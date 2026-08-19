import { sceneManager } from '../rendering/SceneManager';

export class JuiceSystem {
  private static instance: JuiceSystem;
  private hitstopTimer: number = 0;

  public static getInstance(): JuiceSystem {
    if (!JuiceSystem.instance) {
      JuiceSystem.instance = new JuiceSystem();
    }
    return JuiceSystem.instance;
  }

  public triggerImpact(trauma: number = 0.3, hitstopMs: number = 40, vibrateMs: number = 25): void {
    sceneManager.addTrauma(trauma);

    if (hitstopMs > 0) {
      this.hitstopTimer = hitstopMs / 1000;
    }

    if (vibrateMs > 0 && typeof navigator !== 'undefined' && navigator.vibrate) {
      try {
        navigator.vibrate(vibrateMs);
      } catch {}
    }
  }

  public update(dtSeconds: number): number {
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dtSeconds;
      return 0.1; // Slow motion timescale
    }
    return 1.0;
  }
}

export const juiceSystem = JuiceSystem.getInstance();
