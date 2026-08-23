import * as THREE from 'three'
import { BALANCE } from '../config/balance.js'
import type { EventBus, FailReasonKey, GameState, RunStats } from './EventBus.js'
import { GameLoop } from './GameLoop.js'
import type { InputRouter } from '../input/InputRouter.js'
import type { AudioManager } from '../audio/AudioManager.js'
import type { StorageService } from '../platform/StorageService.js'
import { PhysicsWorld } from '../physics/PhysicsWorld.js'
import RAPIER from '@dimforge/rapier3d-compat'
import {
  buildPavilion,
  type PavilionLayout,
} from '../rendering/PavilionScene.js'
import { VfxSystem } from '../rendering/VfxSystem.js'
import { PlayerController } from '../game/PlayerController.js'
import { SaboteurSystem } from '../game/SaboteurSystem.js'
import { GateSystem } from '../game/GateSystem.js'
import { DirectorSystem } from '../game/DirectorSystem.js'
import { WeaponSystem } from '../game/WeaponSystem.js'
import { Viewmodel } from '../game/Viewmodel.js'

/**
 * Координатор игры: машина состояний дубля, порядок кадра
 * (ввод → логика → физика → синхронизация мешей → камера → рендер)
 * и адаптивное качество.
 */

interface QualityLevel {
  pixelRatio: number
  shadows: boolean
}

export class Game {
  private readonly renderer: THREE.WebGLRenderer
  private readonly scene = new THREE.Scene()
  private readonly camera = new THREE.PerspectiveCamera(BALANCE.player.aimFovDeg, 1, 0.05, 220)

  private readonly loop: GameLoop
  private readonly physics = new PhysicsWorld()

  private layout!: PavilionLayout
  private vfx!: VfxSystem
  private player!: PlayerController
  private viewmodel!: Viewmodel
  private saboteurs!: SaboteurSystem
  private gates!: GateSystem
  private director!: DirectorSystem
  private weapon!: WeaponSystem

  private state: GameState = 'MENU'
  private menuTimeS = 0
  private timerEmitAccumulator = 0
  private objectiveAccumulator = 0
  private lastZoomActive = false

  private runStartMs = 0
  private pendingFinish: { win: boolean; reasonKey: FailReasonKey | null } | null = null

