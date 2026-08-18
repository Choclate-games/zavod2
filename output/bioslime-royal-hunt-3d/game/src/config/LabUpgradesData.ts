import { LabGeneUpgrade } from '../types';

export const LAB_GENES_DATABASE: LabGeneUpgrade[] = [
  {
    id: 'cytoplasm_density',
    name: 'Плотность Цитоплазмы',
    icon: '🧪',
    statDescription: '+25 Макс. HP и +0.5 HP/сек регенерации',
    baseCost: 100,
    costMultiplier: 1.35,
    maxLevel: 10,
    valuePerLevel: 25
  },
  {
    id: 'chemotaxis',
    name: 'Хемотаксис',
    icon: '⚡',
    statDescription: '+8% к базовой скорости передвижения',
    baseCost: 120,
    costMultiplier: 1.35,
    maxLevel: 10,
    valuePerLevel: 0.08
  },
  {
    id: 'digestive_ferments',
    name: 'Пищеварительные Ферменты',
    icon: '🧬',
    statDescription: '+15% к урону ядом и силе поглощения',
    baseCost: 150,
    costMultiplier: 1.35,
    maxLevel: 10,
    valuePerLevel: 0.15
  },
  {
    id: 'biomass_magnetism',
    name: 'Магнетизм Биомассы',
    icon: '🧲',
    statDescription: '+20% к радиусу сбора сфер биомассы и ДНК',
    baseCost: 80,
    costMultiplier: 1.35,
    maxLevel: 10,
    valuePerLevel: 0.2
  },
  {
    id: 'primal_mass',
    name: 'Первобытная Масса',
    icon: '👑',
    statDescription: '+20% к начальной массе и размеру слизи',
    baseCost: 200,
    costMultiplier: 1.35,
    maxLevel: 5,
    valuePerLevel: 0.2
  }
];
