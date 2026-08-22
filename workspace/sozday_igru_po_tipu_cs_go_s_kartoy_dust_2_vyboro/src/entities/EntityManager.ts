import * as THREE from 'three';
import { Player, player } from './Player';
import { Bot } from './Bot';
import { sceneManager } from '../rendering/SceneManager';
import { c4System } from '../systems/C4BombObjectiveSystem';
import { hitscanSystem } from '../systems/RaycastHitscanHitboxesSystem';
import { events } from '../core/EventBus';

export class EntityManager {
  private static instance: EntityManager;
  public player: Player = player;
  public bots: Bot[] = [];
  public currentSite: 'A' | 'B' = 'A';

  private constructor() {
    this.createBots();
  }

  public static getInstance(): EntityManager {
    if (!EntityManager.instance) {
      EntityManager.instance = new EntityManager();
    }
    return EntityManager.instance;
  }

  private createBots(): void {
    const botNames = ['SAS Viper', 'SAS Ghost', 'Phoenix Ivan', 'Phoenix Reznov', 'Phoenix Boris'];
    for (let i = 0; i < 5; i++) {
      const b = new Bot(`bot_${i}`, botNames[i], 'T');
      this.bots.push(b);
      sceneManager.scene.add(b.mesh);
    }
  }

  public setupTeams(playerTeam: 'CT' | 'T'): void {
    this.player.setTeam(playerTeam);

    if (playerTeam === 'CT') {
      // 2 CT teammates, 3 T enemies
      this.bots[0] = new Bot('bot_0', 'SAS Ghost', 'CT');
      this.bots[1] = new Bot('bot_1', 'SAS Bravo', 'CT');
      this.bots[2] = new Bot('bot_2', 'Phoenix Ivan', 'T');
      this.bots[3] = new Bot('bot_3', 'Phoenix Reznov', 'T');
      this.bots[4] = new Bot('bot_4', 'Phoenix Boris', 'T');
    } else {
      // 2 T teammates, 3 CT enemies
      this.bots[0] = new Bot('bot_0', 'Phoenix Boris', 'T');
      this.bots[1] = new Bot('bot_1', 'Phoenix Reznov', 'T');
      this.bots[2] = new Bot('bot_2', 'SAS Ghost', 'CT');
      this.bots[3] = new Bot('bot_3', 'SAS Bravo', 'CT');
      this.bots[4] = new Bot('bot_4', 'SAS Viper', 'CT');
    }

    // Re-attach meshes
    this.bots.forEach((b) => sceneManager.scene.add(b.mesh));
  }

  public resetRound(site: 'A' | 'B'): void {
    this.currentSite = site;

    if (site === 'A') {
      // Site A C4 Planted
      const c4Pos = new THREE.Vector3(18, 0.6, -12);
      c4System.arm(c4Pos, 'A');
      sceneManager.scene.add(c4System.mesh);

      // T Spawns on Site A
      const tSpawns = [
        new THREE.Vector3(23, 0.5, -16), // Goose
        new THREE.Vector3(15, 0.6, -10), // Triple crates
        new THREE.Vector3(20, 0.5, -7),  // Ramp / Long corner
      ];

      // CT Retake Spawns
      const ctSpawns = [
        new THREE.Vector3(26, 0.5, 8),   // Long Doors entrance
        new THREE.Vector3(8, 1.2, -14),  // Short / Catwalk
        new THREE.Vector3(4, 0.5, -20),  // CT Spawn ramp
      ];

      this.assignSpawns(ctSpawns, tSpawns);
    } else {
      // Site B C4 Planted
      const c4Pos = new THREE.Vector3(-22, 0.6, -8);
      c4System.arm(c4Pos, 'B');
      sceneManager.scene.add(c4System.mesh);

      // T Spawns on Site B
      const tSpawns = [
        new THREE.Vector3(-27, 0.5, -8),  // Back plat
        new THREE.Vector3(-20, 0.6, -10), // Window corner
        new THREE.Vector3(-24, 0.5, -4),  // Double stack
      ];

      // CT Retake Spawns
      const ctSpawns = [
        new THREE.Vector3(-10, 0.5, -8), // B Doors entrance
        new THREE.Vector3(-18, 0.5, 6),  // Upper Tunnels / Mid connector
        new THREE.Vector3(-6, 0.5, -20), // CT Spawn connector
      ];

      this.assignSpawns(ctSpawns, tSpawns);
    }
  }

