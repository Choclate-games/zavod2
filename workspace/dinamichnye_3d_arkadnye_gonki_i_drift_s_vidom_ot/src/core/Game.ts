import * as THREE from 'three'
import { EventBus } from './EventBus'
import { GameLoop } from './GameLoop'
import { InputRouter } from './InputRouter'
import { SceneManager } from '../rendering/SceneManager'
import { CameraRig } from '../rendering/CameraRig'
import { TrackBuilder, type TrackData } from '../rendering/TrackBuilder'
import { buildTruck, buildScenery, type TruckModel } from '../rendering/ProceduralModels'
import { ParticleSystem } from '../rendering/ParticleSystem'
import { PlayerVehicle, type VehicleTelemetry } from '../entities/Player'
import { EntityManager } from '../entities/EntityManager'
import { SloshSystem } from '../systems/SloshSystem'
import { RaceSystem } from '../systems/RaceSystem'
import { AudioManager } from '../audio/AudioManager'
import { balance } from '../data/balance'
import { TRACKS, type TrackDef } from '../data/tracks'
import type { StorageService } from '../platform/StorageService'

export type GameState = 'menu' | 'trackSelect' | 'countdown' | 'racing' | 'paused' | 'results' | 'crashed'

/**
 * Координатор игры: состояния сессии, фиксированный шаг физики и рендер.
 * Ядро не знает про площадку: всё внешнее приходит через сервисы и шину.
 */
export class Game {
  readonly bus = new EventBus()
  readonly loop: GameLoop
  readonly audio = new AudioManager()

  private manager: SceneManager
  private cameraRig: CameraRig
  private particles: ParticleSystem
  private entities: EntityManager
  private track: TrackData | null = null
  private builder: TrackBuilder | null = null
  private sceneryGroup: THREE.Group | null = null
  private truck: TruckModel | null = null
  private vehicle: PlayerVehicle | null = null
  private slosh = new SloshSystem(this.bus)
  private race: RaceSystem | null = null
  private currentTrackIndex = 0
  private stateValue: GameState = 'menu'
  private pausedByPlatform = false
  private pausedByModal = false
  private reviveUsed = false
  private wrongWayShownAt = -10
  private lastCountdownInt = 4
  private readonly telemetry: VehicleTelemetry = {
    speedKmh: 0, slipAngleDeg: 0, rollDeg: 0, dEdge: 99,
    surfaceIce: false, wheelsGrounded: 6,
  }
  private readonly inputSnapshot = {
    steer: 0, throttle: 0, brake: 0, handbrake: false,
  }

  constructor(
    canvasParent: HTMLElement,
    readonly input: InputRouter,
    private readonly storage: StorageService,
  ) {
    this.manager = new SceneManager(canvasParent)
    this.cameraRig = new CameraRig(this.manager.camera)
    this.particles = new ParticleSystem(this.manager.scene)
    this.entities = new EntityManager(this.particles)
    this.loop = new GameLoop(
      (step) => this.fixedTick(step),
      (alpha) => this.frameRender(alpha),
    )

    this.bus.on('slosh:impact', ({ strength }) => {
      this.audio.thud(strength)
      this.cameraRig.shake(strength)
    })
    this.bus.on('drift:scored', ({ multiplier }) => this.audio.driftTick(Math.min(1, multiplier / 4)))
    this.bus.on('race:checkpoint', () => this.audio.beep(740))
    this.bus.on('vehicle:crashed', () => {
      this.audio.stopSkid()
      this.audio.thud(1)
    })
    this.bus.on('race:finished', (result) => {
      this.audio.fanfare(result.win)
      this.audio.stopEngine()
      this.audio.stopSkid()
      this.saveRunResult(result.time, result.score, result.stars, result.win)
    })

    window.addEventListener('resize', () => this.manager.resize(window.innerWidth, window.innerHeight))
    this.manager.resize(window.innerWidth, window.innerHeight)
  }

  get state(): GameState {
    return this.stateValue
  }

  get physicsReady(): boolean {
    return true
  }

  /** Загрузка физического движка вызывается до конструктора мира. */
  static async preparePhysics(): Promise<void> {
    const { PhysicsWorld } = await import('../physics/PhysicsWorld')
    await PhysicsWorld.initEngine()
    physicsHolder.instance = new PhysicsWorld()
  }

  private physics(): import('../physics/PhysicsWorld').PhysicsWorld {
    return physicsHolder.instance!
  }

  // ── построение перевала ────────────────────────────────────────────────

