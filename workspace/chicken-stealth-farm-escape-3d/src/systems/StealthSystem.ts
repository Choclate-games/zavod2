// src/systems/StealthSystem.ts
import { Dog } from '@/entities/Dog';
import { Player } from '@/entities/Player';
import { physicsWorld } from '@/physics/PhysicsWorld';

export class StealthSystem {
  public static checkStealth(
    player: Player,
    dogs: Dog[],
    _dt: number
  ): { overallAlertLevel: number; anyDogAlerted: boolean } {
    const playerPos = player.getPosition();
    const isHiding = player.isHiding;
    const playerSpeed = player.getVelocityMagnitude();
    const isPlayerMoving = playerSpeed > 0.05;
    const isInvulnerable = player.isInvulnerable;

    let anyAlerted = false;
    let maxAlertScore = 0;

    for (let i = 0; i < dogs.length; i++) {
      const dog = dogs[i];
      const dogPos = dog.getPosition();

      const dx = playerPos.x - dogPos.x;
      const dz = playerPos.z - dogPos.z;
      const dist = Math.hypot(dx, dz);

      const viewDist = dog.getViewDistance();
      const fovRad = dog.getFovRad();
      const facingAngle = dog.getFacingAngle();

      // Check if inside vision distance
      if (dist <= viewDist) {
        // Calculate angle to player relative to dog facing direction
        const angleToPlayer = Math.atan2(dx, dz);
        let angleDiff = angleToPlayer - facingAngle;
        while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
        while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

        const isInsideCone = Math.abs(angleDiff) <= fovRad / 2;

        if (isInsideCone) {
          // Check line-of-sight raycast against static obstacles
          const rayDirX = dx / dist;
          const rayDirZ = dz / dist;

          const rayHit = physicsWorld.castRay(
            dogPos.x,
            0.4,
            dogPos.z,
            rayDirX,
            0,
            rayDirZ,
            dist
          );

          // If no obstacle hit between dog and player (or hit distance is basically the player)
          const hasLineOfSight = !rayHit.hit || rayHit.distance >= dist - 0.2;

          if (hasLineOfSight) {
            if (!isInvulnerable) {
              if (isHiding && !isPlayerMoving) {
                // Completely safe! Dog sees stationary box as a normal farm prop.
              } else if (isHiding && isPlayerMoving) {
                // Dog sees moving cardboard box -> INSTANT ALERT!
                dog.triggerAlert(playerPos.x, playerPos.z);
                anyAlerted = true;
                maxAlertScore = 1.0;
              } else {
                // Exposed chicken in vision cone -> ALERT!
                dog.triggerAlert(playerPos.x, playerPos.z);
                anyAlerted = true;
                maxAlertScore = 1.0;
              }
            }
          }
        } else if (dist < 2.2 && isPlayerMoving && !isHiding) {
          // Proximity noise check: running close to dog triggers suspicion
          dog.triggerSuspicious(playerPos.x, playerPos.z);
          maxAlertScore = Math.max(maxAlertScore, 0.5);
        }
      }

      if (dog.state === 'alert') {
        anyAlerted = true;
        maxAlertScore = 1.0;
      } else if (dog.state === 'suspicious') {
        maxAlertScore = Math.max(maxAlertScore, 0.5);
      }
    }

    return {
      overallAlertLevel: maxAlertScore,
      anyDogAlerted: anyAlerted
    };
  }
}
