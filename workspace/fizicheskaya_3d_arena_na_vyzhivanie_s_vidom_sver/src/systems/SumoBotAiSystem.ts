import type { EntityManager } from '../entities/EntityManager'
import type { Tubing } from '../entities/Player'
import type { IceArenaFracturingSystem } from './IceArenaFracturingSystem'
import { BOOST, ICE } from '../core/Balance'

/**
 * Соревновательный ИИ семи ботов. Конечный автомат: патрулирование центра,
 * охота на ближайшего слабого, таран с форсажем, спасение с кромки.
 * Бот выдаёт ТОЛЬКО TubeInput — тот же интерфейс, что у игрока.
 */
type BotState = 'PATROL' | 'HUNT' | 'RAM' | 'ESCAPE'

export class SumoBotAiSystem {
  private readonly states: BotState[] = []
  private readonly targetId: number[] = []
  private readonly stateTimer: number[] = []
  private reactionCooldown = 0

  constructor(
    private readonly entities: EntityManager,
    private readonly arena: IceArenaFracturingSystem,
  ) {}

  build(): void {
    for (let i = 0; i < this.entities.tubes.length; i++) {
      this.states.push('PATROL')
      this.targetId.push(-1)
      this.stateTimer.push(0)
    }
  }

  update(dt: number): void {
    this.reactionCooldown = Math.max(0, this.reactionCooldown - dt)
    const tubes = this.entities.tubes

    for (let i = 1; i < tubes.length; i++) {
      const bot = tubes[i]
      if (!bot.alive) continue
      if (!bot.body) continue
      this.stateTimer[i] -= dt

      const t = bot.body.translation()
      const edgeDist = Math.hypot(t.x, t.z)

      // Спасение с кромки и с тонущих плит важнее любой атаки.
      const onSinkingIce = !this.arena.hasSupportAt(t.x, t.z) || edgeDist > ICE.arenaRadius * 0.92
      let state = this.states[i]
      if (onSinkingIce && state !== 'ESCAPE') {
        state = 'ESCAPE'
        this.states[i] = state
        this.stateTimer[i] = 1.2
      } else if (state === 'ESCAPE' && this.stateTimer[i] <= 0 && edgeDist < ICE.arenaRadius * 0.6) {
        state = 'PATROL'
        this.states[i] = state
      }

      const input = bot.input
      input.throttle = 1
      input.boost = false
      input.rebound = false
      input.steer = 0

      switch (state) {
        case 'ESCAPE': {
          // Руль к центру арены, форсаж если баллон полон.
          this.steerTowards(bot, -t.x, -t.z)
          if (bot.boostFuel > BOOST.tankCapacity * 0.5) input.boost = true
          break
        }
        case 'HUNT':
        case 'RAM': {
          const target = this.pickTarget(bot)
          if (target && target.body) {
            const tt = target.body.translation()
            this.steerTowards(bot, tt.x, tt.z)
            const dist = Math.hypot(tt.x - t.x, tt.z - t.z)
            // Форсаж в лобовую, когда цель по курсу и дистанция разумная.
            if (dist < 14 && dist > 2.2 && this.facingDot(bot, tt.x, tt.z) > 0.86) {
              if (bot.boostFuel > BOOST.tankCapacity * 0.3) input.boost = true
              if (state !== 'RAM') {
                this.states[i] = 'RAM'
                this.stateTimer[i] = 2.4
              }
            } else if (state === 'RAM' && this.stateTimer[i] <= 0) {
              this.states[i] = 'HUNT'
            }
            // Отскок в ответ на чужой форсаж рядом.
            if (dist < 4 && this.reactionCooldown <= 0 && Math.random() < 0.35) {
              input.rebound = true
              this.reactionCooldown = 1.4
            }
          } else {
            this.states[i] = 'PATROL'
          }
          break
        }
        default: {
          // Патруль: держаться среднего радиуса, искать жертву.
          if (edgeDist < ICE.arenaRadius * 0.45) {
            this.steerTowards(bot, t.x * 1.6, t.z * 1.6)
          } else {
            this.steerTowards(bot, t.x * 0.3, t.z * 0.3)
          }
          if (this.stateTimer[i] <= 0) {
            this.states[i] = 'HUNT'
            this.stateTimer[i] = 2 + Math.random() * 2
          }
          break
        }
      }
    }
  }

  private pickTarget(bot: Tubing): Tubing | null {
    const tubes = this.entities.tubes
    const self = bot.body?.translation()
    if (!self) return null
    let best: Tubing | null = null
    let bestScore = Infinity
    for (let i = 0; i < tubes.length; i++) {
      const other = tubes[i]
      if (other === bot || !other.alive || !other.body) continue
      const to = other.body.translation()
      const dist = Math.hypot(to.x - self.x, to.z - self.z)
      // Лёгких давим охотнее, игрока слегка приоритизируем — давление на лидера.
      let score = dist + other.massKg * 0.12
      if (other.isPlayer) score *= 0.8
      if (score < bestScore) {
        bestScore = score
        best = other
      }
    }
    return best
  }

  private steerTowards(bot: Tubing, x: number, z: number): void {
    const t = bot.body?.translation()
    if (!t) return
    const desired = Math.atan2(x - t.x, z - t.z)
    let diff = desired - bot.heading
    while (diff > Math.PI) diff -= Math.PI * 2
    while (diff < -Math.PI) diff += Math.PI * 2
    bot.input.steer = Math.max(-1, Math.min(1, diff * 2.2))
  }

  private facingDot(bot: Tubing, x: number, z: number): number {
    const t = bot.body?.translation()
    if (!t) return 0
    const dx = x - t.x
    const dz = z - t.z
    const len = Math.hypot(dx, dz) || 1
    return (Math.sin(bot.heading) * dx + Math.cos(bot.heading) * dz) / len
  }

  reset(): void {
    for (let i = 0; i < this.states.length; i++) {
      this.states[i] = 'PATROL'
      this.stateTimer[i] = Math.random() * 2
    }
  }
}