  private assignSpawns(ctSpawns: THREE.Vector3[], tSpawns: THREE.Vector3[]): void {
    let ctIdx = 0;
    let tIdx = 0;

    if (this.player.team === 'CT') {
      this.player.reset(ctSpawns[ctIdx++]);
    } else {
      this.player.reset(tSpawns[tIdx++]);
    }

    for (const b of this.bots) {
      if (b.team === 'CT') {
        const spawn = ctSpawns[ctIdx++] || ctSpawns[0];
        b.reset(spawn, [c4System.position]);
      } else {
        const spawn = tSpawns[tIdx++] || tSpawns[0];
        b.reset(spawn, [c4System.position]);
      }
    }
  }

  public update(
    dt: number,
    onKill: (killerName: string, killerTeam: 'CT' | 'T', victimName: string, victimTeam: 'CT' | 'T', weapon: string, isHeadshot: boolean, isWallbang: boolean) => void
  ): void {
    // 1. Update Player
    this.player.update(dt, (origin, dir, dmg, weaponId) => {
      hitscanSystem.processShot(origin, dir, dmg, weaponId, this.player.team, 'Игрок', this.player, this.bots, onKill);
    });

    // 2. Update Bots
    const allLivingEntities = [
      { id: 'player', position: this.player.position, isAlive: this.player.isAlive, isPlayer: true, team: this.player.team },
      ...this.bots.map((b) => ({ id: b.id, position: b.position, isAlive: b.isAlive, team: b.team })),
    ];

    for (const bot of this.bots) {
      const enemies = allLivingEntities.filter((e) => e.team !== bot.team && e.isAlive);
      bot.update(dt, enemies, c4System.state === 'ARMED' ? c4System.position : null, (origin, dir, dmg, weaponId, attackerBot) => {
        hitscanSystem.processShot(origin, dir, dmg, weaponId, attackerBot.team, attackerBot.name, this.player, this.bots, onKill);
      });
    }

    // 3. Update C4 interactions
    const isPlayerDefusing = this.player.isDefusing && this.player.isAlive && this.player.position.distanceTo(c4System.position) < 2.4;
    const defusingBot = this.bots.find((b) => b.isDefusing && b.isAlive && b.position.distanceTo(c4System.position) < 2.4);

    if (isPlayerDefusing) {
      if (c4System.state === 'ARMED') {
        c4System.startDefusing('player', this.player.hasDefuseKit);
      }
    } else if (defusingBot) {
      if (c4System.state === 'ARMED') {
        c4System.startDefusing(defusingBot.id, true);
      }
    } else {
      if (c4System.state === 'DEFUSING') {
        c4System.abortDefusing();
      }
    }
  }

  public getRadarEntities(): Array<{ id: string; x: number; z: number; team: 'CT' | 'T'; isPlayer: boolean; isAlive: boolean; hasC4?: boolean }> {
    const list: Array<{ id: string; x: number; z: number; team: 'CT' | 'T'; isPlayer: boolean; isAlive: boolean; hasC4?: boolean }> = [];

    list.push({
      id: 'player',
      x: this.player.position.x,
      z: this.player.position.z,
      team: this.player.team,
      isAlive: this.player.isAlive,
      isPlayer: true,
    });

    for (const b of this.bots) {
      list.push({
        id: b.id,
        x: b.position.x,
        z: b.position.z,
        team: b.team,
        isAlive: b.isAlive,
        isPlayer: false,
      });
    }

    return list;
  }

  public areAllTeammatesDead(team: 'CT' | 'T'): boolean {
    if (this.player.team === team && this.player.isAlive) {
      return false;
    }
    const teamBots = this.bots.filter((b) => b.team === team);
    return teamBots.every((b) => !b.isAlive);
  }
}

export const entityManager = EntityManager.getInstance();
