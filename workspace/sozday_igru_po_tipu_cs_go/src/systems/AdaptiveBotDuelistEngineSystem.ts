import * as THREE from 'three';
import { EntityManager } from '../entities/EntityManager';
import { RaycastBvhBallisticsEngineSystem } from './RaycastBvhBallisticsEngineSystem';
import { AudioManager } from '../audio/AudioManager';
import { PhysicsWorld } from '../physics/PhysicsWorld';

export type BotState = 'PATROL' | 'JIGGLE_PEEK' | 'AIM_LOCK' | 'FIRED' | 'PUSH';

export class AdaptiveBotDuelistEngineSystem {
  public static readonly T_JIGGLE_CYCLE = 0.24; // Jiggle bait timing cycle (s)
  public static readonly T_BASE_REACTION = 0.48; // Base reaction time (s)

  public state: BotState = 'PATROL';
  public reactionTimer: number = 0;
  public stateTimer: number = 0;
  public strafeDir: number = 1;
  public winStreak: number = 0;
  public currentReactionTime: number = 0.45;

  public reset(winStreak: number = 0): void {
    this.winStreak = winStreak;
    this.state = 'PATROL';
    this.stateTimer = 0;
    this.strafeDir = Math.random() > 0.5 ? 1 : -1;
    // T_bot_reaction = clamp(T_base * (1.0 - WinStreak * 0.08) + random(-0.03, +0.03), 0.18, 0.55)
    const raw = AdaptiveBotDuelistEngineSystem.T_BASE_REACTION * (1.0 - this.winStreak * 0.08) + (Math.random() * 0.06 - 0.03);
    this.currentReactionTime = Math.max(0.18, Math.min(0.55, raw));
    this.reactionTimer = this.currentReactionTime;
  }

  public update(dt: number, roundTimeLeft: number): void {
    const entities = EntityManager.get();
    const bot = entities.bot;
    const player = entities.player;

    if (!bot.isAlive || !player.isAlive) return;

    this.stateTimer += dt;

    // Direct sight line check to player
    const botEye = bot.position.clone().setY(1.65);
    const playerEye = player.position.clone().setY(1.65);
    const toPlayer = playerEye.clone().sub(botEye);
    const distToPlayer = toPlayer.length();
    const dirToPlayer = toPlayer.clone().normalize();

    // Aim angles
    bot.yaw = Math.atan2(-dirToPlayer.x, -dirToPlayer.z);

    // If time is low (< 4.0s), trigger aggressive PUSH
    if (roundTimeLeft <= 4.0 && this.state !== 'PUSH') {
      this.state = 'PUSH';
      this.stateTimer = 0;
    }

    switch (this.state) {
      case 'PATROL':
      case 'JIGGLE_PEEK': {
        // Jiggle strafing behind cover
        const strafeSpeed = 4.2;
        const rightVec = new THREE.Vector3(Math.cos(bot.yaw), 0, -Math.sin(bot.yaw));
        const moveVec = rightVec.clone().multiplyScalar(this.strafeDir * strafeSpeed * dt);
        const nextPos = bot.position.clone().add(moveVec);
        bot.position.copy(PhysicsWorld.get().resolveMovement(bot.position, nextPos, 0.4));

        if (this.stateTimer >= AdaptiveBotDuelistEngineSystem.T_JIGGLE_CYCLE) {
          this.stateTimer = 0;
          this.strafeDir *= -1; // Reverse jiggle direction
        }

        // Sight check: if clear line of sight, transition to AIM_LOCK
        if (distToPlayer < 40 && Math.random() < 0.6) {
          this.state = 'AIM_LOCK';
          this.reactionTimer = this.currentReactionTime;
        }
        break;
      }

      case 'AIM_LOCK': {
        // Active counter-strafe to stop before firing
        bot.velocity.lerp(new THREE.Vector3(0, 0, 0), Math.min(1.0, 18.0 * dt));
        this.reactionTimer -= dt;

        if (this.reactionTimer <= 0) {
          this.state = 'FIRED';
          this.stateTimer = 0;

          // Bot shoots at player head/body
          const isAimingHead = Math.random() < 0.55;
          const targetPoint = isAimingHead ? playerEye : player.position.clone().setY(1.1);
          const shotDir = targetPoint.clone().sub(botEye).normalize();

          AudioManager.get().playGunshot('deagle');
          RaycastBvhBallisticsEngineSystem.fireRaycast(botEye, shotDir, 0.1, false);
        }
        break;
      }

      case 'FIRED': {
        // Recovery delay after shot (t_deagle_reset = 0.42s)
        if (this.stateTimer >= 0.42) {
          this.state = 'JIGGLE_PEEK';
          this.stateTimer = 0;
          this.strafeDir = Math.random() > 0.5 ? 1 : -1;
        }
        break;
      }

      case 'PUSH': {
        // Aggressive direct advance towards player
        const rushSpeed = 5.5;
        const forwardVec = dirToPlayer.clone().multiplyScalar(rushSpeed * dt);
        forwardVec.y = 0;
        const nextPos = bot.position.clone().add(forwardVec);
        bot.position.copy(PhysicsWorld.get().resolveMovement(bot.position, nextPos, 0.4));

        if (this.stateTimer >= 0.6) {
          this.stateTimer = 0;
          const shotDir = playerEye.clone().sub(botEye).normalize();
          AudioManager.get().playGunshot('deagle');
          RaycastBvhBallisticsEngineSystem.fireRaycast(botEye, shotDir, 1.2, false);
        }
        break;
      }
    }

    bot.update(dt);
  }
}