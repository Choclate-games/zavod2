import * as THREE from 'three'
import { BALANCE } from './balanceConfig'
import { GameState, DefeatReason, MissionStats, RadioMessage } from '../types'
import { events } from '../core/EventBus'
import { sound } from '../audio/SoundManager'
import { playgama } from '../platform/PlaygamaService'
import { ballistics } from './BallisticsManager'
import { squadAI } from './SquadAIController'
import { enemyDirector } from './EnemySpawnDirector'
import { destruction } from './DestructionSystem'
import { SceneManager } from '../rendering/SceneManager'

export class GameManager {
  private static instance: GameManager
  private state: GameState = 'MENU'
  private stats: MissionStats = {
    elapsedTime: 0,
    timeLimit: BALANCE.squad.missionDurationLimit,
    enemiesKilled: 0,
    armorDestroyed: 0,
    chainExplosions: 0,
    shotsFired: 0,
    shotsHit: 0,
    survivors: BALANCE.squad.soldierCount,
    combo: 0,
    maxCombo: 0,
    creditsEarned: 0,
    totalScore: 0,
    dangerCloseWarning: false,
    dangerDistance: 100
  }

  private radioQueue: RadioMessage[] = []
  private currentRadio: RadioMessage | null = null
  private radioTimer = 0

  public static getInstance(): GameManager {
    if (!GameManager.instance) {
      GameManager.instance = new GameManager()
    }
    return GameManager.instance
  }

  public init(): void {
    this.setupEventListeners()
  }

  private setupEventListeners(): void {
    events.on('INPUT_FIRE_START', () => {
      if (this.state === 'PLAYING') {
        this.stats.shotsFired++
      }
    })

    events.on('INPUT_FIRE_END', () => {})
    events.on('SHOT_FIRED', () => {})

    events.on('ENEMIES_ELIMINATED', (data: { killed: number; armor: number }) => {
      if (this.state !== 'PLAYING') return
      this.stats.enemiesKilled += data.killed
      this.stats.armorDestroyed += data.armor
      this.stats.shotsHit += data.killed + data.armor
      this.stats.combo += data.killed + data.armor
      if (this.stats.combo > this.stats.maxCombo) {
        this.stats.maxCombo = this.stats.combo
      }

      if (data.armor > 0) {
        this.pushRadio('NAVIGATOR', 'Direct hit! Heavy armor neutralized!')
      } else if (data.killed >= 3) {
        this.pushRadio('GUNNER', 'Good effect on target! Multiple hostiles down.')
      }
    })

    events.on('CHAIN_DETONATION_OCCURRED', () => {
      if (this.state !== 'PLAYING') return
      this.stats.chainExplosions++
      this.stats.combo += 2
      this.pushRadio('COPILOT', 'Secondary explosion! Fuel depot cooking off!')
    })

    events.on('ENEMY_FIRED_AT_SQUAD', (data: { damage: number }) => {
      if (this.state !== 'PLAYING') return
      const squad = squadAI.getSquadState()
      const living = squad.filter((s) => s.isAlive)
      if (living.length > 0) {
        const victim = living[Math.floor(Math.random() * living.length)]
        victim.health = Math.max(0, victim.health - data.damage)
        if (victim.health <= 0) {
          victim.isAlive = false
          this.pushRadio('BRAVO-6', `Man down! We are taking heavy fire!`)
          if (squadAI.getLivingCount() === 0) {
            this.triggerDefeat('SQUAD_KIA')
          }
        }
      }
    })

    events.on('FRIENDLY_FIRE_INCIDENT', () => {
      if (this.state !== 'PLAYING') return
      this.pushRadio('HQ', 'FRIENDLY FIRE! CEASE FIRE! Mission aborted!')
      this.triggerDefeat('FRIENDLY_FIRE')
    })

    events.on('SQUAD_KIA_INCIDENT', () => {
      if (this.state !== 'PLAYING') return
      this.triggerDefeat('SQUAD_KIA')
    })

    events.on('SQUAD_REACHED_LZ', () => {
      if (this.state !== 'PLAYING') return
      const remainingArmor = enemyDirector.getHeavyArmorRemaining()
      if (remainingArmor === 0) {
        this.triggerVictory()
      } else {
        this.pushRadio('PILOT', 'LZ hot! Gunner, eliminate remaining armor before dustoff!')
      }
    })

    events.on('PLATFORM_PAUSE', (isPaused: boolean) => {
      if (isPaused && this.state === 'PLAYING') {
        this.setState('PAUSED')
      } else if (!isPaused && this.state === 'PAUSED') {
        this.setState('PLAYING')
      }
    })
  }

  public getState(): GameState {
    return this.state
  }

  public getStats(): MissionStats {
    this.stats.survivors = squadAI.getLivingCount()
    return { ...this.stats }
  }

  public setState(newState: GameState): void {
    const prevState = this.state
    this.state = newState
    events.emit('GAME_STATE_CHANGED', newState)

    const scene = SceneManager.getInstance()

    if (newState === 'MENU') {
      scene.setHangarMode(true)
    } else if (newState === 'ARMORY') {
      scene.setHangarMode(true)
    } else if (newState === 'PLAYING') {
      scene.setHangarMode(false)
      if (prevState === 'MENU' || prevState === 'VICTORY' || prevState === 'DEFEAT') {
        this.startNewMission()
      }
    }
  }