  // Адаптивное качество: старт с полного качества и ступенчатое снижение.
  private readonly initialQualityIndex: number
  private qualityIndex: number
  private readonly qualityLevels: QualityLevel[]
  private fpsSamples: number[] = []
  private panelHz = 60
  private readonly hzSamples: number[] = []
  private hzMeasured = false
  private ascentProbeUntilMs = 0
  private nextAscentProbeAtMs = 0
  private descentCooldownUntilMs = 0

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly events: EventBus,
    private readonly input: InputRouter,
    private readonly audio: AudioManager,
    private readonly storage: StorageService,
    isTouchScheme: boolean,
  ) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isTouchScheme,
      powerPreference: 'high-performance',
    })
    // В собранной версии отключаем пост-линковую проверку программ:
    // программный GL (SwiftShader) отвечает VALIDATE_STATUS false с пустым
    // логом на корректно рисующие программы и засоряет консоль.
    this.renderer.debug.checkShaderErrors = import.meta.env.DEV
    const dpr = window.devicePixelRatio || 1
    this.qualityLevels = [
      { pixelRatio: Math.min(dpr, isTouchScheme ? 1.5 : 2), shadows: true },
      { pixelRatio: Math.min(dpr, 1.25), shadows: true },
      { pixelRatio: 1, shadows: false },
      { pixelRatio: 0.85, shadows: false },
    ]
    this.initialQualityIndex = 0
    this.qualityIndex = 0
    this.applyQuality(this.qualityLevels[0])

    this.loop = new GameLoop(
      (stepS) => this.fixedUpdate(stepS),
      (alpha, dtS) => this.renderFrame(alpha, dtS),
    )
  }

  async init(onProgress: (percent: number) => void): Promise<void> {
    onProgress(40)
    await this.physics.init()
    onProgress(60)

    this.scene.background = new THREE.Color(0x101216)
    this.scene.fog = new THREE.Fog(0x101216, 40, 120)
    // Металл в сцене держится на metalness ≤ 0.4: без scene.environment он
    // остаётся читаемым и не требует PMREM-прогона шейдеров на слабом GPU.

    const hemi = new THREE.HemisphereLight(0x8fa3c0, 0x1c1a17, 0.55)
    this.scene.add(hemi)
    const keyLight = new THREE.DirectionalLight(0xbfd4ff, 1.1)
    keyLight.position.set(14, 22, -10)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.set(1024, 1024)
    keyLight.shadow.camera.left = -30
    keyLight.shadow.camera.right = 30
    keyLight.shadow.camera.top = 30
    keyLight.shadow.camera.bottom = -110
    keyLight.shadow.camera.far = 160
    this.scene.add(keyLight)
    this.keyLight = keyLight
    const fillLight = new THREE.AmbientLight(0xffe2b8, 0.18)
    this.scene.add(fillLight)

    const built = buildPavilion(this.scene)
    this.layout = built.layout

    this.vfx = new VfxSystem()
    this.scene.add(this.vfx.points, this.vfx.tracerLines)

    this.player = new PlayerController(this.physics, this.input, this.camera)
    // Камера должна жить в графе сцены, иначе вьюмодель-ребёнок не рисуется.
    this.scene.add(this.player.yawObject)
    this.viewmodel = new Viewmodel()
    this.camera.add(this.viewmodel.root)

    this.saboteurs = new SaboteurSystem(this.scene, {
      onShotAtPlayer: (fx, fy, fz, missFirst) => {
        this.saboteurs.launchBolt(fx, fy, fz, missFirst)
        this.audio.playWarnLate()
      },
      onChargeArmed: () => {
        this.director.registerCharge()
        this.emitCharges()
      },
      onKilled: () => {
        this.audio.playCollapse(0.5)
        this.director.registerKill()
      },
    })

    this.gates = new GateSystem(
      this.scene,
      this.physics,
      this.layout,
      (kind, x, y, z) => {
        this.vfx.spawnBurst(x, y, z, 0, 1, 0, kind === 'panel' ? 26 : 16, 6, kind === 'panel' ? 0xcfc6b4 : 0x9ecbff, 0.8, Math.PI)
        this.vfx.spawnBurst(x, y - 0.4, z, 0, 0.6, 0, 12, 1.6, 0x8a8074, 1.6, Math.PI)
        this.audio.playCollapse(kind === 'panel' ? 1 : 0.5)
        // Тряска камеры от обрушения — слабый подброс той же пружиной.
        this.player.applyRecoilKick(kind === 'panel' ? 0.6 : 0.35)
      },
      () => this.audio.playChainCrack(),
    )

    this.director = new DirectorSystem(
      this.layout, this.gates, this.saboteurs, this.audio, this.scene,
    )
    this.director.onProgressChanged = () => {
      this.events.emit('route:progress', {
        pointsDone: this.director.pointsVisited,
        pointsTotal: BALANCE.session.pointsTotal,
      })
    }
    this.director.onFinish = (win, reasonKey) => {
      this.pendingFinish = { win, reasonKey }
    }

    this.weapon = new WeaponSystem(
      this.player, this.physics, this.saboteurs, this.gates, this.vfx, this.audio,
    )
    this.weapon.onShotResolved = (outcome) => {
      if (outcome === 'headshot' || outcome === 'body') {
        this.events.emit('hitmarker:shown', { headshot: outcome === 'headshot' })
      }
    }
    this.weapon.onAmmoChanged = (current, capacity) => {
      this.events.emit('ammo:changed', { current, capacity })
    }
    this.weapon.onOutOfAmmo = () => {
      this.finishRun(false, 'fail_ammo')
    }

    this.player.spawn(0, 0)
    this.player.onFootstep = () => this.audio.playFootstep()

    onProgress(80)
    this.handleResize()
    window.addEventListener('resize', () => this.handleResize())
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', () => this.handleResize())
    }
    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault())

    // Pointer lock запрашивается только в десктопной схеме и из обработчика нажатия.
    this.canvas.addEventListener('pointerdown', () => {
      if (
        this.input.scheme === 'desktop' &&
        this.state === 'PLAYING' &&
        document.pointerLockElement !== this.canvas
      ) {
        void this.canvas.requestPointerLock()
      }
    })

    onProgress(92)
    this.loop.start()
    onProgress(100)
  }

  private keyLight: THREE.DirectionalLight | null = null

  /* ── Состояния ─────────────────────────────────────────────────────────── */

  get currentState(): GameState {
    return this.state
  }

  setState(state: GameState): void {
    if (this.state === state) return
    this.state = state
    this.events.emit('state:changed', { state })
  }

  startRun(): void {
    this.weapon.reset()
    this.saboteurs.resetAll()
    this.gates.resetAll()
    this.director.reset()
    this.player.teleportTo(0, 0)
    this.emitCharges()
    this.events.emit('marks:changed', { hits: 0, max: BALANCE.session.maxPlayerHits })
    this.events.emit('route:progress', { pointsDone: 0, pointsTotal: BALANCE.session.pointsTotal })
    this.events.emit('objective:changed', { textKey: 'objective_move_on' })
    this.events.emit('timer:tick', { secondsLeft: BALANCE.session.timeLimitS })
    this.runStartMs = performance.now()
    this.setState('PLAYING')
  }

  finishRun(win: boolean, reasonKey: FailReasonKey | null): void {
    if (this.state !== 'PLAYING') return
    if (document.pointerLockElement) document.exitPointerLock()
    const timeMs = performance.now() - this.runStartMs
    const secondsLeft = Math.floor(BALANCE.session.timeLimitS - timeMs / 1000)
    const rating = win
      ? BALANCE.rating.completionBase +
        Math.max(0, secondsLeft) * BALANCE.rating.perSecondLeft +
        this.weapon.headshots * BALANCE.rating.perHeadshot -
        this.director.marksTaken * BALANCE.rating.perHitMarkPenalty
      : 0
    const bestBefore = this.storage.snapshot.bestTimeMs
    let newRecord = false
    if (win) {
      if (bestBefore == null || timeMs < bestBefore) {
        newRecord = true
        this.storage.update((data) => {
          data.bestTimeMs = timeMs
        })
      }
    }
    const stats: RunStats = {
      timeMs,
      shots: this.weapon.shotsFired,
      hitsBody: this.weapon.hitsBody - this.weapon.headshots,
      headshots: this.weapon.headshots,
      rating,
      bestTimeMs: this.storage.snapshot.bestTimeMs,
      newRecord,
    }

    if (win) this.audio.playVictory()
    else if (reasonKey === 'fail_ammo') this.audio.playFailAmmo()
    else if (reasonKey === 'fail_hits') this.audio.playFailHits()
    else if (reasonKey === 'fail_time') this.audio.playAlarm()

    this.events.emit('run:finished', { win, reasonKey, stats })
    this.setState(win ? 'VICTORY' : 'FAIL')
  }

  pause(): void {
    if (this.state !== 'PLAYING') return
    if (document.pointerLockElement) document.exitPointerLock()
    this.setState('PAUSED')
  }

  resume(): void {
    if (this.state !== 'PAUSED') return
    this.loop.resetDelta()
    this.setState('PLAYING')
  }

  returnToMenu(): void {
    this.loop.resetDelta()
    this.setState('MENU')
  }

  /** Возврат вкладки: накопитель дельты сбрасывается, физику не швыряет. */
  onPageVisible(): void {
    this.loop.resetDelta()
    this.input.releaseAll()
  }

  /* ── Кадр ──────────────────────────────────────────────────────────────── */

  private fixedUpdate(stepS: number): void {
    if (this.state === 'PAUSED') return

    this.menuTimeS += stepS
    this.weapon.fixedUpdate(stepS)
    this.gates.fixedUpdate(stepS)

    if (this.state === 'PLAYING') {
      if (this.input.pausePressed) {
        this.pause()
        return
      }
      this.input.consumeFrameInput()
      this.player.fixedUpdate(stepS)
      if (this.input.firePressed) this.weapon.tryFire()
      this.saboteurs.notifyPlayerPosition(this.player.position)
      const px = this.player.position.x
      const py = this.player.position.y
      const pz = this.player.position.z
      this.saboteurs.fixedUpdate(stepS, this.player.position, (fx, fy, fz) =>
        this.hasLineOfSight(fx, fy, fz, px, py + 0.4, pz),
      )

      if (this.saboteurs.playerWasHit) {
        this.saboteurs.playerWasHit = false
        if (!this.director.registerPlayerHit()) {
          this.audio.playPlayerHit()
        }
        this.events.emit('marks:changed', {
          hits: this.director.marksTaken,
          max: BALANCE.session.maxPlayerHits,
        })
      }

      // Физика шагает после логики; меши синхронизируются после мира.
      this.physics.step()
      this.gates.syncMeshes()
      this.director.fixedUpdate(stepS, pz, px)

      if (this.pendingFinish) {
        const finish = this.pendingFinish
        this.pendingFinish = null
        this.finishRun(finish.win, finish.reasonKey)
        return
      }

      // Таймер и цель режиссёра обновляются порциями, не каждый кадр DOM-ом.
      this.timerEmitAccumulator += stepS
      if (this.timerEmitAccumulator >= 0.25) {
        this.timerEmitAccumulator = 0
        this.events.emit('timer:tick', { secondsLeft: Math.ceil(this.director.secondsLeft) })
      }
      this.objectiveAccumulator += stepS
      if (this.objectiveAccumulator >= 0.5) {
        this.objectiveAccumulator = 0
        const aliveNearby = this.anySaboteurNearby()
        this.events.emit('objective:changed', { textKey: this.director.objectiveKey(aliveNearby) })
      }
      return
    }

    // MENU / VICTORY / FAIL: живая сцена за меню на сниженной нагрузке.
    this.physics.step()
    this.gates.syncMeshes()
  }

  private anySaboteurNearby(): boolean {
    const p = this.player.position
    let found = false
    this.saboteurs.forEachAlive((e) => {
      if (Math.hypot(e.group.position.x - p.x, e.group.position.z - p.z) < 26) found = true
    })
    return found || this.director.hasPendingEntries()
  }

  private hasLineOfSight(fx: number, fy: number, fz: number, tx: number, ty: number, tz: number): boolean {
    const dx = tx - fx
    const dy = ty - fy
    const dz = tz - fz
    const dist = Math.hypot(dx, dy, dz)
    if (dist < 0.001) return true
    losRay.origin.x = fx
    losRay.origin.y = fy
    losRay.origin.z = fz
    losRay.dir.x = dx / dist
    losRay.dir.y = dy / dist
    losRay.dir.z = dz / dist
    let toi = dist
    if (this.player.collider) {
      toi = this.physics.castRayExclude(losRay, dist, this.player.collider)
    }
    return toi >= dist - 0.4
  }

  private renderFrame(alpha: number, dtS: number): void {
    this.measurePanelHz(dtS)

    if (this.state === 'MENU') {
      // Медленный дрейф камеры по павильону — сцена за меню живёт.
      const t = this.menuTimeS * 0.12
      this.player.yawObject.position.set(Math.sin(t) * 2.4, 2.1, -4 + Math.cos(t * 0.8) * 2)
      this.player.yawObject.rotation.y = Math.PI + Math.sin(t * 0.9) * 0.35
      this.camera.position.set(0, 0, 0)
      this.camera.rotation.set(-0.12, 0, 0)
      this.viewmodel.root.visible = false
    } else {
      this.viewmodel.root.visible = this.state === 'PLAYING'
      const zoomActive = this.input.zoomHeld
      if (zoomActive !== this.lastZoomActive) {
        this.lastZoomActive = zoomActive
        this.events.emit('zoom:changed', { active: zoomActive })
      }
      this.player.updateCamera(alpha, zoomActive)
      this.viewmodel.update(0, zoomActive)
    }

    this.vfx.update(dtS)
    this.adaptQuality(dtS)
    this.renderer.render(this.scene, this.camera)
  }

  /* ── Адаптивное качество ───────────────────────────────────────────────── */

  private measurePanelHz(dtS: number): void {
    if (this.hzMeasured) return
    if (dtS > 0.0005) this.hzSamples.push(dtS)
    if (this.hzSamples.length >= 60) {
      // Частота панели = минимальный чистый интервал rAF за первые ~60 замеров.
      const minInterval = Math.min(...this.hzSamples)
      this.panelHz = Math.max(30, Math.min(BALANCE.performance.targetFps, Math.round(1 / minInterval)))
      this.hzMeasured = true
    }
  }

  private adaptQuality(dtS: number): void {
    const now = performance.now()
    this.fpsSamples.push(dtS)
    if (this.fpsSamples.length > 150) this.fpsSamples.shift()
    if (now < this.descentCooldownUntilMs && now < this.nextAscentProbeAtMs) return

    const targetInterval = 1 / this.panelHz
    if (this.fpsSamples.length >= 90) {
      const sorted = [...this.fpsSamples].sort((a, b) => a - b)
      const median = sorted[Math.floor(sorted.length / 2)]

      if (median > targetInterval * 1.28 && this.qualityIndex < this.qualityLevels.length - 1 && now > this.descentCooldownUntilMs) {
        this.qualityIndex++
        this.applyQuality(this.qualityLevels[this.qualityIndex])
        this.descentCooldownUntilMs = now + 4000
        this.fpsSamples.length = 0
        return
      }

      // Подъём — оптимистичным зондом: пробуем выше и смотрим на фактический кадр.
      if (
        this.qualityIndex > this.initialQualityIndex &&
        median <= targetInterval * 1.05 &&
        now > this.nextAscentProbeAtMs &&
        now > this.descentCooldownUntilMs
      ) {
        this.qualityIndex--
        this.applyQuality(this.qualityLevels[this.qualityIndex])
        this.ascentProbeUntilMs = now + 3000
        this.nextAscentProbeAtMs = now + 12000
        this.fpsSamples.length = 0
        return
      }
    }

    if (this.ascentProbeUntilMs > 0 && now > this.ascentProbeUntilMs) {
      // Зонд не удержал кадр — откатываемся и запираем подъём.
      if (this.fpsSamples.length > 30) {
        const sorted = [...this.fpsSamples].sort((a, b) => a - b)
        const median = sorted[Math.floor(sorted.length / 2)]
        if (median > targetInterval * 1.15 && this.qualityIndex < this.initialQualityIndex) {
          this.qualityIndex++
          this.applyQuality(this.qualityLevels[this.qualityIndex])
          this.descentCooldownUntilMs = now + 8000
        }
      }
      this.ascentProbeUntilMs = 0
    }
  }

  private applyQuality(level: QualityLevel): void {
    this.renderer.setPixelRatio(level.pixelRatio)
    if (this.keyLight) this.keyLight.castShadow = level.shadows
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.isMesh) {
        const material = mesh.material as THREE.Material | THREE.Material[]
        if (Array.isArray(material)) material.forEach((m) => (m.needsUpdate = true))
        else material.needsUpdate = true
      }
    })
    this.handleResize()
  }

  handleResize(): void {
    const viewport = window.visualViewport
    const w = viewport ? viewport.width : window.innerWidth
    const h = viewport ? viewport.height : window.innerHeight
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / Math.max(1, h)
    this.camera.updateProjectionMatrix()
    document.documentElement.style.setProperty('--app-height', `${Math.round(h)}px`)
  }

  emitCharges(): void {
    this.events.emit('charges:changed', {
      charges: this.director.chargesArmed,
      max: BALANCE.session.maxCharges,
    })
  }

  dispose(): void {
    this.loop.stop()
    this.renderer.dispose()
  }
}

const losRay = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 1 })
