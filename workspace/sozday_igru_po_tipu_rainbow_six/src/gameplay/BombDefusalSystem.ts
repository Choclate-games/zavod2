import { EventBus } from "../core/EventBus";
import type { BombData, WireColor } from "../core/Types";

export class BombDefusalSystem {
  private eventBus: EventBus;
  public bombData: BombData | null = null;
  public isActive = false;
  private timerBeepInterval = 1.0;
  private timerBeepTimer = 0;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  setupBomb(timeLimit = 25.0): BombData {
    const wires: WireColor[] = ["red", "blue", "yellow"];
    const targetWire = wires[Math.floor(Math.random() * wires.length)];

    this.bombData = {
      x: 0,
      y: 0.6,
      z: 5.0,
      targetWire,
      timeLimit,
      remainingTime: timeLimit,
      isDefused: false,
      isDetonated: false,
    };
    this.isActive = true;
    this.timerBeepTimer = 0;

    return this.bombData;
  }

  update(realDt: number): { isDetonated: boolean; isDefused: boolean; remainingTime: number } {
    if (!this.isActive || !this.bombData || this.bombData.isDefused || this.bombData.isDetonated) {
      return {
        isDetonated: this.bombData?.isDetonated ?? false,
        isDefused: this.bombData?.isDefused ?? false,
        remainingTime: this.bombData?.remainingTime ?? 0,
      };
    }

    this.bombData.remainingTime -= realDt;

    // Escalating beep interval
    const ratio = Math.max(0.1, this.bombData.remainingTime / this.bombData.timeLimit);
    this.timerBeepInterval = ratio * 0.9;

    this.timerBeepTimer += realDt;
    if (this.timerBeepTimer >= this.timerBeepInterval) {
      this.timerBeepTimer = 0;
      // Beep handled by AudioManager
    }

    if (this.bombData.remainingTime <= 0) {
      this.bombData.remainingTime = 0;
      this.bombData.isDetonated = true;
      this.isActive = false;
      this.eventBus.emit("bomb:exploded", undefined);
    }

    return {
      isDetonated: this.bombData.isDetonated,
      isDefused: this.bombData.isDefused,
      remainingTime: this.bombData.remainingTime,
    };
  }

  cutWire(wire: WireColor): { success: boolean; correct: boolean; remainingTime: number } {
    if (!this.isActive || !this.bombData || this.bombData.isDefused) {
      return { success: false, correct: false, remainingTime: 0 };
    }

    const isCorrect = wire === this.bombData.targetWire;

    if (isCorrect) {
      this.bombData.isDefused = true;
      this.isActive = false;
      this.eventBus.emit("bomb:wire_cut", {
        color: wire,
        correct: true,
        remainingTime: this.bombData.remainingTime,
      });
      this.eventBus.emit("bomb:defused", undefined);
      return { success: true, correct: true, remainingTime: this.bombData.remainingTime };
    } else {
      // Wrong wire penalty: -8.0s
      this.bombData.remainingTime = Math.max(0, this.bombData.remainingTime - 8.0);
      this.eventBus.emit("bomb:wire_cut", {
        color: wire,
        correct: false,
        remainingTime: this.bombData.remainingTime,
      });

      if (this.bombData.remainingTime <= 0) {
        this.bombData.isDetonated = true;
        this.isActive = false;
        this.eventBus.emit("bomb:exploded", undefined);
      }

      return { success: false, correct: false, remainingTime: this.bombData.remainingTime };
    }
  }

  reset(): void {
    this.bombData = null;
    this.isActive = false;
  }
}
