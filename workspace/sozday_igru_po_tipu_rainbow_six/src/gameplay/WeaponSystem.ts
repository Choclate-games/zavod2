import * as THREE from "three";
import { EventBus } from "../core/EventBus";
import type { WeaponConfig, WeaponId } from "../core/Types";

export const WEAPON_CONFIGS: Record<WeaponId, WeaponConfig> = {
  pistol_p9: {
    id: "pistol_p9",
    name: "Тактический P9",
    caliber: "9x19mm Parabellum",
    damage: 50,
    headshotMultiplier: 10.0,
    magCapacity: 15,
    maxReserveAmmo: 60,
    fireRate: 4.5,
    reloadTime: 1.2,
    spread: 0.008,
    recoilPitch: 0.04,
    recoilYaw: 0.015,
    recoilSnappiness: 14.0,
    armorPenetration: 0.5,
    cost: 0,
    description: "Стандартный пистолет спецназа. Высокая точность стрельбы из-за щита.",
    unlockedByDefault: true,
  },
  smg_mp5: {
    id: "smg_mp5",
    name: "MP5-SD с глушителем",
    caliber: "9x19mm Subsonic",
    damage: 42,
    headshotMultiplier: 10.0,
    magCapacity: 30,
    maxReserveAmmo: 120,
    fireRate: 11.0,
    reloadTime: 1.5,
    spread: 0.018,
    recoilPitch: 0.025,
    recoilYaw: 0.02,
    recoilSnappiness: 16.0,
    armorPenetration: 0.65,
    cost: 1000,
    description: "Высокий темп огня и коллиматорный прицел для штурма в slow-mo.",
    unlockedByDefault: false,
  },
  shotgun_m870: {
    id: "shotgun_m870",
    name: "Дробовик Breacher-12",
    caliber: "12 Gauge 00-Buck",
    damage: 25,
    pelletCount: 8,
    headshotMultiplier: 5.0,
    magCapacity: 6,
    maxReserveAmmo: 24,
    fireRate: 1.2,
    reloadTime: 2.0,
    spread: 0.065,
    recoilPitch: 0.11,
    recoilYaw: 0.04,
    recoilSnappiness: 10.0,
    armorPenetration: 0.75,
    cost: 1800,
    description: "Огромный разлет дроби. Разносит врагов и дверные петли в упор.",
    unlockedByDefault: false,
  },
  revolver_rhino: {
    id: "revolver_rhino",
    name: "Револьвер Rhino .357",
    caliber: ".357 Magnum AP",
    damage: 110,
    headshotMultiplier: 10.0,
    magCapacity: 6,
    maxReserveAmmo: 36,
    fireRate: 2.2,
    reloadTime: 1.8,
    spread: 0.005,
    recoilPitch: 0.09,
    recoilYaw: 0.025,
    recoilSnappiness: 12.0,
    armorPenetration: 0.95,
    cost: 2400,
    description: "Тяжелый бронебойный калибр. Пробивает деревянные укрытия навылет.",
    unlockedByDefault: false,
  },
};

export class WeaponSystem {
  private eventBus: EventBus;
  public config: WeaponConfig;
  public ammoInMag: number;
  public reserveAmmo: number;

  private fireTimer = 0;
  private isReloading = false;
  private reloadTimer = 0;

  constructor(eventBus: EventBus, weaponId: WeaponId = "pistol_p9") {
    this.eventBus = eventBus;
    this.config = WEAPON_CONFIGS[weaponId];
    this.ammoInMag = this.config.magCapacity;
    this.reserveAmmo = this.config.maxReserveAmmo;
  }

  setWeapon(weaponId: WeaponId): void {
    this.config = WEAPON_CONFIGS[weaponId];
    this.resetAmmo();
  }

  resetAmmo(): void {
    this.ammoInMag = this.config.magCapacity;
    this.reserveAmmo = this.config.maxReserveAmmo;
    this.isReloading = false;
    this.reloadTimer = 0;
    this.fireTimer = 0;
  }

  update(realDt: number): void {
    if (this.fireTimer > 0) {
      this.fireTimer -= realDt;
    }

    if (this.isReloading) {
      this.reloadTimer -= realDt;
      if (this.reloadTimer <= 0) {
        this.finishReload();
      }
    }
  }

  canFire(): boolean {
    return !this.isReloading && this.fireTimer <= 0 && this.ammoInMag > 0;
  }

  startReload(): boolean {
    if (this.isReloading || this.ammoInMag >= this.config.magCapacity || this.reserveAmmo <= 0) {
      return false;
    }
    this.isReloading = true;
    this.reloadTimer = this.config.reloadTime;
    return true;
  }

  private finishReload(): void {
    const needed = this.config.magCapacity - this.ammoInMag;
    const toLoad = Math.min(needed, this.reserveAmmo);
    this.ammoInMag += toLoad;
    this.reserveAmmo -= toLoad;
    this.isReloading = false;
    this.eventBus.emit("weapon:reloaded", {
      ammoInMag: this.ammoInMag,
      ammoInReserve: this.reserveAmmo,
    });
  }

  fire(origin: THREE.Vector3, baseDirection: THREE.Vector3): { fired: boolean; rays: { origin: THREE.Vector3; direction: THREE.Vector3 }[] } {
    if (!this.canFire()) {
      if (this.ammoInMag === 0 && !this.isReloading) {
        this.startReload();
      }
      return { fired: false, rays: [] };
    }

    this.ammoInMag--;
    this.fireTimer = 1.0 / this.config.fireRate;

    const rays: { origin: THREE.Vector3; direction: THREE.Vector3 }[] = [];
    const pelletCount = this.config.pelletCount || 1;

    for (let i = 0; i < pelletCount; i++) {
      const spreadX = (Math.random() - 0.5) * this.config.spread * 2;
      const spreadY = (Math.random() - 0.5) * this.config.spread * 2;

      const dir = baseDirection.clone();
      // Apply spread
      dir.x += spreadX;
      dir.y += spreadY;
      dir.normalize();

      rays.push({ origin: origin.clone(), direction: dir });
    }

    this.eventBus.emit("weapon:fired", {
      weapon: this.config,
      origin: { x: origin.x, y: origin.y, z: origin.z },
      direction: { x: baseDirection.x, y: baseDirection.y, z: baseDirection.z },
    });

    return { fired: true, rays };
  }

  getIsReloading(): boolean {
    return this.isReloading;
  }
}
