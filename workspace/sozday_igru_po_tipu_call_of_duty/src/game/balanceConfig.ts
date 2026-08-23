/**
 * Balance constants and tuning numbers parsed from balance.yaml.
 * Pure single source of truth for weapon TTX, physics, thermal dynamics, and squad logic.
 */
export const BALANCE = {
  // 105mm Howitzer M102
  howitzer: {
    projectileSpeed: 455, // 455 м/с
    flightTime: 2.20, // 2.20 с (с высоты 1000м)
    splashRadius: 18.0, // 18.0 м
    baseDamage: 2500, // 2500 ед
    reloadTime: 4.50, // 4.50 с
    dangerRadius: 14.5, // 14.5 м от ИК-маяка Bravo-6
    cameraShake: 0.35,
    blastForce: 120000 // 120000 Н*с
  },

  // 25mm Gatling GAU-12 Equalizer
  gatling: {
    rateOfFireRpm: 1800, // 1800 выстр/мин
    shotsPerSecond: 30, // 30 выстр/с
    bulletDamage: 85, // 85 ед/пуля
    projectileSpeed: 850,
    flightTime: 1.18,
    heatPerShot: 1.85, // 1.85°C за выстрел (перегрев за 43 выстрела ~ 1.4 с)
    coolingRate: 18.0, // 18.0°C/с
    maxHeat: 100.0,
    jamDuration: 3.5,
    suppressionRadius: 3.8, // 3.8 м от точки попадания
    suppressionDuration: 2.8, // 2.8 с после прекращения обстрела
    cameraShake: 0.05
  },

  // 40mm Bofors Autocannon
  bofors: {
    projectileSpeed: 600,
    flightTime: 1.67,
    splashRadius: 6.5,
    baseDamage: 450,
    burstCount: 3,
    cooldownTime: 1.8,
    dangerRadius: 5.2,
    cameraShake: 0.18,
    blastForce: 45000
  },

  // Bravo-6 Friendly Squad Protocol
  squad: {
    soldierCount: 4, // 4 бойца
    soldierMaxHealth: 150, // 150 HP
    strobeFrequencyHz: 2.0, // 2.0 Гц
    marchSpeed: 4.2, // 4.2 м/с
    sprintSpeed: 6.5, // 6.5 м/с
    missionDurationLimit: 100 // 100 секунд до таймаута
  },

  // Physics & Chain Reactions
  physics: {
    fuelTankRadius: 16.5, // 16.5 м
    fuelTankDamage: 3500, // 3500 ед
    vehicleImpulse: 85000, // 85000 Н*с
    ragdollImpulse: 14000, // 14000 Н*с
    debrisCount: 18, // 18 физических мешей
    chainComboMultiplier: 1.5, // x1.5 за шаг
    maxComboMultiplier: 5.0 // до x5.0
  },

  // Orbit and Aircraft
  orbit: {
    altitude: 1000, // 1000 м
    orbitRadius: 800,
    orbitSpeed: 0.04,
    driftVelocity: 3.5 // 3.5 м/с
  }
} as const
