import RAPIER from '@dimforge/rapier3d-compat';
import * as THREE from 'three';
import type { BoxerRig, RagdollBone } from './boxerRig';

/**
 * Рэгдолл ИЗ САМОГО ПЕРСОНАЖА, а не из капсул-заменителей.
 *
 * `world/ragdoll.ts` (слэшер) строит труп из семи капсул и прячет живую
 * модель — для толпы врагов это правильно и дёшево. В файтинге бойцов ровно
 * двое и камера смотрит им в лицо: подмена на капсулы в момент нокдауна —
 * самый заметный обман в кадре. Поэтому здесь физике отдаются настоящие
 * подграфы рига: голова с лицом, грудь с рёбрами, руки в перчатках.
 *
 * Как это работает:
 *
 * 1. Для каждой кости берём мировой AABB её подграфа (`Box3.setFromObject`)
 *    ДО того, как отцепили её детей — поэтому список костей идёт «листья →
 *    корень» (см. `BoxerRig.ragdollBones()`).
 * 2. На месте AABB создаём динамическое тело с кубоид-коллайдером и
 *    holder-группу в той же точке; `holder.attach(obj)` переносит подграф без
 *    смещения (Three пересчитывает локальную матрицу под нового родителя).
 * 3. Кости сшиваются сферическими суставами в середине между центрами.
 *
 * Три ловушки те же, что в `ragdoll.ts`, и они не прощают:
 * части одного тела не должны сталкиваться друг с другом (иначе труп дрожит),
 * без углового демпфирования он крутится вечно, импульс прикладывается один
 * раз и клампится — иначе решатель рвёт суставы и получается судорога.
 */

const GROUP_RAGDOLL = 0x0008;
const GROUP_GROUND = 0x0001;
const GROUP_PROP = 0x0010;
/** membership << 16 | filter: части видят пол и реквизит, но не друг друга. */
const RAGDOLL_GROUPS = (GROUP_RAGDOLL << 16) | (GROUP_GROUND | GROUP_PROP);

/** Максимальный импульс на одно тело, Н·с. Выше — суставы рвутся. */
const MAX_IMPULSE = 34;
/** Минимальная полутолщина коллайдера: у плоских накладок AABB почти нулевой. */
const MIN_HALF = 0.04;

interface Part {
  body: RAPIER.RigidBody;
  holder: THREE.Group;
}

export interface BoxerRagdollOptions {
  /** Импульс от последнего удара, м/с·кг. Клампится. */
  impulse: THREE.Vector3;
  /** По какой кости пришёлся удар: 'head' | 'chest' | 'waist'. */
  hitBone?: string;
}

export class BoxerRagdoll {
  /** Секунды с момента нокдауна — по ним демо решает, когда поднимать бойца. */
  age = 0;
  readonly group = new THREE.Group();
  private readonly parts = new Map<string, Part>();
  private readonly joints: RAPIER.ImpulseJoint[] = [];
  private readonly restored: Array<{ object: THREE.Object3D; parent: THREE.Object3D }> = [];

  constructor(
    private readonly world: RAPIER.World,
    scene: THREE.Object3D,
    rig: BoxerRig,
    opts: BoxerRagdollOptions,
  ) {
    scene.add(this.group);
    rig.root.updateWorldMatrix(true, true);

    const box = new THREE.Box3();
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();

    for (const bone of rig.ragdollBones()) {
      box.setFromObject(bone.object);
      if (box.isEmpty()) continue;
      box.getCenter(center);
      box.getSize(size);

      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic()
          .setTranslation(center.x, center.y, center.z)
          .setLinearDamping(0.2)
          // Ловушка №2: без этого тело вращается до конца раунда.
          .setAngularDamping(3.5)
          .setCcdEnabled(true),
      );
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(
          Math.max(size.x / 2, MIN_HALF),
          Math.max(size.y / 2, MIN_HALF),
          Math.max(size.z / 2, MIN_HALF),
        )
          .setMass(bone.mass)
          .setFriction(0.9)
          .setRestitution(0.03)
          // Ловушка №1: части не видят друг друга, только ринг.
          .setCollisionGroups(RAGDOLL_GROUPS),
        body,
      );

      const holder = new THREE.Group();
      holder.position.copy(center);
      this.group.add(holder);
      this.restored.push({ object: bone.object, parent: bone.object.parent ?? rig.root });
      // attach (а не add) сохраняет мировое положение подграфа.
      holder.attach(bone.object);

      this.parts.set(bone.name, { body, holder });
      this.link(bone);
    }

    // Ловушка №3: один импульс, в одну кость, с потолком.
    const hit = this.parts.get(opts.hitBone ?? 'chest') ?? this.parts.get('chest');
    if (hit) {
      const imp = opts.impulse.clone();
      if (imp.length() > MAX_IMPULSE) imp.setLength(MAX_IMPULSE);
      hit.body.applyImpulse({ x: imp.x, y: imp.y, z: imp.z }, true);
    }
  }

  private link(bone: RagdollBone): void {
    if (!bone.parent) return;
    const a = this.parts.get(bone.parent);
    const b = this.parts.get(bone.name);
    if (!a || !b) return;
    const pa = a.body.translation();
    const pb = b.body.translation();
    const mid = { x: (pa.x + pb.x) / 2, y: (pa.y + pb.y) / 2, z: (pa.z + pb.z) / 2 };
    const params = RAPIER.JointData.spherical(
      { x: mid.x - pa.x, y: mid.y - pa.y, z: mid.z - pa.z },
      { x: mid.x - pb.x, y: mid.y - pb.y, z: mid.z - pb.z },
    );
    this.joints.push(this.world.createImpulseJoint(params, a.body, b.body, true));
  }

  /** Перенести состояние тел в сцену. Вызывать раз в кадр после world.step(). */
  sync(): void {
    for (const part of this.parts.values()) {
      const p = part.body.translation();
      const r = part.body.rotation();
      part.holder.position.set(p.x, p.y, p.z);
      part.holder.quaternion.set(r.x, r.y, r.z, r.w);
    }
  }

  /** Средняя скорость тел: по ней видно, что труп улёгся и можно вставать. */
  get settled(): boolean {
    let v = 0;
    for (const part of this.parts.values()) {
      const l = part.body.linvel();
      v += Math.abs(l.x) + Math.abs(l.y) + Math.abs(l.z);
    }
    return v / Math.max(1, this.parts.size) < 0.35;
  }

  /** Мировая позиция таза — куда «переехал» боец, пока падал. */
  hipsPosition(out: THREE.Vector3): THREE.Vector3 {
    const p = (this.parts.get('hips') ?? this.parts.get('waist'))?.body.translation();
    return p ? out.set(p.x, p.y, p.z) : out.set(0, 0, 0);
  }

  /**
   * Вернуть подграфы рига на их исходные места в иерархии и убрать тела.
   * Локальные трансформы восстанавливает `resetPose(rig)` на стороне демо.
   */
  dispose(): void {
    for (const { object, parent } of this.restored) parent.add(object);
    this.restored.length = 0;
    for (const j of this.joints) this.world.removeImpulseJoint(j, true);
    this.joints.length = 0;
    for (const part of this.parts.values()) this.world.removeRigidBody(part.body);
    this.parts.clear();
    this.group.removeFromParent();
  }
}
