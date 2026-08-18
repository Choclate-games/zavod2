import { Caste, Team, AntState, CASTE_BASE_STATS } from '../entities/AntTypes';
import { SpatialHashGrid } from '../physics/SpatialHashGrid';
import { FlowFieldGrid, PheromoneSample } from './FlowFieldGrid';
import { Nest } from '../entities/Nest';
import { Obstacle, ObstacleType } from '../entities/Obstacle';
import { BiomassNode } from '../entities/BiomassNode';
import { LivingStructureManager } from './LivingStructureManager';
import { evolutionManager } from '../systems/EvolutionManager';
import { eventBus } from './EventBus';

export class SwarmEngine {
  public readonly MAX_ANTS = 1200;

  // Contiguous SOA (Structure of Arrays) for zero runtime allocations
  public active: Uint8Array;
  public posX: Float32Array;
  public posY: Float32Array;
  public velX: Float32Array;
  public velY: Float32Array;
  public caste: Uint8Array;
  public team: Uint8Array;
  public state: Uint8Array;
  public hp: Float32Array;
  public maxHp: Float32Array;
  public animTimer: Float32Array;
  public targetObstacleId: Int32Array;

  public activeCount = 0;
  public playerCount = 0;
  public enemyCount = 0;

  public spatialGrid: SpatialHashGrid;
  private pheromoneSampleBuffer: PheromoneSample = { x: 0, y: 0, strength: 0 };

  public worldWidth: number;
  public worldHeight: number;

  constructor(worldWidth: number, worldHeight: number) {
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;

    const max = this.MAX_ANTS;
    this.active = new Uint8Array(max);
    this.posX = new Float32Array(max);
    this.posY = new Float32Array(max);
    this.velX = new Float32Array(max);
    this.velY = new Float32Array(max);
    this.caste = new Uint8Array(max);
    this.team = new Uint8Array(max);
    this.state = new Uint8Array(max);
    this.hp = new Float32Array(max);
    this.maxHp = new Float32Array(max);
    this.animTimer = new Float32Array(max);
    this.targetObstacleId = new Int32Array(max);

    this.spatialGrid = new SpatialHashGrid(worldWidth, worldHeight, 56, max);
    this.clear();
  }

  public clear(): void {
    this.active.fill(0);
    this.posX.fill(0);
    this.posY.fill(0);
    this.velX.fill(0);
    this.velY.fill(0);
    this.caste.fill(0);
    this.team.fill(0);
    this.state.fill(AntState.FREE);
    this.hp.fill(0);
    this.maxHp.fill(0);
    this.animTimer.fill(0);
    this.targetObstacleId.fill(-1);

    this.activeCount = 0;
    this.playerCount = 0;
    this.enemyCount = 0;
    this.spatialGrid.clear();
  }

  public spawnAnt(x: number, y: number, caste: Caste, team: Team): number {
    // Find free index
    let freeIdx = -1;
    for (let i = 0; i < this.MAX_ANTS; i++) {
      if (this.active[i] === 0) {
        freeIdx = i;
        break;
      }
    }

    if (freeIdx === -1) return -1;

    const baseStats = CASTE_BASE_STATS[caste];
    let maxHealth = baseStats.health;
    if (team === Team.PLAYER) {
      if (caste === Caste.SOLDIER) {
        maxHealth *= (1 + evolutionManager.getMultiplier('soldierArmor'));
      }
    }

    this.active[freeIdx] = 1;
    this.posX[freeIdx] = x + (Math.random() - 0.5) * 16;
    this.posY[freeIdx] = y + (Math.random() - 0.5) * 16;

    const angle = Math.random() * Math.PI * 2;
    this.velX[freeIdx] = Math.cos(angle) * 30;
    this.velY[freeIdx] = Math.sin(angle) * 30;

    this.caste[freeIdx] = caste;
    this.team[freeIdx] = team;
    this.state[freeIdx] = AntState.FREE;
    this.hp[freeIdx] = maxHealth;
    this.maxHp[freeIdx] = maxHealth;
    this.animTimer[freeIdx] = Math.random() * 10;
    this.targetObstacleId[freeIdx] = -1;

    this.activeCount++;
    if (team === Team.PLAYER) this.playerCount++;
    else if (team === Team.ENEMY) this.enemyCount++;

    return freeIdx;
  }

