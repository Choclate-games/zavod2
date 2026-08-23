import { GAME_BALANCE } from '../config/balance';
import { eventBus } from '../core/EventBus';

export interface MatchStats {
  elapsedTime: number;
  playerFrags: number;
  leadingBotFrags: number;
  headshots: number;
  killstreaks: number;
  score: number;
  isVictory: boolean;
}

export class MatchFlowVictoryResolutionSystem {
  public matchDuration: number = GAME_BALANCE.match_duration; // 90 seconds
  public timeRemaining: number = GAME_BALANCE.match_duration;
  public playerFrags: number = 0;
  public leadingBotFrags: number = 0;
  public headshots: number = 0;
  public totalKillstreaks: number = 0;
  public isMatchActive: boolean = false;
  private botFragTimer: number = 0;

  public startMatch(): void {
    this.timeRemaining = this.matchDuration;
    this.playerFrags = 0;
    this.leadingBotFrags = 0;
    this.headshots = 0;
    this.totalKillstreaks = 0;
    this.isMatchActive = true;
    this.botFragTimer = 10.0 + Math.random() * 5.0;

    eventBus.emit('MATCH_TIME_UPDATED', Math.ceil(this.timeRemaining));
    eventBus.emit('MATCH_SCORE_UPDATED', {
      player: this.playerFrags,
      leader: Math.max(this.playerFrags, this.leadingBotFrags),
      target: GAME_BALANCE.win_frags
    });
  }

  public recordPlayerFrag(headshot: boolean): void {
    if (!this.isMatchActive) return;
    this.playerFrags++;
    if (headshot) this.headshots++;

    eventBus.emit('MATCH_SCORE_UPDATED', {
      player: this.playerFrags,
      leader: Math.max(this.playerFrags, this.leadingBotFrags),
      target: GAME_BALANCE.win_frags
    });

    if (this.playerFrags >= GAME_BALANCE.win_frags) {
      this.endMatch(true);
    }
  }

  public update(dt: number): void {
    if (!this.isMatchActive) return;

    this.timeRemaining -= dt;
    eventBus.emit('MATCH_TIME_UPDATED', Math.ceil(Math.max(0, this.timeRemaining)));

    // Simulate competitor bots scoring frags periodically
    this.botFragTimer -= dt;
    if (this.botFragTimer <= 0) {
      this.botFragTimer = 7.0 + Math.random() * 8.0;
      if (this.leadingBotFrags < GAME_BALANCE.win_frags - 1) {
        this.leadingBotFrags++;
        eventBus.emit('MATCH_SCORE_UPDATED', {
          player: this.playerFrags,
          leader: Math.max(this.playerFrags, this.leadingBotFrags),
          target: GAME_BALANCE.win_frags
        });
      }
    }

    if (this.leadingBotFrags >= GAME_BALANCE.win_frags) {
      this.endMatch(false);
    } else if (this.timeRemaining <= 0) {
      this.endMatch(this.playerFrags >= this.leadingBotFrags && this.playerFrags >= GAME_BALANCE.win_frags);
    }
  }

  public calculateFinalScore(isVictory: boolean): MatchStats {
    const elapsed = this.matchDuration - this.timeRemaining;
    const timeBonus = Math.max(0, Math.floor((this.matchDuration - elapsed) * 10));
    const score = (this.playerFrags * 100) + (this.headshots * 50) + (this.totalKillstreaks * 150) + timeBonus;

    return {
      elapsedTime: Math.floor(elapsed),
      playerFrags: this.playerFrags,
      leadingBotFrags: this.leadingBotFrags,
      headshots: this.headshots,
      killstreaks: this.totalKillstreaks,
      score,
      isVictory
    };
  }

  private endMatch(isVictory: boolean): void {
    this.isMatchActive = false;
    const stats = this.calculateFinalScore(isVictory);
    eventBus.emit('GAME_STATE_CHANGED', isVictory ? 'VICTORY' : 'DEFEAT');
  }
}