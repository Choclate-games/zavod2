import { BALANCE } from '../core/Constants';
import { EventBus, BreathState } from '../core/EventBus';

export class SniperController {
  public stamina = 1.0; // 0.0 to 1.0
  public isHoldingBreath = false;
  public isExhausted = false;
  public hyperventilationTimer = 0.0;
  public swayX = 0.0;
  public swayY = 0.0;
  public aimPitch = 0.0; // Vertical aim angle
  public aimYaw = 0.0; // Horizontal aim angle
  public recoilPitch = 0.0;
  public recoilYaw = 0.0;
  public timeScale = 1.0;
  public state: BreathState = 'NORMAL';

  private swayTime = 0.0;
  private currentSwayAmount = 16.0; // px / units

  public update(dt: number, isFocusPressed: boolean): void {
    this.swayTime += dt;

    if (this.isExhausted) {
      this.hyperventilationTimer -= dt;
      this.state = 'HYPERVENTILATION';
      this.timeScale = 1.0;
      this.currentSwayAmount = 40.0;

      // Chaotic heavy sway during hyperventilation
      this.swayX = Math.sin(this.swayTime * 6.0) * 0.025;
      this.swayY = Math.cos(this.swayTime * 8.0) * 0.035;

      if (this.hyperventilationTimer <= 0) {
        this.isExhausted = false;
        this.hyperventilationTimer = 0;
      }
    } else if (isFocusPressed && this.stamina > 0.0) {
      this.isHoldingBreath = true;
      this.state = 'HOLDING';
      this.timeScale = BALANCE.time_dilation; // 0.50x

      // Consume oxygen
      const drainRate = 1.0 / BALANCE.max_breath_time; // 25% per sec -> 4.00s max
      this.stamina = Math.max(0.0, this.stamina - drainRate * dt);

      // Stabilize sway towards zero in 0.25s
      this.currentSwayAmount = Math.max(0.0, this.currentSwayAmount - (16.0 / BALANCE.scope_stabilization_time) * dt);
      this.swayX = Math.sin(this.swayTime * 1.5) * (this.currentSwayAmount * 0.0003);
      this.swayY = Math.cos(this.swayTime * 1.2) * (this.currentSwayAmount * 0.0003);

      if (this.stamina <= 0.0) {
        this.triggerHyperventilation();
      }
    } else {
      this.isHoldingBreath = false;
      this.timeScale = 1.0;
      this.state = this.stamina < 1.0 ? 'RECOVERY' : 'NORMAL';

      // Oxygen recovery (33.3 %/s -> full in 3.0s)
      const recoveryRate = BALANCE.breath_recovery_speed / 100.0;
      this.stamina = Math.min(1.0, this.stamina + recoveryRate * dt);

      // Natural breathing sway (±16 px/s equivalent)
      this.currentSwayAmount = 16.0;
      this.swayX = Math.sin(this.swayTime * 1.5) * 0.008;
      this.swayY = Math.cos(this.swayTime * 2.0) * 0.012;
    }

    // Recover recoil
    this.recoilPitch = Math.max(0.0, this.recoilPitch - dt * 6.0);
    this.recoilYaw = this.recoilYaw * Math.max(0.0, 1.0 - dt * 5.0);

    EventBus.emit('BREATH_STATE_CHANGED', this.state);
  }

  public applyAimDelta(deltaX: number, deltaY: number, sensitivity = 1.0): void {
    const scale = 0.0008 * sensitivity;
    this.aimYaw -= deltaX * scale;
    this.aimPitch += deltaY * scale;

    // Clamp vertical view
    this.aimPitch = Math.max(-0.6, Math.min(0.6, this.aimPitch));
    this.aimYaw = Math.max(-1.2, Math.min(1.2, this.aimYaw));
  }

  public triggerShotRecoil(): void {
    this.recoilPitch = 0.035; // ~1.8 degrees kick
    this.recoilYaw = (Math.random() - 0.5) * 0.01;
  }

  private triggerHyperventilation(): void {
    this.isExhausted = true;
    this.isHoldingBreath = false;
    this.hyperventilationTimer = BALANCE.hyperventilation_penalty_time; // 2.50s
    this.state = 'HYPERVENTILATION';
    EventBus.emit('BREATH_STATE_CHANGED', 'HYPERVENTILATION');
  }

  public getEffectiveAim(): { pitch: number; yaw: number } {
    return {
      pitch: this.aimPitch + this.swayY + this.recoilPitch,
      yaw: this.aimYaw + this.swayX + this.recoilYaw
    };
  }
}
