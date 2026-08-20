import { WeaponStats, WeaponType } from '../core/Types';

export class Weapon {
  public stats: WeaponStats;
  public currentAmmo: number;
  public fireCooldownTimer: number = 0;

  constructor(type: WeaponType, isOverdrive: boolean = false) {
    this.stats = this.createStats(type, isOverdrive);
    this.currentAmmo = this.stats.maxAmmo;
  }

  private createStats(type: WeaponType, isOverdrive: boolean): WeaponStats {
    let stats: WeaponStats;

    switch (type) {
      case WeaponType.SHOTGUN:
        stats = {
          type,
          name: isOverdrive ? 'ДРОБОВИК [ОВЕРДРАЙВ]' : 'ОБРЕЗ ВЫШИБНОЙ',
          damage: 32,
          fireRate: isOverdrive ? 3.0 : 2.0,
          pellets: 6,
          spread: 0.28,
          maxAmmo: 6,
          bulletSpeed: 38,
          knockback: 12,
          isOverdrive
        };
        break;

      case WeaponType.ASSAULT_RIFLE:
        stats = {
          type,
          name: isOverdrive ? 'ШТУРМОВИК [ОВЕРДРАЙВ]' : 'АВТОМАТ ШТУРМОВОЙ',
          damage: 22,
          fireRate: isOverdrive ? 12.0 : 8.5,
          pellets: 1,
          spread: 0.08,
          maxAmmo: 30,
          bulletSpeed: 45,
          knockback: 4,
          isOverdrive
        };
        break;

      case WeaponType.ROCKET_LAUNCHER:
        stats = {
          type,
          name: isOverdrive ? 'ГРАНАТОМЕТ [ОВЕРДРАЙВ]' : 'ТЯЖЕЛЫЙ РАКЕТОМЕТ',
          damage: 130,
          fireRate: isOverdrive ? 2.2 : 1.4,
          pellets: 1,
          spread: 0.02,
          maxAmmo: 3,
          bulletSpeed: 24,
          knockback: 25,
          isOverdrive
        };
        break;

      case WeaponType.PISTOL:
      default:
        stats = {
          type: WeaponType.PISTOL,
          name: isOverdrive ? 'ТАКТИЧЕСКИЙ ПИСТОЛЕТ [ОВЕРДРАЙВ]' : 'ТАКТИЧЕСКИЙ ПИСТОЛЕТ',
          damage: 28,
          fireRate: isOverdrive ? 6.0 : 4.2,
          pellets: 1,
          spread: 0.03,
          maxAmmo: 12,
          bulletSpeed: 48,
          knockback: 5,
          isOverdrive
        };
        break;
    }

    return stats;
  }

  public update(dt: number): void {
    if (this.fireCooldownTimer > 0) {
      this.fireCooldownTimer -= dt;
    }
  }

  public canShoot(): boolean {
    return this.fireCooldownTimer <= 0 && this.currentAmmo > 0;
  }

  public shoot(): boolean {
    if (!this.canShoot()) return false;
    this.fireCooldownTimer = 1.0 / this.stats.fireRate;
    if (this.stats.type !== WeaponType.PISTOL) {
      this.currentAmmo--;
    }
    return true;
  }

  public addAmmo(amount: number): void {
    this.currentAmmo = Math.min(this.stats.maxAmmo, this.currentAmmo + amount);
  }
}
