import * as THREE from 'three';
import { EntityManager } from '../entities/EntityManager';
import { AdaptiveBotDuelistEngineSystem } from './AdaptiveBotDuelistEngineSystem';
import { StorageService } from '../platform/StorageService';
import { AudioManager } from '../audio/AudioManager';
import { EventBus } from '../core/EventBus';

export type MatchPhase = 'WARMUP' | 'LIVE' | 'SLOWMO' | 'ROUND_END' | 'MATCH_END';

export class BestOf5MatchDirectorFlowSystem {
  public static readonly T_ROUND_MAX = 15.0; // Round maximum duration (s)
  public static readonly T_CRITICAL_THRESHOLD = 4.0; // Pressure threshold (s)
  public static readonly DRAW_LOSS_PENALTY = -50; // Draw-loss rating penalty

  public phase: MatchPhase = 'WARMUP';
  public playerScore: number = 0;
  public botScore: number = 0;
  public currentRound: number = 1;
  public roundTimeLeft: number = 15.0;
  public isPlayerSpawnNorth: boolean = false;
  public phaseTimer: number = 0;
  public lastWinner: 'player' | 'bot' | 'draw' = 'draw';
  public lastIsHeadshot: boolean = false;

  private botSystem: AdaptiveBotDuelistEngineSystem;

  constructor() {
    this.botSystem = new AdaptiveBotDuelistEngineSystem();
  }

  public startNewMatch(): void {
    this.playerScore = 0;
    this.botScore = 0;
    this.currentRound = 1;
    this.isPlayerSpawnNorth = false;
    this.startRound();
  }

  public startRound(): void {
    this.phase = 'LIVE';
    this.roundTimeLeft = BestOf5MatchDirectorFlowSystem.T_ROUND_MAX;
    this.phaseTimer = 0;
    this.lastWinner = 'draw';
    this.lastIsHeadshot = false;

    const entities = EntityManager.get();
    const storage = StorageService.get().getData();

    // Alternate spawn points between rounds
    const pPos = this.isPlayerSpawnNorth ? new THREE.Vector3(0, 1.65, -6) : new THREE.Vector3(0, 1.65, 6);
    const pYaw = this.isPlayerSpawnNorth ? Math.PI : 0;

    const bPos = this.isPlayerSpawnNorth ? new THREE.Vector3(0, 0, 6) : new THREE.Vector3(0, 0, -6);
    const bYaw = this.isPlayerSpawnNorth ? 0 : Math.PI;

    entities.player.reset(pPos, pYaw);
    entities.player.setWeapon(storage.selectedWeapon || 'deagle');
    entities.bot.reset(bPos, bYaw);

    this.botSystem.reset(storage.totalWins || 0);

    AudioManager.get().playCountdown();

    EventBus.get().emit('ROUND_TIME_TICK', {
      timeLeft: this.roundTimeLeft,
      maxTime: BestOf5MatchDirectorFlowSystem.T_ROUND_MAX,
      isCritical: false
    });
  }

  public update(dt: number): void {
    const entities = EntityManager.get();

    switch (this.phase) {
      case 'LIVE': {
        this.roundTimeLeft -= dt;
        const isCritical = this.roundTimeLeft <= BestOf5MatchDirectorFlowSystem.T_CRITICAL_THRESHOLD;

        EventBus.get().emit('ROUND_TIME_TICK', {
          timeLeft: Math.max(0, this.roundTimeLeft),
          maxTime: BestOf5MatchDirectorFlowSystem.T_ROUND_MAX,
          isCritical
        });

        this.botSystem.update(dt, this.roundTimeLeft);

        // Check Round Ending Conditions
        if (!entities.bot.isAlive) {
          // Player won round
          this.lastWinner = 'player';
          this.lastIsHeadshot = !entities.bot.hasHelmet;
          this.playerScore++;
          this.enterSlowmoOrRoundEnd();
        } else if (!entities.player.isAlive) {
          // Bot won round
          this.lastWinner = 'bot';
          this.lastIsHeadshot = false;
          this.botScore++;
          this.enterSlowmoOrRoundEnd();
        } else if (this.roundTimeLeft <= 0) {
          // Time expired -> Draw-Loss for both
          this.lastWinner = 'draw';
          this.lastIsHeadshot = false;
          this.botScore++;
          this.playerScore++;
          this.enterSlowmoOrRoundEnd();
        }
        break;
      }

      case 'SLOWMO': {
        this.phaseTimer += dt;
        if (this.phaseTimer >= 0.35) {
          this.phase = 'ROUND_END';
          this.phaseTimer = 0;
          this.notifyRoundEnd();
        }
        break;
      }

      case 'ROUND_END': {
        this.phaseTimer += dt;
        if (this.phaseTimer >= 2.0) {
          // Check if match won (Best of 5 -> 3 wins)
          if (this.playerScore >= 3 || this.botScore >= 3 || this.currentRound >= 5) {
            this.phase = 'MATCH_END';
            this.finishMatch();
          } else {
            this.currentRound++;
            this.isPlayerSpawnNorth = !this.isPlayerSpawnNorth; // Swap sides
            this.startRound();
          }
        }
        break;
      }

      case 'MATCH_END': {
        // Awaiting player action on match end screen
        break;
      }
    }
  }

  private enterSlowmoOrRoundEnd(): void {
    if (this.lastIsHeadshot) {
      this.phase = 'SLOWMO';
      this.phaseTimer = 0;
    } else {
      this.phase = 'ROUND_END';
      this.phaseTimer = 0;
      this.notifyRoundEnd();
    }
  }

  private notifyRoundEnd(): void {
    const elapsed = BestOf5MatchDirectorFlowSystem.T_ROUND_MAX - Math.max(0, this.roundTimeLeft);
    EventBus.get().emit('ROUND_ENDED', {
      winner: this.lastWinner,
      isHeadshot: this.lastIsHeadshot,
      playerScore: this.playerScore,
      botScore: this.botScore,
      roundTime: elapsed
    });
  }

  private finishMatch(): void {
    const isWin = this.playerScore > this.botScore;
    const storage = StorageService.get();
    const cur = storage.getData();

    const eloChange = isWin ? 35 : -20;
    const earnedCoins = isWin ? 100 : 25;

    storage.updateData({
      elo: Math.max(100, cur.elo + eloChange),
      coins: cur.coins + earnedCoins,
      totalMatches: cur.totalMatches + 1,
      totalWins: isWin ? cur.totalWins + 1 : cur.totalWins,
      totalHeadshots: this.lastIsHeadshot ? cur.totalHeadshots + 1 : cur.totalHeadshots
    });

    if (isWin) {
      AudioManager.get().playWinFanfare();
    }

    EventBus.get().emit('MATCH_ENDED', {
      winner: isWin ? 'player' : 'bot',
      playerScore: this.playerScore,
      botScore: this.botScore,
      eloChange,
      totalCoins: storage.getData().coins
    });
  }
}