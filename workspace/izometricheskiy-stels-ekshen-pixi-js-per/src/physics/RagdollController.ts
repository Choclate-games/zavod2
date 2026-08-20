/**
 * Impact, Knockback & Dynamic Physics Reaction Controller
 */

import Matter from 'matter-js';

export interface KnockbackEffect {
  body: Matter.Body;
  impulseX: number;
  impulseY: number;
  decay: number;
}

export class RagdollController {
  private activeKnockbacks: KnockbackEffect[] = [];

  applyKnockback(body: Matter.Body, dirX: number, dirY: number, force: number, decay = 0.88): void {
    const len = Math.hypot(dirX, dirY) || 1;
    const nx = dirX / len;
    const ny = dirY / len;

    Matter.Body.setVelocity(body, {
      x: body.velocity.x + nx * force,
      y: body.velocity.y + ny * force,
    });

    this.activeKnockbacks.push({
      body,
      impulseX: nx * force,
      impulseY: ny * force,
      decay,
    });
  }

  update(): void {
    for (let i = this.activeKnockbacks.length - 1; i >= 0; i--) {
      const kb = this.activeKnockbacks[i];
      kb.impulseX *= kb.decay;
      kb.impulseY *= kb.decay;

      if (Math.hypot(kb.impulseX, kb.impulseY) < 0.05) {
        this.activeKnockbacks.splice(i, 1);
      }
    }
  }

  clear(): void {
    this.activeKnockbacks.length = 0;
  }
}
