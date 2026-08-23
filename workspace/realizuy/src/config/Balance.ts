/**
 * Single source of truth for game balance numbers derived from balance.yaml.
 * Code reads balance parameters from this module.
 */
export const BALANCE = {
  performance: {
    targetFps: 60,
    maxDrawCalls: 80,
    maxTriangles: 45000,
    bundleSizeBudgetMb: 4.5,
  },
  spartan_launch_kick: {
    baseLaunchImpulse: 350, // 350 Н*с
    chargeTimeThreshold: 0.25, // 0.25 с
    hitstopDuration: 0.08, // 0.08 с
    kickRangeReach: 1.8, // 1.8 м
    chargedImpulseMultiplier: 1.4857, // yields ~520 Н*с (350 * 1.4857)
    baseKickDamage: 20,
    recoveryDuration: 0.35,
  },
  kinetic_body_bowling: {
    chainEnergyTransfer: 0.65, // 65%
    knockdownStunDuration: 1.2, // 1.2 с
    comboCashMultiplier: 1.3, // 1.3x за сбитое тело
    minLethalSpeed: 3.5, // 3.5 м/с
    kineticDamageConstant: 0.035, // K_kinetic = 0.035 Дж^-1
  },
  prop_tactical_hurdle: {
    throwVelocityBase: 16.0, // 16.0 м/с
    explosiveBarrelRadius: 4.5, // 4.5 м
    meleeWeaponDurability: 4, // 4 удара
    autoAimAssistAngle: 20, // 20 градусов
    pickupRadius: 1.8, // 1.8 м
    barrelExplosionDamage: 75,
  },
  wall_splat_destruction: {
    wallSplatBonusDmg: 45, // 45 ед.
    destructibleForceThreshold: 1200, // 1200 Н
    shrapnelFragmentCount: 4, // 4 осколка
    wallStickDuration: 0.2, // 0.2 с
    shrapnelDamage: 18,
    shrapnelImpulse: 90,
  },
  pit_workbench_economy: {
    kickUpgradeCostBase: 150, // $150
    sledgehammerWeaponCost: 220, // $220
    medkitHealAmount: 60, // 60 HP
    medkitCost: 60, // $60
    earlyStartCashBonus: 50, // $50
    baseHooliganBounty: 25,
  },
  player: {
    maxHp: 100,
    moveSpeed: 6.5,
    dashSpeed: 14.0,
    dashDuration: 0.25,
    dashCooldown: 0.8,
    mass: 85,
  },
  enemies: {
    hooligan: { hp: 40, mass: 75, speed: 4.2, damage: 10, bounty: 25 },
    flanker: { hp: 35, mass: 70, speed: 5.8, damage: 12, bounty: 35 },
    brawler: { hp: 70, mass: 95, speed: 3.8, damage: 15, bounty: 45 },
    heavy: { hp: 120, mass: 140, speed: 2.8, damage: 25, bounty: 60 },
    boss: { hp: 450, mass: 240, speed: 3.2, damage: 40, bounty: 200 },
  },
} as const
