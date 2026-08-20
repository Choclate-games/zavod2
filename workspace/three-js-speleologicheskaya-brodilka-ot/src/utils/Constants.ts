export interface UpgradeCard {
  id: string;
  name: string;
  description: string;
  rarity: "common" | "rare" | "epic" | "legendary";
  icon: string;
  apply: (stats: GameStats) => void;
}

export interface MetaUpgradeDef {
  id: string;
  name: string;
  description: string;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
  icon: string;
}

export interface GameStats {
  maxHp: number;
  hp: number;
  maxEnergy: number;
  energy: number;
  energyRechargeRate: number;
  pulseEnergyCost: number;
  walkSpeed: number;
  sprintSpeed: number;
  jumpForce: number;
  fallDamageThreshold: number;
  fallDamageMultiplier: number;
  crouchNoiseMult: number;
  stepNoiseWeight: number;
  pingNoiseWeight: number;
  waveSpeed: number;
  particleLifetime: number;
  baseScanRange: number;
  maxParticlesLimit: number;
  crystalValue: number;
  resonanceFrequencyMatch: number;
  dopplerFilterActive: boolean;
  phosphorGlowBonus: number;
  acousticResonatorRadius: number;
  superconductingDiscount: number;
  infrasoundStunActive: boolean;
  acousticArmorMult: number;
  decoyCharges: number;
  maxDecoyCharges: number;
}

export const GAME_CONSTANTS = {
  // Movement & Physics
  DEFAULT_WALK_SPEED: 3.8,
  DEFAULT_SPRINT_SPEED: 6.5,
  DEFAULT_JUMP_FORCE: 5.2,
  DEFAULT_FALL_DAMAGE_THRESHOLD: 7.5,
  DEFAULT_FALL_DAMAGE_MULTIPLIER: 18.0,
  GRAVITY: -18.0,

  // LiDAR & Echolocation
  DEFAULT_WAVE_SPEED: 28.0,
  DEFAULT_PARTICLE_LIFETIME: 6.0,
  DEFAULT_MAX_PARTICLES: 65000,
  DEFAULT_PULSE_ENERGY_COST: 30.0,
  DEFAULT_BASE_SCAN_RANGE: 35.0,
  BASE_POINT_DENSITY: 450, // points/m2

  // Acoustic & Noise
  STEP_NOISE_WEIGHT: 12.0, // dB
  PING_NOISE_WEIGHT: 48.0, // dB
  STALKER_SENSITIVITY_THRESHOLD: 0.75,
  
  // Combat & Monsters
  STALKER_AGGRO_SPEED: 7.2,
  STALKER_PATROL_SPEED: 2.5,
  STALKER_DAMAGE: 35.0,
  STALKER_ATTACK_RADIUS: 1.8,
  STALKER_ATTACK_COOLDOWN: 1.5,
  DECOY_LIFETIME: 8.0,
  HITSTOP_DURATION: 0.04, // 40ms hitstop
  
  // Minerals & Economy
  BASE_CRYSTAL_VALUE: 15,
  FLOORS_COUNT: 3
} as const;

export const META_UPGRADES: MetaUpgradeDef[] = [
  {
    id: "boots_dampeners",
    name: "Кевларовые демпферы",
    description: "-10% шум шагов и +1.0 м/с к безопасному падению за уровень",
    maxLevel: 5,
    baseCost: 30,
    costMultiplier: 1.8,
    icon: "🥾"
  },
  {
    id: "lidar_neural",
    name: "Нейроинтерфейс LiDAR",
    description: "+15 000 точек PointCloud и +15% к радиусу обзора",
    maxLevel: 5,
    baseCost: 40,
    costMultiplier: 2.0,
    icon: "👁️"
  },
  {
    id: "high_voltage_battery",
    name: "Высоковольтный аккумулятор",
    description: "+30 макс. энергии сонара и +20% скорость зарядки",
    maxLevel: 4,
    baseCost: 50,
    costMultiplier: 2.2,
    icon: "🔋"
  },
  {
    id: "geo_spectrometer",
    name: "Геоакустический спектрометр",
    description: "Цветовая идентификация пород и +25% доход кристаллов",
    maxLevel: 3,
    baseCost: 60,
    costMultiplier: 2.5,
    icon: "💎"
  }
];

export const UPGRADE_CARDS_POOL: UpgradeCard[] = [
  {
    id: "doppler_filter",
    name: "Доплеровский фильтр",
    description: "Движущиеся враги подсвечиваются ярко-красным спектром с +40% временем жизни точек.",
    rarity: "rare",
    icon: "📡",
    apply: (stats) => {
      stats.dopplerFilterActive = true;
    }
  },
  {
    id: "phosphor_glow",
    name: "Фосфорное тление",
    description: "Точки рельефа тлеют на 3.5 секунды дольше (время жизни возрастает до 9.5 с).",
    rarity: "common",
    icon: "✨",
    apply: (stats) => {
      stats.particleLifetime += 3.5;
      stats.phosphorGlowBonus += 3.5;
    }
  },
  {
    id: "acoustic_resonator",
    name: "Акустический резонатор",
    description: "Пуск сонара дробит жилы кристаллов на расстоянии до 15м и притягивает осколки.",
    rarity: "epic",
    icon: "🔮",
    apply: (stats) => {
      stats.acousticResonatorRadius = 15.0;
      stats.resonanceFrequencyMatch = 1.0;
    }
  },
  {
    id: "superconducting_capacitor",
    name: "Сверхпроводящий конденсатор",
    description: "Расход энергии сонара снижается на 35%, позволяя чаще отправлять импульсы.",
    rarity: "rare",
    icon: "⚡",
    apply: (stats) => {
      stats.pulseEnergyCost *= 0.65;
      stats.superconductingDiscount = 0.35;
    }
  },
  {
    id: "infrasound_shockwave",
    name: "Инфразвуковая ударная волна",
    description: "Импульс сонара и приземление оглушают монстров в радиусе 8м на 2.5 секунды.",
    rarity: "legendary",
    icon: "💥",
    apply: (stats) => {
      stats.infrasoundStunActive = true;
    }
  },
  {
    id: "acoustic_armor",
    name: "Акустический демпфер брони",
    description: "Снижает урон от атак монстров на 30% и поглощает силу удара.",
    rarity: "common",
    icon: "🛡️",
    apply: (stats) => {
      stats.acousticArmorMult *= 0.7;
    }
  },
  {
    id: "ultrasonic_radar",
    name: "Ультразвуковой радар",
    description: "Увеличивает базовую дальность сканирования до 50 метров.",
    rarity: "common",
    icon: "🌐",
    apply: (stats) => {
      stats.baseScanRange += 15.0;
    }
  },
  {
    id: "decoy_fabricator",
    name: "Фабрикатор приманок",
    description: "+2 звуковых маячка-приманки в запас для отвлечения монстров.",
    rarity: "rare",
    icon: "🔊",
    apply: (stats) => {
      stats.maxDecoyCharges += 2;
      stats.decoyCharges = Math.min(stats.maxDecoyCharges, stats.decoyCharges + 2);
    }
  }
];
