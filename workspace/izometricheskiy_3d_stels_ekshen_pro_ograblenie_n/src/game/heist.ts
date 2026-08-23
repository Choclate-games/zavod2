import * as THREE from 'three'
import { BAL, ALARM_LOSE, PLAYER_MAX_HITS, TRACK_TIME_LIMIT } from '../config/balance.js'
import { buildWorld, clampToWalkable, pushOutOfObstacles, type WorldData } from '../render/world.js'
import { Dancers } from './dancers.js'
import { VfxPool } from '../render/vfx.js'
import { Player } from './player.js'
import { Guard } from './guards.js'
import { audio } from '../audio/audio.js'
import type { Upgrades } from '../platform/save.js'

/**
 * Сессия ограбления: связывает уровень, толпу, стражу и вора; ведёт шкалу
 * тревоги, таймер трека шествия и условия победы/поражения. В режиме idle
 * (живая сцена за меню) симуляция идёт без вора и таймера.
 */

export type RunPhase = 'playing' | 'won' | 'lost'

interface ConfettiCloud {
  x: number
  z: number
  until: number
}

export class HeistSession {
  readonly world: WorldData
  private readonly dancers = new Dancers()
  private readonly vfx = new VfxPool()
  private readonly player = new Player()
  private readonly guards: Guard[] = []
  private readonly clouds: ConfettiCloud[] = []
  private readonly flowVec = { x: 0, z: BAL.marchSpeed }
  mode: 'idle' | 'run' = 'idle'
  phase: RunPhase = 'playing'
  loseReason = ''
  alarm = 0
  timeLeft = TRACK_TIME_LIMIT
  elapsed = 0
  goldEarned = 0
  defeatedCount = 0
  confettiCharges = BAL.confettiCharges
  totemCarried = false
  secondChanceAvailable = true

  private readonly upgrades: Upgrades
  constructor(scene: THREE.Scene, upgrades: Upgrades) {
    this.world = buildWorld(scene)
    scene.add(this.dancers.mesh)
    scene.add(this.vfx.group)
    this.upgrades = upgrades
    this.spawnGuards()
    scene.add(this.player.root)
    this.player.placeAt(this.world.spawnPos.x, this.world.spawnPos.z)
    this.applyUpgradeStock()
  }

  private applyUpgradeStock(): void {
    this.confettiCharges = BAL.confettiCharges + this.upgrades.confettiStock
  }

  /** Обновление улучшений между забегами (мастерская могла что-то купить). */
  upgradesRefresh(next: Upgrades): void {
    this.upgrades.confettiStock = next.confettiStock
    this.upgrades.silentSteps = next.silentSteps
    this.upgrades.strongGuard = next.strongGuard
    this.applyUpgradeStock()
  }

  playerHitsTaken(): number {
    return this.player.hitsTaken
  }

  facingNow(): number {
    return this.player.facing
  }

  private spawnGuards(): void {
    const layouts: Array<{ elite: boolean; waypoints: Array<{ x: number; z: number }> }> = [
      { elite: false, waypoints: [{ x: -8, z: 38 }, { x: 8, z: 38 }, { x: 8, z: 14 }, { x: -8, z: 16 }] },
      { elite: false, waypoints: [{ x: -10, z: 30 }, { x: 10, z: 12 }] },
      { elite: false, waypoints: [{ x: -11, z: -2 }, { x: 11, z: -2 }, { x: 11, z: -26 }, { x: -11, z: -28 }] },
      { elite: true, waypoints: [{ x: 0, z: -8 }, { x: 0, z: -30 }] },
      { elite: false, waypoints: [{ x: -13, z: -44 }, { x: 13, z: -44 }, { x: 13, z: -70 }, { x: -13, z: -70 }] },
      { elite: true, waypoints: [{ x: -5, z: -50 }, { x: 5, z: -64 }] },
      { elite: true, waypoints: [{ x: 0, z: -46 }, { x: 8, z: -57 }, { x: -8, z: -57 }] },
    ]
    for (const layout of layouts) {
      const guard = new Guard(layout.elite, layout.waypoints)
      this.guards.push(guard)
      this.world.root.add(guard.root)
    }
  }

