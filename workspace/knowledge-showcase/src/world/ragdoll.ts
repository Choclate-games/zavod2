import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';

/**
 * Рэгдолл на Rapier: семь тел, шесть сферических суставов.
 *
 * knowledge/mechanics/ragdoll.md. Ключевая мысль: рэгдолл заменяет труп, а не
 * живого врага. Пока враг жив, им управляет боевой автомат состояний
 * (`game/meleeCombat.ts`) с предсказуемыми кадрами; физика включается ровно в
 * момент смерти и получает импульс от последнего удара. Гибридный «активный
 * рэгдолл» с PD-контроллерами на каждом суставе — отдельная задача, и на
 * мобильном он стоит кадра.
 *
 * Три ловушки, каждая из которых стоила отладки:
 *
 * 1. **Части одного рэгдолла не должны сталкиваться друг с другом.** Соседние
 *    капсулы (грудь и рука) всегда пересекаются в суставе, решатель контактов
 *    и решатель суставов начинают спорить, и труп дрожит и уползает. Лечится
 *    группами столкновений: все части — одна membership, фильтр только «земля».
 * 2. **Без углового демпфирования труп крутится вечно** и никогда не засыпает,
 *    то есть навсегда остаётся в бюджете кадра.
 * 3. **Импульс прикладывается один раз и клампится.** `applyImpulse` каждый
 *    кадр или импульс «как в кино» разрывает суставы: тела разлетаются, потом
 *    решатель стягивает их обратно — получается судорога.
 */

const GROUP_RAGDOLL = 0x0008;
const GROUP_GROUND = 0x0001;
/** membership << 16 | filter: части видят только землю, но не друг друга. */
const RAGDOLL_GROUPS = (GROUP_RAGDOLL << 16) | GROUP_GROUND;

/** Максимальный импульс на одно тело, Н·с. Выше — суставы рвутся. */
const MAX_IMPULSE = 26;

interface BoneSpec {
  readonly name: string;
  /** Центр относительно точки спавна (ступни на y = 0), метры. */
  readonly pos: readonly [number, number, number];
  /** Капсула: половина высоты цилиндра и радиус. */
  readonly halfHeight: number;
  readonly radius: number;
  readonly mass: number;
  /** Материал: 0 — одежда, 1 — кожа. */
  readonly skin: 0 | 1;
}

const BONES: readonly BoneSpec[] = [
  { name: 'pelvis', pos: [0, 0.95, 0], halfHeight: 0.10, radius: 0.17, mass: 12, skin: 0 },
  { name: 'chest', pos: [0, 1.32, 0], halfHeight: 0.16, radius: 0.20, mass: 16, skin: 0 },
  { name: 'head', pos: [0, 1.70, 0], halfHeight: 0.04, radius: 0.14, mass: 4, skin: 1 },
  { name: 'armL', pos: [-0.30, 1.28, 0], halfHeight: 0.20, radius: 0.075, mass: 3, skin: 1 },
  { name: 'armR', pos: [0.30, 1.28, 0], halfHeight: 0.20, radius: 0.075, mass: 3, skin: 1 },
  { name: 'legL', pos: [-0.13, 0.48, 0], halfHeight: 0.26, radius: 0.10, mass: 8, skin: 0 },
  { name: 'legR', pos: [0.13, 0.48, 0], halfHeight: 0.26, radius: 0.10, mass: 8, skin: 0 },
];

/** Сустав: две кости и мировая точка крепления относительно спавна. */
const JOINTS: ReadonlyArray<readonly [string, string, readonly [number, number, number]]> = [
  ['pelvis', 'chest', [0, 1.13, 0]],
  ['chest', 'head', [0, 1.54, 0]],
  ['chest', 'armL', [-0.26, 1.46, 0]],
  ['chest', 'armR', [0.26, 1.46, 0]],
  ['pelvis', 'legL', [-0.13, 0.82, 0]],
  ['pelvis', 'legR', [0.13, 0.82, 0]],
];

interface Part {
  body: RAPIER.RigidBody;
  mesh: THREE.Mesh;
}

export interface RagdollOptions {
  position: THREE.Vector3;
  /** Поворот вокруг Y, радианы. */
  facing: number;
  suit: number;
  skin: number;
  /** Импульс от убившего удара; клампится до MAX_IMPULSE. */
  impulse: THREE.Vector3;
  /** Куда пришёлся удар — по этой кости и бьём. */
  impulseBone?: 'head' | 'chest' | 'pelvis';
}

export class Ragdoll {
  readonly group = new THREE.Group();
  private readonly parts = new Map<string, Part>();
  private readonly joints: RAPIER.ImpulseJoint[] = [];
  /** Секунд с момента смерти — по нему хост решает, когда убирать труп. */
  age = 0;

