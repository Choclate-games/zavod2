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

export interface LevelConfig {
  id: number;
  title: string;
  subtitle: string;
  tag: string;
  cargoPackage?: CargoPackageType;
  length: number;
  mudZones: MudZoneConfig[];
  waterZones: WaterZoneConfig[];
  bumpFreq: number;
  bumpAmp: number;
  camberAmp: number;
  hillsAmp: number;
  boulderCount: number;
  rewardCoins: number;
  parTime: number;
}

export const LEVELS: LevelConfig[] = [
  {
    "id": 1,
    "title": "01. Деревенский просёлок",
    "subtitle": "Укатанная грунтовка с лёгкими лужицами. Знакомство с управлением.",
    "tag": "Легко",
    "length": 220,
    "mudZones": [
      {
        "startZ": 73,
        "endZ": 150,
        "intensity": 0.6
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.45,
    "bumpAmp": 0.18,
    "camberAmp": 0.1,
    "hillsAmp": 0.6,
    "boulderCount": 4,
    "rewardCoins": 50,
    "parTime": 31
  },
  {
    "id": 2,
    "title": "02. Лесная колея",
    "subtitle": "Мягкие волны рельефа и первая промоина среди старых сосен.",
    "tag": "Легко",
    "length": 226,
    "mudZones": [],
    "waterZones": [],
    "bumpFreq": 0.59,
    "bumpAmp": 0.19,
    "camberAmp": 0.11,
    "hillsAmp": 0.64,
    "boulderCount": 5,
    "rewardCoins": 68,
    "parTime": 31
  },
  {
    "id": 3,
    "title": "03. Топи у ручья",
    "subtitle": "Заболоченная низина с вязким илом. Не бросай газ!",
    "tag": "Грязь",
    "length": 232,
    "mudZones": [
      {
        "startZ": 75,
        "endZ": 156,
        "intensity": 0.61
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.73,
    "bumpAmp": 0.19,
    "camberAmp": 0.11,
    "hillsAmp": 0.67,
    "boulderCount": 5,
    "rewardCoins": 86,
    "parTime": 32
  },
  {
    "id": 4,
    "title": "04. Брод через ручей",
    "subtitle": "Водная преграда с брызгами. Снижай скорость перед въездом в воду.",
    "tag": "Вода",
    "length": 239,
    "mudZones": [
      {
        "startZ": 76,
        "endZ": 160,
        "intensity": 0.62
      }
    ],
    "waterZones": [
      {
        "startZ": 98,
        "endZ": 134,
        "depth": 0.36
      }
    ],
    "bumpFreq": 0.87,
    "bumpAmp": 0.2,
    "camberAmp": 0.12,
    "hillsAmp": 0.7,
    "boulderCount": 6,
    "rewardCoins": 104,
    "parTime": 33
  },
  {
    "id": 5,
    "title": "05. Каменистый спуск",
    "subtitle": "Каменистая тропа с ухабами. Следи за скоростью на крутом спуске.",
    "tag": "Кочки",
    "length": 245,
    "mudZones": [
      {
        "startZ": 86,
        "endZ": 135,
        "intensity": 0.47
      }
    ],
    "waterZones": [],
    "bumpFreq": 1.36,
    "bumpAmp": 0.32,
    "camberAmp": 0.12,
    "hillsAmp": 0.74,
    "boulderCount": 6,
    "rewardCoins": 122,
    "parTime": 34
  },
  {
    "id": 6,
    "title": "06. Грязевой серпантин",
    "subtitle": "Извилистый подъём по раскисшей глине. Потребуется запас тяги.",
    "tag": "Грязь",
    "length": 251,
    "mudZones": [
      {
        "startZ": 78,
        "endZ": 166,
        "intensity": 0.64
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.45,
    "bumpAmp": 0.21,
    "camberAmp": 0.13,
    "hillsAmp": 0.78,
    "boulderCount": 7,
    "rewardCoins": 140,
    "parTime": 35
  },
  {
    "id": 7,
    "title": "07. Сосновый бор",
    "subtitle": "Живописная лесная трасса с корнями и плотными рядами деревьев.",
    "tag": "Легко",
    "length": 257,
    "mudZones": [
      {
        "startZ": 79,
        "endZ": 169,
        "intensity": 0.64
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.59,
    "bumpAmp": 0.22,
    "camberAmp": 0.13,
    "hillsAmp": 0.81,
    "boulderCount": 8,
    "rewardCoins": 158,
    "parTime": 36
  },
  {
    "id": 8,
    "title": "08. Болото Лесорубов",
    "subtitle": "Огромная протяжённая топь с коварными колеями. Колёса буксуют.",
    "tag": "Грязь",
    "length": 263,
    "mudZones": [
      {
        "startZ": 79,
        "endZ": 172,
        "intensity": 0.65
      }
    ],
    "waterZones": [
      {
        "startZ": 103,
        "endZ": 142,
        "depth": 0.39
      }
    ],
    "bumpFreq": 0.73,
    "bumpAmp": 0.22,
    "camberAmp": 0.14,
    "hillsAmp": 0.84,
    "boulderCount": 8,
    "rewardCoins": 176,
    "parTime": 37
  },
  {
    "id": 9,
    "title": "09. Ухабистая гряда",
    "subtitle": "Ритмичные моголы и поперечный крен, раскачивающий кузов.",
    "tag": "Кочки",
    "length": 270,
    "mudZones": [
      {
        "startZ": 95,
        "endZ": 149,
        "intensity": 0.5
      }
    ],
    "waterZones": [],
    "bumpFreq": 1.22,
    "bumpAmp": 0.35,
    "camberAmp": 0.14,
    "hillsAmp": 0.88,
    "boulderCount": 9,
    "rewardCoins": 194,
    "parTime": 38
  },
  {
    "id": 10,
    "title": "10. Тайга после ливня",
    "subtitle": "После дождя вся дорога превратилась в сплошное грязевое месиво.",
    "tag": "Грязь",
    "length": 276,
    "mudZones": [
      {
        "startZ": 81,
        "endZ": 178,
        "intensity": 0.66
      }
    ],
    "waterZones": [],
    "bumpFreq": 1.01,
    "bumpAmp": 0.23,
    "camberAmp": 0.15,
    "hillsAmp": 0.92,
    "boulderCount": 9,
    "rewardCoins": 212,
    "parTime": 38
  },
  {
    "id": 11,
    "title": "11. Речной брод",
    "subtitle": "Глубокий брод через лесную речку. Держи тягу, преодолевая сопротивление воды.",
    "tag": "Вода",
    "length": 282,
    "mudZones": [
      {
        "startZ": 99,
        "endZ": 155,
        "intensity": 0.51
      }
    ],
    "waterZones": [
      {
        "startZ": 106,
        "endZ": 149,
        "depth": 0.4
      }
    ],
    "bumpFreq": 0.45,
    "bumpAmp": 0.24,
    "camberAmp": 0.15,
    "hillsAmp": 0.95,
    "boulderCount": 10,
    "rewardCoins": 230,
    "parTime": 39
  },
  {
    "id": 12,
    "title": "12. Каменный каньон",
    "subtitle": "Узкий проход с крупными валунами на полосе движения.",
    "tag": "Камни",
    "length": 288,
    "mudZones": [
      {
        "startZ": 101,
        "endZ": 158,
        "intensity": 0.52
      }
    ],
    "waterZones": [
      {
        "startZ": 108,
        "endZ": 151,
        "depth": 0.4
      }
    ],
    "bumpFreq": 0.59,
    "bumpAmp": 0.25,
    "camberAmp": 0.15,
    "hillsAmp": 0.98,
    "boulderCount": 19,
    "rewardCoins": 248,
    "parTime": 40
  },
  {
    "id": 13,
    "title": "13. Чёрная топь",
    "subtitle": "Вязкий чёрный торфяник. Минимальное сцепление шин.",
    "tag": "Грязь",
    "length": 294,
    "mudZones": [
      {
        "startZ": 84,
        "endZ": 187,
        "intensity": 0.68
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.73,
    "bumpAmp": 0.25,
    "camberAmp": 0.16,
    "hillsAmp": 1.02,
    "boulderCount": 11,
    "rewardCoins": 266,
    "parTime": 41
  },
  {
    "id": 14,
    "title": "14. Крутой перевал",
    "subtitle": "Затяжные крутые подъёмы, ямы и обрывистые гребни.",
    "tag": "Сложно",
    "length": 301,
    "mudZones": [
      {
        "startZ": 105,
        "endZ": 166,
        "intensity": 0.53
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.87,
    "bumpAmp": 0.26,
    "camberAmp": 0.17,
    "hillsAmp": 1.06,
    "boulderCount": 12,
    "rewardCoins": 284,
    "parTime": 42
  },
  {
    "id": 15,
    "title": "15. Затопленная колея",
    "subtitle": "Глубокие затопленные промоины, смывающие налипшую грязь.",
    "tag": "Вода",
    "length": 307,
    "mudZones": [
      {
        "startZ": 107,
        "endZ": 169,
        "intensity": 0.53
      }
    ],
    "waterZones": [
      {
        "startZ": 111,
        "endZ": 157,
        "depth": 0.42
      }
    ],
    "bumpFreq": 1.01,
    "bumpAmp": 0.26,
    "camberAmp": 0.17,
    "hillsAmp": 1.09,
    "boulderCount": 12,
    "rewardCoins": 302,
    "parTime": 43
  },
  {
    "id": 16,
    "title": "16. Топкая низина",
    "subtitle": "Гигантское грязевое озеро с глубокими промоинами.",
    "tag": "Грязь",
    "length": 313,
    "mudZones": [
      {
        "startZ": 87,
        "endZ": 197,
        "intensity": 0.7
      }
    ],
    "waterZones": [
      {
        "startZ": 113,
        "endZ": 160,
        "depth": 0.42
      }
    ],
    "bumpFreq": 0.45,
    "bumpAmp": 0.27,
    "camberAmp": 0.17,
    "hillsAmp": 1.13,
    "boulderCount": 13,
    "rewardCoins": 320,
    "parTime": 43
  },
  {
    "id": 17,
    "title": "17. Лесовозный большак",
    "subtitle": "Разбитый лесовозами большак: глубокая колея, брёвна и ямы.",
    "tag": "Сложно",
    "length": 319,
    "mudZones": [
      {
        "startZ": 112,
        "endZ": 175,
        "intensity": 0.55
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.59,
    "bumpAmp": 0.28,
    "camberAmp": 0.18,
    "hillsAmp": 1.16,
    "boulderCount": 14,
    "rewardCoins": 338,
    "parTime": 44
  },
  {
    "id": 18,
    "title": "18. Каменная осыпь",
    "subtitle": "Множество валунов, преграждающих путь прямо посреди трассы.",
    "tag": "Камни",
    "length": 325,
    "mudZones": [
      {
        "startZ": 114,
        "endZ": 179,
        "intensity": 0.55
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.73,
    "bumpAmp": 0.28,
    "camberAmp": 0.18,
    "hillsAmp": 1.2,
    "boulderCount": 22,
    "rewardCoins": 356,
    "parTime": 45
  },
  {
    "id": 19,
    "title": "19. Гиблое урочище",
    "subtitle": "Коварная смесь моголов, глубоких ям, топей и грязи.",
    "tag": "Грязь",
    "length": 332,
    "mudZones": [
      {
        "startZ": 90,
        "endZ": 206,
        "intensity": 0.73
      },
      {
        "startZ": 199,
        "endZ": 292,
        "intensity": 0.79
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.87,
    "bumpAmp": 0.29,
    "camberAmp": 0.19,
    "hillsAmp": 1.23,
    "boulderCount": 15,
    "rewardCoins": 374,
    "parTime": 46
  },
  {
    "id": 20,
    "title": "20. Таёжный перевал",
    "subtitle": "Высокий горный хребет с крутыми оврагами и грязевыми колеями.",
    "tag": "Сложно",
    "length": 338,
    "mudZones": [
      {
        "startZ": 118,
        "endZ": 186,
        "intensity": 0.56
      }
    ],
    "waterZones": [
      {
        "startZ": 118,
        "endZ": 168,
        "depth": 0.44
      }
    ],
    "bumpFreq": 1.01,
    "bumpAmp": 0.29,
    "camberAmp": 0.2,
    "hillsAmp": 1.27,
    "boulderCount": 15,
    "rewardCoins": 392,
    "parTime": 47
  },
  {
    "id": 21,
    "title": "21. Озёрный перешеек",
    "subtitle": "Узкая насыпь между двумя таёжными озёрами с глубокими лужами.",
    "tag": "Вода",
    "length": 344,
    "mudZones": [
      {
        "startZ": 120,
        "endZ": 189,
        "intensity": 0.57
      }
    ],
    "waterZones": [
      {
        "startZ": 119,
        "endZ": 170,
        "depth": 0.45
      },
      {
        "startZ": 224,
        "endZ": 268,
        "depth": 0.45
      }
    ],
    "bumpFreq": 0.45,
    "bumpAmp": 0.3,
    "camberAmp": 0.2,
    "hillsAmp": 1.3,
    "boulderCount": 16,
    "rewardCoins": 410,
    "parTime": 48
  },
  {
    "id": 22,
    "title": "22. Скальный гребень",
    "subtitle": "Острые каменистые выступы и валуны на опасных виражах.",
    "tag": "Камни",
    "length": 350,
    "mudZones": [
      {
        "startZ": 93,
        "endZ": 215,
        "intensity": 0.75
      },
      {
        "startZ": 210,
        "endZ": 308,
        "intensity": 0.8
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.59,
    "bumpAmp": 0.31,
    "camberAmp": 0.21,
    "hillsAmp": 1.33,
    "boulderCount": 25,
    "rewardCoins": 428,
    "parTime": 49
  },
  {
    "id": 23,
    "title": "23. Глинистый овраг",
    "subtitle": "Крутой спуск в размытый овраг с тяжёлым выездом.",
    "tag": "Грязь",
    "length": 356,
    "mudZones": [
      {
        "startZ": 93,
        "endZ": 218,
        "intensity": 0.75
      },
      {
        "startZ": 214,
        "endZ": 313,
        "intensity": 0.81
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.73,
    "bumpAmp": 0.31,
    "camberAmp": 0.21,
    "hillsAmp": 1.37,
    "boulderCount": 17,
    "rewardCoins": 446,
    "parTime": 49
  },
  {
    "id": 24,
    "title": "24. Гребёнка лесорубов",
    "subtitle": "Экстремальные волнообразные кочки, норовящие вытряхнуть весь груз.",
    "tag": "Кочки",
    "length": 363,
    "mudZones": [
      {
        "startZ": 127,
        "endZ": 200,
        "intensity": 0.59
      }
    ],
    "waterZones": [
      {
        "startZ": 123,
        "endZ": 177,
        "depth": 0.46
      }
    ],
    "bumpFreq": 1.22,
    "bumpAmp": 0.44,
    "camberAmp": 0.22,
    "hillsAmp": 1.41,
    "boulderCount": 18,
    "rewardCoins": 464,
    "parTime": 50
  },
  {
    "id": 25,
    "title": "25. Речная пойма",
    "subtitle": "Широкая затопленная пойма: брызги, аквапланирование и скользкое дно.",
    "tag": "Вода",
    "length": 369,
    "mudZones": [
      {
        "startZ": 95,
        "endZ": 225,
        "intensity": 0.77
      },
      {
        "startZ": 221,
        "endZ": 325,
        "intensity": 0.82
      }
    ],
    "waterZones": [
      {
        "startZ": 124,
        "endZ": 179,
        "depth": 0.47
      },
      {
        "startZ": 240,
        "endZ": 288,
        "depth": 0.45
      }
    ],
    "bumpFreq": 1.01,
    "bumpAmp": 0.32,
    "camberAmp": 0.22,
    "hillsAmp": 1.44,
    "boulderCount": 18,
    "rewardCoins": 482,
    "parTime": 51
  },
  {
    "id": 26,
    "title": "26. Медвежий угол",
    "subtitle": "Густой лес со сплошными стволами и сложными поворотами.",
    "tag": "Сложно",
    "length": 375,
    "mudZones": [
      {
        "startZ": 131,
        "endZ": 206,
        "intensity": 0.6
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.45,
    "bumpAmp": 0.33,
    "camberAmp": 0.23,
    "hillsAmp": 1.48,
    "boulderCount": 19,
    "rewardCoins": 500,
    "parTime": 52
  },
  {
    "id": 27,
    "title": "27. Глубокая колея",
    "subtitle": "Двухполосная разбитая колея: рули точно по верхушкам колей.",
    "tag": "Грязь",
    "length": 381,
    "mudZones": [
      {
        "startZ": 97,
        "endZ": 231,
        "intensity": 0.78
      },
      {
        "startZ": 229,
        "endZ": 335,
        "intensity": 0.83
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.59,
    "bumpAmp": 0.34,
    "camberAmp": 0.23,
    "hillsAmp": 1.51,
    "boulderCount": 20,
    "rewardCoins": 518,
    "parTime": 53
  },
  {
    "id": 28,
    "title": "28. Валунный лабиринт",
    "subtitle": "Плотные группы массивных камней на полотне дороги.",
    "tag": "Камни",
    "length": 387,
    "mudZones": [
      {
        "startZ": 98,
        "endZ": 234,
        "intensity": 0.79
      },
      {
        "startZ": 232,
        "endZ": 341,
        "intensity": 0.83
      }
    ],
    "waterZones": [
      {
        "startZ": 127,
        "endZ": 185,
        "depth": 0.48
      }
    ],
    "bumpFreq": 0.73,
    "bumpAmp": 0.34,
    "camberAmp": 0.24,
    "hillsAmp": 1.54,
    "boulderCount": 28,
    "rewardCoins": 536,
    "parTime": 54
  },
  {
    "id": 29,
    "title": "29. Моховое болото",
    "subtitle": "Мягкий вязкий мох и топь, поглощающие импульс движения.",
    "tag": "Грязь",
    "length": 394,
    "mudZones": [
      {
        "startZ": 99,
        "endZ": 237,
        "intensity": 0.8
      },
      {
        "startZ": 236,
        "endZ": 347,
        "intensity": 0.84
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.87,
    "bumpAmp": 0.35,
    "camberAmp": 0.24,
    "hillsAmp": 1.58,
    "boulderCount": 21,
    "rewardCoins": 554,
    "parTime": 55
  },
  {
    "id": 30,
    "title": "30. Вершина кряжа",
    "subtitle": "Открытый продуваемый гребень с резкими перепадами высоты.",
    "tag": "Экстрим",
    "length": 400,
    "mudZones": [
      {
        "startZ": 100,
        "endZ": 240,
        "intensity": 0.8
      },
      {
        "startZ": 240,
        "endZ": 352,
        "intensity": 0.84
      }
    ],
    "waterZones": [
      {
        "startZ": 130,
        "endZ": 190,
        "depth": 0.49
      }
    ],
    "bumpFreq": 1.01,
    "bumpAmp": 0.35,
    "camberAmp": 0.24,
    "hillsAmp": 1.62,
    "boulderCount": 21,
    "rewardCoins": 572,
    "parTime": 56
  },
  {
    "id": 31,
    "title": "31. Бурный приток",
    "subtitle": "Каменистый брод с сильным течением и глубокими ямами.",
    "tag": "Вода",
    "length": 406,
    "mudZones": [
      {
        "startZ": 101,
        "endZ": 243,
        "intensity": 0.81
      },
      {
        "startZ": 244,
        "endZ": 357,
        "intensity": 0.85
      }
    ],
    "waterZones": [
      {
        "startZ": 131,
        "endZ": 192,
        "depth": 0.5
      },
      {
        "startZ": 264,
        "endZ": 317,
        "depth": 0.45
      }
    ],
    "bumpFreq": 0.45,
    "bumpAmp": 0.36,
    "camberAmp": 0.25,
    "hillsAmp": 1.65,
    "boulderCount": 22,
    "rewardCoins": 590,
    "parTime": 56
  },
  {
    "id": 32,
    "title": "32. Крутояр",
    "subtitle": "Обрывистый береговой серпантин с резкими спусками и грязевыми ловушками.",
    "tag": "Сложно",
    "length": 412,
    "mudZones": [
      {
        "startZ": 144,
        "endZ": 227,
        "intensity": 0.64
      }
    ],
    "waterZones": [
      {
        "startZ": 132,
        "endZ": 194,
        "depth": 0.51
      }
    ],
    "bumpFreq": 0.59,
    "bumpAmp": 0.37,
    "camberAmp": 0.26,
    "hillsAmp": 1.69,
    "boulderCount": 23,
    "rewardCoins": 608,
    "parTime": 57
  },
  {
    "id": 33,
    "title": "33. Размытая гать",
    "subtitle": "Старая деревянная гать, наполовину ушедшая в трясину.",
    "tag": "Грязь",
    "length": 418,
    "mudZones": [
      {
        "startZ": 103,
        "endZ": 249,
        "intensity": 0.82
      },
      {
        "startZ": 251,
        "endZ": 368,
        "intensity": 0.86
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.73,
    "bumpAmp": 0.37,
    "camberAmp": 0.26,
    "hillsAmp": 1.72,
    "boulderCount": 23,
    "rewardCoins": 626,
    "parTime": 58
  },
  {
    "id": 34,
    "title": "34. Камнепадный распадок",
    "subtitle": "Скалистое ущелье с упавшими на дорогу глыбами.",
    "tag": "Камни",
    "length": 425,
    "mudZones": [
      {
        "startZ": 104,
        "endZ": 253,
        "intensity": 0.83
      },
      {
        "startZ": 255,
        "endZ": 374,
        "intensity": 0.86
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.87,
    "bumpAmp": 0.38,
    "camberAmp": 0.27,
    "hillsAmp": 1.75,
    "boulderCount": 32,
    "rewardCoins": 644,
    "parTime": 59
  },
  {
    "id": 35,
    "title": "35. Торфяной карьер",
    "subtitle": "Густая чёрная жижа, требующая максимальной мощности двигателя.",
    "tag": "Грязь",
    "length": 431,
    "mudZones": [
      {
        "startZ": 105,
        "endZ": 256,
        "intensity": 0.84
      },
      {
        "startZ": 259,
        "endZ": 379,
        "intensity": 0.87
      }
    ],
    "waterZones": [],
    "bumpFreq": 1.01,
    "bumpAmp": 0.38,
    "camberAmp": 0.27,
    "hillsAmp": 1.79,
    "boulderCount": 24,
    "rewardCoins": 662,
    "parTime": 60
  },
  {
    "id": 36,
    "title": "36. Затопленный просек",
    "subtitle": "Затопленная километровая просека с каскадом бродов.",
    "tag": "Вода",
    "length": 437,
    "mudZones": [
      {
        "startZ": 153,
        "endZ": 240,
        "intensity": 0.66
      }
    ],
    "waterZones": [
      {
        "startZ": 137,
        "endZ": 203,
        "depth": 0.53
      },
      {
        "startZ": 284,
        "endZ": 341,
        "depth": 0.45
      }
    ],
    "bumpFreq": 0.45,
    "bumpAmp": 0.39,
    "camberAmp": 0.28,
    "hillsAmp": 1.83,
    "boulderCount": 25,
    "rewardCoins": 680,
    "parTime": 61
  },
  {
    "id": 37,
    "title": "37. Холмы дровосеков",
    "subtitle": "Непрерывная череда моголов и трамплинов.",
    "tag": "Кочки",
    "length": 443,
    "mudZones": [
      {
        "startZ": 106,
        "endZ": 262,
        "intensity": 0.85
      },
      {
        "startZ": 266,
        "endZ": 390,
        "intensity": 0.88
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.94,
    "bumpAmp": 0.52,
    "camberAmp": 0.28,
    "hillsAmp": 1.86,
    "boulderCount": 26,
    "rewardCoins": 698,
    "parTime": 62
  },
  {
    "id": 38,
    "title": "38. Тёмный распадок",
    "subtitle": "Узкая тропа сквозь глухую чащу со скальными завалами.",
    "tag": "Сложно",
    "length": 449,
    "mudZones": [
      {
        "startZ": 157,
        "endZ": 247,
        "intensity": 0.67
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.73,
    "bumpAmp": 0.4,
    "camberAmp": 0.29,
    "hillsAmp": 1.9,
    "boulderCount": 26,
    "rewardCoins": 716,
    "parTime": 62
  },
  {
    "id": 39,
    "title": "39. Грязевой капкан",
    "subtitle": "Коварная яма с илом перед самым подъёмом на холм.",
    "tag": "Грязь",
    "length": 456,
    "mudZones": [
      {
        "startZ": 108,
        "endZ": 268,
        "intensity": 0.87
      },
      {
        "startZ": 274,
        "endZ": 401,
        "intensity": 0.89
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.87,
    "bumpAmp": 0.41,
    "camberAmp": 0.29,
    "hillsAmp": 1.93,
    "boulderCount": 27,
    "rewardCoins": 734,
    "parTime": 63
  },
  {
    "id": 40,
    "title": "40. Высокогорная просека",
    "subtitle": "Экстремальный набор высоты по разбитому скалистому склону.",
    "tag": "Экстрим",
    "length": 462,
    "mudZones": [
      {
        "startZ": 109,
        "endZ": 271,
        "intensity": 0.87
      },
      {
        "startZ": 277,
        "endZ": 407,
        "intensity": 0.9
      }
    ],
    "waterZones": [
      {
        "startZ": 142,
        "endZ": 212,
        "depth": 0.54
      }
    ],
    "bumpFreq": 1.01,
    "bumpAmp": 0.41,
    "camberAmp": 0.3,
    "hillsAmp": 1.97,
    "boulderCount": 27,
    "rewardCoins": 752,
    "parTime": 64
  },
  {
    "id": 41,
    "title": "41. Брод через быстрину",
    "subtitle": "Мощная водная преграда: проверь баланс грузовика.",
    "tag": "Вода",
    "length": 468,
    "mudZones": [
      {
        "startZ": 164,
        "endZ": 257,
        "intensity": 0.69
      }
    ],
    "waterZones": [
      {
        "startZ": 144,
        "endZ": 214,
        "depth": 0.55
      },
      {
        "startZ": 304,
        "endZ": 365,
        "depth": 0.45
      }
    ],
    "bumpFreq": 0.45,
    "bumpAmp": 0.42,
    "camberAmp": 0.3,
    "hillsAmp": 2,
    "boulderCount": 28,
    "rewardCoins": 770,
    "parTime": 65
  },
  {
    "id": 42,
    "title": "42. Каменный рубеж",
    "subtitle": "Частокол из валунов, требующий филигранного руления.",
    "tag": "Камни",
    "length": 474,
    "mudZones": [
      {
        "startZ": 166,
        "endZ": 261,
        "intensity": 0.7
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.59,
    "bumpAmp": 0.43,
    "camberAmp": 0.31,
    "hillsAmp": 2.04,
    "boulderCount": 37,
    "rewardCoins": 788,
    "parTime": 66
  },
  {
    "id": 43,
    "title": "43. Великая топь",
    "subtitle": "Бескрайнее болото: 80% маршрута в глубокой жиже.",
    "tag": "Грязь",
    "length": 480,
    "mudZones": [
      {
        "startZ": 112,
        "endZ": 280,
        "intensity": 0.89
      },
      {
        "startZ": 288,
        "endZ": 422,
        "intensity": 0.91
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.73,
    "bumpAmp": 0.43,
    "camberAmp": 0.31,
    "hillsAmp": 2.07,
    "boulderCount": 29,
    "rewardCoins": 806,
    "parTime": 67
  },
  {
    "id": 44,
    "title": "44. Скалистый хребет",
    "subtitle": "Опасные каменные ступени и крутые крены.",
    "tag": "Экстрим",
    "length": 487,
    "mudZones": [
      {
        "startZ": 113,
        "endZ": 284,
        "intensity": 0.9
      },
      {
        "startZ": 292,
        "endZ": 429,
        "intensity": 0.91
      }
    ],
    "waterZones": [
      {
        "startZ": 147,
        "endZ": 220,
        "depth": 0.56
      }
    ],
    "bumpFreq": 0.87,
    "bumpAmp": 0.44,
    "camberAmp": 0.32,
    "hillsAmp": 2.1,
    "boulderCount": 30,
    "rewardCoins": 824,
    "parTime": 68
  },
  {
    "id": 45,
    "title": "45. Заболоченная долина",
    "subtitle": "Длинная долина с чередой глубоких промоин и луж.",
    "tag": "Грязь",
    "length": 493,
    "mudZones": [
      {
        "startZ": 114,
        "endZ": 287,
        "intensity": 0.91
      },
      {
        "startZ": 296,
        "endZ": 434,
        "intensity": 0.92
      }
    ],
    "waterZones": [],
    "bumpFreq": 1.01,
    "bumpAmp": 0.44,
    "camberAmp": 0.32,
    "hillsAmp": 2.14,
    "boulderCount": 30,
    "rewardCoins": 842,
    "parTime": 68
  },
  {
    "id": 46,
    "title": "46. Двойной брод",
    "subtitle": "Два подряд глубоких водных участка на высокой скорости.",
    "tag": "Вода",
    "length": 499,
    "mudZones": [
      {
        "startZ": 115,
        "endZ": 290,
        "intensity": 0.92
      },
      {
        "startZ": 299,
        "endZ": 439,
        "intensity": 0.92
      }
    ],
    "waterZones": [
      {
        "startZ": 150,
        "endZ": 225,
        "depth": 0.57
      },
      {
        "startZ": 324,
        "endZ": 389,
        "depth": 0.45
      }
    ],
    "bumpFreq": 0.45,
    "bumpAmp": 0.45,
    "camberAmp": 0.33,
    "hillsAmp": 2.18,
    "boulderCount": 31,
    "rewardCoins": 860,
    "parTime": 69
  },
  {
    "id": 47,
    "title": "47. Чёртово урочище",
    "subtitle": "Моголы, топи и камни, сменяющие друг друга каждые 20 метров.",
    "tag": "Экстрим",
    "length": 505,
    "mudZones": [
      {
        "startZ": 116,
        "endZ": 293,
        "intensity": 0.92
      },
      {
        "startZ": 303,
        "endZ": 444,
        "intensity": 0.93
      }
    ],
    "waterZones": [
      {
        "startZ": 151,
        "endZ": 227,
        "depth": 0.58
      }
    ],
    "bumpFreq": 0.59,
    "bumpAmp": 0.46,
    "camberAmp": 0.33,
    "hillsAmp": 2.21,
    "boulderCount": 32,
    "rewardCoins": 878,
    "parTime": 70
  },
  {
    "id": 48,
    "title": "48. Таёжный шторм",
    "subtitle": "Размытый до основания тракт с тяжелейшими колеями.",
    "tag": "Грязь",
    "length": 511,
    "mudZones": [
      {
        "startZ": 117,
        "endZ": 296,
        "intensity": 0.93
      },
      {
        "startZ": 307,
        "endZ": 450,
        "intensity": 0.93
      }
    ],
    "waterZones": [
      {
        "startZ": 152,
        "endZ": 229,
        "depth": 0.58
      }
    ],
    "bumpFreq": 0.73,
    "bumpAmp": 0.46,
    "camberAmp": 0.34,
    "hillsAmp": 2.25,
    "boulderCount": 32,
    "rewardCoins": 896,
    "parTime": 71
  },
  {
    "id": 49,
    "title": "49. Скала Лесопильщика",
    "subtitle": "Финальный каменистый подъём перед пилорамой.",
    "tag": "Камни",
    "length": 518,
    "mudZones": [
      {
        "startZ": 118,
        "endZ": 299,
        "intensity": 0.94
      },
      {
        "startZ": 311,
        "endZ": 456,
        "intensity": 0.94
      }
    ],
    "waterZones": [],
    "bumpFreq": 0.87,
    "bumpAmp": 0.47,
    "camberAmp": 0.34,
    "hillsAmp": 2.28,
    "boulderCount": 41,
    "rewardCoins": 914,
    "parTime": 72
  },
  {
    "id": 50,
    "title": "50. Таёжный экстремал 50",
    "subtitle": "Кульминационный ультра-маршрут: 520 м дикой тайги, топей и скал.",
    "tag": "Экстрим",
    "length": 524,
    "mudZones": [
      {
        "startZ": 119,
        "endZ": 302,
        "intensity": 0.94
      },
      {
        "startZ": 314,
        "endZ": 461,
        "intensity": 0.94
      }
    ],
    "waterZones": [
      {
        "startZ": 155,
        "endZ": 233,
        "depth": 0.59
      }
    ],
    "bumpFreq": 1.01,
    "bumpAmp": 0.47,
    "camberAmp": 0.34,
    "hillsAmp": 2.31,
    "boulderCount": 33,
    "rewardCoins": 932,
    "parTime": 73
  }
];

export const LEVEL_CARGO_MAP: Record<number, CargoPackageType> = {
  1: 'logs',
  2: 'logs',
  3: 'barrels',
  4: 'barrels',
  5: 'construction',
  6: 'logs',
  7: 'farm',
  8: 'logs',
  9: 'farm',
  10: 'barrels',
  11: 'barrels',
  12: 'construction',
  13: 'fragile',
  14: 'construction',
  15: 'barrels',
  16: 'logs',
  17: 'logs',
  18: 'construction',
  19: 'fragile',
  20: 'mixed',
  21: 'barrels',
  22: 'construction',
  23: 'farm',
  24: 'logs',
  25: 'barrels',
  26: 'fragile',
  27: 'farm',
  28: 'construction',
  29: 'mixed',
  30: 'mixed',
  31: 'logs',
  32: 'barrels',
  33: 'construction',
  34: 'farm',
  35: 'fragile',
  36: 'barrels',
  37: 'logs',
  38: 'construction',
  39: 'farm',
  40: 'fragile',
  41: 'mixed',
  42: 'construction',
  43: 'fragile',
  44: 'barrels',
  45: 'mixed',
  46: 'farm',
  47: 'construction',
  48: 'fragile',
  49: 'mixed',
  50: 'mixed',
};

export function getLevelCargoPackage(levelId: number): CargoPackageType {
  return LEVEL_CARGO_MAP[levelId] || 'logs';
}

export function getLevelConfig(levelId: number): LevelConfig & { cargoPackage: CargoPackageType } {
  const found = LEVELS.find((l) => l.id === levelId) ?? LEVELS[0];
  return {
    ...found,
    cargoPackage: found.cargoPackage || getLevelCargoPackage(found.id),
  };
}
