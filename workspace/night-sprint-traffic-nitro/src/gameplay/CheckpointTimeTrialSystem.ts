import { TrackDefinition } from '../types';
import { eventBus } from '../core/EventBus';

export class CheckpointTimeTrialSystem {
  track: TrackDefinition | null = null;
  playerDistanceMeters = 0;
  totalTrackLengthMeters = 2400;

  timeRemainingSec = 25.0;
  totalElapsedTimeSec = 0.0;
  isRunActive = false;
  isFinished = false;

  private checkpoints: { distance: number; hit: boolean; bonus: number }[] = [];

  start(track: TrackDefinition): void {
    this.track = track;
    this.totalTrackLengthMeters = track.lengthMeters;
    this.playerDistanceMeters = 0;
    this.totalElapsedTimeSec = 0;
    this.isRunActive = true;
    this.isFinished = false;

    // Initial 25 seconds start time
    this.timeRemainingSec = 25.0;

    // 3 Checkpoints at 25%, 50% and 75%
    const l = track.lengthMeters;
    this.checkpoints = [
      { distance: l * 0.25, hit: false, bonus: 20.0 },
      { distance: l * 0.50, hit: false, bonus: 18.0 },
      { distance: l * 0.75, hit: false, bonus: 16.0 },
    ];
  }

  update(dt: number, playerZ: number): void {
    if (!this.isRunActive || this.isFinished) return;

    this.totalElapsedTimeSec += dt;
    this.timeRemainingSec -= dt;
    this.playerDistanceMeters = Math.max(0, playerZ);

    for (let i = 0; i < this.checkpoints.length; i++) {
      const cp = this.checkpoints[i];
      if (!cp.hit && this.playerDistanceMeters >= cp.distance) {
        cp.hit = true;
        this.timeRemainingSec += cp.bonus;
        eventBus.emit('checkpoint:hit', {
          checkpointIndex: i + 1,
          timeBonus: cp.bonus,
          timeRemaining: this.timeRemainingSec,
        });
        eventBus.emit('score:stunt', {
          type: 'CHECKPOINT',
          points: 1000,
          multiplier: 1,
          message: 'ЧЕКПОИНТ ' + (i + 1) + '! (+' + cp.bonus + 'с)',
        });
      }
    }

    if (this.playerDistanceMeters >= this.totalTrackLengthMeters) {
      this.finish(true);
      return;
    }

    if (this.timeRemainingSec <= 0) {
      this.finish(false);
    }
  }

  finish(success: boolean): void {
    if (this.isFinished || !this.track) return;
    this.isFinished = true;
    this.isRunActive = false;

    if (success) {
      let medal: 'none' | 'bronze' | 'silver' | 'gold' = 'gold';
      if (this.totalElapsedTimeSec <= this.track.targetGoldSec) {
        medal = 'gold';
      } else if (this.totalElapsedTimeSec <= this.track.targetSilverSec) {
        medal = 'silver';
      } else if (this.totalElapsedTimeSec <= this.track.targetBronzeSec) {
        medal = 'bronze';
      } else {
        medal = 'none';
      }

      eventBus.emit('game:finish_run', {
        trackId: this.track.id,
        totalTimeSec: this.totalElapsedTimeSec,
        medal,
        nearMissCount: 0,
        driftPoints: 0,
        score: 0,
        earnedCash: this.track.rewardCash,
        earnedRep: this.track.rewardRep,
        isNewRecord: true,
      });
    } else {
      eventBus.emit('game:crash', { fatal: true, speedKmh: 0 });
    }
  }

  addTimeBonus(seconds: number): void {
    this.timeRemainingSec += seconds;
  }
}

export const checkpointTimeTrialSystem = new CheckpointTimeTrialSystem();
