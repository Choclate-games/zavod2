// src/systems/BuildManager.ts
// Construction grid coordinator, scrap cost verification and turret placement

import * as THREE from 'three';
import { Turret, TURRET_SPECS } from '../entities/Turret';
import { sceneManager } from '../rendering/SceneManager';
import { eventBus } from '../core/EventBus';
import { enemyPool } from '../entities/EnemyPool';
import { player } from '../entities/Player';

export class BuildManager {
  private static instance: BuildManager;
  private turrets: Turret[] = [];
  private selectedBuildType: string | null = null;
  private previewMesh!: THREE.Mesh;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): BuildManager {
    if (!BuildManager.instance) {
      BuildManager.instance = new BuildManager();
    }
    return BuildManager.instance;
  }

  public init(): void {
    if (this.isInitialized) return;
    const geo = new THREE.CylinderGeometry(1.2, 1.2, 0.2, 16);
    const mat = new THREE.MeshBasicMaterial({
      color: 0x00ffaa,
      transparent: true,
      opacity: 0.4,
      wireframe: true,
    });
    this.previewMesh = new THREE.Mesh(geo, mat);
    this.previewMesh.visible = false;
    sceneManager.getScene().add(this.previewMesh);
    this.isInitialized = true;
  }

  public selectType(type: string | null): void {
    this.selectedBuildType = type;
    if (this.previewMesh) {
      this.previewMesh.visible = type !== null;
    }
  }

  public getSelectedType(): string | null {
    return this.selectedBuildType;
  }

  public getTurrets(): Turret[] {
    return this.turrets;
  }

  public canBuild(type: string, x: number, z: number, availableScrap: number): boolean {
    const spec = TURRET_SPECS[type];
    if (!spec || availableScrap < spec.cost) return false;

    // Check bounds
    if (Math.abs(x) > 26 || Math.abs(z) > 26) return false;

    // Check distance to base core (can't build inside core 4.8 radius)
    if (Math.hypot(x, z) < 4.8) return false;

    // Check distance to other turrets
    for (const t of this.turrets) {
      if (t.active && Math.hypot(t.x - x, t.z - z) < 2.5) {
        return false;
      }
    }

    return true;
  }

  public placeTurret(type: 'gatling' | 'tesla' | 'shield' | 'repair', x: number, z: number, availableScrap: number): boolean {
    if (!this.canBuild(type, x, z, availableScrap)) return false;

    const spec = TURRET_SPECS[type];
    const turret = new Turret(type, x, z);
    this.turrets.push(turret);

    eventBus.emit('turret:placed', {
      type,
      x,
      z,
      cost: spec.cost,
    });

    this.selectType(null);
    return true;
  }

  public update(dt: number): void {
    if (!this.isInitialized) return;
    const enemies = enemyPool.getActiveEnemies();
    const buff = player.stats.turretBuffMultiplier;

    // Update turrets
    for (const t of this.turrets) {
      if (t.active) {
        t.update(dt, enemies, buff);
      }
    }

    // Clean up inactive
    this.turrets = this.turrets.filter((t) => t.active);

    // Update preview position if active
    if (this.selectedBuildType && this.previewMesh && this.previewMesh.visible) {
      // Place preview 3.5 units in front of player
      const angle = player.root.rotation.y;
      const px = player.x + Math.sin(angle) * 3.5;
      const pz = player.z + Math.cos(angle) * 3.5;
      this.previewMesh.position.set(px, 0.1, pz);
    }
  }

  public clear(): void {
    for (const t of this.turrets) {
      t.destroy();
    }
    this.turrets = [];
    this.selectType(null);
  }
}

export const buildManager = BuildManager.getInstance();