  loadTrack(index: number): void {
    const def = TRACKS[Math.min(TRACKS.length - 1, Math.max(0, index))]
    this.currentTrackIndex = def.index
    this.teardownTrack()
    this.builder = new TrackBuilder(this.physics(), def.tier, def.seed)
    this.track = this.builder.build(def.index)
    this.manager.scene.add(this.track.group)
    this.sceneryGroup = new THREE.Group()
    buildScenery(this.manager.scene, this.track, def.seed + 7)

    const model = buildTruck()
    this.truck = model
    this.manager.scene.add(model.group)
    this.vehicle = new PlayerVehicle(
      this.physics(),
      this.track,
      this.builder,
      model.group,
      model.wheelMeshes,
      model.milkSurface,
      model.brakeLights,
    )
    this.race = new RaceSystem(this.bus, this.physics(), this.track, this.builder, this.vehicle, def)
    this.reviveUsed = false

    // сцена за меню: тягач стоит на старте перевала, камера облетает
    const pose = this.builder.poseAt(this.track, 4)
    this.menuFocus.set(pose.x, pose.y + 2.2, pose.z)
    this.cameraRig.snapTo(this.menuFocus)
  }

  private teardownTrack(): void {
    if (this.vehicle) {
      this.physics().world.removeRigidBody(this.vehicle.body)
      this.vehicle = null
    }
    if (this.truck) {
      this.manager.scene.remove(this.truck.group)
      this.truck = null
    }
    if (this.track) {
      this.manager.scene.remove(this.track.group)
      this.track.group.traverse((obj) => {
        if (obj instanceof THREE.Mesh) obj.geometry.dispose()
      })
      this.track = null
    }
    if (this.sceneryGroup) {
      this.manager.scene.remove(this.sceneryGroup)
      this.sceneryGroup = null
    }
    this.race = null
  }

  // ── переходы состояний ────────────────────────────────────────────────

  toMenu(): void {
    this.stateValue = 'menu'
    this.pausedByModal = false
    this.emitPause()
    this.audio.stopSkid()
    this.audio.stopEngine()
    if (this.race && this.track && this.builder && this.vehicle) {
      this.vehicle.respawn(this.builder, this.track, 4)
      this.race.restart()
    }
  }

  beginCountdown(): void {
    if (!this.race || !this.vehicle || !this.builder || !this.track) return
    this.race.restart()
    this.vehicle.respawn(this.builder, this.track, 4)
    this.slosh.reset()
    this.lastCountdownInt = 4
    this.stateValue = 'countdown'
    this.audio.startEngine()
  }

  startRun(): void {
    this.stateValue = 'racing'
    this.race?.begin()
    this.hudReset?.()
  }

  setPaused(paused: boolean): void {
    this.pausedByModal = paused
    this.emitPause()
  }

  onPlatformPause(paused: boolean): void {
    this.pausedByPlatform = paused
    this.emitPause()
  }

  private emitPause(): void {
    const paused = this.pausedByModal || this.pausedByPlatform
    this.bus.emit('pause:changed', paused)
    if (!paused) this.loop.resetDelta()
  }

  get isPausedNow(): boolean {
    return this.pausedByModal || this.pausedByPlatform
  }

  hudReset: (() => void) | null = null
  menuFocus = new THREE.Vector3()

  // ── фиксированный шаг ──────────────────────────────────────────────────

  private fixedTick(dt: number): void {
    this.audio.updateEngine(0)
    if (!this.vehicle || !this.track || !this.builder || !this.race) {
      return
    }
    const paused = this.isPausedNow
    if (paused || this.stateValue === 'results') {
      return
    }

    const racingOrCountdown = this.stateValue === 'racing' || this.stateValue === 'countdown'
    const crashed = this.stateValue === 'crashed'
    if (!racingOrCountdown && !crashed && this.stateValue !== 'menu' && this.stateValue !== 'trackSelect') {
      return
    }

    const frozen = !racingOrCountdown || this.stateValue === 'countdown'
    const snap = this.input.read(this.inputSnapshot)
    if (frozen) {
      this.input.releaseAll()
    }

    const loc = this.builder.locate(this.track, ...this.positionParts(), this.lastLocIndex)
    this.lastLocIndex = loc.index

    // расходники ввода работают только в заезде
    if (this.stateValue === 'racing') {
      if (this.input.consumeTurbo()) {
        if (this.vehicle.activateTurbo()) this.audio.turboWhoosh()
      }
      if (this.input.consumeValve()) {
        if (this.vehicle.activateValve()) {
          this.race.dumpValve()
          this.entities.milkSplash(this.vehicle.position())
          this.audio.valveHiss()
        }
      }
    } else {
      this.input.consumeTurbo()
      this.input.consumeValve()
    }

    this.vehicle.updateVehicle(dt, snap, loc.surface === 1, frozen)

    // маятник молока: интеграция → реакция на кузов → шаг мира
    this.vehicle.syncBeforeStep()
    const latAccel = this.vehicle.lateralAccel(dt)
    this.slosh.integrate(latAccel, dt)
    this.slosh.applyReaction(
      (fx, fz, py) => this.vehicle.applyLiquidReaction(fx, fz, py),
      balance.massMilkKg,
    )
    this.slosh.detectImpact()
    this.physics().step()
    this.postStep(dt, loc)
  }

