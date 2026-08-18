import { storage, PlayerSaveData } from '../platform/StorageService';
import { eventBus } from '../core/EventBus';

export interface UpgradeNode {
  id: keyof PlayerSaveData['upgrades'];
  nameRu: string;
  nameEn: string;
  descRu: string;
  descEn: string;
  category: 'worker' | 'soldier' | 'bomber' | 'queen';
  icon: string;
  maxLevel: number;
  baseCost: number;
  costMultiplier: number;
}

export const UPGRADE_CATALOG: UpgradeNode[] = [
  {
    id: 'workerSpeed',
    nameRu: 'Феромонная скорость',
    nameEn: 'Pheromone Agility',
    descRu: 'Увеличивает скорость перемещения Рабочих на +15%',
    descEn: 'Increases Worker movement speed by +15%',
    category: 'worker',
    icon: '⚡',
    maxLevel: 5,
    baseCost: 100,
    costMultiplier: 1.6
  },
  {
    id: 'bridgeStrength',
    nameRu: 'Хитиновые связки',
    nameEn: 'Chitin Linkages',
    descRu: 'Ускоряет постройку живых мостов на +30%',
    descEn: 'Builds living ant bridges +30% faster',
    category: 'worker',
    icon: '🌉',
    maxLevel: 5,
    baseCost: 150,
    costMultiplier: 1.7
  },
  {
    id: 'workerHarvest',
    nameRu: 'Сбор пыльцы',
    nameEn: 'Pollen Harvester',
    descRu: 'Рабочие собирают на +40% больше биомассы',
    descEn: 'Workers gather +40% more biomass per node',
    category: 'worker',
    icon: '🌸',
    maxLevel: 5,
    baseCost: 120,
    costMultiplier: 1.5
  },
  {
    id: 'soldierAttack',
    nameRu: 'Жвала-косы',
    nameEn: 'Scythe Mandibles',
    descRu: 'Увеличивает урон Солдат в ближнем бою на +25%',
    descEn: 'Increases Soldier melee attack by +25%',
    category: 'soldier',
    icon: '⚔️',
    maxLevel: 5,
    baseCost: 180,
    costMultiplier: 1.8
  },
  {
    id: 'soldierArmor',
    nameRu: 'Панцирь титана',
    nameEn: 'Carapace Armor',
    descRu: 'Уменьшает получаемый Солдатами урон на +10%',
    descEn: 'Reduces damage taken by Soldiers by +10%',
    category: 'soldier',
    icon: '🛡️',
    maxLevel: 5,
    baseCost: 200,
    costMultiplier: 1.8
  },
  {
    id: 'bomberRadius',
    nameRu: 'Кислотный резервуар',
    nameEn: 'Acid Reservoir',
    descRu: 'Увеличивает радиус взрыва Бомбардиров на +20%',
    descEn: 'Increases Bomber blast radius by +20%',
    category: 'bomber',
    icon: '💥',
    maxLevel: 5,
    baseCost: 220,
    costMultiplier: 1.75
  },
  {
    id: 'bomberAcid',
    nameRu: 'Едкая слизь',
    nameEn: 'Corrosive Slime',
    descRu: 'Увеличивает взрывной урон по укреплениям на +30%',
    descEn: 'Increases blast damage against walls by +30%',
    category: 'bomber',
    icon: '🧪',
    maxLevel: 5,
    baseCost: 240,
    costMultiplier: 1.8
  },
  {
    id: 'queenSpawnRate',
    nameRu: 'Матка-инкубатор',
    nameEn: 'Queen Incubator',
    descRu: 'Увеличивает скорость рождения новых муравьев на +20%',
    descEn: 'Increases base ant spawn rate by +20%',
    category: 'queen',
    icon: '👑',
    maxLevel: 5,
    baseCost: 250,
    costMultiplier: 2.0
  },
  {
    id: 'pheromoneCapacity',
    nameRu: 'Феромонная железа',
    nameEn: 'Pheromone Gland',
    descRu: 'Увеличивает запас энергии феромонов на +25%',
    descEn: 'Increases max pheromone capacity by +25%',
    category: 'queen',
    icon: '💧',
    maxLevel: 5,
    baseCost: 150,
    costMultiplier: 1.6
  }
];

export class EvolutionManager {
  private static instance: EvolutionManager;

  private constructor() {}

  public static getInstance(): EvolutionManager {
    if (!EvolutionManager.instance) {
      EvolutionManager.instance = new EvolutionManager();
    }
    return EvolutionManager.instance;
  }

  public getUpgradeLevel(id: keyof PlayerSaveData['upgrades']): number {
    return storage.getData().upgrades[id] || 0;
  }

  public getUpgradeCost(node: UpgradeNode): number {
    const currentLevel = this.getUpgradeLevel(node.id);
    if (currentLevel >= node.maxLevel) return Infinity;
    return Math.floor(node.baseCost * Math.pow(node.costMultiplier, currentLevel));
  }

  public canAfford(node: UpgradeNode): boolean {
    const cost = this.getUpgradeCost(node);
    return storage.getData().biomass >= cost && this.getUpgradeLevel(node.id) < node.maxLevel;
  }

  public purchaseUpgrade(node: UpgradeNode): boolean {
    if (!this.canAfford(node)) return false;

    const cost = this.getUpgradeCost(node);
    const data = storage.getData();
    data.biomass -= cost;
    data.upgrades[node.id] = (data.upgrades[node.id] || 0) + 1;

    storage.save(true);
    eventBus.emit('biomass:changed', { total: data.biomass });
    eventBus.emit('upgrade:purchased', { upgradeKey: node.id, level: data.upgrades[node.id] });
    eventBus.emit('audio:play_sfx', { name: 'pickup_collect_chime' });

    return true;
  }

  public addBiomass(amount: number): void {
    const data = storage.getData();
    data.biomass += Math.max(0, Math.floor(amount));
    storage.save();
    eventBus.emit('biomass:changed', { total: data.biomass });
  }

  public getBiomass(): number {
    return storage.getData().biomass;
  }

  public getMultiplier(id: keyof PlayerSaveData['upgrades']): number {
    const lvl = this.getUpgradeLevel(id);
    switch (id) {
      case 'workerSpeed': return 1 + lvl * 0.15;
      case 'bridgeStrength': return 1 + lvl * 0.30;
      case 'workerHarvest': return 1 + lvl * 0.40;
      case 'soldierAttack': return 1 + lvl * 0.25;
      case 'soldierArmor': return Math.min(0.75, lvl * 0.10);
      case 'bomberRadius': return 1 + lvl * 0.20;
      case 'bomberAcid': return 1 + lvl * 0.30;
      case 'queenSpawnRate': return 1 + lvl * 0.20;
      case 'pheromoneCapacity': return 1 + lvl * 0.25;
      default: return 1;
    }
  }
}

export const evolutionManager = EvolutionManager.getInstance();