  public killAnt(index: number, explode = false): void {
    if (this.active[index] === 0) return;

    const x = this.posX[index];
    const y = this.posY[index];
    const antCaste = this.caste[index];
    const antTeam = this.team[index];

    if (explode || antCaste === Caste.BOMBER || antCaste === Caste.TITAN) {
      const radius = antCaste === Caste.TITAN ? 140 : 85 * (antTeam === Team.PLAYER ? evolutionManager.getMultiplier('bomberRadius') : 1.0);
      eventBus.emit('vfx:explosion', { x, y, radius, color: 0xffaa00 });
      eventBus.emit('audio:play_sfx', { name: 'bomber_explosion' });
      eventBus.emit('camera:shake', { intensity: 6, durationMs: 250 });
    }

    this.active[index] = 0;
    this.activeCount--;
    if (antTeam === Team.PLAYER) this.playerCount--;
    else if (antTeam === Team.ENEMY) this.enemyCount--;
  }

  public update(
    dt: number,
    flowGrid: FlowFieldGrid,
    structures: LivingStructureManager,
    nests: Nest[],
    obstacles: Obstacle[],
    biomassNodes: BiomassNode[],
    enemyTarget: { x: number; y: number; hasTarget: boolean }
  ): void {
    // 1. Rebuild Spatial Hash Grid
    this.spatialGrid.clear();
    for (let i = 0; i < this.MAX_ANTS; i++) {
      if (this.active[i] === 1) {
        this.spatialGrid.insert(i, this.posX[i], this.posY[i]);
      }
    }

    let pCount = 0;
    let eCount = 0;

    // Center of mass accumulator for player swarm (for camera & enemy AI)
    let playerCentroidX = 0;
    let playerCentroidY = 0;

    // Cache upgrades multipliers for player
    const workerSpeedMult = evolutionManager.getMultiplier('workerSpeed');
    const soldierAttackMult = evolutionManager.getMultiplier('soldierAttack');
    const harvestMult = evolutionManager.getMultiplier('workerHarvest');

    // 2. Swarm simulation step
    for (let i = 0; i < this.MAX_ANTS; i++) {
      if (this.active[i] === 0) continue;

      const px = this.posX[i];
      const py = this.posY[i];
      const vx = this.velX[i];
      const vy = this.velY[i];
      const antCaste = this.caste[i] as Caste;
      const antTeam = this.team[i] as Team;
      const baseStats = CASTE_BASE_STATS[antCaste];

      if (antTeam === Team.PLAYER) {
        pCount++;
        playerCentroidX += px;
        playerCentroidY += py;
      } else if (antTeam === Team.ENEMY) {
        eCount++;
      }

      this.animTimer[i] += dt * 10;

      // Base forces
      let steerX = 0;
      let steerY = 0;

      // Boids separation & neighbor flocking
      const neighborCount = this.spatialGrid.query(px, py, 40);
      let sepX = 0;
      let sepY = 0;
      let alignX = 0;
      let alignY = 0;
      let cohX = 0;
      let cohY = 0;
      let closeNeighbors = 0;

      for (let n = 0; n < neighborCount; n++) {
        const otherIdx = this.spatialGrid.queryBuffer[n];
        if (otherIdx === i || this.active[otherIdx] === 0) continue;

        const ox = this.posX[otherIdx];
        const oy = this.posY[otherIdx];
        const dx = px - ox;
        const dy = py - oy;
        const distSq = dx * dx + dy * dy;

        const otherTeam = this.team[otherIdx];

        if (otherTeam === antTeam) {
          // Flocking with friendly ants
          if (distSq < 18 * 18 && distSq > 0.001) {
            const dist = Math.sqrt(distSq);
            const repel = (18 - dist) / dist;
            sepX += dx * repel;
            sepY += dy * repel;
          }

          alignX += this.velX[otherIdx];
          alignY += this.velY[otherIdx];
          cohX += ox;
          cohY += oy;
          closeNeighbors++;
        } else {
          // Combat encounter with enemy ant!
          if (distSq < 22 * 22) {
            // Apply damage
            let dmg = baseStats.attack * dt;
            if (antTeam === Team.PLAYER && antCaste === Caste.SOLDIER) {
              dmg *= soldierAttackMult;
            }

            // Target armor reduction
            const otherStats = CASTE_BASE_STATS[this.caste[otherIdx] as Caste];
            dmg *= (1.0 - otherStats.armor);

            this.hp[otherIdx] -= dmg;

            // Combat sparks
            if (Math.random() < 0.15) {
              eventBus.emit('vfx:sparks', { x: (px + ox) / 2, y: (py + oy) / 2, count: 2 });
              eventBus.emit('audio:play_sfx', { name: 'action_swing_whoosh', volume: 0.2 });
            }

            // Bomber suicidal detonation
            if (antCaste === Caste.BOMBER) {
              this.killAnt(i, true);
              this.hp[otherIdx] -= 80;
              break;
            }

            if (this.hp[otherIdx] <= 0) {
              this.killAnt(otherIdx, false);
            }
          }
        }
      }

      if (closeNeighbors > 0) {
        alignX /= closeNeighbors;
        alignY /= closeNeighbors;
        cohX = (cohX / closeNeighbors - px) * 0.02;
        cohY = (cohY / closeNeighbors - py) * 0.02;

        steerX += sepX * 4.0 + alignX * 0.15 + cohX;
        steerY += sepY * 4.0 + alignY * 0.15 + cohY;
      }

      // Sphere formation logic (Space / Defense)
      if (antTeam === Team.PLAYER && structures.isSphereActive) {
        const scx = structures.sphereCenter.x;
        const scy = structures.sphereCenter.y;
        const toCenterX = scx - px;
        const toCenterY = scy - py;
        const cDist = Math.hypot(toCenterX, toCenterY) || 1;

        // Orbit and collapse into dense sphere
        const targetRadius = Math.min(65, 20 + Math.sqrt(this.playerCount) * 2.2);
        const radiusDiff = cDist - targetRadius;
        const orbitDirX = -toCenterY / cDist;
        const orbitDirY = toCenterX / cDist;

        steerX += (toCenterX / cDist) * radiusDiff * 3.5 + orbitDirX * 120;
        steerY += (toCenterY / cDist) * radiusDiff * 3.5 + orbitDirY * 120;
      } else if (antTeam === Team.PLAYER) {
        // Sample Player Flow Field Pheromones
        const hasPheromone = flowGrid.sample(px, py, antCaste, this.pheromoneSampleBuffer);
        if (hasPheromone) {
          const pStrength = this.pheromoneSampleBuffer.strength;
          steerX += this.pheromoneSampleBuffer.x * 240 * pStrength;
          steerY += this.pheromoneSampleBuffer.y * 240 * pStrength;
        }
      } else if (antTeam === Team.ENEMY && enemyTarget.hasTarget) {
        // Enemy swarm follows AI strategic vector
        const edx = enemyTarget.x - px;
        const edy = enemyTarget.y - py;
        const edist = Math.hypot(edx, edy) || 1;
        steerX += (edx / edist) * 140;
        steerY += (edy / edist) * 140;
      }

      // 3. Obstacles interaction & bridge building
      for (const obs of obstacles) {
        if (obs.isDestroyed) continue;

        if (obs.type === ObstacleType.DESTRUCTIBLE_WALL) {
          if (obs.intersectsCircle(px, py, 16)) {
            // Bombers deal massive siege damage
            if (antCaste === Caste.BOMBER) {
              const siegeDmg = 150 * (antTeam === Team.PLAYER ? evolutionManager.getMultiplier('bomberAcid') : 1.0);
              const destroyed = obs.takeDamage(siegeDmg);
              this.killAnt(i, true);
              if (destroyed) {
                eventBus.emit('obstacle:destroyed', { obstacleId: obs.id, x: obs.x, y: obs.y });
                eventBus.emit('vfx:explosion', { x: obs.x, y: obs.y, radius: 90 });
              }
              break;
            } else if (structures.isSphereActive && antTeam === Team.PLAYER) {
              // Ramming sphere smashes walls
              const destroyed = obs.takeDamage(20 * dt);
              if (destroyed) {
                eventBus.emit('obstacle:destroyed', { obstacleId: obs.id, x: obs.x, y: obs.y });
              }
            } else {
              // Normal ants bounce off walls
              const normX = px - obs.x;
              const normY = py - obs.y;
              const nLen = Math.hypot(normX, normY) || 1;
              steerX += (normX / nLen) * 200;
              steerY += (normY / nLen) * 200;
            }
          }
        } else if (obs.type === ObstacleType.CHASM || obs.type === ObstacleType.RIVER) {
          if (!obs.isBridged) {
            // Check if worker is near to build bridge
            if (antCaste === Caste.WORKER && obs.intersectsCircle(px, py, 32)) {
              structures.addAntToBridge(obs.id);
            }

            // Non-bridged chasms repel ants
            if (obs.containsPoint(px, py)) {
              const repelX = px < obs.x ? -1 : 1;
              const repelY = py < obs.y ? -1 : 1;
              steerX += repelX * 220;
              steerY += repelY * 220;
            }
          }
        }
      }

      // 4. Biomass nodes harvesting (Workers)
      if (antCaste === Caste.WORKER && antTeam === Team.PLAYER) {
        for (const node of biomassNodes) {
          if (node.isDepleted) continue;
          const ndx = node.x - px;
          const ndy = node.y - py;
          const nDist = Math.hypot(ndx, ndy);

          if (nDist < node.radius + 12) {
            const harvested = node.harvest(15 * harvestMult * dt);
            if (harvested > 0) {
              evolutionManager.addBiomass(harvested);
              if (Math.random() < 0.1) {
                eventBus.emit('biomass:collected', { amount: Math.ceil(harvested), x: px, y: py });
                eventBus.emit('audio:play_sfx', { name: 'pickup_collect_chime', volume: 0.15 });
              }
            }
          }
        }
      }

      // Max speed capping
      let maxSpeed = baseStats.speed;
      if (antTeam === Team.PLAYER && antCaste === Caste.WORKER) {
        maxSpeed *= workerSpeedMult;
      }

      // Integrate velocity & acceleration
      let newVx = vx + steerX * dt * 5;
      let newVy = vy + steerY * dt * 5;

      const currentSpeed = Math.hypot(newVx, newVy);
      if (currentSpeed > maxSpeed) {
        newVx = (newVx / currentSpeed) * maxSpeed;
        newVy = (newVy / currentSpeed) * maxSpeed;
      }

      // Damping
      newVx *= 0.96;
      newVy *= 0.96;

      // Integrate position
      let newPx = px + newVx * dt;
      let newPy = py + newVy * dt;

      // World boundary constraints with gentle bounce
      const margin = 20;
      if (newPx < margin) { newPx = margin; newVx = Math.abs(newVx) * 0.8; }
      else if (newPx > this.worldWidth - margin) { newPx = this.worldWidth - margin; newVx = -Math.abs(newVx) * 0.8; }

      if (newPy < margin) { newPy = margin; newVy = Math.abs(newVy) * 0.8; }
      else if (newPy > this.worldHeight - margin) { newPy = this.worldHeight - margin; newVy = -Math.abs(newVy) * 0.8; }

      this.posX[i] = newPx;
      this.posY[i] = newPy;
      this.velX[i] = newVx;
      this.velY[i] = newVy;
    }

    this.playerCount = pCount;
    this.enemyCount = eCount;

    // 5. Update Nests capture pressures
    for (const nest of nests) {
      // Query ants within nest radius
      const count = this.spatialGrid.query(nest.x, nest.y, nest.radius + 18);
      let pPressure = 0;
      let ePressure = 0;

      for (let n = 0; n < count; n++) {
        const antIdx = this.spatialGrid.queryBuffer[n];
        if (this.active[antIdx] === 0) continue;

        const t = this.team[antIdx];
        const c = this.caste[antIdx] as Caste;
        const power = c === Caste.SOLDIER ? 2.0 : (c === Caste.TITAN ? 4.0 : 1.0);

        if (t === Team.PLAYER) pPressure += power;
        else if (t === Team.ENEMY) ePressure += power;
      }

      nest.update(
        dt,
        pPressure,
        ePressure,
        (n, caste, team) => {
          this.spawnAnt(n.x, n.y, caste, team);
          eventBus.emit('nest:spawn', { nestId: n.id, team, count: 1 });
        },
        (n, newTeam) => {
          eventBus.emit('nest:captured', { nestId: n.id, team: newTeam, x: n.x, y: n.y });
          eventBus.emit('vfx:explosion', { x: n.x, y: n.y, radius: 80, color: newTeam === Team.PLAYER ? 0x39ff14 : 0xff3355 });
          eventBus.emit('audio:play_sfx', { name: 'nest_captured' });
          eventBus.emit('camera:shake', { intensity: 8, durationMs: 300 });
        }
      );
    }

    // Emit count update to HUD
    eventBus.emit('swarm:count_changed', {
      playerCount: this.playerCount,
      enemyCount: this.enemyCount,
      maxCount: this.MAX_ANTS
    });
  }

  public getPlayerCentroid(): { x: number; y: number; count: number } {
    if (this.playerCount === 0) return { x: this.worldWidth / 2, y: this.worldHeight / 2, count: 0 };

    let totalX = 0;
    let totalY = 0;
    for (let i = 0; i < this.MAX_ANTS; i++) {
      if (this.active[i] === 1 && this.team[i] === Team.PLAYER) {
        totalX += this.posX[i];
        totalY += this.posY[i];
      }
    }
    return {
      x: totalX / this.playerCount,
      y: totalY / this.playerCount,
      count: this.playerCount
    };
  }
}
