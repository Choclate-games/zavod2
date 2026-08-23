import * as THREE from 'three'
import {
  ARC_PREDICTOR,
  DELAYED_CHARGE,
  DOMINO_CHAIN,
  SCORE,
  SESSION,
  SHEAR_CUT,
  STARS,
} from './balance'
import type { EventBus } from './EventBus'
import { GameLoop } from './GameLoop'
import { buildLevel, type LevelSpec } from './levels'
import type { PlaygamaService } from '../platform/PlaygamaService'
import type { StorageService } from '../platform/StorageService'
import type { AudioManager } from '../audio/AudioManager'
import { PhysicsWorld, requiredTiltDv } from '../physics/PhysicsWorld'
import { CuttingImpulseSystem } from '../systems/CuttingImpulseSystem'
import { CenterOfMassArcPredictorSystem } from '../systems/CenterOfMassArcPredictorSystem'
import { DelayedChargeSystem } from '../systems/DelayedChargeSystem'
import { DominoChainEvaluationSystem } from '../systems/DominoChainEvaluationSystem'
import { Building } from '../entities/Building'
import { EntityManager } from '../entities/EntityManager'
import { CameraRig } from '../rendering/CameraRig'
import { GameplayVisuals } from '../rendering/GameplayVisuals'
import { ParticleSystem } from '../rendering/ParticleSystem'
import { SceneManager, type QualityTier } from '../rendering/SceneManager'
import { createBuildingMesh } from '../rendering/ProceduralModels'

export type GamePhase = 'boot' | 'menu' | 'aiming' | 'cascade' | 'result'

type GameHooks = {
  showScreen: (name: 'levelselect' | 'gameplay' | 'victory' | 'defeat' | 'pause') => void
}

const DEBRIS_BUDGET = 96
const MENU_ORBIT_SPEED = 0.05

export class Game {
  private readonly loop: GameLoop
  private readonly physics = new PhysicsWorld()
  private readonly cutting = new CuttingImpulseSystem()
  private readonly arcPredictor = new CenterOfMassArcPredictorSystem()
  private readonly delayed: DelayedChargeSystem
  private domino: DominoChainEvaluationSystem
  private readonly entities = new EntityManager(this.physics, DEBRIS_BUDGET)

  private sceneManager: SceneManager | null = null
  private rig: CameraRig | null = null
  private visuals: GameplayVisuals | null = null
  private particles: ParticleSystem | null = null
  private levelGroup: THREE.Group | null = null

  phase: GamePhase = 'boot'
  pausedByPlatform = false
  pausedByUi = false

