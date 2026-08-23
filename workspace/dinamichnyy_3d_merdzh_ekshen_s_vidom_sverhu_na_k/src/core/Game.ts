import { BALANCE } from '../balance'
import { AudioManager } from '../audio/AudioManager'
import { EventBus } from './EventBus'
import { GameLoop } from './GameLoop'
import { EntityManager, type BlobEntity, type EnemyEntity } from '../entities/EntityManager'
import { Player } from '../entities/Player'
import { InputRouter } from '../input/InputRouter'
import { PhysicsWorld } from '../physics/PhysicsWorld'
import { PlaygamaService } from '../platform/PlaygamaService'
import { ArenaRingShrinkingSystem } from '../systems/ArenaRingShrinkingSystem'
import { EnemyHordeDirectorSystem } from '../systems/EnemyHordeDirectorSystem'
import { MergeShockwaveEngineSystem } from '../systems/MergeShockwaveEngineSystem'
import { PointerGesturePhysicsControllerSystem } from '../systems/PointerGesturePhysicsControllerSystem'
import { SceneManager } from '../rendering/SceneManager'

export type GameState = 'main_menu' | 'gameplay_hud' | 'wave_clear' | 'game_over' | 'victory_podium'

export class Game {
  readonly bus: EventBus
  readonly scene: SceneManager
  readonly physics = new PhysicsWorld()
  readonly entities = new EntityManager()
  readonly player = new Player()
  readonly audio: AudioManager
  readonly loop: GameLoop
  private readonly platform: PlaygamaService
  private readonly horde: EnemyHordeDirectorSystem
  private readonly merge: MergeShockwaveEngineSystem
  private readonly arena: ArenaRingShrinkingSystem
  private readonly gestures: PointerGesturePhysicsControllerSystem
  private state: GameState = 'main_menu'
  private wave = 1
  private waveTime = 0
  private hitStop = 0
  private paused = false
  private frameCounter = 0
  private saveHighScore = 0
  private readonly hud = { wave: 1, time: 60, score: 0, ringouts: 0, tier: 1, combo: 0, radius: 12 }

  constructor(canvas: HTMLCanvasElement, platform: PlaygamaService, bus: EventBus) {
    this.bus = bus
    this.platform = platform
    this.scene = new SceneManager(canvas)
    this.audio = new AudioManager(this.bus)
    this.horde = new EnemyHordeDirectorSystem(this.entities)
    this.merge = new MergeShockwaveEngineSystem(this.physics, this.entities)
    this.arena = new ArenaRingShrinkingSystem()
    this.gestures = new PointerGesturePhysicsControllerSystem(this.bus, this.entities, (x, y) => this.scene.screenToArena(x, y), (slot, x, z) => this.fling(slot, x, z), () => this.chomp(), (startX, startZ, currentX, currentZ) => this.scene.setAim(startX, startZ, currentX, currentZ), () => this.scene.clearAim())
    new InputRouter(this.bus, canvas, platform.deviceType)
    this.loop = new GameLoop(this)
    this.bus.on('input:pause', () => this.togglePause())
    this.bus.on('input:restart', () => this.startRun())
    this.bus.on('input:chomp', () => this.chomp())
    this.bus.on('platform:pause', (status) => { this.paused = status === 'PAUSED'; if (!this.paused) this.loop.resetAccumulator() })
  }

  async initialize(): Promise<void> {
    await this.physics.initialize()
    const save = await this.platform.readSave()
    this.saveHighScore = save.highScore
    this.audio.setPlayerMuted(save.muted)
    this.startMenu()
  }

  get bestScore(): number { return this.saveHighScore }

  startMenu(): void {
    this.clearEntities()
    this.state = 'main_menu'
    this.paused = false
    this.emitState()
  }

  startRun(): void {
    this.clearEntities()
    this.player.reset()
    this.wave = 1
    this.waveTime = 0
    this.hitStop = 0
    this.arena.reset()
    this.horde.reset()
    this.spawnStarterBlobs()
    this.state = 'gameplay_hud'
    this.paused = false
    this.emitState()
    this.emitHud()
  }

