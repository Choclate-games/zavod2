import * as THREE from 'three';
import { MutationDefinition } from '../types';
import { MUTATIONS_DATABASE } from '../config/MutationsData';
import { PlayerSlime } from '../entities/PlayerSlime';
import { SlimeMinion } from '../entities/SlimeMinion';
import { Projectile } from '../entities/Projectile';
import { ParticleSystem } from '../rendering/ParticleSystem';
import { AudioManager } from '../audio/AudioManager';

export class MutationManager {
  public activeMutations: Map<string, number> = new Map();
  public minions: SlimeMinion[] = [];

  // Auto-attack Timers
  private sporeTimer = 0;
  private spikeTimer = 0;
  private trailTimer = 0;
  private novaTimer = 0;

  private nextMinionId = 1;

  constructor() {}

  public getMutationLevel(id: string): number {
    return this.activeMutations.get(id) || 0;
  }

  public applyMutation(id: string, player: PlayerSlime, scene: THREE.Scene): void {
    const currentLvl = this.getMutationLevel(id);
    const newLvl = currentLvl + 1;
    this.activeMutations.set(id, newLvl);

    console.log(`Applied mutation ${id} level ${newLvl}`);

    // Update player stats & visual attachments
    if (id === 'chitin_armor') {
      player.stats.damageReduction = Math.min(0.7, newLvl * 0.14);
      player.setChitinArmorVisual(true, newLvl);
    } else if (id === 'poison_spores') {
      player.setSporeBulbsVisual(true, newLvl);
    } else if (id === 'acid_spikes') {
      player.setAcidSpikesVisual(true, newLvl);
    } else if (id === 'bio_magnetism') {
      player.stats.magnetRadius *= 1.35;
    } else if (id === 'digestive_enzymes') {
      player.stats.absorbPower += 0.25;
    } else if (id === 'slime_minions') {
      this.syncMinionsCount(newLvl, player, scene);
    } else if (id === 'plague_citadel') {
      player.stats.damageReduction = 0.65;
      player.setChitinArmorVisual(true, 5);
      player.setSporeBulbsVisual(true, 5);
      player.material.uniforms.uColorRim.value.setHex(0xd946ef); // Synergy violet glow
    } else if (id === 'biomass_infusion') {
      player.heal(player.stats.maxHp * 0.3);
      player.stats.dnaEarned += 150;
    }
  }

  private syncMinionsCount(targetCount: number, player: PlayerSlime, scene: THREE.Scene): void {
    const desired = Math.min(6, targetCount);
    while (this.minions.length < desired) {
      const minion = new SlimeMinion(this.nextMinionId++, player.position, this.minions.length);
      this.minions.push(minion);
      scene.add(minion.group);
    }
  }

  public generateMutationChoices(count = 3): MutationDefinition[] {
    const available: MutationDefinition[] = [];

    // Check synergy prerequisites
    const hasMaxSpores = this.getMutationLevel('poison_spores') >= 5;
    const hasMaxChitin = this.getMutationLevel('chitin_armor') >= 5;
    const hasCitadel = this.getMutationLevel('plague_citadel') > 0;

    for (const [id, def] of Object.entries(MUTATIONS_DATABASE)) {
      if (id === 'biomass_infusion') continue;

      if (id === 'plague_citadel') {
        if (hasMaxSpores && hasMaxChitin && !hasCitadel) {
          available.push(def);
        }
        continue;
      }

      const currentLvl = this.getMutationLevel(id);
      if (currentLvl < def.maxLevel) {
        available.push(def);
      }
    }

    // Fallback if all mutations maxed
    if (available.length === 0) {
      return [MUTATIONS_DATABASE['biomass_infusion']];
    }

    // Shuffle and pick random distinct choices
    const shuffled = [...available].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length));
  }

  public update(
    dt: number,
    totalTime: number,
    player: PlayerSlime,
    nearestEnemyPos: THREE.Vector3 | null,
    projectiles: Projectile[],
    particles: ParticleSystem,
    scene: THREE.Scene
  ): void {
    const audio = AudioManager.getInstance();

    // 1. Poison Spores Auto-cast
    const sporeLvl = this.getMutationLevel('poison_spores');
    if (sporeLvl > 0) {
      this.sporeTimer += dt;
      const cooldown = Math.max(1.5, 3.8 - sporeLvl * 0.4);
      if (this.sporeTimer >= cooldown) {
        this.sporeTimer = 0;
        const radius = 3.5 + sporeLvl * 0.8;
        particles.emitSporeCloud(player.position, radius);
        particles.spawnAcidPuddle(player.position, radius, 3.5, player.stats.poisonDamage * (0.8 + sporeLvl * 0.3));
        audio.playSquish();
      }
    }

    // 2. Acid Spikes Auto-fire
    const spikeLvl = this.getMutationLevel('acid_spikes');
    if (spikeLvl > 0) {
      this.spikeTimer += dt;
      const cooldown = Math.max(0.8, 2.2 - spikeLvl * 0.25);
      if (this.spikeTimer >= cooldown && nearestEnemyPos) {
        this.spikeTimer = 0;
        const count = 2 + spikeLvl;
        const baseDir = nearestEnemyPos.clone().sub(player.position).normalize();
        const baseAngle = Math.atan2(baseDir.x, baseDir.z);

        for (let i = 0; i < count; i++) {
          const spread = (i - (count - 1) / 2) * 0.2;
          const angle = baseAngle + spread;
          const vel = new THREE.Vector3(Math.sin(angle) * 22, 0, Math.cos(angle) * 22);
          const proj = new Projectile(
            player.position.clone().add(new THREE.Vector3(0, 0.4, 0)),
            vel,
            18 + spikeLvl * 6,
            true,
            'spike'
          );
          projectiles.push(proj);
          scene.add(proj.data.mesh);
        }
        audio.playSpikeShoot();
      }
    }

    // 3. Acid Slime Trail
    const trailLvl = this.getMutationLevel('acid_trail');
    if (trailLvl > 0 && player.velocity.lengthSq() > 1.0) {
      this.trailTimer += dt;
      if (this.trailTimer >= 0.28) {
        this.trailTimer = 0;
        particles.spawnAcidPuddle(
          player.position,
          1.2 + trailLvl * 0.3,
          2.5 + trailLvl * 0.5,
          12 + trailLvl * 5
        );
      }
    }

    // 4. Toxic Nova Burst
    const novaLvl = this.getMutationLevel('toxic_nova');
    if (novaLvl > 0) {
      this.novaTimer += dt;
      if (this.novaTimer >= 6.0) {
        this.novaTimer = 0;
        particles.emitSporeCloud(player.position, 8.0);
        audio.playDash();
        // Deal huge aoe
        particles.spawnAcidPuddle(player.position, 6.0, 4.0, 35 * novaLvl);
      }
    }

    // 5. Plague Citadel Aura
    if (this.getMutationLevel('plague_citadel') > 0) {
      if (Math.random() < 0.2) {
        particles.emitSporeCloud(player.position, 5.0);
      }
    }

    // 6. Update Minions
    for (const minion of this.minions) {
      minion.update(player.position, nearestEnemyPos, dt, totalTime);
    }
  }

  public reset(scene: THREE.Scene): void {
    this.activeMutations.clear();
    for (const minion of this.minions) {
      scene.remove(minion.group);
      minion.dispose();
    }
    this.minions = [];
    this.sporeTimer = 0;
    this.spikeTimer = 0;
    this.trailTimer = 0;
    this.novaTimer = 0;
  }
}
