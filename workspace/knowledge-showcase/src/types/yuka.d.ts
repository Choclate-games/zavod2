/**
 * Yuka 0.7.8 не поставляет TypeScript-типов и не имеет пакета `@types/yuka`.
 * Без этого файла TS выводит типы из `build/yuka.module.js` и теряет почти все
 * члены классов: `guard.position`, `guard.steering`, `guard.vision` становятся
 * ошибками уже при первом наследовании от `Vehicle`.
 *
 * Здесь объявлено только то, что реально используется стендом. Расширяйте по
 * мере надобности, сверяясь с https://mugen87.github.io/yuka/docs/ — выдумывать
 * методы нельзя, они не проверяются компилятором против реализации.
 */
declare module 'yuka' {
  export class Vector3 {
    x: number; y: number; z: number;
    constructor(x?: number, y?: number, z?: number);
    set(x: number, y: number, z: number): this;
    copy(v: Vector3): this;
    clone(): Vector3;
    add(v: Vector3): this;
    sub(v: Vector3): this;
    normalize(): this;
    length(): number;
    distanceTo(v: Vector3): number;
    squaredDistanceTo(v: Vector3): number;
  }

  export class Quaternion {
    x: number; y: number; z: number; w: number;
  }

  export class Matrix4 {
    elements: number[];
  }

  export class Time {
    update(): this;
    getDelta(): number;
    getElapsed(): number;
  }

  export class GameEntity {
    name: string;
    active: boolean;
    position: Vector3;
    rotation: Quaternion;
    scale: Vector3;
    boundingRadius: number;
    maxTurnRate: number;
    worldMatrix: Matrix4;
    manager: EntityManager | null;
    setRenderComponent(renderComponent: unknown, callback: (entity: GameEntity, renderComponent: unknown) => void): this;
    update(delta: number): this;
    lookAt(target: Vector3): this;
  }

  export class MovingEntity extends GameEntity {
    velocity: Vector3;
    maxSpeed: number;
    updateOrientation: boolean;
    getSpeed(): number;
    getSpeedSquared(): number;
  }

  export class Vehicle extends MovingEntity {
    steering: SteeringManager;
    smoother: Smoother | null;
    mass: number;
    maxForce: number;
    updateNeighborhood: boolean;
    neighborhoodRadius: number;
    neighbors: Vehicle[];
    vision?: Vision;
    memory?: MemorySystem;
  }

  export class SteeringManager {
    behaviors: SteeringBehavior[];
    add(behavior: SteeringBehavior): this;
    remove(behavior: SteeringBehavior): this;
    clear(): this;
  }

  export class SteeringBehavior {
    active: boolean;
    weight: number;
  }

  export class SeekBehavior extends SteeringBehavior { constructor(target?: Vector3); target: Vector3 }
  export class FleeBehavior extends SteeringBehavior { constructor(target?: Vector3, panicDistance?: number); target: Vector3; panicDistance: number }
  export class ArriveBehavior extends SteeringBehavior { constructor(target?: Vector3, deceleration?: number, tolerance?: number); target: Vector3; deceleration: number; tolerance: number }
  export class PursuitBehavior extends SteeringBehavior { constructor(evader?: MovingEntity, predictionFactor?: number); evader: MovingEntity | null }
  export class EvadeBehavior extends SteeringBehavior { constructor(pursuer?: MovingEntity, panicDistance?: number, predictionFactor?: number) }
  export class WanderBehavior extends SteeringBehavior { constructor(radius?: number, distance?: number, jitter?: number) }
  export class SeparationBehavior extends SteeringBehavior {}
  export class AlignmentBehavior extends SteeringBehavior {}
  export class CohesionBehavior extends SteeringBehavior {}
  export class OffsetPursuitBehavior extends SteeringBehavior { constructor(leader?: Vehicle, offset?: Vector3) }
  export class InterposeBehavior extends SteeringBehavior { constructor(entity1?: MovingEntity, entity2?: MovingEntity, deceleration?: number) }
  export class ObstacleAvoidanceBehavior extends SteeringBehavior {
    constructor(obstacles?: GameEntity[]);
    obstacles: GameEntity[];
    brakingWeight: number;
    dBoxMinLength: number;
  }
  export class FollowPathBehavior extends SteeringBehavior {
    constructor(path?: Path, nextWaypointDistance?: number);
    path: Path;
    nextWaypointDistance: number;
  }
  export class OnPathBehavior extends SteeringBehavior { constructor(path?: Path, radius?: number, predictionFactor?: number) }