  constructor(private readonly world: RAPIER.World, opts: RagdollOptions) {
    const suitMat = new THREE.MeshStandardMaterial({ color: opts.suit, roughness: 0.7 });
    const skinMat = new THREE.MeshStandardMaterial({ color: opts.skin, roughness: 0.85 });
    const rot = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), opts.facing);
    const offset = new THREE.Vector3();

    for (const bone of BONES) {
      offset.set(bone.pos[0], bone.pos[1], bone.pos[2]).applyQuaternion(rot).add(opts.position);

      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(offset.x, offset.y, offset.z)
          .setRotation({ x: rot.x, y: rot.y, z: rot.z, w: rot.w })
          .setLinearDamping(0.15)
          // Ловушка №2: без этого труп вращается до конца сессии.
          .setAngularDamping(4.0),
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.capsule(bone.halfHeight, bone.radius)
          .setMass(bone.mass)
          .setFriction(0.85)
          .setRestitution(0.02)
          // Ловушка №1: части не видят друг друга, только землю.
          .setCollisionGroups(RAGDOLL_GROUPS),
        body,
      );

      const mesh = new THREE.Mesh(
        new THREE.CapsuleGeometry(bone.radius, bone.halfHeight * 2, 3, 8),
        bone.skin === 1 ? skinMat : suitMat,
      );
      mesh.castShadow = true;
      this.group.add(mesh);
      this.parts.set(bone.name, { body, mesh });
    }

    const anchor = new THREE.Vector3();
    for (const [aName, bName, at] of JOINTS) {
      const a = this.parts.get(aName)!;
      const b = this.parts.get(bName)!;
      anchor.set(at[0], at[1], at[2]).applyQuaternion(rot).add(opts.position);
      // Якоря — в локальных координатах каждого тела: мировая точка минус центр.
      const pa = a.body.translation();
      const pb = b.body.translation();
      const params = RAPIER.JointData.spherical(
        { x: anchor.x - pa.x, y: anchor.y - pa.y, z: anchor.z - pa.z },
        { x: anchor.x - pb.x, y: anchor.y - pb.y, z: anchor.z - pb.z },
      );
      this.joints.push(this.world.createImpulseJoint(params, a.body, b.body, true));
    }

    this.applyDeathImpulse(opts);
    this.sync();
  }

  /**
   * Рэгдолл успокоился — труп можно убирать, не показав игроку телепорт.
   *
   * Считаем по скорости, а не по `body.isSleeping()`. Замерено на этом самом
   * рэгдолле (`npm run check:melee`): за 15 секунд НИ ОДНО тело не засыпает —
   * решатель суставов постоянно подталкивает соседей, скорости не падают до
   * порога сна Rapier и таймер сна сбрасывается. То есть «дождаться сна»
   * ждало бы вечно, а мы бы списали это на «редкий случай».
   */
  get settled(): boolean {
    return this.maxSpeed() < 0.06;
  }

  /** Наибольшая линейная скорость среди тел, м/с. */
  maxSpeed(): number {
    let max = 0;
    for (const { body } of this.parts.values()) {
      const v = body.linvel();
      max = Math.max(max, Math.hypot(v.x, v.y, v.z));
    }
    return max;
  }

  /** Позиция таза — по ней считается, куда смотреть камере и где кровь. */
  pelvisPosition(out = new THREE.Vector3()): THREE.Vector3 {
    const t = this.parts.get('pelvis')!.body.translation();
    return out.set(t.x, t.y, t.z);
  }

  /** Перенести трансформы тел в меши. Вызывать ПОСЛЕ `world.step()`. */
  sync(): void {
    for (const { body, mesh } of this.parts.values()) {
      const t = body.translation();
      const r = body.rotation();
      mesh.position.set(t.x, t.y, t.z);
      mesh.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }

  dispose(): void {
    for (const joint of this.joints) this.world.removeImpulseJoint(joint, false);
    this.joints.length = 0;
    for (const { body, mesh } of this.parts.values()) {
      this.world.removeRigidBody(body);
      mesh.geometry.dispose();
    }
    this.parts.clear();
    // Материалы общие на рэгдолл — освобождаем один раз.
    this.group.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined;
      m?.dispose();
    });
    this.group.removeFromParent();
  }

  private applyDeathImpulse(opts: RagdollOptions): void {
    const target = this.parts.get(opts.impulseBone ?? 'chest')!;
    const imp = opts.impulse.clone();
    // Ловушка №3: клампим. «Кинематографичный» импульс рвёт суставы.
    if (imp.length() > MAX_IMPULSE) imp.setLength(MAX_IMPULSE);
    // Небольшая доля вверх: труп, который просто скользит по полу, выглядит
    // как мешок. Подброс на 20% импульса читается как удар.
    imp.y += imp.length() * 0.2;
    target.body.applyImpulse({ x: imp.x, y: imp.y, z: imp.z }, true);
    // Момент вокруг вертикали — рэгдолл разворачивает, а не просто толкает.
    target.body.applyTorqueImpulse({ x: imp.z * 0.05, y: 0, z: -imp.x * 0.05 }, true);
  }
}