  startRun(): void {
    this.mode = 'run'
    this.phase = 'playing'
    this.loseReason = ''
    this.alarm = 0
    this.timeLeft = TRACK_TIME_LIMIT
    this.elapsed = 0
    this.goldEarned = 0
    this.defeatedCount = 0
    this.totemCarried = false
    this.secondChanceAvailable = true
    this.clouds.length = 0
    this.applyUpgradeStock()
    this.player.placeAt(this.world.spawnPos.x, this.world.spawnPos.z)
    this.player.carryingTotem = false
    // Рестарт уровня — телепорт живых тел на маршруты, а не пересборка мира.
    for (const guard of this.guards) {
      if (!guard.alive) continue
      guard.state = 'calm'
      guard.suspicion = 0
      guard.blindedTimer = 0
      guard.stunnedTimer = 0
    }
    this.world.totemMesh.visible = true
    this.world.totemMesh.position.copy(this.world.totemPos).setY(1.1)
    audio.startMusic()
  }

  enterIdle(): void {
    this.mode = 'idle'
    this.phase = 'playing'
    this.player.root.visible = false
  }

  /** Второй шанс вора: rewarded возвращает в бой с полным здоровьем один раз. */
  useSecondChance(): boolean {
    if (this.phase !== 'lost' || !this.secondChanceAvailable || this.loseReason === 'time') return false
    this.secondChanceAvailable = false
    this.phase = 'playing'
    this.player.hitsTaken = 0
    this.player.invulnTimer = 2
    if (this.loseReason === 'alarm') this.alarm = 65
    return true
  }

  tryLunge(dx: number, dz: number): void {
    if (this.mode !== 'run' || this.phase !== 'playing') return
    const beat = audio.isOnStrongBeat(BAL.beatWindow)
    if (this.player.tryLunge(dx, dz, beat.onBeat)) {
      audio.lunge()
      if (!beat.onBeat) {
        // Неритмичный удар шумит: патрули идут проверять источник.
        this.emitNoise(this.player.pos.x, this.player.pos.z, BAL.offbeatNoiseRadius)
      }
    }
  }

  tryParry(): void {
    if (this.mode !== 'run' || this.phase !== 'playing') return
    if (this.player.canAct) this.player.tryParry()
  }

  tryKick(): void {
    if (this.mode !== 'run' || this.phase !== 'playing') return
    const fx = Math.sin(this.player.facing)
    const fz = Math.cos(this.player.facing)
    for (const guard of this.guards) {
      if (!guard.alive || guard.stunnedTimer <= 0) continue
      const dx = guard.x - this.player.pos.x
      const dz = guard.z - this.player.pos.z
      if (Math.hypot(dx, dz) > BAL.ramKnockdownRadius + 0.6) continue
      guard.launchRagdoll(fx, fz)
      audio.kickLaunch()
      this.defeatedCount++
      this.goldEarned += 25
      return
    }
  }

  tryDash(): void {
    if (this.mode !== 'run' || this.phase !== 'playing') return
    this.player.tryDash()
  }

  throwConfetti(targetX: number | null, targetZ: number | null): void {
    if (this.mode !== 'run' || this.phase !== 'playing') return
    if (this.confettiCharges <= 0) return
    if (targetX === null || targetZ === null) {
      targetX = this.player.pos.x
      targetZ = this.player.pos.z
    }
    const x = targetX
    const z = targetZ
    if (targetX !== null && Math.hypot(targetX - this.player.pos.x, targetZ - this.player.pos.z) > 7) return
    this.confettiCharges--
    this.vfx.spawnCloud(x, z, BAL.confettiRadius)
    audio.confettiPop()
    this.clouds.push({ x, z, until: this.elapsed + BAL.smokeDuration })
    // Хлопушка приманивает патрули звуком — отвлечение работает обеими сторонами.
    this.emitNoise(x, z, BAL.popperNoiseRadius)
  }

  /** Шум переводит стражу в проверку источника, но сам тревогу не поднимает. */
  private emitNoise(x: number, z: number, radius: number): void {
    for (const guard of this.guards) {
      if (!guard.alive) continue
      if (Math.hypot(guard.x - x, guard.z - z) <= radius) guard.hearNoise(x, z)
    }
  }

  get playerPos(): THREE.Vector3 {
    return this.player.pos
  }

  get disguiseActive(): boolean {
    return this.dancers.crowdCountNear(this.player.pos.x, this.player.pos.z) >= BAL.crowdMinSize
  }

