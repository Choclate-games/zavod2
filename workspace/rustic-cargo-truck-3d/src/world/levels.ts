import type { CargoPackageType } from '../core/types';

export interface MudZoneConfig {
  startZ: number;
  endZ: number;
  intensity: number;
}

export interface WaterZoneConfig {
  startZ: number;
  endZ: number;
  depth: number;
}

export interface ForkConfig {
  startZ: number;
  endZ: number;
  leftOffset: number;
  rightOffset: number;
  leftTag: string;
  rightTag: string;
  leftElevation?: number;
  rightElevation?: number;
  leftMudIntensity?: number;
  rightMudIntensity?: number;
  leftWaterDepth?: number;
  rightWaterDepth?: number;
  leftBumpsAmp?: number;
  rightBumpsAmp?: number;
  leftBoulders?: number;
  rightBoulders?: number;
}

export interface LevelConfig {
  id: number;
  title: string;
  subtitle: string;
  tag: string;
  cargoPackage?: CargoPackageType;
  length: number;
  curveAmp?: number;
  curveFreq?: number;
  forks?: ForkConfig[];
  mudZones: MudZoneConfig[];
  waterZones: WaterZoneConfig[];
  bumpFreq: number;
  bumpAmp: number;
  camberAmp: number;
  hillsAmp: number;
  boulderCount: number;
  rewardCoins: number;
  parTime: number;
  /** Optional per-level fog: distance at which fog starts and ends. Defaults: near=90, far=360 */
  fogNear?: number;
  fogFar?: number;
}