  private currentLevelIndex = -1
  private currentSpec: LevelSpec | null = null
  private chargesLeft = 0
  private chargesTotal = 0
  private cascadeActive = false
  private settleTimer = 0
  private settleElapsed = 0
  private aimStartNdc = { x: 0, y: 0 }
  private aimLastPoint = { x: 0, y: 0 }
  private aimingBuilding: Building | null = null
  private readonly raycaster = new THREE.Raycaster()
  private readonly ndc = new THREE.Vector2()
  private readonly meshesByHandle = new Map<number, THREE.Object3D>()
  private readonly tmpPose = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 }
  private menuTime = 0
  private frameTimes = new Float32Array(90)
  private frameCursor = 0
  private qualityCheckCooldown = 3
  private closeView = false

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly events: EventBus,
    private readonly playgama: PlaygamaService,
    private readonly storage: StorageService,
    private readonly audio: AudioManager,
    private readonly hooks: GameHooks,
  ) {
    this.loop = new GameLoop({
      fixedUpdate: (dt) => this.fixedUpdate(dt),
      render: () => this.render(),
      isPaused: () => this.pausedByPlatform || this.pausedByUi,
    })
    this.delayed = new DelayedChargeSystem(events)
    const noopTopple = (): void => undefined
    const noopFx = (): void => undefined
    this.domino = new DominoChainEvaluationSystem(this.physics, events, noopTopple, noopFx)
    this.wireInput()
  }

  async init(report: (fraction: number) => void): Promise<void> {
    report(0.15)
    await this.physics.load()
    report(0.4)
    const isTouchDevice = this.playgama.deviceType !== 'desktop'
    this.sceneManager = new SceneManager(this.canvas, isTouchDevice)
    this.rig = new CameraRig(this.sceneManager)
    this.visuals = new GameplayVisuals(this.sceneManager.scene)
    this.particles = new ParticleSystem(this.sceneManager.scene)
    report(0.65)

    this.domino = new DominoChainEvaluationSystem(
      this.physics,
      this.events,
      (building) => this.onBuildingToppled(building),
      (x, y, z, power) => this.onImpactFx(x, y, z, power),
    )
    // Сцена за меню: живой квартал с медленным облётом камеры.
    this.loadLevelMeshes(buildLevel(0), true)
    this.focusOverview()
    report(0.85)
    window.addEventListener('resize', () => this.sceneManager?.resize())
    this.loop.start()
    report(1)
  }

  private wireInput(): void {
    this.events.on('aim:start', ({ x, y }) => this.onAimStart(x, y))
    this.events.on('aim:move', ({ x, y }) => this.onAimMove(x, y))
    this.events.on('aim:end', () => this.onAimEnd())
    this.events.on('cam:orbit', ({ dx, dy, zoom }) => {
      if (!this.rig) return
      if (zoom !== 0) this.rig.zoom(zoom)
      else this.rig.orbit(dx, dy)
    })
    this.events.on('charge:request', ({ x, y }) => this.onChargeRequest(x, y))
    this.events.on('delay:adjust', ({ delta }) => {
      if (this.phase !== 'aiming') return
      this.delayed.adjust(delta)
      this.events.emit('delay:value', { seconds: Math.round(this.delayed.timerS * 10) / 10 })
    })
    this.events.on('act:restart', () => this.restartLevel())
    this.events.on('act:view', () => this.toggleView())
    this.events.on('act:pause', () => this.togglePause())
    this.events.on('platform:pause', ({ paused }) => {
      this.pausedByPlatform = paused
      if (!paused) this.loop.resetDelta()
    })
  }

  setPausedByUi(paused: boolean): void {
    this.pausedByUi = paused
    if (!paused) this.loop.resetDelta()
  }

  // ── уровень ─────────────────────────────────────────────────────────────

  startLevel(index: number): void {
    this.currentLevelIndex = index
    const spec = buildLevel(index)
    this.currentSpec = spec
    this.entities.loadLevel(spec)
    this.domino.bindLevel(spec, this.entities.buildings)
    this.clearLevelGroup()
    this.loadLevelMeshes(spec, false)
    this.chargesTotal = spec.chargeLimit
    this.chargesLeft = spec.chargeLimit
    this.cascadeActive = false
    this.settleTimer = DOMINO_CHAIN.SETTLE_CHECK_S
    this.settleElapsed = 0
    this.delayed.clear()
    this.delayed.timerS = DELAYED_CHARGE.TIMER_DEFAULT_S
    this.closeView = false
    this.events.emit('delay:value', { seconds: DELAYED_CHARGE.TIMER_DEFAULT_S })
    this.events.emit('charges:changed', { left: this.chargesLeft, total: this.chargesTotal })
    this.events.emit('progress:collapse', { ratio: 0 })
    this.events.emit('level:start', { index })
    this.visuals?.showPerimeter(spec.perimeterRadius)
    this.focusOverview()
    this.phase = 'aiming'
    this.hooks.showScreen('gameplay')
  }

  restartLevel(): void {
    if (this.currentLevelIndex < 0 || this.phase === 'menu') return
    this.cutting.cancelAim()
    this.arcPredictor.clear()
    this.visuals?.hideCutPreview()
    this.visuals?.hideArc()
    this.audio.pumpStop()
    this.entities.restartLevel()
    this.domino.bindLevel(this.currentSpec!, this.entities.buildings)
    for (const building of this.domino.all) {
      building.chargeArmed = false
      building.chainDepth = 0
      building.state = 'standing'
    }
    this.delayed.clear()
    this.chargesLeft = this.chargesTotal
    this.cascadeActive = false
    this.settleTimer = DOMINO_CHAIN.SETTLE_CHECK_S
    this.settleElapsed = 0
    this.events.emit('charges:changed', { left: this.chargesLeft, total: this.chargesTotal })
    this.events.emit('progress:collapse', { ratio: 0 })
    this.phase = 'aiming'
    this.hooks.showScreen('gameplay')
    this.setPausedByUi(false)
  }

  toMenu(): void {
    this.phase = 'menu'
    this.clearLevelGroup()
    this.loadLevelMeshes(buildLevel(0), true)
    this.visuals?.hidePerimeter()
    this.visuals?.hideCutPreview()
    this.visuals?.hideArc()
    this.focusOverview()
    this.hooks.showScreen('levelselect')
  }

  private clearLevelGroup(): void {
    if (this.levelGroup && this.sceneManager) {
      this.sceneManager.scene.remove(this.levelGroup)
    }
    this.levelGroup = new THREE.Group()
    this.meshesByHandle.clear()
  }

  private loadLevelMeshes(spec: LevelSpec, isMenuBackdrop: boolean): void {
    this.clearLevelGroup()
    for (const building of spec.buildings) {
      const mesh = createBuildingMesh(building)
      mesh.position.set(building.x, 0, building.z)
      mesh.userData.handle = -1
      this.levelGroup!.add(mesh)
      if (!isMenuBackdrop) {
        const handle = this.entities.buildings[this.meshesByHandle.size]?.handle ?? -1
        mesh.userData.handle = handle
        if (handle >= 0) this.meshesByHandle.set(handle, mesh)
      }
    }
    this.sceneManager!.scene.add(this.levelGroup!)
  }

  private focusOverview(): void {
    const spec = this.currentSpec
    const centerX = spec ? spec.buildings.reduce((sum, b) => sum + b.x, 0) / spec.buildings.length : 0
    const centerZ = spec ? spec.buildings.reduce((sum, b) => sum + b.z, 0) / spec.buildings.length : 0
    this.rig?.focusOn(centerX, 16, centerZ, spec ? 70 + spec.buildings.length * 9 : 130)
  }

  private toggleView(): void {
    this.closeView = !this.closeView
    if (this.closeView && this.aimingBuilding) {
      const s = this.aimingBuilding.spec
      this.rig?.focusOn(s.x, s.h * 0.35, s.z, s.h * 1.6)
    } else {
      this.focusOverview()
    }
  }

  togglePause(): void {
    if (this.phase === 'result') return
    if (this.pausedByUi) {
      this.setPausedByUi(false)
      this.hooks.showScreen('gameplay')
    } else if (this.phase === 'aiming' || this.phase === 'cascade') {
      this.setPausedByUi(true)
      this.hooks.showScreen('pause')
    }
  }

  // ── прицеливание ────────────────────────────────────────────────────────

  private pickBuilding(clientX: number, clientY: number): Building | null {
    const manager = this.sceneManager
    if (!manager || this.phase !== 'aiming') return null
    const rect = this.canvas.getBoundingClientRect()
    this.ndc.x = ((clientX - rect.left) / Math.max(1, rect.width)) * 2 - 1
    this.ndc.y = -((clientY - rect.top) / Math.max(1, rect.height)) * 2 + 1
    this.raycaster.setFromCamera(this.ndc, manager.camera)
    const targets: THREE.Object3D[] = []
    for (const building of this.domino.all) {
      if (building.state !== 'standing') continue
      const mesh = this.meshesByHandle.get(building.handle)
      if (mesh) targets.push(mesh)
    }
    const hits = this.raycaster.intersectObjects(targets, true)
    const first = hits[0]
    if (!first) return null
    let object: THREE.Object3D | null = first.object
    while (object && object.userData.handle === undefined) object = object.parent
    const handle = object?.userData.handle as number | undefined
    if (handle === undefined || handle < 0) return null
    return this.domino.all.find((b) => b.handle === handle) ?? null
  }

  private onAimStart(x: number, y: number): void {
    if (this.phase !== 'aiming' || this.pausedByUi) return
    const building = this.pickBuilding(x, y)
    if (!building) return
    this.aimingBuilding = building
    this.aimStartNdc.x = x
    this.aimStartNdc.y = y
    this.aimLastPoint.x = x
    this.aimLastPoint.y = y
    this.cutting.beginAim(building)
    this.audio.pumpStart()
  }

  private onAimMove(x: number, y: number): void {
    if (!this.cutting.active || !this.aimingBuilding || !this.rig || !this.visuals) return
    const dxScreen = x - this.aimStartNdc.x
    const dyScreen = y - this.aimStartNdc.y
    this.aimLastPoint.x = x
    this.aimLastPoint.y = y
    this.cutting.updateAim(dxScreen, dyScreen, this.rig.currentYaw)
    const plan = this.cutting.plan
    const spec = plan.building.spec
    const cutY = plan.cutHeightM
    this.visuals.highlightBuilding(spec.x, spec.z, spec.w, spec.h, spec.d, true)
    this.visuals.setCutPreview(
      spec.x, cutY, spec.z, plan.fallDirX, plan.fallDirZ, spec.w + 6, false,
    )
    this.arcPredictor.predict(plan, this.rig.currentYaw)
    const landingDistSq =
      this.arcPredictor.landingX ** 2 + this.arcPredictor.landingZ ** 2
    const danger =
      landingDistSq > (this.domino.perimeterRadius * (1 + ARC_PREDICTOR.NOISE_FRACTION)) ** 2
    this.visuals.setArc(this.arcPredictor.positions, danger)
    this.audio.pumpUpdate(plan.angleDeg)
  }

  private onAimEnd(): void {
    if (!this.cutting.active) return
    this.audio.pumpStop()
    this.visuals?.hideCutPreview()
    this.visuals?.hideArc()
    this.visuals?.highlightBuilding(0, 0, 0, 0, 0, false)
    const plan = this.cutting.endAim()
    this.aimingBuilding = null
    if (!plan || this.phase !== 'aiming' || this.chargesLeft <= 0) return
    this.fireCut(plan.building, plan.fallDirX, plan.fallDirZ, plan.cutHeightM)
  }

  /** Пуск гидравлического клина: F_shear превращается в импульс у точки среза. */
  private fireCut(building: Building, dirX: number, dirZ: number, cutHeightM: number): void {
    this.chargesLeft--
    this.events.emit('charges:changed', { left: this.chargesLeft, total: this.chargesTotal })
    this.physics.setDynamic(building.handle, true)
    building.state = 'falling'
    building.chainDepth = 0
    const mass = this.physics.massOf(building.handle)
    const s = building.spec
    // Импульс клина обязан перекрыть энергетический барьер опрокидывания;
    // 850 кН с запасом фактора безопасности дают нужное приращение скорости.
    const barrier = requiredTiltDv(s.w, s.d, s.h)
    const dvWanted = Math.min(
      8,
      Math.max(barrier * 1.7, (SHEAR_CUT.WEDGE_IMPULSE_KN * 1000 * 2.2) / mass),
    )
    const scale = dvWanted * mass
    // Импульс прикладывается выше центра масс: так верхушка получает момент
    // в сторону вектора среза и башня кренится вперёд, а не уезжает фундаментом.
    const shoulderY = Math.max(cutHeightM + 1, building.spec.h * 0.72)
    this.physics.applyImpulseAt(
      building.handle,
      dirX * scale,
      scale * 0.12,
      dirZ * scale,
      building.spec.x + dirX * 2,
      shoulderY,
      building.spec.z + dirZ * 2,
    )
    this.cascadeActive = true
    this.settleTimer = 0
    this.settleElapsed = 0
    this.phase = 'cascade'
    this.audio.plasmaCut()
    this.audio.metalGroan()
    this.audio.wedgeThud(0.7)
    this.particles?.spawnDustRing(building.spec.x, cutHeightM, building.spec.z, 0.8)
    this.rig?.snapFocus(building.spec.x + dirX * building.spec.h * 0.5, building.spec.h * 0.3, building.spec.z + dirZ * building.spec.h * 0.5)
  }

  private onChargeRequest(x: number, y: number): void {
    if (this.phase !== 'aiming') return
    const index = this.currentLevelIndex + 1
    if (index < DELAYED_CHARGE.UNLOCK_LEVEL) return
    if (this.delayed.hasCharge || this.chargesLeft <= 0) return
    const building = this.pickBuilding(x, y)
    if (!building) return
    if (this.delayed.place(building)) {
      this.audio.chargeArm()
      this.events.emit('delay:value', { seconds: Math.round(this.delayed.timerS * 10) / 10 })
    }
  }

  private onBuildingToppled(building: Building): void {
    this.audio.metalGroan()
    this.particles?.spawnDustRing(building.spec.x, 2, building.spec.z, 1)
    this.settleTimer = DOMINO_CHAIN.SETTLE_CHECK_S
    this.settleElapsed = 0
    if (this.closeView) return
    this.rig?.snapFocus(building.spec.x, building.spec.h * 0.25, building.spec.z)
  }

  private onImpactFx(x: number, y: number, z: number, power: number): void {
    this.audio.wedgeThud(power)
    this.particles?.spawnDebris(x, y, z, power)
    this.particles?.spawnDustRing(x, Math.min(y, 6), z, power)
    this.rig?.addShake(power)
  }

  // ── кадр ────────────────────────────────────────────────────────────────

  private fixedUpdate(dt: number): void {
    if (!this.physics.isReady || !this.rig || !this.particles) return
    if (this.phase === 'menu') {
      this.menuTime += dt
      this.rig.orbit(MENU_ORBIT_SPEED * dt * 60, 0)
      this.syncMeshes()
      this.particles.update(dt)
      if (Math.random() < dt * 2.5) {
        this.particles.spawnDustRing((Math.random() - 0.5) * 40, 6 + Math.random() * 20, (Math.random() - 0.5) * 30, 0.12)
      }
      return
    }
    if (this.phase === 'aiming' || this.phase === 'cascade') {
      this.physics.step()
      if (this.cascadeActive) {
        const detonate = this.delayed.update(true, dt)
        if (detonate) {
          const target = this.findStandingByArmedFlag()
          if (target) {
            const neighbor = this.nearestNeighbor(target)
            const dx = neighbor ? neighbor.spec.x - target.spec.x : 1
            const dz = neighbor ? neighbor.spec.z - target.spec.z : 0
            const len = Math.max(0.001, Math.hypot(dx, dz))
            this.fireDelayedTopple(target, dx / len, dz / len)
          }
        }
      }
      this.domino.update()
      if (this.cascadeActive) {
        if (this.domino.isSettled()) {
          this.settleElapsed += dt
          if (this.settleElapsed >= 1.1) this.evaluateResult()
        } else {
          this.settleElapsed = 0
          this.settleTimer -= dt
          if (this.settleTimer <= 0) this.evaluateResult()
        }
      }
    }
    this.syncMeshes()
    this.particles.update(dt)
    this.monitorQuality(dt)
  }

  private findStandingByArmedFlag(): Building | null {
    for (const building of this.domino.all) {
      if (building.chargeArmed && building.state === 'standing') return building
    }
    return null
  }

  private nearestNeighbor(of: Building): Building | null {
    let best: Building | null = null
    let bestDist = Infinity
    for (const other of this.domino.all) {
      if (other === of || other.state !== 'standing') continue
      const d = (other.spec.x - of.spec.x) ** 2 + (other.spec.z - of.spec.z) ** 2
      if (d < bestDist) {
        bestDist = d
        best = other
      }
    }
    return best
  }

  private fireDelayedTopple(target: Building, dirX: number, dirZ: number): void {
    target.state = 'falling'
    target.chainDepth = 1
    this.physics.setDynamic(target.handle, true)
    const s = target.spec
    const dvWanted = Math.min(8, requiredTiltDv(s.w, s.d, s.h) * 1.5)
    const kick = dvWanted * this.physics.massOf(target.handle)
    this.physics.applyImpulseAt(
      target.handle,
      dirX * kick,
      kick * 0.05,
      dirZ * kick,
      target.spec.x,
      target.spec.h * 0.45,
      target.spec.z,
    )
    this.audio.plasmaCut()
    this.particles?.spawnDustRing(target.spec.x, 2, target.spec.z, 0.7)
  }

  private evaluateResult(): void {
    if (this.phase === 'result') return
    const ratio = this.domino.collapseRatio
    const breach = this.domino.breachDetected
    const win = ratio >= SESSION.WIN_RATIO && !breach
    if (!win && this.chargesLeft > 0 && !breach) {
      // Заряды ещё есть — попытка продолжается, игрок перезаряжает прицел.
      this.cascadeActive = false
      this.settleTimer = DOMINO_CHAIN.SETTLE_CHECK_S
      this.settleElapsed = 0
      this.phase = 'aiming'
      return
    }
    this.phase = 'result'
    const score = Math.round(
      SCORE.COLLAPSE_WEIGHT * ratio +
        (win ? this.chargesLeft * SCORE.UNUSED_CHARGE_BONUS : 0) -
        (breach ? SCORE.PERIMETER_BREACH_PENALTY : 0) +
        this.domino.maxChainDepth * SCORE.CHAIN_COMBO_BONUS,
    )
    let starsCount = 1
    if (score >= STARS.THREE_MIN_SCORE) starsCount = 3
    else if (score >= STARS.TWO_MIN_SCORE) starsCount = 2
    if (!win) starsCount = 0
    if (win) {
      this.storage.setStars(this.currentLevelIndex, starsCount)
      this.audio.victoryChord()
      this.hooks.showScreen('victory')
    } else {
      this.audio.defeatTone()
      this.hooks.showScreen('defeat')
    }
    this.events.emit('level:result', { win, ratio, score, stars: starsCount, breach })
  }

  /** Кнопка rewarded-награды: клик уже был, награда подтверждена состоянием моста. */
  async grantExtraWedge(): Promise<boolean> {
    const granted = await this.playgama.showRewarded()
    if (!granted) return false
    if (this.phase !== 'result') return false
    this.chargesLeft++
    this.chargesTotal++
    this.cascadeActive = false
    this.settleTimer = DOMINO_CHAIN.SETTLE_CHECK_S
    this.settleElapsed = 0
    this.phase = 'aiming'
    this.events.emit('charges:changed', { left: this.chargesLeft, total: this.chargesTotal })
    this.hooks.showScreen('gameplay')
    return true
  }

  private syncMeshes(): void {
    for (const [handle, mesh] of this.meshesByHandle) {
      if (this.physics.isFixed(handle)) continue
      if (!this.physics.syncPose(handle, this.tmpPose)) continue
      mesh.position.set(this.tmpPose.x, this.tmpPose.y, this.tmpPose.z)
      mesh.quaternion.set(this.tmpPose.qx, this.tmpPose.qy, this.tmpPose.qz, this.tmpPose.qw)
    }
  }

  /** Адаптивное качество сходится: шаг вниз при перегрузе, вверх при запасе. */
  private monitorQuality(dt: number): void {
    if (!this.sceneManager) return
    this.frameTimes[this.frameCursor % this.frameTimes.length] = dt
    this.frameCursor++
    this.qualityCheckCooldown -= dt
    if (this.qualityCheckCooldown > 0) return
    this.qualityCheckCooldown = 3
    let sum = 0
    let count = 0
    for (let i = 0; i < this.frameTimes.length; i++) {
      const value = this.frameTimes[i]
      if (value === undefined || value <= 0) continue
      sum += value
      count++
    }
    if (count < 60) return
    const average = sum / count
    const tierOrder: QualityTier[] = ['low', 'medium', 'high']
    const currentIndex = tierOrder.indexOf(this.sceneManager.currentQuality)
    if (average > 1 / 48 && currentIndex > 0) {
      this.sceneManager.setQuality(tierOrder[currentIndex - 1]!)
    } else if (average < 1 / 58 && currentIndex < tierOrder.length - 1) {
      this.sceneManager.setQuality(tierOrder[currentIndex + 1]!)
    }
  }

  private render(): void {
    if (!this.sceneManager || !this.rig) return
    this.rig.update(1 / PERFORMANCE_RENDER_HZ)
    this.sceneManager.render()
  }
}

const PERFORMANCE_RENDER_HZ = 60
