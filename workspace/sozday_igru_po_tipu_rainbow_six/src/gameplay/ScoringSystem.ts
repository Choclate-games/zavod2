import type { AssaultStats, RoomId } from "../core/Types";

export class ScoringSystem {
  static calculateAssaultStats(
    roomId: RoomId,
    roomName: string,
    durationSeconds: number,
    shotsFired: number,
    shotsHit: number,
    headshots: number,
    breachKills: number,
    shieldDamageAbsorbed: number,
    shieldIntegrityPercent: number
  ): AssaultStats {
    const accuracy = shotsFired > 0 ? Math.min(1.0, shotsHit / shotsFired) : 1.0;
    const accuracyMult = Math.max(0.5, accuracy);

    const speedBonus = Math.max(0, Math.round((90 - durationSeconds) * 50));
    const headshotScore = headshots * 500;
    const breachScore = breachKills * 350;
    const shieldScore = Math.round(shieldIntegrityPercent * 10);

    const rawScore = headshotScore + breachScore + speedBonus + shieldScore;
    const finalScore = Math.round(rawScore * accuracyMult);

    let rank: "S" | "A" | "B" | "C" | "D" = "C";
    let stars = 1;

    if (finalScore >= 3600 && accuracy >= 0.75 && headshots >= 2) {
      rank = "S";
      stars = 3;
    } else if (finalScore >= 2500) {
      rank = "A";
      stars = 3;
    } else if (finalScore >= 1600) {
      rank = "B";
      stars = 2;
    } else if (finalScore >= 800) {
      rank = "C";
      stars = 1;
    } else {
      rank = "D";
      stars = 1;
    }

    const creditsEarned = Math.round(350 + finalScore * 0.25);

    return {
      roomId,
      roomName,
      durationSeconds: Math.round(durationSeconds * 10) / 10,
      shotsFired,
      shotsHit,
      headshots,
      breachKills,
      shieldDamageAbsorbed,
      shieldIntegrityPercent,
      creditsEarned,
      score: finalScore,
      rank,
      stars,
    };
  }
}