  export class Path {
    loop: boolean;
    add(waypoint: Vector3): this;
    clear(): this;
    current(): Vector3;
    finished(): boolean;
    advance(): this;
  }

  export class Smoother {
    constructor(count?: number);
  }

  export class EntityManager {
    entities: GameEntity[];
    spatialIndex: CellSpacePartitioning | null;
    time?: Time;
    add(entity: GameEntity): this;
    remove(entity: GameEntity): this;
    clear(): this;
    update(delta: number): this;
  }

  export class CellSpacePartitioning {
    constructor(width: number, height: number, depth: number, cellsX: number, cellsY: number, cellsZ: number);
  }

  export class State<T> {
    enter(owner: T): void;
    execute(owner: T): void;
    exit(owner: T): void;
  }

  export class StateMachine<T> {
    constructor(owner?: T);
    owner: T;
    currentState: State<T> | null;
    previousState: State<T> | null;
    globalState: State<T> | null;
    add(id: string, state: State<T>): this;
    remove(id: string): this;
    get(id: string): State<T> | null;
    changeTo(id: string): this;
    revert(): this;
    in(id: string): boolean;
    update(): this;
  }

  export class Vision {
    constructor(owner?: GameEntity);
    owner: GameEntity | null;
    fieldOfView: number;
    range: number;
    addObstacle(obstacle: unknown): this;
    visible(point: Vector3): boolean;
  }

  export class MemoryRecord {
    entity: GameEntity | null;
    timeBecameVisible: number;
    timeLastSensed: number;
    lastSensedPosition: Vector3;
    visible: boolean;
  }

  export class MemorySystem {
    constructor(owner?: GameEntity);
    owner: GameEntity | null;
    records: MemoryRecord[];
    memorySpan: number;
    createRecord(entity: GameEntity): this;
    /** ВНИМАНИЕ: возвращает undefined, пока для сущности не вызван createRecord(). */
    getRecord(entity: GameEntity): MemoryRecord | undefined;
    getValidMemoryRecords(currentTime: number, result: MemoryRecord[]): MemoryRecord[];
    hasRecord(entity: GameEntity): boolean;
  }

  export class FuzzyModule {
    addFLV(name: string, fuzzyVariable: FuzzyVariable): this;
    addRule(rule: FuzzyRule): this;
    fuzzify(name: string, value: number): this;
    defuzzify(name: string, type?: string): number;
  }
  export class FuzzyVariable { add(set: FuzzySet): this }
  export class FuzzySet {}
  export class LeftShoulderFuzzySet extends FuzzySet { constructor(left: number, midpoint: number, right: number) }
  export class RightShoulderFuzzySet extends FuzzySet { constructor(left: number, midpoint: number, right: number) }
  export class TriangularFuzzySet extends FuzzySet { constructor(left: number, midpoint: number, right: number) }
  export class FuzzyRule { constructor(antecedent: unknown, consequence: unknown) }
  export class FuzzyAND { constructor(...terms: unknown[]) }
  export class FuzzyOR { constructor(...terms: unknown[]) }

  export class MeshGeometry {
    constructor(vertices: Float32Array | number[], indices?: Uint16Array | Uint32Array | number[]);
  }

  export const MathUtils: {
    clamp(value: number, min: number, max: number): number;
    randFloat(min: number, max: number): number;
    randInt(min: number, max: number): number;
  };
}