  fixedUpdate(dt: number): void {
    this.dancers.update(dt)
    this.vfx.update(dt)

    if (this.mode === 'idle') {
      const idleCtx = {
        playerX: 999,
        playerZ: 999,
        playerDisguised: true,
        playerInShade: false,
        obstacles: this.world.obstacles,
        walkable: this.world.walkable,
        onAlert: () => undefined,
        onStrike: () => undefined,
        onTakedown: () => undefined,
      }
      for (const guard of this.guards) guard.update(dt, idleCtx)
      this.updateClouds(dt)
      return
    }
    if (this.phase !== 'playing') return

    this.elapsed += dt
    this.timeLeft -= dt
    if (this.timeLeft <= 0) {
      this.timeLeft = 0
      this.finish(false, 'time')
      return
    }

    // Ритмическая левитация тотема: движение в такт снижает вес.
    const beat = audio.isOnStrongBeat(BAL.beatWindow)
    this.player.rhythmInStep = this.totemCarried && beat.onBeat
    const disguised = this.disguiseActive
    this.dancers.flowDirectionNear(this.flowVec)

    this.player.update(dt, {
      moveX: this.pendingMoveX,
      moveZ: this.pendingMoveZ,
      blend: this.pendingBlend && disguised,
    }, this.flowVec, disguised)

    clampToWalkable(this.world.walkable, this.player.pos, 0.45)
    pushOutOfObstacles(this.world.obstacles, this.player.pos, 0.45)

    // Тень навесов: подозрение копится заметно медленнее.
    let inShade = false
    for (const s of this.world.shades) {
      if (Math.hypot(s.x - this.player.pos.x, s.z - this.player.pos.z) <= s.r) {
        inShade = true
        break
      }
    }

    const ctx = {
      playerX: this.player.pos.x,
      playerZ: this.player.pos.z,
      playerDisguised: disguised,
      playerInShade: inShade,
      obstacles: this.world.obstacles,
      walkable: this.world.walkable,
      onAlert: (_guard: Guard) => this.onGuardAlert(),
      onStrike: (guard: Guard) => this.onGuardStrike(guard),
      onTakedown: () => undefined,
    }
    let anyAlert = false
    for (const guard of this.guards) {
      guard.update(dt, ctx)
      if (guard.alive && guard.state === 'alert') anyAlert = true
    }

    // Тревога: поднимается от глаз стражи, спадает, когда никто не видит вора.
    if (anyAlert) {
      this.alarm = Math.min(ALARM_LOSE, this.alarm + dt * 11)
    } else {
      this.alarm = Math.max(0, this.alarm - dt * 5)
    }
    if (this.alarm >= ALARM_LOSE) {
      this.finish(false, 'alarm')
      return
    }
    if (this.player.hitsTaken >= PLAYER_MAX_HITS) {
      this.finish(false, 'blades')
      return
    }

    this.resolveLungeHits()
    this.resolveRamDash()
    this.updateClouds(dt)
    this.updateTotem()
    this.checkWin()
  }

  private pendingMoveX = 0
  private pendingMoveZ = 0
  private pendingBlend = false

  submitMove(moveX: number, moveZ: number, blend: boolean): void {
    this.pendingMoveX = moveX
    this.pendingMoveZ = moveZ
    this.pendingBlend = blend
  }

  private onGuardAlert(): void {
    if (this.alarm < 1) {
      audio.alarmSting()
    }
  }

  private onGuardStrike(guard: Guard): void {
    const dx = guard.x - this.player.pos.x
    const dz = guard.z - this.player.pos.z
    const dist = Math.hypot(dx, dz)
    if (dist > 2.2) return
    const dirAngle = Math.atan2(dx, dz)
    let delta = dirAngle - this.player.facing
    while (delta > Math.PI) delta -= Math.PI * 2
    while (delta < -Math.PI) delta += Math.PI * 2
    const halfSector = (BAL.parrySectorDeg / 2 * Math.PI) / 180
    if (this.player.parryTimer > 0 && Math.abs(delta) <= halfSector) {
      // Успешное парирование: звон, вспышка, hit-stop кадрами, стража в стаггере.
      audio.clang()
      this.player.registerParrySuccess()
      this.player.parryRecovery = 0
      this.player.hitStopFrames = 4
      guard.stunAfterParry(dx / dist, dz / dist)
      this.goldEarned += 5
    } else if (this.player.invulnTimer <= 0) {
      audio.hitTaken()
      this.player.takeHit()
    }
  }

