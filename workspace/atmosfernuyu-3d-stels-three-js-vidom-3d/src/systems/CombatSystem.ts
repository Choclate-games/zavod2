import * as THREE from 'three';
import { Player } from '../entities/Player';
import { EnemyPool } from '../entities/EnemyPool';
import { SceneManager } from '../rendering/SceneManager';
import { audioManager } from '../audio/AudioManager';
import { eventBus } from '../core/EventBus';

export class CombatSystem {
  constructor(
    private player: Player,
    private enemyPool: EnemyPool,
    private sceneManager: SceneManager
  ) {
    // Enemy attack listener
    eventBus.on('enemy:attack', ({ damage }: { damage: number }) => {
      this.player.takeDamage(damage);
    });

    // Player Sonar pulse stun
    eventBus.on('player:sonar', ({ position, radius }: { position: THREE.Vector3; radius: number }) => {
      this.sceneManager.triggerSonar(position, radius);
      this.enemyPool.getActiveEnemies().forEach((enemy) => {
        if (enemy.body.position.distanceTo(position) <= radius) {
          enemy.stun(1.4);
          this.sceneManager.meshPool.spawnDust(enemy.body.position, 8);
        }
      });
    });

    // Player footstep / noise alert
    eventBus.on('player:step', ({ position }: { position: THREE.Vector3 }) => {
      this.enemyPool.alertAllNear(position, 12);
    });

    eventBus.on('player:dash', ({ position }: { position: THREE.Vector3 }) => {
      this.sceneManager.meshPool.spawnDust(position, 14);
      this.enemyPool.alertAllNear(position, 18);
    });
  }

  update(_dt: number): void {
    if (!this.player.attackHitboxActive) return;

    const playerPos = this.player.body.position;
    const heading = this.player.headingAngle;
    const forward = new THREE.Vector3(Math.sin(heading), 0, Math.cos(heading));
    const attackRange = 2.4;
    const attackArc = Math.PI * 0.65; // ~120 degree cone

    const enemies = this.enemyPool.getActiveEnemies();

    for (let i = 0; i < enemies.length; i++) {
      const enemy = enemies[i];
      const toEnemy = new THREE.Vector3().subVectors(enemy.body.position, playerPos);
      toEnemy.y = 0;
      const dist = toEnemy.length();

      if (dist <= attackRange + enemy.body.radius) {
        toEnemy.normalize();
        const dot = forward.dot(toEnemy);
        const angle = Math.acos(Math.max(-1, Math.min(1, dot)));

        if (angle <= attackArc / 2) {
          this.resolvePlayerHit(enemy, forward);
        }
      }
    }
  }

  private resolvePlayerHit(enemy: any, attackDir: THREE.Vector3): void {
    // Check if attack is critical (from stealth or against stunned enemy)
    const isCritical = this.player.isStealthed || enemy.aiState === 4 || Math.random() < this.player.stats.critChance;

    const velocityBonus = this.player.isDashing ? 1.4 : 1.0;
    const baseDamage = this.player.stats.attackPower * velocityBonus;
    const finalDamage = isCritical ? baseDamage * 2.0 : baseDamage;

    // Apply damage to enemy
    const killed = enemy.takeDamage(finalDamage, attackDir, isCritical);

    // Audio and Visual Feedback
    audioManager.playImpact(isCritical);
    this.sceneManager.meshPool.spawnSparks(enemy.body.position, isCritical ? 18 : 10);
    this.sceneManager.triggerScreenShake(isCritical ? 0.35 : 0.15, isCritical ? 0.6 : 0.3);

    // 40ms Hit-stop on heavy/critical hit
    if (isCritical || killed) {
      this.sceneManager.triggerHitstop(0.04);
    }

    // Damage Popup
    eventBus.emit('ui:damage_popup', {
      position: enemy.body.position.clone(),
      damage: Math.round(finalDamage),
      isCritical,
    });
  }
}