  nextWave(): void {
    if (this.state !== 'wave_clear') return
    this.wave = Math.min(BALANCE.waveCount, this.wave + 1)
    this.waveTime = 0
    this.arena.reset()
    this.horde.reset()
    if (this.entities.countBlobs() < 2) this.entities.spawnBlob(Math.min(3, this.player.maxTier), 0, 0)
    this.state = 'gameplay_hud'
    this.emitState()
  }

  togglePause(): void {
    if (this.state !== 'gameplay_hud') return
    this.paused = !this.paused
    if (!this.paused) this.loop.resetAccumulator()
    this.emitState()
  }

  toggleSound(): void { this.audio.togglePlayerMute() }
  requestReward(): void {
    if (this.state !== 'game_over') return
    void this.platform.showRewarded('revive_lava_rescue').then((rewarded) => {
      if (!rewarded) return
      this.clearEntities()
      this.entities.spawnBlob(Math.max(2, this.player.maxTier), 0, 0)
      this.state = 'gameplay_hud'
      this.emitState()
    })
  }

  submitLeaderboard(): void { this.platform.submitScore(this.player.score) }

  update(dt: number): void {
    if (this.paused || this.state !== 'gameplay_hud') return
    if (this.hitStop > 0) { this.hitStop -= dt; return }
    this.waveTime += dt
    this.physics.step()
    this.arena.update(dt, () => this.emitHud(), (radius) => { this.scene.setArenaRadius(radius); this.emitHud() })
    this.horde.update(dt, this.wave, this.arena.radius, () => this.player.registerRingout(1), (force) => this.hitBlobs(force))
    this.merge.update((tier, x, z, radius) => this.onMerge(tier, x, z, radius), (tier) => this.player.registerRingout(tier))
    this.moveBlobs(dt)
    this.removeFallenBlobs()
    if (this.waveTime >= BALANCE.waveDuration) this.finishWave()
    if (this.player.maxTier >= 4 && this.wave >= 3 && this.entities.countEnemies() === 0) this.finishVictory()
    this.frameCounter += 1
    if (this.frameCounter % 4 === 0) this.emitHud()
  }

  render(): void {
    this.scene.sync(this.entities.blobs, this.entities.enemies, 1 / 60)
    this.scene.render()
  }

  private spawnStarterBlobs(): void {
    const spots = [[-3.2, -1.2], [3.2, -1.2], [-2.2, 2.1], [2.2, 2.1]]
    for (const spot of spots) {
      const blob = this.entities.spawnBlob(1, spot[0], spot[1])
      if (blob) this.physics.reset(blob.slot, blob.x, blob.z)
    }
  }

  private fling(slot: number, x: number, z: number): void {
    const blob = this.blobsBySlot(slot)
    if (!blob || !blob.active) return
    const length = Math.sqrt(x * x + z * z)
    if (length < BALANCE.pointerDeadzone) return
    const strength = Math.min(BALANCE.maxDragDistance, length)
    blob.vx = x / Math.max(0.01, length) * strength * BALANCE.flingSpeedMultiplier
    blob.vz = z / Math.max(0.01, length) * strength * BALANCE.flingSpeedMultiplier
    blob.ramTime = BALANCE.heavyRamDuration
    this.physics.applyImpulse(blob.slot, blob.vx, blob.vz)
    this.audio.playFling()
  }

  private chomp(): void {
    let chosen: BlobEntity | null = null
    for (const blob of this.entities.blobs) if (blob.active && (!chosen || blob.tier > chosen.tier)) chosen = blob
    if (!chosen || chosen.chompCooldown > 0) return
    chosen.chompCooldown = BALANCE.chompCooldown
    let target: EnemyEntity | null = null
    let nearest = BALANCE.baseBiteReach + chosen.tier * 0.6
    for (const enemy of this.entities.enemies) {
      if (!enemy.active) continue
      const dx = enemy.x - chosen.x
      const dz = enemy.z - chosen.z
      const distance = Math.sqrt(dx * dx + dz * dz)
      if (distance < nearest) { nearest = distance; target = enemy }
    }
    if (target) {
      const dx = target.x - chosen.x
      const dz = target.z - chosen.z
      const distance = Math.max(0.2, Math.sqrt(dx * dx + dz * dz))
      target.vx += dx / distance * BALANCE.jawKnockbackImpulse / 100
      target.vz += dz / distance * BALANCE.jawKnockbackImpulse / 100
      target.stunTime = BALANCE.stunDuration
    }
    this.audio.playFling()
  }

