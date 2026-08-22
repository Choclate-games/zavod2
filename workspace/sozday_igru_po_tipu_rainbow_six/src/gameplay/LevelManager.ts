import type { RoomConfig, RoomId } from "../core/Types";

export const ROOM_CONFIGS: Record<RoomId, RoomConfig> = {
  1: {
    id: 1,
    name: "Периметр: Фойе Посольства",
    subtitle: "Сектор 1/3 — Прорыв рубежа",
    description: "Два боевика удерживают ресепшн. Установите заряд C4 на слабую перегородку и ликвидируйте цели в slow-mo.",
    timeLimitSeconds: 90,
    baseSlowMoSeconds: 3.0,
    playerSpawn: { x: 0, y: 0, z: -4.5, rotY: 0 },
    roomBounds: { minX: -10, maxX: 10, minZ: -5, maxZ: 12 },
    breachPoints: [
      {
        id: "breach_door",
        name: "Дверь Охраны (Дерево)",
        x: 0,
        y: 1.5,
        z: 0,
        rotY: 0,
        isReinforced: false,
        isDoor: true,
        width: 1.8,
        height: 2.8,
      },
      {
        id: "breach_left_wall",
        name: "Слабая Стена (Гипсокартон)",
        x: -3.5,
        y: 1.5,
        z: 0,
        rotY: 0,
        isReinforced: false,
        isDoor: false,
        width: 3.2,
        height: 2.8,
      },
    ],
    enemies: [
      {
        id: "enemy_1_1",
        type: "militia_scout",
        x: -0.8,
        y: 0,
        z: 4.2,
        rotY: Math.PI,
        hasArmor: false,
      },
      {
        id: "enemy_1_2",
        type: "militia_scout",
        x: 2.8,
        y: 0,
        z: 5.5,
        rotY: Math.PI + 0.3,
        hasArmor: false,
      },
    ],
    tripmines: [],
  },
  2: {
    id: 2,
    name: "Офисный Холл: Опенспейс",
    subtitle: "Сектор 2/3 — Засада за столами",
    description: "Три террориста заняли укрытия. Осторожно: перед дверью установлена лазерная растяжка с взрывчаткой.",
    timeLimitSeconds: 75,
    baseSlowMoSeconds: 2.0,
    playerSpawn: { x: 0, y: 0, z: -4.5, rotY: 0 },
    roomBounds: { minX: -10, maxX: 10, minZ: -5, maxZ: 12 },
    breachPoints: [
      {
        id: "breach_door",
        name: "Центральная Дверь",
        x: 0,
        y: 1.5,
        z: 0,
        rotY: 0,
        isReinforced: false,
        isDoor: true,
        width: 1.8,
        height: 2.8,
      },
      {
        id: "breach_right_wall",
        name: "Боковая Перегородка",
        x: 3.5,
        y: 1.5,
        z: 0,
        rotY: 0,
        isReinforced: false,
        isDoor: false,
        width: 3.2,
        height: 2.8,
      },
    ],
    enemies: [
      {
        id: "enemy_2_1",
        type: "terrorist_rifleman",
        x: -3.2,
        y: 0,
        z: 4.5,
        rotY: Math.PI - 0.2,
        hasArmor: false,
      },
      {
        id: "enemy_2_2",
        type: "terrorist_rifleman",
        x: 0.2,
        y: 0,
        z: 6.0,
        rotY: Math.PI,
        hasArmor: true,
      },
      {
        id: "enemy_2_3",
        type: "terrorist_rifleman",
        x: 3.0,
        y: 0,
        z: 7.2,
        rotY: Math.PI + 0.4,
        hasArmor: false,
      },
    ],
    tripmines: [
      {
        id: "tripmine_2_1",
        x: -1.2,
        y: 0.35,
        z: 0.5,
        beamLength: 2.4,
        beamDir: "x",
        disarmed: false,
      },
    ],
  },
  3: {
    id: 3,
    name: "Серверное Хранилище: СВУ",
    subtitle: "Сектор 3/3 — Финальная детонация",
    description: "Четыре тяжелых наемника синдиката и тикающая бомба (25 сек). Стена армирована — требуется термо-заряд.",
    timeLimitSeconds: 30,
    baseSlowMoSeconds: 1.5,
    playerSpawn: { x: 0, y: 0, z: -4.5, rotY: 0 },
    roomBounds: { minX: -10, maxX: 10, minZ: -5, maxZ: 12 },
    breachPoints: [
      {
        id: "breach_door",
        name: "Армированная Бронедверь",
        x: 0,
        y: 1.5,
        z: 0,
        rotY: 0,
        isReinforced: true,
        isDoor: true,
        width: 2.0,
        height: 2.8,
      },
      {
        id: "breach_left_wall",
        name: "Армированная Перегородка",
        x: -3.5,
        y: 1.5,
        z: 0,
        rotY: 0,
        isReinforced: true,
        isDoor: false,
        width: 3.2,
        height: 2.8,
      },
    ],
    enemies: [
      {
        id: "enemy_3_1",
        type: "syndicate_heavy",
        x: -4.2,
        y: 0,
        z: 4.8,
        rotY: Math.PI - 0.3,
        hasArmor: true,
      },
      {
        id: "enemy_3_2",
        type: "syndicate_heavy",
        x: -1.5,
        y: 0,
        z: 7.2,
        rotY: Math.PI - 0.1,
        hasArmor: true,
      },
      {
        id: "enemy_3_3",
        type: "syndicate_heavy",
        x: 1.5,
        y: 0,
        z: 7.2,
        rotY: Math.PI + 0.1,
        hasArmor: true,
      },
      {
        id: "enemy_3_4",
        type: "syndicate_heavy",
        x: 4.2,
        y: 0,
        z: 4.8,
        rotY: Math.PI + 0.3,
        hasArmor: true,
      },
    ],
    tripmines: [
      {
        id: "tripmine_3_1",
        x: -3.8,
        y: 0.35,
        z: 2.2,
        beamLength: 2.0,
        beamDir: "x",
        disarmed: false,
      },
    ],
    bomb: {
      x: 0,
      y: 0.55,
      z: 5.0,
      targetWire: "blue",
      timeLimit: 25.0,
      remainingTime: 25.0,
      isDefused: false,
      isDetonated: false,
    },
  },
};

export class LevelManager {
  public currentRoomId: RoomId = 1;
  public currentRoomConfig: RoomConfig = ROOM_CONFIGS[1];

  setRoom(roomId: RoomId): RoomConfig {
    this.currentRoomId = roomId;
    this.currentRoomConfig = ROOM_CONFIGS[roomId];
    return this.currentRoomConfig;
  }

  nextRoom(): RoomConfig | null {
    if (this.currentRoomId < 3) {
      this.currentRoomId = (this.currentRoomId + 1) as RoomId;
      this.currentRoomConfig = ROOM_CONFIGS[this.currentRoomId];
      return this.currentRoomConfig;
    }
    return null;
  }

  isFinalRoom(): boolean {
    return this.currentRoomId === 3;
  }
}
