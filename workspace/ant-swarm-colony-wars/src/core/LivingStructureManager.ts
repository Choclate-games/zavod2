import { Obstacle, ObstacleType } from '../entities/Obstacle';
import { eventBus } from './EventBus';

export interface BridgeConnection {
  obstacleId: number;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  antCount: number;
  requiredAnts: number;
  isComplete: boolean;
  nodes: { x: number; y: number; vx: number; vy: number }[];
}

export class LivingStructureManager {
  public bridges: Map<number, BridgeConnection> = new Map();
  public isSphereActive = false;
  public sphereCenter = { x: 0, y: 0 };
  public sphereRadius = 40;
  public sphereRotation = 0;

  constructor() {}

  public initLevel(obstacles: Obstacle[]): void {
    this.bridges.clear();
    this.isSphereActive = false;

    for (const obs of obstacles) {
      if (obs.type === ObstacleType.CHASM || obs.type === ObstacleType.RIVER) {
        // Create bridge anchor slots across width/height
        const isHorizontal = obs.width >= obs.height;
        const required = Math.max(12, Math.floor((isHorizontal ? obs.height : obs.width) / 6));

        const startX = isHorizontal ? obs.x : obs.x - obs.width / 2;
        const startY = isHorizontal ? obs.y - obs.height / 2 : obs.y;
        const endX = isHorizontal ? obs.x : obs.x + obs.width / 2;
        const endY = isHorizontal ? obs.y + obs.height / 2 : obs.y;

        const nodes: { x: number; y: number; vx: number; vy: number }[] = [];
        for (let i = 0; i <= required; i++) {
          const t = i / required;
          nodes.push({
            x: startX + (endX - startX) * t,
            y: startY + (endY - startY) * t,
            vx: 0,
            vy: 0
          });
        }

        this.bridges.set(obs.id, {
          obstacleId: obs.id,
          startX,
          startY,
          endX,
          endY,
          antCount: 0,
          requiredAnts: required,
          isComplete: false,
          nodes
        });
      }
    }
  }

  public update(dt: number, obstacles: Obstacle[]): void {
    this.sphereRotation += dt * 4;

    // Simulate Verlet springs and tension for bridge nodes
    for (const [obsId, bridge] of this.bridges) {
      const obs = obstacles.find((o) => o.id === obsId);
      if (!obs || obs.isDestroyed) continue;

      const nodes = bridge.nodes;
      const len = nodes.length;
      if (len < 2) continue;

      // Relax constraints along bridge chain
      for (let iter = 0; iter < 3; iter++) {
        for (let i = 1; i < len - 1; i++) {
          const prev = nodes[i - 1];
          const curr = nodes[i];
          const next = nodes[i + 1];

          // Damped spring towards neighbors
          const targetX = (prev.x + next.x) * 0.5;
          const targetY = (prev.y + next.y) * 0.5;

          curr.vx = (curr.vx + (targetX - curr.x) * 0.15) * 0.85;
          curr.vy = (curr.vy + (targetY - curr.y) * 0.15) * 0.85;

          curr.x += curr.vx;
          curr.y += curr.vy;
        }
      }

      // Check bridge completion status
      const wasComplete = bridge.isComplete;
      bridge.isComplete = bridge.antCount >= bridge.requiredAnts;
      obs.isBridged = bridge.isComplete;

      if (!wasComplete && bridge.isComplete) {
        eventBus.emit('structure:formed', {
          type: 'bridge',
          x1: bridge.startX,
          y1: bridge.startY,
          x2: bridge.endX,
          y2: bridge.endY
        });
        eventBus.emit('audio:play_sfx', { name: 'bridge_connect' });
      }
    }
  }

  public addAntToBridge(obstacleId: number): boolean {
    const bridge = this.bridges.get(obstacleId);
    if (!bridge) return false;

    if (bridge.antCount < bridge.requiredAnts) {
      bridge.antCount++;
      return true;
    }
    return false;
  }

  public toggleSphere(active?: boolean, centerX = 0, centerY = 0): void {
    this.isSphereActive = active !== undefined ? active : !this.isSphereActive;
    if (this.isSphereActive) {
      this.sphereCenter.x = centerX;
      this.sphereCenter.y = centerY;
      eventBus.emit('swarm:sphere', { active: true });
      eventBus.emit('audio:play_sfx', { name: 'bridge_connect' });
    } else {
      eventBus.emit('swarm:sphere', { active: false });
    }
  }
}