export const LEVELS: LevelConfig[] = [
  {
    "id": 1,
    "title": "01. Деревенский просёлок",
    "subtitle": "Извилистая грунтовка с мягкими виражами и лужицами. Знакомство с управлением.",
    "tag": "Легко",
    "cargoPackage": "logs",
    "length": 220,
    "curveAmp": 3.2,
    "curveFreq": 0.038,
    "mudZones": [
      {
        "startZ": 75,
        "endZ": 145,
        "intensity": 0.55
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.49,
    "bumpAmp": 0.128,
    "camberAmp": 0.157,
    "hillsAmp": 1.65,
    "boulderCount": 7,
    "rewardCoins": 105,
    "parTime": 31
  },
  {
    "id": 2,
    "title": "02. Лесная колея",
    "subtitle": "Извилистая колея среди старых сосен с волнообразными поворотами.",
    "tag": "Легко",
    "cargoPackage": "logs",
    "length": 226,
    "curveAmp": 3.29,
    "curveFreq": 0.0379,
    "mudZones": [],
    "waterZones": [],
    "bumpFreq": 0.53,
    "bumpAmp": 0.136,
    "camberAmp": 0.164,
    "hillsAmp": 1.7,
    "boulderCount": 7,
    "rewardCoins": 130,
    "parTime": 32
  },
  {
    "id": 3,
    "title": "03. Топи у ручья",
    "subtitle": "Заболоченная низина на крутом лесном вираже. Не бросай газ!",
    "tag": "Грязь",
    "cargoPackage": "barrels",
    "length": 232,
    "curveAmp": 3.38,
    "curveFreq": 0.0377,
    "mudZones": [
      {
        "startZ": 65,
        "endZ": 128,
        "intensity": 0.6
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.57,
    "bumpAmp": 0.144,
    "camberAmp": 0.171,
    "hillsAmp": 1.75,
    "boulderCount": 8,
    "rewardCoins": 155,
    "parTime": 32
  },
  {
    "id": 4,
    "title": "04. Брод через ручей",
    "subtitle": "Водная преграда на повороте у ручья. Снижай скорость перед въездом в воду.",
    "tag": "Вода",
    "cargoPackage": "barrels",
    "length": 239,
    "curveAmp": 3.46,
    "curveFreq": 0.0376,
    "mudZones": [],
    "waterZones": [
      {
        "startZ": 86,
        "endZ": 115,
        "depth": 0.38
      }
    ],
    "bumpFreq": 0.61,
    "bumpAmp": 0.152,
    "camberAmp": 0.178,
    "hillsAmp": 1.8,
    "boulderCount": 9,
    "rewardCoins": 180,
    "parTime": 33
  },
  {
    "id": 5,
    "title": "05. Каменистый спуск",
    "subtitle": "Извилистый каменистый спуск с ухабами. Следи за скоростью на крутых виражах.",
    "tag": "Кочки",
    "cargoPackage": "construction",
    "length": 245,
    "curveAmp": 3.55,
    "curveFreq": 0.0374,
    "mudZones": [
      {
        "startZ": 69,
        "endZ": 135,
        "intensity": 0.61
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.65,
    "bumpAmp": 0.16,
    "camberAmp": 0.185,
    "hillsAmp": 1.85,
    "boulderCount": 10,
    "rewardCoins": 205,
    "parTime": 34
  },
  {
    "id": 6,
    "title": "06. Грязевой серпантин",
    "subtitle": "Извилистый подъём по раскисшей глине. Потребуется запас тяги на дуге.",
    "tag": "Грязь",
    "cargoPackage": "logs",
    "length": 251,
    "curveAmp": 3.64,
    "curveFreq": 0.0373,
    "mudZones": [],
    "waterZones": [],
    "bumpFreq": 0.45,
    "bumpAmp": 0.168,
    "camberAmp": 0.192,
    "hillsAmp": 1.9,
    "boulderCount": 10,
    "rewardCoins": 230,
    "parTime": 35
  },
  {
    "id": 7,
    "title": "07. Сосновый бор",
    "subtitle": "Живописная извилистая трасса с выступающими корнями и плотными рядами сосен.",
    "tag": "Легко",
    "cargoPackage": "farm",
    "length": 257,
    "curveAmp": 3.73,
    "curveFreq": 0.0372,
    "mudZones": [
      {
        "startZ": 72,
        "endZ": 141,
        "intensity": 0.63
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.49,
    "bumpAmp": 0.176,
    "camberAmp": 0.199,
    "hillsAmp": 1.95,
    "boulderCount": 11,
    "rewardCoins": 255,
    "parTime": 36
  },
  {
    "id": 8,
    "title": "08. Болото Лесорубов",
    "subtitle": "Огромная протяжённая топь с коварными S-образными колеями. Колёса буксуют.",
    "tag": "Грязь",
    "cargoPackage": "logs",
    "length": 263,
    "curveAmp": 3.82,
    "curveFreq": 0.037,
    "mudZones": [],
    "waterZones": [
      {
        "startZ": 95,
        "endZ": 126,
        "depth": 0.4
      }
    ],
    "bumpFreq": 0.53,
    "bumpAmp": 0.184,
    "camberAmp": 0.206,
    "hillsAmp": 2,
    "boulderCount": 12,
    "rewardCoins": 280,
    "parTime": 37
  },
  {
    "id": 9,
    "title": "09. Ухабистая гряда",
    "subtitle": "Ритмичные моголы и поперечный крен на виражах, раскачивающий кузов.",
    "tag": "Кочки",
    "cargoPackage": "farm",
    "length": 270,
    "curveAmp": 3.9,
    "curveFreq": 0.0369,
    "mudZones": [
      {
        "startZ": 76,
        "endZ": 149,
        "intensity": 0.64
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.57,
    "bumpAmp": 0.192,
    "camberAmp": 0.213,
    "hillsAmp": 2.05,
    "boulderCount": 12,
    "rewardCoins": 305,
    "parTime": 38
  },
  {
    "id": 10,
    "title": "10. Тайга после ливня",
    "subtitle": "Широкая развилка: опасная срезка через глубокую топь или сухой песчаный объезд.",
    "tag": "Развилка",
    "cargoPackage": "barrels",
    "length": 276,
    "curveAmp": 3.99,
    "curveFreq": 0.0367,
    "forks": [
      {
        "startZ": 70,
        "endZ": 185,
        "leftOffset": -14.5,
        "rightOffset": 14.5,
        "leftTag": "💥 ТОПЬ",
        "rightTag": "✨ ОБЪЕЗД",
        "leftElevation": -1.2,
        "rightElevation": 1.8,
        "leftMudIntensity": 0.95,
        "rightMudIntensity": 0,
        "rightBumpsAmp": 0.05
      }
    ],
    "mudZones": [
      {
        "startZ": 77,
        "endZ": 152,
        "intensity": 0.65
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.61,
    "bumpAmp": 0.2,
    "camberAmp": 0.22,
    "hillsAmp": 2.1,
    "boulderCount": 13,
    "rewardCoins": 330,
    "parTime": 39
  },
  {
    "id": 11,
    "title": "11. Речной брод",
    "subtitle": "Глубокий брод через лесную речку с плавным изгибом русла.",
    "tag": "Вода",
    "cargoPackage": "barrels",
    "length": 282,
    "curveAmp": 4.08,
    "curveFreq": 0.0366,
    "mudZones": [
      {
        "startZ": 79,
        "endZ": 155,
        "intensity": 0.66
      }
    ],
    "waterZones": [
      {
        "startZ": 102,
        "endZ": 135,
        "depth": 0.41
      }
    ],
    "bumpFreq": 0.65,
    "bumpAmp": 0.208,
    "camberAmp": 0.227,
    "hillsAmp": 2.15,
    "boulderCount": 14,
    "rewardCoins": 355,
    "parTime": 39
  },
  {
    "id": 12,
    "title": "12. Каменный каньон",
    "subtitle": "Широкая развилка: ровный песчаник слева или каменистый каньон с валунами справа.",
    "tag": "Развилка",
    "cargoPackage": "construction",
    "length": 288,
    "curveAmp": 4.17,
    "curveFreq": 0.0365,
    "forks": [
      {
        "startZ": 75,
        "endZ": 200,
        "leftOffset": -15,
        "rightOffset": 15,
        "leftTag": "✨ ПЕСЧАНИК",
        "rightTag": "💥 ВАЛУНЫ",
        "leftElevation": 1.2,
        "rightElevation": 0.2,
        "leftMudIntensity": 0,
        "leftBoulders": 0,
        "leftBumpsAmp": 0.05,
        "rightBoulders": 14,
        "rightBumpsAmp": 0.55
      }
    ],
    "mudZones": [
      {
        "startZ": 81,
        "endZ": 158,
        "intensity": 0.66
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.45,
    "bumpAmp": 0.216,
    "camberAmp": 0.234,
    "hillsAmp": 2.2,
    "boulderCount": 14,
    "rewardCoins": 380,
    "parTime": 40
  },
  {
    "id": 13,
    "title": "13. Чёрная топь",
    "subtitle": "Вязкий чёрный торфяник на S-образном участке. Минимальное сцепление шин.",
    "tag": "Грязь",
    "cargoPackage": "fragile",
    "length": 294,
    "curveAmp": 4.26,
    "curveFreq": 0.0363,
    "mudZones": [
      {
        "startZ": 82,
        "endZ": 162,
        "intensity": 0.67
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.49,
    "bumpAmp": 0.224,
    "camberAmp": 0.241,
    "hillsAmp": 2.25,
    "boulderCount": 15,
    "rewardCoins": 405,
    "parTime": 41
  },
  {
    "id": 14,
    "title": "14. Крутой перевал",
    "subtitle": "Широкая развилка: крутой скользкий подъём слева или пологий гравийный объезд справа.",
    "tag": "Развилка",
    "cargoPackage": "construction",
    "length": 301,
    "curveAmp": 4.34,
    "curveFreq": 0.0362,
    "forks": [
      {
        "startZ": 80,
        "endZ": 215,
        "leftOffset": -15,
        "rightOffset": 15,
        "leftTag": "💥 ПОДЪЁМ",
        "rightTag": "✨ СЕРПАНТИН",
        "leftElevation": 3.8,
        "rightElevation": 1,
        "leftMudIntensity": 0.85,
        "rightMudIntensity": 0.05,
        "leftBumpsAmp": 0.45,
        "rightBumpsAmp": 0.08
      }
    ],
    "mudZones": [
      {
        "startZ": 84,
        "endZ": 166,
        "intensity": 0.68
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.53,
    "bumpAmp": 0.232,
    "camberAmp": 0.248,
    "hillsAmp": 2.3,
    "boulderCount": 16,
    "rewardCoins": 430,
    "parTime": 42
  },
  {
    "id": 15,
    "title": "15. Затопленная колея",
    "subtitle": "Широкая развилка: ровная бревенчатая гать слева или глубокий затопленный брод справа.",
    "tag": "Развилка",
    "cargoPackage": "barrels",
    "length": 307,
    "curveAmp": 4.43,
    "curveFreq": 0.036,
    "forks": [
      {
        "startZ": 85,
        "endZ": 220,
        "leftOffset": -15.5,
        "rightOffset": 15.5,
        "leftTag": "✨ ГАТЬ",
        "rightTag": "💥 БРОД",
        "leftElevation": 1.2,
        "rightElevation": -1.2,
        "leftWaterDepth": 0,
        "rightWaterDepth": 0.65,
        "leftMudIntensity": 0,
        "rightMudIntensity": 0.88,
        "leftBumpsAmp": 0.06
      }
    ],
    "mudZones": [
      {
        "startZ": 86,
        "endZ": 169,
        "intensity": 0.68
      }
    ],
    "waterZones": [
      {
        "startZ": 111,
        "endZ": 147,
        "depth": 0.43
      }
    ],
    "bumpFreq": 0.57,
    "bumpAmp": 0.24,
    "camberAmp": 0.255,
    "hillsAmp": 2.35,
    "boulderCount": 17,
    "rewardCoins": 455,
    "parTime": 43
  },
  {
    "id": 16,
    "title": "16. Топкая низина",
    "subtitle": "Широкая развилка: коварная топкая низина слева или сухой высокий гребень справа.",
    "tag": "Развилка",
    "cargoPackage": "logs",
    "length": 313,
    "curveAmp": 4.52,
    "curveFreq": 0.0359,
    "forks": [
      {
        "startZ": 85,
        "endZ": 225,
        "leftOffset": -15.5,
        "rightOffset": 15.5,
        "leftTag": "💥 НИЗИНА",
        "rightTag": "✨ ГРЕБЕНЬ",
        "leftElevation": -1.5,
        "rightElevation": 2.4,
        "leftMudIntensity": 0.96,
        "rightMudIntensity": 0,
        "leftBumpsAmp": 0.4,
        "rightBumpsAmp": 0.06
      }
    ],
    "mudZones": [
      {
        "startZ": 88,
        "endZ": 172,
        "intensity": 0.69
      }
    ],
    "waterZones": [
      {
        "startZ": 113,
        "endZ": 150,
        "depth": 0.44
      }
    ],
    "bumpFreq": 0.61,
    "bumpAmp": 0.248,
    "camberAmp": 0.262,
    "hillsAmp": 2.4,
    "boulderCount": 17,
    "rewardCoins": 480,
    "parTime": 44
  },
  {
    "id": 17,
    "title": "17. Лесовозный большак",
    "subtitle": "Разбитый лесовозами большак: глубокая колея, брёвна и извилистые промоины.",
    "tag": "Сложно",
    "cargoPackage": "logs",
    "length": 319,
    "curveAmp": 4.61,
    "curveFreq": 0.0358,
    "mudZones": [
      {
        "startZ": 89,
        "endZ": 175,
        "intensity": 0.7
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.65,
    "bumpAmp": 0.256,
    "camberAmp": 0.269,
    "hillsAmp": 2.45,
    "boulderCount": 18,
    "rewardCoins": 505,
    "parTime": 45
  },
  {
    "id": 18,
    "title": "18. Каменная осыпь",
    "subtitle": "Широкая развилка: расчищенная просека слева или опасный скальный распадок с валунами справа.",
    "tag": "Развилка",
    "cargoPackage": "construction",
    "length": 325,
    "curveAmp": 4.7,
    "curveFreq": 0.0356,
    "forks": [
      {
        "startZ": 90,
        "endZ": 240,
        "leftOffset": -15.8,
        "rightOffset": 15.8,
        "leftTag": "✨ ПРОСЕКА",
        "rightTag": "💥 СКАЛЫ",
        "leftElevation": 0.8,
        "rightElevation": 2.2,
        "leftMudIntensity": 0.05,
        "rightBoulders": 16,
        "leftBoulders": 0,
        "rightBumpsAmp": 0.6
      }
    ],
    "mudZones": [
      {
        "startZ": 91,
        "endZ": 179,
        "intensity": 0.71
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.45,
    "bumpAmp": 0.264,
    "camberAmp": 0.276,
    "hillsAmp": 2.5,
    "boulderCount": 19,
    "rewardCoins": 530,
    "parTime": 45
  },
  {
    "id": 19,
    "title": "19. Гиблое урочище",
    "subtitle": "Коварная смесь моголов, глубоких ям, топей и грязи на извилистом рельефе.",
    "tag": "Грязь",
    "cargoPackage": "fragile",
    "length": 332,
    "curveAmp": 4.78,
    "curveFreq": 0.0355,
    "mudZones": [
      {
        "startZ": 93,
        "endZ": 183,
        "intensity": 0.71
      },
      {
        "startZ": 212,
        "endZ": 292,
        "intensity": 0.74
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.49,
    "bumpAmp": 0.272,
    "camberAmp": 0.283,
    "hillsAmp": 2.55,
    "boulderCount": 19,
    "rewardCoins": 555,
    "parTime": 46
  },
  {
    "id": 20,
    "title": "20. Таёжный перевал",
    "subtitle": "Широкая развилка: бурный глубокий брод слева или сухой горный перевал справа.",
    "tag": "Развилка",
    "cargoPackage": "mixed",
    "length": 338,
    "curveAmp": 4.87,
    "curveFreq": 0.0353,
    "forks": [
      {
        "startZ": 95,
        "endZ": 250,
        "leftOffset": -16,
        "rightOffset": 16,
        "leftTag": "💥 БРОД",
        "rightTag": "✨ ПЕРЕВАЛ",
        "leftElevation": -1.2,
        "rightElevation": 3,
        "leftWaterDepth": 0.7,
        "rightWaterDepth": 0,
        "leftMudIntensity": 0.9,
        "rightMudIntensity": 0,
        "rightBumpsAmp": 0.08
      }
    ],
    "mudZones": [
      {
        "startZ": 95,
        "endZ": 186,
        "intensity": 0.72
      },
      {
        "startZ": 216,
        "endZ": 297,
        "intensity": 0.75
      }
    ],
    "waterZones": [
      {
        "startZ": 122,
        "endZ": 162,
        "depth": 0.46
      }
    ],
    "bumpFreq": 0.53,
    "bumpAmp": 0.28,
    "camberAmp": 0.29,
    "hillsAmp": 2.6,
    "boulderCount": 20,
    "rewardCoins": 580,
    "parTime": 47
  },
  {
    "id": 21,
    "title": "21. Озёрный перешеек",
    "subtitle": "Узкая извилистая насыпь между двумя таёжными озёрами с глубокими лужами.",
    "tag": "Вода",
    "cargoPackage": "barrels",
    "length": 344,
    "curveAmp": 4.96,
    "curveFreq": 0.0352,
    "mudZones": [
      {
        "startZ": 96,
        "endZ": 189,
        "intensity": 0.73
      },
      {
        "startZ": 220,
        "endZ": 303,
        "intensity": 0.76
      }
    ],
    "waterZones": [
      {
        "startZ": 124,
        "endZ": 165,
        "depth": 0.46
      },
      {
        "startZ": 224,
        "endZ": 268,
        "depth": 0.45
      }
    ],
    "bumpFreq": 0.57,
    "bumpAmp": 0.288,
    "camberAmp": 0.297,
    "hillsAmp": 2.65,
    "boulderCount": 21,
    "rewardCoins": 605,
    "parTime": 48
  },
  {
    "id": 22,
    "title": "22. Скальный гребень",
    "subtitle": "Широкая развилка: песчаная терраса слева или вязкая чёрная топь справа.",
    "tag": "Развилка",
    "cargoPackage": "construction",
    "length": 350,
    "curveAmp": 5.05,
    "curveFreq": 0.0351,
    "forks": [
      {
        "startZ": 100,
        "endZ": 260,
        "leftOffset": -16,
        "rightOffset": 16,
        "leftTag": "✨ ТЕРРАСА",
        "rightTag": "💥 ТОПЬ",
        "leftElevation": 1.6,
        "rightElevation": -1.6,
        "leftMudIntensity": 0,
        "rightMudIntensity": 0.98,
        "rightBumpsAmp": 0.45,
        "leftBumpsAmp": 0.06
      }
    ],
    "mudZones": [
      {
        "startZ": 98,
        "endZ": 193,
        "intensity": 0.73
      },
      {
        "startZ": 224,
        "endZ": 308,
        "intensity": 0.76
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.61,
    "bumpAmp": 0.296,
    "camberAmp": 0.304,
    "hillsAmp": 2.7,
    "boulderCount": 21,
    "rewardCoins": 630,
    "parTime": 49
  },
  {
    "id": 23,
    "title": "23. Глинистый овраг",
    "subtitle": "Крутой спуск в размытый глинистый овраг с тяжёлым поворотом на выезде.",
    "tag": "Грязь",
    "cargoPackage": "farm",
    "length": 356,
    "curveAmp": 5.14,
    "curveFreq": 0.0349,
    "mudZones": [
      {
        "startZ": 100,
        "endZ": 196,
        "intensity": 0.74
      },
      {
        "startZ": 228,
        "endZ": 313,
        "intensity": 0.77
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.65,
    "bumpAmp": 0.304,
    "camberAmp": 0.311,
    "hillsAmp": 2.75,
    "boulderCount": 22,
    "rewardCoins": 655,
    "parTime": 50
  },
  {
    "id": 24,
    "title": "24. Гребёнка лесорубов",
    "subtitle": "Широкая развилка: жестокая могольная гребёнка слева или ровная расчищенная просека справа.",
    "tag": "Развилка",
    "cargoPackage": "logs",
    "length": 363,
    "curveAmp": 5.22,
    "curveFreq": 0.0348,
    "forks": [
      {
        "startZ": 105,
        "endZ": 270,
        "leftOffset": -16.2,
        "rightOffset": 16.2,
        "leftTag": "💥 МОГОЛЫ",
        "rightTag": "✨ ПРОСЕКА",
        "leftElevation": 1.5,
        "rightElevation": 0.6,
        "leftBumpsAmp": 0.75,
        "rightBumpsAmp": 0.06,
        "rightMudIntensity": 0.05
      }
    ],
    "mudZones": [
      {
        "startZ": 102,
        "endZ": 200,
        "intensity": 0.75
      },
      {
        "startZ": 232,
        "endZ": 319,
        "intensity": 0.77
      }
    ],
    "waterZones": [
      {
        "startZ": 131,
        "endZ": 174,
        "depth": 0.48
      }
    ],
    "bumpFreq": 0.45,
    "bumpAmp": 0.312,
    "camberAmp": 0.318,
    "hillsAmp": 2.8,
    "boulderCount": 23,
    "rewardCoins": 680,
    "parTime": 51
  },
  {
    "id": 25,
    "title": "25. Речная пойма",
    "subtitle": "Широкая развилка: ровный бревенчатый настил слева или глубокий озёрный ил справа.",
    "tag": "Развилка",
    "cargoPackage": "barrels",
    "length": 369,
    "curveAmp": 5.31,
    "curveFreq": 0.0346,
    "forks": [
      {
        "startZ": 105,
        "endZ": 275,
        "leftOffset": -16.2,
        "rightOffset": 16.2,
        "leftTag": "✨ НАСТИЛ",
        "rightTag": "💥 ИЛ",
        "leftElevation": 1.4,
        "rightElevation": -1.4,
        "leftWaterDepth": 0,
        "rightWaterDepth": 0.68,
        "leftMudIntensity": 0,
        "rightMudIntensity": 0.92
      }
    ],
    "mudZones": [
      {
        "startZ": 103,
        "endZ": 203,
        "intensity": 0.76
      },
      {
        "startZ": 236,
        "endZ": 325,
        "intensity": 0.78
      }
    ],
    "waterZones": [
      {
        "startZ": 133,
        "endZ": 177,
        "depth": 0.48
      },
      {
        "startZ": 240,
        "endZ": 288,
        "depth": 0.45
      }
    ],
    "bumpFreq": 0.49,
    "bumpAmp": 0.32,
    "camberAmp": 0.325,
    "hillsAmp": 2.85,
    "boulderCount": 24,
    "rewardCoins": 855,
    "parTime": 52
  },
  {
    "id": 26,
    "title": "26. Медвежий угол",
    "subtitle": "Широкая развилка: бурелом со скалами слева или ровный укатанный тракт справа.",
    "tag": "Развилка",
    "cargoPackage": "fragile",
    "length": 375,
    "curveAmp": 5.4,
    "curveFreq": 0.0345,
    "forks": [
      {
        "startZ": 110,
        "endZ": 280,
        "leftOffset": -16.5,
        "rightOffset": 16.5,
        "leftTag": "💥 ЗАВАЛ",
        "rightTag": "✨ ТРАКТ",
        "leftElevation": 1.8,
        "rightElevation": 0.8,
        "leftBoulders": 18,
        "rightBoulders": 0,
        "leftBumpsAmp": 0.55,
        "rightMudIntensity": 0.05
      }
    ],
    "mudZones": [
      {
        "startZ": 105,
        "endZ": 206,
        "intensity": 0.76
      },
      {
        "startZ": 240,
        "endZ": 330,
        "intensity": 0.78
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.53,
    "bumpAmp": 0.328,
    "camberAmp": 0.332,
    "hillsAmp": 2.9,
    "boulderCount": 24,
    "rewardCoins": 880,
    "parTime": 52
  },
  {
    "id": 27,
    "title": "27. Глубокая колея",
    "subtitle": "Двухполосная разбитая колея: рули точно по верхушкам извилистых колей.",
    "tag": "Грязь",
    "cargoPackage": "farm",
    "length": 381,
    "curveAmp": 5.49,
    "curveFreq": 0.0344,
    "mudZones": [
      {
        "startZ": 107,
        "endZ": 210,
        "intensity": 0.77
      },
      {
        "startZ": 244,
        "endZ": 335,
        "intensity": 0.79
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.57,
    "bumpAmp": 0.336,
    "camberAmp": 0.339,
    "hillsAmp": 2.95,
    "boulderCount": 25,
    "rewardCoins": 905,
    "parTime": 53
  },
  {
    "id": 28,
    "title": "28. Валунный лабиринт",
    "subtitle": "Широкая развилка: сухой гравийный холм слева или глубокий вязкий ил справа.",
    "tag": "Развилка",
    "cargoPackage": "construction",
    "length": 387,
    "curveAmp": 5.58,
    "curveFreq": 0.0342,
    "forks": [
      {
        "startZ": 110,
        "endZ": 290,
        "leftOffset": -16.5,
        "rightOffset": 16.5,
        "leftTag": "✨ ХОЛМ",
        "rightTag": "💥 ИЛ",
        "leftElevation": 2.5,
        "rightElevation": -1.4,
        "leftMudIntensity": 0,
        "rightMudIntensity": 0.97,
        "leftBumpsAmp": 0.06
      }
    ],
    "mudZones": [
      {
        "startZ": 108,
        "endZ": 213,
        "intensity": 0.78
      },
      {
        "startZ": 248,
        "endZ": 341,
        "intensity": 0.79
      }
    ],
    "waterZones": [
      {
        "startZ": 139,
        "endZ": 186,
        "depth": 0.5
      }
    ],
    "bumpFreq": 0.61,
    "bumpAmp": 0.344,
    "camberAmp": 0.346,
    "hillsAmp": 3,
    "boulderCount": 26,
    "rewardCoins": 930,
    "parTime": 54
  },
  {
    "id": 29,
    "title": "29. Моховое болото",
    "subtitle": "Мягкий вязкий мох и топь на затяжном повороте, поглощающие импульс движения.",
    "tag": "Грязь",
    "cargoPackage": "mixed",
    "length": 394,
    "curveAmp": 5.66,
    "curveFreq": 0.0341,
    "mudZones": [
      {
        "startZ": 110,
        "endZ": 217,
        "intensity": 0.78
      },
      {
        "startZ": 252,
        "endZ": 347,
        "intensity": 0.8
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.65,
    "bumpAmp": 0.352,
    "camberAmp": 0.353,
    "hillsAmp": 3.05,
    "boulderCount": 26,
    "rewardCoins": 955,
    "parTime": 55
  },
  {
    "id": 30,
    "title": "30. Вершина кряжа",
    "subtitle": "Широкая развилка: скалистый кряж с валунами слева или ровный песчаный обход справа.",
    "tag": "Развилка",
    "cargoPackage": "mixed",
    "length": 400,
    "curveAmp": 5.75,
    "curveFreq": 0.0339,
    "forks": [
      {
        "startZ": 115,
        "endZ": 300,
        "leftOffset": -16.8,
        "rightOffset": 16.8,
        "leftTag": "💥 СКАЛЫ",
        "rightTag": "✨ ОБХОД",
        "leftElevation": 3.2,
        "rightElevation": 0.8,
        "leftBoulders": 18,
        "rightBoulders": 0,
        "leftBumpsAmp": 0.65,
        "rightMudIntensity": 0.08
      }
    ],
    "mudZones": [
      {
        "startZ": 112,
        "endZ": 220,
        "intensity": 0.79
      },
      {
        "startZ": 256,
        "endZ": 352,
        "intensity": 0.8
      }
    ],
    "waterZones": [
      {
        "startZ": 144,
        "endZ": 192,
        "depth": 0.51
      }
    ],
    "bumpFreq": 0.45,
    "bumpAmp": 0.36,
    "camberAmp": 0.36,
    "hillsAmp": 3.1,
    "boulderCount": 27,
    "rewardCoins": 980,
    "parTime": 56
  },
  {
    "id": 31,
    "title": "31. Бурный приток",
    "subtitle": "Каменистый брод с сильным течением и глубокими ямами на дуге реки.",
    "tag": "Вода",
    "cargoPackage": "logs",
    "length": 406,
    "curveAmp": 5.84,
    "curveFreq": 0.0338,
    "mudZones": [
      {
        "startZ": 114,
        "endZ": 223,
        "intensity": 0.8
      },
      {
        "startZ": 260,
        "endZ": 357,
        "intensity": 0.81
      }
    ],
    "waterZones": [
      {
        "startZ": 146,
        "endZ": 195,
        "depth": 0.52
      },
      {
        "startZ": 264,
        "endZ": 317,
        "depth": 0.45
      }
    ],
    "bumpFreq": 0.49,
    "bumpAmp": 0.368,
    "camberAmp": 0.367,
    "hillsAmp": 3.15,
    "boulderCount": 28,
    "rewardCoins": 1005,
    "parTime": 57
  },
  {
    "id": 32,
    "title": "32. Крутояр",
    "subtitle": "Широкая развилка: сухой высокий карниз слева или размытый затопленный овраг справа.",
    "tag": "Развилка",
    "cargoPackage": "barrels",
    "length": 412,
    "curveAmp": 5.93,
    "curveFreq": 0.0337,
    "forks": [
      {
        "startZ": 120,
        "endZ": 310,
        "leftOffset": -16.8,
        "rightOffset": 16.8,
        "leftTag": "✨ КАРНИЗ",
        "rightTag": "💥 ОВРАГ",
        "leftElevation": 2.4,
        "rightElevation": -1.7,
        "leftMudIntensity": 0,
        "rightMudIntensity": 0.96,
        "rightWaterDepth": 0.45
      }
    ],
    "mudZones": [
      {
        "startZ": 115,
        "endZ": 227,
        "intensity": 0.8
      },
      {
        "startZ": 264,
        "endZ": 363,
        "intensity": 0.81
      }
    ],
    "waterZones": [
      {
        "startZ": 148,
        "endZ": 198,
        "depth": 0.52
      }
    ],
    "bumpFreq": 0.53,
    "bumpAmp": 0.376,
    "camberAmp": 0.374,
    "hillsAmp": 3.2,
    "boulderCount": 28,
    "rewardCoins": 1030,
    "parTime": 58
  },
  {
    "id": 33,
    "title": "33. Размытая гать",
    "subtitle": "Старая деревянная гать на S-образном повороте, наполовину ушедшая в трясину.",
    "tag": "Грязь",
    "cargoPackage": "construction",
    "length": 418,
    "curveAmp": 6.02,
    "curveFreq": 0.0335,
    "mudZones": [
      {
        "startZ": 117,
        "endZ": 230,
        "intensity": 0.81
      },
      {
        "startZ": 268,
        "endZ": 368,
        "intensity": 0.82
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.57,
    "bumpAmp": 0.384,
    "camberAmp": 0.381,
    "hillsAmp": 3.25,
    "boulderCount": 29,
    "rewardCoins": 1055,
    "parTime": 58
  },
  {
    "id": 34,
    "title": "34. Камнепадный распадок",
    "subtitle": "Широкая развилка: опасный камнепад слева или пологий безопасный траверс справа.",
    "tag": "Развилка",
    "cargoPackage": "farm",
    "length": 425,
    "curveAmp": 6.1,
    "curveFreq": 0.0334,
    "forks": [
      {
        "startZ": 120,
        "endZ": 320,
        "leftOffset": -17,
        "rightOffset": 17,
        "leftTag": "💥 КАМНЕПАД",
        "rightTag": "✨ ТРАВЕРС",
        "leftElevation": 2,
        "rightElevation": 1.2,
        "leftBoulders": 22,
        "rightBoulders": 0,
        "leftBumpsAmp": 0.6,
        "rightMudIntensity": 0.08
      }
    ],
    "mudZones": [
      {
        "startZ": 119,
        "endZ": 234,
        "intensity": 0.82
      },
      {
        "startZ": 272,
        "endZ": 374,
        "intensity": 0.82
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.61,
    "bumpAmp": 0.392,
    "camberAmp": 0.388,
    "hillsAmp": 3.3,
    "boulderCount": 30,
    "rewardCoins": 1080,
    "parTime": 59
  },
  {
    "id": 35,
    "title": "35. Торфяной карьер",
    "subtitle": "Широкая развилка: жидкий торфяной карьер слева или высокая сухая насыпь справа.",
    "tag": "Развилка",
    "cargoPackage": "fragile",
    "length": 431,
    "curveAmp": 6.19,
    "curveFreq": 0.0332,
    "forks": [
      {
        "startZ": 125,
        "endZ": 325,
        "leftOffset": -17,
        "rightOffset": 17,
        "leftTag": "💥 ТОРФЯНИК",
        "rightTag": "✨ НАСЫПЬ",
        "leftElevation": -1.6,
        "rightElevation": 2.2,
        "leftMudIntensity": 0.98,
        "rightMudIntensity": 0,
        "leftBumpsAmp": 0.35,
        "rightBumpsAmp": 0.05
      }
    ],
    "mudZones": [
      {
        "startZ": 121,
        "endZ": 237,
        "intensity": 0.82
      },
      {
        "startZ": 276,
        "endZ": 379,
        "intensity": 0.83
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.65,
    "bumpAmp": 0.4,
    "camberAmp": 0.395,
    "hillsAmp": 3.35,
    "boulderCount": 31,
    "rewardCoins": 1105,
    "parTime": 60
  },
  {
    "id": 36,
    "title": "36. Затопленный просек",
    "subtitle": "Широкая развилка: высокий сухой объезд слева или каскад глубоких бродов справа.",
    "tag": "Развилка",
    "cargoPackage": "barrels",
    "length": 437,
    "curveAmp": 6.28,
    "curveFreq": 0.0331,
    "forks": [
      {
        "startZ": 125,
        "endZ": 335,
        "leftOffset": -17,
        "rightOffset": 17,
        "leftTag": "✨ ОБЪЕЗД",
        "rightTag": "💥 БРОДЫ",
        "leftElevation": 2.8,
        "rightElevation": -1.4,
        "leftWaterDepth": 0,
        "rightWaterDepth": 0.72,
        "leftMudIntensity": 0,
        "rightMudIntensity": 0.92
      }
    ],
    "mudZones": [
      {
        "startZ": 122,
        "endZ": 240,
        "intensity": 0.83
      },
      {
        "startZ": 280,
        "endZ": 385,
        "intensity": 0.83
      }
    ],
    "waterZones": [
      {
        "startZ": 157,
        "endZ": 210,
        "depth": 0.54
      },
      {
        "startZ": 284,
        "endZ": 341,
        "depth": 0.45
      }
    ],
    "bumpFreq": 0.45,
    "bumpAmp": 0.408,
    "camberAmp": 0.402,
    "hillsAmp": 3.4,
    "boulderCount": 31,
    "rewardCoins": 1130,
    "parTime": 61
  },
  {
    "id": 37,
    "title": "37. Холмы дровосеков",
    "subtitle": "Непрерывная череда моголов и трамплинов на извилистых таёжных холмах.",
    "tag": "Кочки",
    "cargoPackage": "logs",
    "length": 443,
    "curveAmp": 6.37,
    "curveFreq": 0.033,
    "mudZones": [
      {
        "startZ": 124,
        "endZ": 244,
        "intensity": 0.84
      },
      {
        "startZ": 284,
        "endZ": 390,
        "intensity": 0.83
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.49,
    "bumpAmp": 0.416,
    "camberAmp": 0.409,
    "hillsAmp": 3.45,
    "boulderCount": 32,
    "rewardCoins": 1155,
    "parTime": 62
  },
  {
    "id": 38,
    "title": "38. Тёмный распадок",
    "subtitle": "Широкая развилка: тёмное ущелье с валунами слева или светлая песчаная поляна справа.",
    "tag": "Развилка",
    "cargoPackage": "construction",
    "length": 449,
    "curveAmp": 6.46,
    "curveFreq": 0.0328,
    "forks": [
      {
        "startZ": 130,
        "endZ": 345,
        "leftOffset": -17.2,
        "rightOffset": 17.2,
        "leftTag": "💥 УЩЕЛЬЕ",
        "rightTag": "✨ ПОЛЯНА",
        "leftElevation": -1.2,
        "rightElevation": 1.5,
        "leftBoulders": 20,
        "rightBoulders": 0,
        "leftMudIntensity": 0.88,
        "rightMudIntensity": 0.05
      }
    ],
    "mudZones": [
      {
        "startZ": 126,
        "endZ": 247,
        "intensity": 0.85
      },
      {
        "startZ": 287,
        "endZ": 395,
        "intensity": 0.84
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.53,
    "bumpAmp": 0.424,
    "camberAmp": 0.416,
    "hillsAmp": 3.5,
    "boulderCount": 33,
    "rewardCoins": 1180,
    "parTime": 63
  },
  {
    "id": 39,
    "title": "39. Грязевой капкан",
    "subtitle": "Коварная яма с илом перед самым подъёмом на извилистый холм.",
    "tag": "Грязь",
    "cargoPackage": "farm",
    "length": 456,
    "curveAmp": 6.54,
    "curveFreq": 0.0327,
    "mudZones": [
      {
        "startZ": 128,
        "endZ": 251,
        "intensity": 0.85
      },
      {
        "startZ": 292,
        "endZ": 401,
        "intensity": 0.84
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.57,
    "bumpAmp": 0.432,
    "camberAmp": 0.423,
    "hillsAmp": 3.55,
    "boulderCount": 33,
    "rewardCoins": 1205,
    "parTime": 64
  },
  {
    "id": 40,
    "title": "40. Высокогорная просека",
    "subtitle": "Широкая развилка: высокий скальный карниз слева или гиблое топкое болото справа.",
    "tag": "Развилка",
    "cargoPackage": "fragile",
    "length": 462,
    "curveAmp": 6.63,
    "curveFreq": 0.0325,
    "forks": [
      {
        "startZ": 135,
        "endZ": 355,
        "leftOffset": -17.2,
        "rightOffset": 17.2,
        "leftTag": "✨ КАРНИЗ",
        "rightTag": "💥 БОЛОТО",
        "leftElevation": 3,
        "rightElevation": -1.8,
        "leftMudIntensity": 0,
        "rightMudIntensity": 0.99,
        "rightBumpsAmp": 0.45
      }
    ],
    "mudZones": [
      {
        "startZ": 129,
        "endZ": 254,
        "intensity": 0.86
      },
      {
        "startZ": 296,
        "endZ": 407,
        "intensity": 0.85
      }
    ],
    "waterZones": [
      {
        "startZ": 166,
        "endZ": 222,
        "depth": 0.56
      }
    ],
    "bumpFreq": 0.61,
    "bumpAmp": 0.44,
    "camberAmp": 0.43,
    "hillsAmp": 3.6,
    "boulderCount": 34,
    "rewardCoins": 1530,
    "parTime": 65
  },
  {
    "id": 41,
    "title": "41. Брод через быстрину",
    "subtitle": "Мощная водная преграда на горном вираже: проверь баланс грузовика.",
    "tag": "Вода",
    "cargoPackage": "mixed",
    "length": 468,
    "curveAmp": 6.72,
    "curveFreq": 0.0324,
    "mudZones": [
      {
        "startZ": 131,
        "endZ": 257,
        "intensity": 0.87
      },
      {
        "startZ": 300,
        "endZ": 412,
        "intensity": 0.85
      }
    ],
    "waterZones": [
      {
        "startZ": 168,
        "endZ": 225,
        "depth": 0.56
      },
      {
        "startZ": 304,
        "endZ": 365,
        "depth": 0.45
      }
    ],
    "bumpFreq": 0.65,
    "bumpAmp": 0.448,
    "camberAmp": 0.437,
    "hillsAmp": 3.65,
    "boulderCount": 35,
    "rewardCoins": 1555,
    "parTime": 65
  },
  {
    "id": 42,
    "title": "42. Каменный рубеж",
    "subtitle": "Широкая развилка: частокол валунов слева или ровная расчищенная полоса справа.",
    "tag": "Развилка",
    "cargoPackage": "construction",
    "length": 474,
    "curveAmp": 6.81,
    "curveFreq": 0.0323,
    "forks": [
      {
        "startZ": 135,
        "endZ": 365,
        "leftOffset": -17.5,
        "rightOffset": 17.5,
        "leftTag": "💥 ВАЛУНЫ",
        "rightTag": "✨ ТРАКТ",
        "leftElevation": 1.8,
        "rightElevation": 1,
        "leftBoulders": 24,
        "rightBoulders": 0,
        "leftBumpsAmp": 0.7,
        "rightMudIntensity": 0.05
      }
    ],
    "mudZones": [
      {
        "startZ": 133,
        "endZ": 261,
        "intensity": 0.87
      },
      {
        "startZ": 303,
        "endZ": 417,
        "intensity": 0.86
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.45,
    "bumpAmp": 0.456,
    "camberAmp": 0.444,
    "hillsAmp": 3.7,
    "boulderCount": 35,
    "rewardCoins": 1580,
    "parTime": 66
  },
  {
    "id": 43,
    "title": "43. Великая топь",
    "subtitle": "Бескрайнее болото на извилистом плато: 80% маршрута в глубокой жиже.",
    "tag": "Грязь",
    "cargoPackage": "fragile",
    "length": 480,
    "curveAmp": 6.9,
    "curveFreq": 0.0321,
    "mudZones": [
      {
        "startZ": 134,
        "endZ": 264,
        "intensity": 0.88
      },
      {
        "startZ": 307,
        "endZ": 422,
        "intensity": 0.86
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.49,
    "bumpAmp": 0.464,
    "camberAmp": 0.451,
    "hillsAmp": 3.75,
    "boulderCount": 36,
    "rewardCoins": 1605,
    "parTime": 67
  },
  {
    "id": 44,
    "title": "44. Скалистый хребет",
    "subtitle": "Широкая развилка: высокий сухой хребет слева или вязкая грязевая впадина справа.",
    "tag": "Развилка",
    "cargoPackage": "barrels",
    "length": 487,
    "curveAmp": 6.98,
    "curveFreq": 0.032,
    "forks": [
      {
        "startZ": 140,
        "endZ": 375,
        "leftOffset": -17.5,
        "rightOffset": 17.5,
        "leftTag": "✨ ХРЕБЕТ",
        "rightTag": "💥 ВПАДИНА",
        "leftElevation": 3.6,
        "rightElevation": -1.8,
        "leftMudIntensity": 0,
        "rightMudIntensity": 0.98,
        "rightBumpsAmp": 0.4
      }
    ],
    "mudZones": [
      {
        "startZ": 136,
        "endZ": 268,
        "intensity": 0.89
      },
      {
        "startZ": 312,
        "endZ": 429,
        "intensity": 0.87
      }
    ],
    "waterZones": [
      {
        "startZ": 175,
        "endZ": 234,
        "depth": 0.58
      }
    ],
    "bumpFreq": 0.53,
    "bumpAmp": 0.472,
    "camberAmp": 0.458,
    "hillsAmp": 3.8,
    "boulderCount": 37,
    "rewardCoins": 1630,
    "parTime": 68
  },
  {
    "id": 45,
    "title": "45. Заболоченная долина",
    "subtitle": "Длинная извилистая долина с чередой глубоких промоин и луж.",
    "tag": "Грязь",
    "cargoPackage": "mixed",
    "length": 493,
    "curveAmp": 7.07,
    "curveFreq": 0.0318,
    "mudZones": [
      {
        "startZ": 138,
        "endZ": 271,
        "intensity": 0.9
      },
      {
        "startZ": 316,
        "endZ": 434,
        "intensity": 0.88
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.57,
    "bumpAmp": 0.48,
    "camberAmp": 0.465,
    "hillsAmp": 3.85,
    "boulderCount": 37,
    "rewardCoins": 1655,
    "parTime": 69
  },
  {
    "id": 46,
    "title": "46. Двойной брод",
    "subtitle": "Широкая развилка: бурный двойной брод слева или сухой горный серпантин справа.",
    "tag": "Развилка",
    "cargoPackage": "farm",
    "length": 499,
    "curveAmp": 7.16,
    "curveFreq": 0.0317,
    "forks": [
      {
        "startZ": 145,
        "endZ": 385,
        "leftOffset": -17.5,
        "rightOffset": 17.5,
        "leftTag": "💥 БРОД",
        "rightTag": "✨ СЕРПАНТИН",
        "leftElevation": -1.5,
        "rightElevation": 2.2,
        "leftWaterDepth": 0.75,
        "rightWaterDepth": 0,
        "leftMudIntensity": 0.92,
        "rightMudIntensity": 0.05
      }
    ],
    "mudZones": [
      {
        "startZ": 140,
        "endZ": 274,
        "intensity": 0.9
      },
      {
        "startZ": 319,
        "endZ": 439,
        "intensity": 0.88
      }
    ],
    "waterZones": [
      {
        "startZ": 180,
        "endZ": 240,
        "depth": 0.59
      },
      {
        "startZ": 324,
        "endZ": 389,
        "depth": 0.45
      }
    ],
    "bumpFreq": 0.61,
    "bumpAmp": 0.488,
    "camberAmp": 0.472,
    "hillsAmp": 3.9,
    "boulderCount": 38,
    "rewardCoins": 1680,
    "parTime": 70
  },
  {
    "id": 47,
    "title": "47. Чёртово урочище",
    "subtitle": "Моголы, топи и камни на связке резких поворотов каждые 20 метров.",
    "tag": "Экстрим",
    "cargoPackage": "construction",
    "length": 505,
    "curveAmp": 7.25,
    "curveFreq": 0.0316,
    "mudZones": [
      {
        "startZ": 141,
        "endZ": 278,
        "intensity": 0.91
      },
      {
        "startZ": 323,
        "endZ": 444,
        "intensity": 0.89
      }
    ],
    "waterZones": [
      {
        "startZ": 182,
        "endZ": 242,
        "depth": 0.59
      }
    ],
    "bumpFreq": 0.65,
    "bumpAmp": 0.496,
    "camberAmp": 0.479,
    "hillsAmp": 3.95,
    "boulderCount": 39,
    "rewardCoins": 1705,
    "parTime": 71
  },
  {
    "id": 48,
    "title": "48. Таёжный шторм",
    "subtitle": "Широкая развилка: расчищенный тракт слева или штормовой размыв с валунами справа.",
    "tag": "Развилка",
    "cargoPackage": "fragile",
    "length": 511,
    "curveAmp": 7.34,
    "curveFreq": 0.0314,
    "forks": [
      {
        "startZ": 150,
        "endZ": 395,
        "leftOffset": -17.5,
        "rightOffset": 17.5,
        "leftTag": "✨ ТРАКТ",
        "rightTag": "💥 РАЗМЫВ",
        "leftElevation": 1.6,
        "rightElevation": -1.4,
        "leftMudIntensity": 0.05,
        "rightMudIntensity": 0.98,
        "rightBoulders": 16,
        "rightBumpsAmp": 0.65
      }
    ],
    "mudZones": [
      {
        "startZ": 143,
        "endZ": 281,
        "intensity": 0.92
      },
      {
        "startZ": 327,
        "endZ": 450,
        "intensity": 0.89
      }
    ],
    "waterZones": [
      {
        "startZ": 184,
        "endZ": 245,
        "depth": 0.6
      }
    ],
    "bumpFreq": 0.45,
    "bumpAmp": 0.5,
    "camberAmp": 0.486,
    "hillsAmp": 4,
    "boulderCount": 40,
    "rewardCoins": 1730,
    "parTime": 71
  },
  {
    "id": 49,
    "title": "49. Скала Лесопильщика",
    "subtitle": "Финальный каменистый подъём с острыми поворотами перед пилорамой.",
    "tag": "Камни",
    "cargoPackage": "mixed",
    "length": 518,
    "curveAmp": 7.42,
    "curveFreq": 0.0313,
    "mudZones": [
      {
        "startZ": 145,
        "endZ": 285,
        "intensity": 0.92
      },
      {
        "startZ": 332,
        "endZ": 456,
        "intensity": 0.9
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.49,
    "bumpAmp": 0.5,
    "camberAmp": 0.493,
    "hillsAmp": 4,
    "boulderCount": 40,
    "rewardCoins": 1755,
    "parTime": 72
  },
  {
    "id": 50,
    "title": "50. Таёжный экстремал 50",
    "subtitle": "Кульминационный ультра-маршрут: 524 м с двумя широкими развилками, топью, бродами и скалами.",
    "tag": "Экстрим",
    "cargoPackage": "mixed",
    "length": 524,
    "curveAmp": 7.51,
    "curveFreq": 0.0311,
    "forks": [
      {
        "startZ": 85,
        "endZ": 230,
        "leftOffset": -17.5,
        "rightOffset": 17.5,
        "leftTag": "💥 ТОПЬ 50",
        "rightTag": "✨ КАРНИЗ 50",
        "leftElevation": -1.8,
        "rightElevation": 3,
        "leftMudIntensity": 0.99,
        "rightMudIntensity": 0,
        "rightBumpsAmp": 0.06
      },
      {
        "startZ": 285,
        "endZ": 445,
        "leftOffset": -17.5,
        "rightOffset": 17.5,
        "leftTag": "✨ ХРЕБЕТ",
        "rightTag": "💥 КАНЬОН",
        "leftElevation": 3.6,
        "rightElevation": -1.6,
        "leftMudIntensity": 0,
        "rightWaterDepth": 0.75,
        "rightMudIntensity": 0.96,
        "rightBoulders": 16
      }
    ],
    "mudZones": [
      {
        "startZ": 147,
        "endZ": 288,
        "intensity": 0.93
      },
      {
        "startZ": 335,
        "endZ": 461,
        "intensity": 0.9
      }
    ],
    "waterZones": [
      {
        "startZ": 189,
        "endZ": 252,
        "depth": 0.6
      }
    ],
    "bumpFreq": 0.53,
    "bumpAmp": 0.5,
    "camberAmp": 0.5,
    "hillsAmp": 4,
    "boulderCount": 41,
    "rewardCoins": 1780,
    "parTime": 73
  }
];

/**
 * Atmospheric fog presets per chapter.
 * Each entry: [fogNear, fogFar]
 * Chapter 1 (lv 1-10):   Forest roads  — mild forest haze
 * Chapter 2 (lv 11-20):  Swamps        — thick misty fog, very short visibility
 * Chapter 3 (lv 21-30):  Mountain pass — crisp mountain air, long visibility
 * Chapter 4 (lv 31-40):  Deep Taiga    — dense boreal fog, medium visibility
 * Chapter 5 (lv 41-50):  Extreme       — very heavy fog for tension and challenge
 */
const FOG_PRESETS: [number, number][] = [
  [110, 300], // Ch.1: Проселки     — лесная дымка
  [55, 200],  // Ch.2: Топи         — густой туман болот
  [160, 420], // Ch.3: Перевалы     — горный чистый воздух
  [75, 230],  // Ch.4: Тайга        — таёжная мгла
  [40, 160],  // Ch.5: Экстрим      — плотный туман, напряжение
];

function getFogPreset(id: number): { fogNear: number; fogFar: number } {
  const chapter = Math.min(4, Math.floor((id - 1) / 10));
  const [fogNear, fogFar] = FOG_PRESETS[chapter];
  return { fogNear, fogFar };
}

export function getLevelConfig(id: number): LevelConfig {
  const index = Math.max(1, Math.min(LEVELS.length, Math.floor(id))) - 1;
  const base = LEVELS[index] ?? LEVELS[0];
  // Merge fog preset if the level doesn't specify custom fog
  if (base.fogNear === undefined || base.fogFar === undefined) {
    const fog = getFogPreset(base.id);
    return { ...base, fogNear: fog.fogNear, fogFar: fog.fogFar };
  }
  return base;
}