  private postStep(dt: number, loc: ReturnType<TrackBuilder['locate']>): void {
    const vehicle = this.vehicle!
    const race = this.race!
    const track = this.track!

    vehicle.fillTelemetry(this.telemetry, loc.surface, track.halfWidth, loc.lateral)
    vehicle.setMilkVisual(race.volumeL / race.startVolume(), this.slosh.theta)

    // шлейфы из-под колёс: снег и осколки льда от реального скольжения
    const slipAmount = Math.min(1, Math.abs(this.telemetry.slipAngleDeg) / 45) *
      Math.min(1, this.telemetry.speedKmh / 60)
    if (slipAmount > 0.12 && this.stateValue === 'racing') {
      const pos = vehicle.position()
      this.entities.snowSpray(pos, slipAmount)
      if (this.telemetry.surfaceIce) this.entities.iceShards(pos, slipAmount)
    }
    this.audio.updateSkid(slipAmount)
    this.audio.updateEngine(Math.min(1, this.telemetry.speedKmh / 120))

    if (this.stateValue === 'countdown') {
      const raceRef = this.race!
      raceRef.countdown -= dt
      const remaining = Math.ceil(raceRef.countdown)
      if (remaining !== this.lastCountdownInt) {
        this.lastCountdownInt = remaining
        this.countdownTickCallback?.(remaining)
      }
      if (raceRef.countdown <= 0) this.startRun()
      return
    }

    if (this.stateValue !== 'racing') return

    race.update(dt, this.telemetry, loc)

    if (race.isWrongWay() && this.timeNow - this.wrongWayShownAt > 3) {
      this.wrongWayShownAt = this.timeNow
      this.wrongWayCallback?.()
    }

    // падение в пропасть за пределы трассы
    let minY = Infinity
    for (let i = 0; i < track.centerY.length; i++) minY = Math.min(minY, track.centerY[i])
    if (vehicle.position().y < minY - 45) race.crash('fall')
  }

  timeNow = 0
  countdownTickCallback: ((remaining: number) => void) | null = null
  wrongWayCallback: (() => void) | null = null
  private lastLocIndex = 0

  private positionParts(): [number, number] {
    const p = this.vehicle!.position()
    return [p.x, p.z]
  }

  // ── кадр рендера ──────────────────────────────────────────────────────

  private frameRender(alpha: number): void {
    this.timeNow += 1 / 60
    this.manager.sampleFrame(1 / 60)
    if (this.vehicle && this.truck) {
      this.vehicle.render(alpha)
      if (this.stateValue === 'menu' || this.stateValue === 'trackSelect') {
        this.entities.menuExhaust(this.truck.exhaustTips[0], this.truck.exhaustTips[1], 1 / 60)
        this.cameraRig.orbitMenu(this.menuFocus, 1 / 60)
      } else if (this.vehicle) {
        this.cameraRig.followRace(this.vehicle, 1 / 60, this.telemetry.slipAngleDeg)
      }
    }
    this.particles.update(1 / 60)
    this.hudFrameCallback?.()
    this.manager.render()
  }

  hudFrameCallback: (() => void) | null = null

  get telemetryRef(): VehicleTelemetry {
    return this.telemetry
  }

  get activeRace(): RaceSystem | null {
    return this.race
  }

  get activeTrack(): TrackData | null {
    return this.track
  }

  get trackDefIndex(): number {
    return this.currentTrackIndex
  }

  markReviveUsed(): void {
    this.reviveUsed = true
  }

  markCrashed(): void {
    this.stateValue = 'crashed'
  }

  markResults(): void {
    this.stateValue = 'results'
  }

  enterShowcase(): void {
    this.stateValue = 'menu'
    this.pausedByModal = false
    this.emitPause()
  }

  resumeFromCrash(): void {
    this.stateValue = 'racing'
    this.pausedByModal = false
    this.emitPause()
  }

  get currentVehicle(): PlayerVehicle | null {
    return this.vehicle
  }

  get isReviveUsed(): boolean {
    return this.reviveUsed
  }

  private saveRunResult(time: number, score: number, stars: number, win: boolean): void {
    const def: TrackDef = TRACKS[this.currentTrackIndex]
    const save = this.storage.get()
    const bestScore = save.bestScores[def.id] ?? 0
    if (score > bestScore) save.bestScores[def.id] = score
    const bestTime = save.bestTimes[def.id] ?? Infinity
    if (win && time < bestTime) save.bestTimes[def.id] = time
    if (win && stars > (save.starsByTrack[def.id] ?? 0)) save.starsByTrack[def.id] = stars
    if (win) save.unlockedMask |= 1 << Math.min(TRACKS.length - 1, def.index + 1)
    this.storage.save()
  }
}

/** Физический мир создаётся асинхронно до входа в игру. */
const physicsHolder: { instance: import('../physics/PhysicsWorld').PhysicsWorld | null } = {
  instance: null,
}
