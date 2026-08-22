import * as THREE from 'three';
import { entityManager } from '../entities/EntityManager';
import { c4System } from '../systems/C4BombObjectiveSystem';
import { sceneManager } from '../rendering/SceneManager';
import { hud } from '../ui/Hud';
import { events } from './EventBus';
import { storage } from '../platform/StorageService';
import { audio } from '../audio/AudioManager';
import { router } from '../ui/ScreenRouter';

export type MatchPhase = 'MENU' | 'FREEZETIME' | 'IN_ROUND' | 'ROUND_END' | 'MATCH_END';

export class Game {
  private static instance: Game;
  public phase: MatchPhase = 'MENU';

  public scoreCT = 0;
  public scoreT = 0;
  public readonly targetWins = 3;

  // Player Match Stats
  public kills = 0;
  public deaths = 0;
  public headshots = 0;

  private freezetimeRemaining = 0;
  private roundEndDelayRemaining = 0;
  private currentSite: 'A' | 'B' = 'A';

  private constructor() {
    events.on('GAME_STATE_CHANGED', (state) => {
      if (state === 'PLAYING' && this.phase === 'MENU') {
        this.startMatch();
      } else if (state === 'MENU') {
        this.phase = 'MENU';
        sceneManager.setCameraMode('MENU_PAN');
      }
    });

    events.on('TEAM_SELECTED', (team) => {
      entityManager.setupTeams(team);
    });
  }

  public static getInstance(): Game {
    if (!Game.instance) {
      Game.instance = new Game();
    }
    return Game.instance;
  }

  public startMatch(): void {
    this.scoreCT = 0;
    this.scoreT = 0;
    this.kills = 0;
    this.deaths = 0;
    this.headshots = 0;
    this.currentSite = Math.random() > 0.5 ? 'A' : 'B';

    sceneManager.setCameraMode('FPS_PLAYER');
    this.startRound();
  }

  public startRound(): void {
    this.phase = 'FREEZETIME';
    this.freezetimeRemaining = 2.0;
    this.currentSite = this.currentSite === 'A' ? 'B' : 'A';

    entityManager.resetRound(this.currentSite);
    router.navigateTo('GameplayHUD');
  }

  public update(dt: number): void {
    if (this.phase === 'MENU') {
      sceneManager.update(dt);
      sceneManager.render();
      return;
    }

    if (this.phase === 'FREEZETIME') {
      this.freezetimeRemaining -= dt;
      if (this.freezetimeRemaining <= 0) {
        this.phase = 'IN_ROUND';
      }
    }

    if (this.phase === 'IN_ROUND') {
      // 1. Update Entities
      entityManager.update(dt, (killerName, killerTeam, victimName, victimTeam, weapon, isHeadshot, isWallbang) => {
        this.handleKill(killerName, killerTeam, victimName, victimTeam, weapon, isHeadshot, isWallbang);
      });

      // 2. Update C4 Objective
      c4System.update(
        dt,
        () => this.endRound('T', 'БОМБА ВЗОРВАНА'),
        () => this.endRound('CT', 'БОМБА ОБЕЗВРЕЖЕНА')
      );

      // 3. Check Team Wipes
      if (entityManager.areAllTeammatesDead('CT')) {
        this.endRound('T', 'СПЕЦНАЗ УНИЧТОЖЕН');
      } else if (entityManager.areAllTeammatesDead('T') && c4System.state !== 'ARMED' && c4System.state !== 'DEFUSING') {
        this.endRound('CT', 'ТЕРРОРИСТЫ УНИЧТОЖЕНЫ');
      }
    }

    if (this.phase === 'ROUND_END') {
      this.roundEndDelayRemaining -= dt;
      if (this.roundEndDelayRemaining <= 0) {
        if (this.scoreCT >= this.targetWins || this.scoreT >= this.targetWins) {
          this.endMatch();
        } else {
          this.startRound();
        }
      }
    }

    // Camera & Scene Update
    sceneManager.update(
      dt,
      entityManager.player.position,
      entityManager.player.yaw,
      entityManager.player.pitch
    );

    // HUD Update
    const activeWeapon = entityManager.player.getCurrentWeapon();
    hud.update({
      health: entityManager.player.health,
      armor: entityManager.player.armor,
      ammo: activeWeapon.ammo,
      reserveAmmo: activeWeapon.reserveAmmo,
      weaponName: activeWeapon.name,
      weaponId: activeWeapon.id,
      hasDefuseKit: entityManager.player.hasDefuseKit,
      scoreCT: this.scoreCT,
      scoreT: this.scoreT,
      roundNumber: this.scoreCT + this.scoreT + 1,
      playerTeam: entityManager.player.team,
      c4Ticking: c4System.state === 'ARMED' || c4System.state === 'DEFUSING',
      c4TimeRemaining: c4System.timeRemaining,
      isDefusing: c4System.state === 'DEFUSING',
      defuseProgress: c4System.defuseProgress,
      crosshairSpread: entityManager.player.crosshairSpread,
      radarEntities: entityManager.getRadarEntities(),
      c4Position: { x: c4System.position.x, z: c4System.position.z },
    });

    // Render WebGL frame
    sceneManager.render();
  }