  /** Выпад рапирой: добивает в секторе со спины, в такт — тихо. */
  private resolveLungeHits(): void {
    if (!this.player.isLunging || this.player.lungeHitDone) return
    const px = this.player.pos.x
    const pz = this.player.pos.z
    for (const guard of this.guards) {
      if (!guard.alive) continue
      const dx = guard.x - px
      const dz = guard.z - pz
      const dist = Math.hypot(dx, dz)
      if (dist > BAL.lungeDistance + 0.55) continue
      const angleToGuard = Math.atan2(dx, dz)
      let delta = angleToGuard - this.player.facing
      while (delta > Math.PI) delta -= Math.PI * 2
      while (delta < -Math.PI) delta += Math.PI * 2
      if (Math.abs(delta) > Math.PI / 2) continue
      // Сектор со спины: угол между взглядом стражи и направлением на вора.
      const rear = Math.abs(angleDelta(guard.facing, Math.atan2(-dx, -dz)))
      const halfBack = (BAL.backstabSectorDeg / 2 * Math.PI) / 180
      const fromBehind = rear <= halfBack
      guard.launchRagdoll(Math.sin(angleToGuard), Math.cos(angleToGuard))
      this.player.lungeHitDone = true
      this.defeatedCount++
      this.goldEarned += fromBehind ? 40 : 20
      if (this.player.lungeSilent && fromBehind) {
        audio.takedown()
      } else {
        audio.takedown()
        this.emitNoise(px, pz, 3.2)
      }
      return
    }
  }

  /** Таранный рывок с тотемом сбивает стражей в радиусе из баланса. */
  private resolveRamDash(): void {
    if (!this.player.isDashing) return
    for (const guard of this.guards) {
      if (!guard.alive) continue
      const dx = guard.x - this.player.pos.x
      const dz = guard.z - this.player.pos.z
      if (Math.hypot(dx, dz) > BAL.ramKnockdownRadius) continue
      guard.launchRagdoll(dx, dz)
      this.defeatedCount++
      this.goldEarned += 15
      audio.kickLaunch()
    }
  }

  private updateClouds(_dt: number): void {
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const cloud = this.clouds[i]
      if (this.elapsed > cloud.until) {
        this.clouds.splice(i, 1)
        continue
      }
      for (const guard of this.guards) {
        if (!guard.alive) continue
        if (Math.hypot(guard.x - cloud.x, guard.z - cloud.z) <= BAL.confettiRadius) {
          guard.blind(BAL.blindDuration)
        }
      }
    }
  }

  private updateTotem(): void {
    if (!this.totemCarried) {
      if (Math.hypot(this.player.pos.x - this.world.totemPos.x, this.player.pos.z - this.world.totemPos.z) < 1.5) {
        this.totemCarried = true
        this.player.carryingTotem = true
        this.world.totemMesh.visible = false
        audio.pickup()
      }
    } else {
      // Тотем едет над головой вора.
      this.world.totemMesh.visible = true
      this.world.totemMesh.position.set(this.player.pos.x, 2.35, this.player.pos.z)
      this.world.totemMesh.rotation.y = this.player.facing
    }
  }

  private checkWin(): void {
    if (!this.totemCarried) return
    if (Math.hypot(this.player.pos.x - this.world.exitPos.x, this.player.pos.z - this.world.exitPos.z) < 2.6) {
      this.goldEarned += 100 + Math.round(this.timeLeft * 2)
      this.finish(true, '')
    }
  }

  private finish(won: boolean, reason: string): void {
    this.phase = won ? 'won' : 'lost'
    this.loseReason = reason
    if (won) audio.winFanfare()
    else audio.loseSting()
  }

  /** Направление к ближайшему стражу в секторе выпада — для подсветки цели. */
  nearestThreatDirection(out: THREE.Vector3): boolean {
    let best = Infinity
    let found = false
    for (const guard of this.guards) {
      if (!guard.alive) continue
      const dx = guard.x - this.player.pos.x
      const dz = guard.z - this.player.pos.z
      const d = Math.hypot(dx, dz)
      if (d < best && d < 6) {
        best = d
        out.set(dx, 0, dz)
        found = true
      }
    }
    if (found) out.normalize()
    return found
  }
}

function angleDelta(from: number, to: number): number {
  let d = to - from
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}
