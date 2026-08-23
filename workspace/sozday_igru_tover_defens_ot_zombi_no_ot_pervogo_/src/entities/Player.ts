import { BALANCE } from '../balance';
import { EventBus } from '../core/EventBus';

export interface PlayerInputState {
  moveX: number;
  moveZ: number;
  lookDeltaX: number;
  lookDeltaY: number;
  isSprinting: boolean;
  isCryoSpraying: boolean;
  isRiveting: boolean;
  interactPressed: boolean;
  throwFlarePressed: boolean;
  meleeBashPressed: boolean;
  dropCellPressed: boolean;
}

export class Player {
  public position = { x: 0, y: 1.7, z: 0 };
  public yaw = 0;
  public pitch = 0;

  public cryoTank: number = BALANCE.thermal.zapas_krio_hladagenta_v_rantse;
  public isCarryingCell = false;
  public stamina: number = BALANCE.player.max_stamina;
  public meleeCooldown = 0;

  private stepTime = 0;
  public bobOffset = 0;

  public update(input: PlayerInputState, dt: number): void {
    // 1. Поворот камеры
    this.yaw -= input.lookDeltaX;
    this.pitch -= input.lookDeltaY;
    this.pitch = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, this.pitch));

    // 2. Логика спринта и выносливости
    let isSprinting = input.isSprinting;
    if (isSprinting && (input.moveX !== 0 || input.moveZ !== 0)) {
      this.stamina = Math.max(0, this.stamina - BALANCE.player.stamina_drain_sprint * dt);
      if (this.stamina <= 0) isSprinting = false;
    } else {
      this.stamina = Math.min(BALANCE.player.max_stamina as number, this.stamina + BALANCE.player.stamina_recovery * dt);
    }

    // 3. Скорость перемещения с учетом веса Overcharge-ячейки
    let baseSpeed: number = isSprinting ? BALANCE.player.sprint_speed : BALANCE.player.walk_speed;
    if (this.isCarryingCell) {
      baseSpeed *= (1.0 - BALANCE.overcharge.shtraf_k_skorosti_inzhenera_pri_perenoske_yacheyki);
    }

    // 4. Расчет направления движения относительно угла обзора
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);

    const forwardX = -sin;
    const forwardZ = -cos;
    const rightX = cos;
    const rightZ = -sin;

    const moveDirX = rightX * input.moveX + forwardX * input.moveZ;
    const moveDirZ = rightZ * input.moveX + forwardZ * input.moveZ;

    const len = Math.hypot(moveDirX, moveDirZ);
    if (len > 0.001) {
      const normX = moveDirX / len;
      const normZ = moveDirZ / len;

      this.position.x += normX * baseSpeed * dt;
      this.position.z += normZ * baseSpeed * dt;

      // Ограничение по границам платформы обороны
      this.position.x = Math.max(-10, Math.min(10, this.position.x));
      this.position.z = Math.max(-5.2, Math.min(5.5, this.position.z));

      this.stepTime += dt * (isSprinting ? 12 : 8);
      this.bobOffset = Math.sin(this.stepTime) * 0.04;
    } else {
      this.bobOffset *= 0.85;
    }

    // 5. Кулдаун ближнего боя / пневмо-удара
    if (this.meleeCooldown > 0) {
      this.meleeCooldown = Math.max(0, this.meleeCooldown - dt);
    }

    // 6. Расход крио-агента при активном поливе
    if (input.isCryoSpraying && this.cryoTank > 0) {
      this.cryoTank = Math.max(0, this.cryoTank - 25.0 * dt);
      EventBus.emit('CRYO_LEVEL_CHANGED', this.cryoTank);
    }
  }

  public refillCryo(): void {
    this.cryoTank = BALANCE.thermal.zapas_krio_hladagenta_v_rantse;
    EventBus.emit('CRYO_LEVEL_CHANGED', this.cryoTank);
  }

  public reset(): void {
    this.position = { x: 0, y: 1.7, z: 0 };
    this.yaw = 0;
    this.pitch = 0;
    this.cryoTank = BALANCE.thermal.zapas_krio_hladagenta_v_rantse;
    this.isCarryingCell = false;
    this.stamina = BALANCE.player.max_stamina;
    this.meleeCooldown = 0;
    EventBus.emit('CRYO_LEVEL_CHANGED', this.cryoTank);
  }
}
