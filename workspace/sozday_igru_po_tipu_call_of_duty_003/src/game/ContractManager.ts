import { BALANCE } from '../core/Constants';
import { EventBus } from '../core/EventBus';

export interface ContractConfig {
  id: string;
  title: string;
  location: string;
  description: string;
  targetCount: number;
  ammoCount: number;
  baseReward: number;
  timeLimitSeconds: number;
  windDifficulty: number;
}

export const CONTRACTS: ContractConfig[] = [
  {
    id: 'contract_01',
    title: 'Радарный Пост «Скала-4»',
    location: 'Архипелаг Новая Земля',
    description: 'Ликвидировать офицера связи и командира гарнизона до выхода на связь со штабом.',
    targetCount: 2,
    ammoCount: 6,
    baseReward: 1500,
    timeLimitSeconds: 90,
    windDifficulty: 6.0
  },
  {
    id: 'contract_02',
    title: 'Дизельный Узел «Норд-2»',
    location: 'Мыс Желания',
    description: 'Спровоцировать аварию подвесного освещения и снять патрульного снайпера.',
    targetCount: 3,
    ammoCount: 6,
    baseReward: 2400,
    timeLimitSeconds: 85,
    windDifficulty: 8.5
  },
  {
    id: 'contract_03',
    title: 'Бункер «Полярная Звезда»',
    location: 'Залив Моллера',
    description: 'Нейтрализовать 4 ключевые цели при штормовом боковом ветре.',
    targetCount: 4,
    ammoCount: 7,
    baseReward: 3500,
    timeLimitSeconds: 80,
    windDifficulty: 12.0
  }
];

export class ContractManager {
  public currentContract: ContractConfig = CONTRACTS[0];
  public remainingAmmo = 6;
  public eliminatedVIPs = 0;
  public totalKills = 0;
  public headshotKills = 0;
  public accidentKills = 0;
  public shotsFired = 0;
  public sessionTimer = 0.0;
  public isCompleted = false;
  public isFailed = false;

  public startContract(contractId: string): void {
    const found = CONTRACTS.find((c) => c.id === contractId);
    this.currentContract = found || CONTRACTS[0];
    this.remainingAmmo = this.currentContract.ammoCount;
    this.eliminatedVIPs = 0;
    this.totalKills = 0;
    this.headshotKills = 0;
    this.accidentKills = 0;
    this.shotsFired = 0;
    this.sessionTimer = 0;
    this.isCompleted = false;
    this.isFailed = false;

    EventBus.emit('MISSION_OBJECTIVE_UPDATED', {
      eliminated: 0,
      total: this.currentContract.targetCount,
      ammo: this.remainingAmmo
    });
  }

  public recordShot(): boolean {
    if (this.remainingAmmo <= 0) return false;
    this.remainingAmmo--;
    this.shotsFired++;
    EventBus.emit('MISSION_OBJECTIVE_UPDATED', {
      eliminated: this.eliminatedVIPs,
      total: this.currentContract.targetCount,
      ammo: this.remainingAmmo
    });
    return true;
  }

  public recordKill(isVIP: boolean, isHeadshot: boolean, isAccident: boolean): void {
    this.totalKills++;
    if (isHeadshot) this.headshotKills++;
    if (isAccident) this.accidentKills++;

    if (isVIP) {
      this.eliminatedVIPs++;
      EventBus.emit('MISSION_OBJECTIVE_UPDATED', {
        eliminated: this.eliminatedVIPs,
        total: this.currentContract.targetCount,
        ammo: this.remainingAmmo
      });

      if (this.eliminatedVIPs >= this.currentContract.targetCount) {
        this.isCompleted = true;
        EventBus.emit('GAME_STATE_CHANGED', 'VICTORY');
      }
    }
  }

  public checkFailure(isAlarmTriggered: boolean): boolean {
    if (this.isCompleted || this.isFailed) return this.isFailed;

    if (isAlarmTriggered) {
      this.isFailed = true;
      EventBus.emit('GAME_STATE_CHANGED', 'DEFEAT');
      return true;
    }

    if (this.remainingAmmo <= 0 && this.eliminatedVIPs < this.currentContract.targetCount) {
      this.isFailed = true;
      EventBus.emit('GAME_STATE_CHANGED', 'DEFEAT');
      return true;
    }

    return false;
  }

  public calculateReward(isGhostStealth: boolean): number {
    const base = this.currentContract.baseReward;
    const ghostBonus = isGhostStealth ? 0.5 : 0.0;
    const accidentBonus = this.accidentKills * 0.25;
    const accuracy = this.shotsFired > 0 ? (this.totalKills / this.shotsFired) : 1.0;

    return Math.round(base * (1.0 + ghostBonus) * (1.0 + accidentBonus) * Math.max(0.5, accuracy) + this.accidentKills * BALANCE.accident_bounty_xp);
  }
}