  private moveBlobs(dt: number): void {
    for (const blob of this.entities.blobs) {
      if (!blob.active) continue
      blob.chompCooldown = Math.max(0, blob.chompCooldown - dt)
      blob.ramTime = Math.max(0, blob.ramTime - dt)
      blob.x += blob.vx * dt
      blob.z += blob.vz * dt
      const drag = Math.max(0, 1 - BALANCE.linearDrag * dt)
      blob.vx *= drag
      blob.vz *= drag
      if (blob.ramTime <= 0 && Math.abs(blob.vx) + Math.abs(blob.vz) < 0.08) { blob.vx = 0; blob.vz = 0 }
    }
  }

  private hitBlobs(force: number): void {
    for (const blob of this.entities.blobs) {
      if (!blob.active) continue
      const distance = Math.max(0.4, Math.sqrt(blob.x * blob.x + blob.z * blob.z))
      blob.vx += blob.x / distance * force * 0.04
      blob.vz += blob.z / distance * force * 0.04
    }
  }

  private removeFallenBlobs(): void {
    for (const blob of this.entities.blobs) {
      if (!blob.active) continue
      if (Math.sqrt(blob.x * blob.x + blob.z * blob.z) > this.arena.radius + 1.4) this.entities.deactivateBlob(blob)
    }
    if (this.entities.countBlobs() === 0) this.finishDefeat()
  }

  private finishWave(): void {
    if (this.wave >= BALANCE.waveCount) {
      this.horde.spawnBoss(this.arena.radius)
      this.waveTime = BALANCE.waveDuration - 0.5
      return
    }
    this.state = 'wave_clear'
    this.emitState()
  }

  private finishVictory(): void {
    if (this.state === 'victory_podium') return
    this.state = 'victory_podium'
    this.saveResult()
    this.emitState()
  }

  private finishDefeat(): void {
    if (this.state === 'game_over') return
    this.state = 'game_over'
    this.saveResult()
    this.emitState()
  }

  private onMerge(tier: number, x: number, z: number, radius: number): void {
    this.player.registerMerge(tier)
    this.hitStop = BALANCE.hitStopDuration
    this.scene.triggerShockwave(x, z, radius)
    this.audio.playMerge()
    if (navigator.vibrate) navigator.vibrate(40)
  }

  private saveResult(): void {
    this.saveHighScore = Math.max(this.saveHighScore, this.player.score)
    this.platform.storage.schedule({ highScore: this.saveHighScore, totalRingouts: this.player.ringouts })
    this.platform.submitScore(this.player.score)
  }

  private clearEntities(): void {
    for (const blob of this.entities.blobs) this.entities.deactivateBlob(blob)
    for (const enemy of this.entities.enemies) this.entities.deactivateEnemy(enemy)
  }

  private blobsBySlot(slot: number): BlobEntity | null {
    for (const blob of this.entities.blobs) if (blob.slot === slot) return blob
    return null
  }

  private emitState(): void { this.bus.emit('game:state', { state: this.paused ? 'main_menu' : this.state }) }

  private emitHud(): void {
    this.hud.wave = this.wave
    this.hud.time = BALANCE.waveDuration - this.waveTime
    this.hud.score = this.player.score
    this.hud.ringouts = this.player.ringouts
    this.hud.tier = this.player.maxTier
    this.hud.combo = this.player.combo
    this.hud.radius = this.arena.radius
    this.bus.emit('game:hud', this.hud)
  }
}