  private handleKill(killerName: string, killerTeam: 'CT' | 'T', victimName: string, victimTeam: 'CT' | 'T', weapon: string, isHeadshot: boolean, isWallbang: boolean): void {
    if (killerName === 'Игрок') {
      this.kills++;
      if (isHeadshot) this.headshots++;
    }
    if (victimName === 'Игрок') {
      this.deaths++;
    }

    events.emit('KILLFEED_EVENT', {
      killerName,
      killerTeam,
      victimName,
      victimTeam,
      weapon,
      isHeadshot,
      isWallbang,
    });
  }

  private endRound(winnerTeam: 'CT' | 'T', reason: string): void {
    if (this.phase !== 'IN_ROUND') return;
    this.phase = 'ROUND_END';
    this.roundEndDelayRemaining = 3.2;

    if (winnerTeam === 'CT') {
      this.scoreCT++;
    } else {
      this.scoreT++;
    }

    const playerWonRound = entityManager.player.team === winnerTeam;
    if (playerWonRound) {
      audio.playWinJingle();
    } else {
      audio.playLoseJingle();
    }

    events.emit('ROUND_END', {
      winnerTeam,
      reason,
      roundCT: this.scoreCT,
      roundT: this.scoreT,
      mvpName: playerWonRound ? 'Игрок' : 'Phoenix Ivan',
      mvpScore: 300,
    });

    router.navigateTo('RoundEndModal');
  }

  private endMatch(): void {
    this.phase = 'MATCH_END';
    sceneManager.setCameraMode('MENU_PAN');

    const playerTeam = entityManager.player.team;
    const playerWon = (playerTeam === 'CT' && this.scoreCT >= this.targetWins) || (playerTeam === 'T' && this.scoreT >= this.targetWins);

    const data = storage.getData();
    const eloDelta = playerWon ? 25 : -20;
    const newElo = Math.max(0, data.elo + eloDelta);

    const rankNames = ['Silver I', 'Silver Elite', 'Gold Nova III', 'Master Guardian', 'Legendary Eagle', 'Global Elite'];
    const rankIndex = Math.min(5, Math.floor(newElo / 300));

    data.elo = newElo;
    data.rankIndex = rankIndex;
    data.stats.matchesPlayed++;
    if (playerWon) {
      data.stats.matchesWon++;
      data.stats.winStreak++;
    } else {
      data.stats.winStreak = 0;
    }
    data.stats.totalKills += this.kills;
    data.stats.totalHeadshots += this.headshots;

    storage.updateData(data);

    const hsPct = this.kills > 0 ? Math.round((this.headshots / this.kills) * 100) : 0;

    events.emit('MATCH_END', {
      winnerTeam: this.scoreCT >= this.targetWins ? 'CT' : 'T',
      playerWon,
      scoreCT: this.scoreCT,
      scoreT: this.scoreT,
      eloDelta,
      newElo,
      rankName: rankNames[rankIndex] || 'Gold Nova',
      kills: this.kills,
      deaths: this.deaths,
      headshots: this.headshots,
      headshotPercent: hsPct,
    });

    router.navigateTo('MatchResultScreen');
  }
}

export const game = Game.getInstance();
