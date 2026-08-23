import { EntityManager } from '../entities/EntityManager';
import { Player, PlayerInputState } from '../entities/Player';
import { BALANCE } from '../balance';
import { AudioManager } from '../audio/AudioManager';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { EventBus } from '../core/EventBus';

export class ThermalSystem {
  private entities: EntityManager;
  private player: Player;
  private particles: ParticleSystem;

  constructor(entities: EntityManager, player: Player, particles: ParticleSystem) {
    this.entities = entities;
    this.player = player;
    this.particles = particles;
  }

  public update(input: PlayerInputState, dt: number): void {
    // 1. Восстановление ячеек на стойке генератора
    if (this.entities.generatorCellsAvailable < BALANCE.overcharge.kolichestvo_dostupnyh_yacheek_na_rubezhe) {
      this.entities.generatorRechargeTimer += dt;
      if (this.entities.generatorRechargeTimer >= BALANCE.overcharge.vremya_perezaryadki_generatora_na_baze) {
        this.entities.generatorRechargeTimer = 0;
        this.entities.generatorCellsAvailable++;
        EventBus.emit('TOAST_SHOW', { message: 'Генератор: новая Overcharge-ячейка готова!', type: 'info' });
      }
    }

    // 2. Взаимодействие со стойкой генератора (дистанция < 2.5 м)
    const distToGen = Math.hypot(this.player.position.x - (-8), this.player.position.z - 4);
    if (distToGen < 2.5 && input.interactPressed) {
      if (!this.player.isCarryingCell && this.entities.generatorCellsAvailable > 0) {
        this.player.isCarryingCell = true;
        this.entities.generatorCellsAvailable--;
        AudioManager.playOvercharge();
        EventBus.emit('OVERCHARGE_CELL_PICKED', undefined);
        EventBus.emit('TOAST_SHOW', { message: 'Энергоячейка взята! Доставьте в слот турели.', type: 'info' });
      }
    }

    // 3. Взаимодействие со станцией заправки крио-агента (дистанция < 2.5 м)
    const distToCryoStation = Math.hypot(this.player.position.x - 8, this.player.position.z - 4);
    if (distToCryoStation < 2.5 && (input.interactPressed || this.player.cryoTank < 20)) {
      if (this.player.cryoTank < BALANCE.thermal.zapas_krio_hladagenta_v_rantse) {
        this.player.refillCryo();
        AudioManager.playCryoHiss();
        EventBus.emit('TOAST_SHOW', { message: 'Крио-ранец полностью заправлен фреоном!', type: 'info' });
      }
    }

    // 4. Сброс / установка ячейки по клавише [G]
    if (input.dropCellPressed && this.player.isCarryingCell) {
      this.player.isCarryingCell = false;
      EventBus.emit('TOAST_SHOW', { message: 'Энергоячейка сброшена на настил.', type: 'warn' });
    }

    // 5. Обслуживание турелей инженером
    for (const slot of this.entities.turretSlots) {
      if (!slot.isMounted) continue;

      const dist = Math.hypot(this.player.position.x - slot.position.x, this.player.position.z - slot.position.z);

      // Вставка Overcharge ячейки в турель
      if (dist < 2.5 && input.interactPressed && this.player.isCarryingCell && !slot.isOvercharged) {
        this.player.isCarryingCell = false;
        slot.isOvercharged = true;
        slot.overchargeTimer = BALANCE.overcharge.dlitelnost_rezhima_overcharge;
        AudioManager.playOvercharge();
        EventBus.emit('OVERCHARGE_CELL_INSERTED', { slotId: slot.id });
        EventBus.emit('TOAST_SHOW', { message: `Сектор ${slot.id + 1}: РЕЖИМ OVERCHARGE АКТИВИРОВАН (+80% DPS)!`, type: 'info' });
      }

      // Крио-охлаждение ствола соплом ранца
      if (dist <= BALANCE.thermal.distantsiya_primeneniya_sopla_ohlazhdeniya && input.isCryoSpraying && this.player.cryoTank > 0) {
        if (slot.heat > 0) {
          slot.heat = Math.max(0, slot.heat - BALANCE.thermal.skorost_sbrosa_tepla_krio_spreem * dt);
          AudioManager.playCryoHiss();

          // Выброс морозного пара
          this.particles.spawnCryoSteam(
            slot.position.x,
            slot.position.y + 0.8,
            slot.position.z,
            0, 1.0, 0
          );

          EventBus.emit('HEAT_LEVEL_CHANGED', { slotId: slot.id, heat: slot.heat, jammed: slot.isJammed });
        }
      }
    }
  }
}