  public startNewMission(): void {
    this.stats = {
      elapsedTime: 0,
      timeLimit: BALANCE.squad.missionDurationLimit,
      enemiesKilled: 0,
      armorDestroyed: 0,
      chainExplosions: 0,
      shotsFired: 0,
      shotsHit: 0,
      survivors: BALANCE.squad.soldierCount,
      combo: 0,
      maxCombo: 0,
      creditsEarned: 0,
      totalScore: 0,
      dangerCloseWarning: false,
      dangerDistance: 100
    }

    ballistics.reset()
    squadAI.reset()
    enemyDirector.reset()
    destruction.reset()
    this.radioQueue = []
    this.currentRadio = null

    this.pushRadio('HQ', 'Angel 2-0, you are cleared hot. Escort Bravo-6 to extraction.')
    this.pushRadio('BRAVO-6', 'Spectre, Bravo-6 moving out. Keep an eye on our flank.')
  }

  public update(dt: number, aimPos: THREE.Vector3): void {
    if (this.state !== 'PLAYING') return

    this.stats.elapsedTime += dt

    // Timeout Check
    if (this.stats.elapsedTime >= this.stats.timeLimit) {
      this.triggerDefeat('TIMEOUT')
      return
    }

    // Danger Close Warning Check
    const currentCaliber = ballistics.getCaliber()
    const dangerCheck = squadAI.checkDangerCloseWarning(aimPos, currentCaliber)
    this.stats.dangerCloseWarning = dangerCheck.isDanger
    this.stats.dangerDistance = Math.round(dangerCheck.distance)

    if (dangerCheck.isDanger && currentCaliber === '105mm') {
      sound.playDangerWarningBeep()
    }

    // Radio Messages Handling
    if (this.currentRadio) {
      this.radioTimer -= dt
      if (this.radioTimer <= 0) {
        this.currentRadio = null
        events.emit('RADIO_TRANSCRIPT_UPDATED', null)
      }
    } else if (this.radioQueue.length > 0) {
      this.currentRadio = this.radioQueue.shift()!
      this.radioTimer = this.currentRadio.duration
      sound.playRadioChirp()
      events.emit('RADIO_TRANSCRIPT_UPDATED', this.currentRadio)
    }

    // Update subsystems
    const squadCenter = squadAI.getCenterPosition()
    squadAI.update(dt, false)
    enemyDirector.update(dt, squadCenter)
    destruction.update(dt)

    // Check victory condition if LZ reached and time >= 85s
    if (this.stats.elapsedTime >= 85 && squadAI.getLivingCount() > 0 && enemyDirector.getHeavyArmorRemaining() === 0) {
      this.triggerVictory()
    }
  }

  public pushRadio(speaker: string, text: string, duration = 3.5): void {
    this.radioQueue.push({ speaker, text, duration })
  }

  private triggerVictory(): void {
    this.pushRadio('PILOT', 'All Bravo teams aboard, dustoff! Outstanding support, Spectre!')
    this.calculateFinalScore()

    const save = playgama.getSaveData()
    const newCredits = save.credits + this.stats.creditsEarned
    const newHigh = Math.max(save.highScore, this.stats.totalScore)
    playgama.updateSaveData({ credits: newCredits, highScore: newHigh })

    this.setState('VICTORY')
  }

  private triggerDefeat(reason: DefeatReason): void {
    this.calculateFinalScore()
    events.emit('DEFEAT_REASON_SET', reason)
    this.setState('DEFEAT')
  }

  private calculateFinalScore(): void {
    const accuracy = this.stats.shotsFired > 0 ? Math.min(1.0, this.stats.shotsHit / this.stats.shotsFired) : 0.5
    const survivorMultiplier = squadAI.getLivingCount() / BALANCE.squad.soldierCount
    const timeBonus = Math.max(0, Math.floor((this.stats.timeLimit - this.stats.elapsedTime) * 20))

    const baseScore =
      this.stats.enemiesKilled * 150 +
      this.stats.armorDestroyed * 500 +
      this.stats.chainExplosions * 300

    this.stats.totalScore = Math.floor((baseScore * (0.5 + accuracy * 0.5) * Math.max(0.2, survivorMultiplier)) + timeBonus)
    this.stats.creditsEarned = Math.floor(this.stats.totalScore * 0.15)
  }

  public doubleCreditsReward(): void {
    const save = playgama.getSaveData()
    save.credits += this.stats.creditsEarned
    this.stats.creditsEarned *= 2
    playgama.updateSaveData({ credits: save.credits })
    events.emit('CREDITS_DOUBLED', this.stats.creditsEarned)
  }

  public reviveSquadReward(): void {
    squadAI.reviveAll()
    this.pushRadio('HQ', 'Combat medevac deployed! Bravo-6 is back on their feet!')
    this.setState('PLAYING')
  }
}

export const game = GameManager.getInstance()
