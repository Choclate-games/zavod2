import { LevelDefinition, CAMPAIGN_LEVELS } from './LevelData';
import { Team, Caste } from '../entities/AntTypes';
import { ObstacleType } from '../entities/Obstacle';

export class LevelGenerator {
  public static getLevel(levelNumber: number): LevelDefinition {
    // If within handcrafted campaign levels, return curated setup
    if (levelNumber <= CAMPAIGN_LEVELS.length) {
      return JSON.parse(JSON.stringify(CAMPAIGN_LEVELS[levelNumber - 1]));
    }

    // Procedural Endless Generator for level > 6
    return LevelGenerator.generateProceduralLevel(levelNumber);
  }

  private static generateProceduralLevel(levelNum: number): LevelDefinition {
    const width = 1600;
    const height = 900;

    // Difficulty scaling
    const enemyNestCount = Math.min(4, 2 + Math.floor((levelNum - 6) / 3));
    const neutralNestCount = 2 + Math.floor(Math.random() * 2);

    const nests: LevelDefinition['nests'] = [
      {
        id: 1,
        x: 240,
        y: height / 2,
        team: Team.PLAYER,
        isHQ: true,
        garrison: 50 + levelNum * 5
      }
    ];

    let nextNestId = 2;

    // Neutral nests in middle column
    for (let i = 0; i < neutralNestCount; i++) {
      const ny = (height / (neutralNestCount + 1)) * (i + 1);
      nests.push({
        id: nextNestId++,
        x: width * 0.45 + (Math.random() - 0.5) * 100,
        y: ny,
        team: Team.NEUTRAL,
        isHQ: false,
        garrison: 25 + levelNum * 2
      });
    }

    // Enemy nests on right side
    for (let i = 0; i < enemyNestCount; i++) {
      const ey = (height / (enemyNestCount + 1)) * (i + 1);
      nests.push({
        id: nextNestId++,
        x: width * 0.82 + (Math.random() - 0.5) * 80,
        y: ey,
        team: Team.ENEMY,
        isHQ: i === 0,
        garrison: 40 + levelNum * 4
      });
    }

    // Procedural obstacles (Chasm or Walls)
    const obstacles: LevelDefinition['obstacles'] = [];
    let nextObsId = 1;

    if (levelNum % 2 === 0) {
      // Split with chasm in center
      obstacles.push({
        id: nextObsId++,
        type: ObstacleType.CHASM,
        x: width * 0.35,
        y: height / 2,
        width: 140,
        height: height * 0.65
      });
    } else {
      // Barricade wall
      obstacles.push({
        id: nextObsId++,
        type: ObstacleType.DESTRUCTIBLE_WALL,
        x: width * 0.65,
        y: height / 2,
        width: 60,
        height: height * 0.7,
        hp: 400 + levelNum * 50,
        maxHp: 400 + levelNum * 50
      });
    }

    // Biomass nodes
    const biomassNodes: LevelDefinition['biomassNodes'] = [
      { id: 1, x: width * 0.3, y: height * 0.2, amount: 300 + levelNum * 30 },
      { id: 2, x: width * 0.3, y: height * 0.8, amount: 300 + levelNum * 30 },
      { id: 3, x: width * 0.7, y: height * 0.5, amount: 400 + levelNum * 40 }
    ];

    const initialSpawns: LevelDefinition['initialSpawns'] = [
      { x: 240, y: height / 2, caste: Caste.WORKER, team: Team.PLAYER, count: 35 },
      { x: 240, y: height / 2, caste: Caste.SOLDIER, team: Team.PLAYER, count: 30 },
      { x: 240, y: height / 2, caste: Caste.BOMBER, team: Team.PLAYER, count: 20 }
    ];

    return {
      id: levelNum,
      titleRu: `Уровень ${levelNum}: Завоевание Территории`,
      titleEn: `Level ${levelNum}: Territory Conquest`,
      objectiveRu: 'Уничтожьте все вражеские муравейники!',
      objectiveEn: 'Destroy all enemy hives on the map!',
      hintRu: 'Развивайте рой и захватывайте ключевые позиции!',
      hintEn: 'Grow your swarm and capture key positions!',
      worldWidth: width,
      worldHeight: height,
      nests,
      obstacles,
      biomassNodes,
      initialSpawns
    };
  }
}
