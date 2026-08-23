import { GAME_BALANCE, WEAPON_LADDER, WeaponDef } from '../config/balance';
import { Player } from '../entities/Player';
import { eventBus } from '../core/EventBus';

export class WeaponLadderProgressionSystem {
  public static processFrag(player: Player, headshot: boolean): { newRank: number; isFinalKill: boolean } {
    const isFinalKill = player.ladderRank >= GAME_BALANCE.ladder_tier_count;

    if (!isFinalKill) {
      // 0 bonus skip for headshots to ensure all 12 weapons are played (balance.yaml)
      const nextRank = player.ladderRank + 1;
      player.setRank(nextRank);
    }

    return {
      newRank: player.ladderRank,
      isFinalKill
    };
  }

  public static getWeaponForRank(rank: number): WeaponDef {
    const idx = Math.max(0, Math.min(WEAPON_LADDER.length - 1, rank - 1));
    return WEAPON_LADDER[idx];
  }
}