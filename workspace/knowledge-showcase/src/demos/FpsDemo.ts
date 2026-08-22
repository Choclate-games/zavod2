import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { VignetteEffect, type Effect } from 'postprocessing';
import type { Demo, DemoContext } from '../core/Demo';
import { disposeObject } from '../core/Demo';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { mulberry32 } from '../world/bvhLevel';
import { ParticlePoolSystem } from '../game/vfxJuice';
import { BOXER_MODELS, loadBoxerModel } from '../world/mixamoRig';
import { buildShooterRig, type ShooterRig } from '../world/shooterRig';
import {
  aimShooterAt, calibrateAim, createShooterAnim, poseShooter, triggerDeath, triggerFire, triggerHit,
  updateShooterAnim, SHOOTER_DURATIONS, type ShooterAnimState,
} from '../world/shooterPose';
import { DroppedProp, ShooterRagdoll, type RagdollSolid } from '../world/shooterRagdoll';
// Прицеливание и проверка видимости идут через ускоренный Raycaster.
import '../stack/bvhSetup';

const ARENA = 34;
const MAX_DECALS = 64;
const MAX_TRACERS = 24;
const PLAYER_HP = 200;
/** Токены атаки: одновременно стреляют максимум столько врагов. */
const ATTACK_TOKENS = 2;

const EYE_STAND = 1.68;
const EYE_CROUCH = 1.05;
/** Радиус игрока. Не меньше выноса ствола, иначе оружие входит в стену. */
const PLAYER_RADIUS = 0.62;
const GRAVITY = 24;
const JUMP_SPEED = 7.6;
/** Окно «прощения» после схода с края: без него прыжок с ящика не срабатывает. */
const COYOTE_TIME = 0.12;
/** Буфер раннего нажатия: Space за миг до приземления не теряется. */
const JUMP_BUFFER = 0.14;
/** Сколько тело лежит на арене, с. След боя нужен, вечное кладбище — нет. */
const CORPSE_TIME = 14;
const MAX_BLOOD = 40;
const UP_AXIS = new THREE.Vector3(0, 1, 0);

type EnemyState = 'idle' | 'alert' | 'engage' | 'reposition' | 'dead';

/** Что сейчас делает вьюмодель. Одна анимация за раз — иначе позы дерутся. */
type ViewAction = 'idle' | 'reload' | 'swap';

interface WeaponSpec {
  id: string;
  name: string;
  /** Автоматическое (огонь на удержании) или полуавтоматическое. */
  auto: boolean;
  damage: number;
  headMult: number;
  limbMult: number;
  /** Дробинок за выстрел. Дробовик — 9, остальные — 1. */
  pellets: number;
  /** Выстрелов в минуту. */
  rpm: number;
  /** Разброс от бедра / в прицеле, радианы. */
  hipSpread: number;
  adsSpread: number;
  /** Прирост разброса за выстрел и спад в секунду. */
  spreadPerShot: number;
  spreadDecay: number;
  maxSpread: number;
  mag: number;
  reserve: number;
  reloadTime: number;
  /** Подброс камеры (рад) и увод вьюмодели. */
  recoilPitch: number;
  recoilYaw: number;
  viewKick: number;
  trauma: number;
  range: number;
  /** Питч и мощность выстрела для синтезатора. */
  audioPitch: number;
  audioPower: number;
  adsFov: number;
  /** Множитель скорости хода с этим стволом. */
  moveScale: number;
  tracerColor: number;
  /**
   * Где вьюмодель стоит от бедра и в прицеле, в осях камеры.
   *
   * Своё на каждый ствол, а не общее: у пистолета мушка на 6 см выше начала
   * координат, у автомата — на 8, и от одного общего смещения пистолет
   * уезжает под нижний край кадра, а прицельная планка автомата не
   * попадает в центр экрана.
   */
  hipPos: readonly [number, number, number];
  adsPos: readonly [number, number, number];
}

/**
 * Три ствола, различающиеся НЕ только числами урона: полуавтомат против
 * автомата против залпа дробью — это три разных ритма боя, ради которого
 * выбор оружия вообще существует.
 */
const WEAPONS: readonly WeaponSpec[] = [
  {
    id: 'pistol', name: 'Пистолет', auto: false,
    damage: 34, headMult: 3.0, limbMult: 0.7, pellets: 1, rpm: 320,
    hipSpread: 0.010, adsSpread: 0.0015, spreadPerShot: 0.010, spreadDecay: 0.055, maxSpread: 0.05,
    mag: 12, reserve: 72, reloadTime: 1.15,
    recoilPitch: 0.022, recoilYaw: 0.006, viewKick: 0.055, trauma: 0.035,
    range: 90, audioPitch: 1.25, audioPower: 0.45, adsFov: 58, moveScale: 1.05,
    tracerColor: 0xffe6a8,
    hipPos: [0.13, -0.10, -0.36], adsPos: [0, -0.040, -0.40],
  },
  {
    id: 'rifle', name: 'Автомат', auto: true,
    damage: 26, headMult: 2.6, limbMult: 0.75, pellets: 1, rpm: 640,
    hipSpread: 0.016, adsSpread: 0.003, spreadPerShot: 0.006, spreadDecay: 0.045, maxSpread: 0.07,
    mag: 30, reserve: 180, reloadTime: 1.75,
    recoilPitch: 0.016, recoilYaw: 0.008, viewKick: 0.05, trauma: 0.028,
    range: 120, audioPitch: 1.0, audioPower: 0.62, adsFov: 52, moveScale: 1.0,
    tracerColor: 0xffd070,
    hipPos: [0.17, -0.15, -0.46], adsPos: [0, -0.048, -0.56],
  },
  {
    id: 'shotgun', name: 'Дробовик', auto: false,
    damage: 15, headMult: 1.8, limbMult: 0.85, pellets: 9, rpm: 78,
    hipSpread: 0.055, adsSpread: 0.032, spreadPerShot: 0.0, spreadDecay: 0.2, maxSpread: 0.055,
    mag: 6, reserve: 36, reloadTime: 2.1,
    recoilPitch: 0.07, recoilYaw: 0.012, viewKick: 0.16, trauma: 0.12,
    range: 34, audioPitch: 0.72, audioPower: 1.0, adsFov: 64, moveScale: 0.92,
    tracerColor: 0xffc25e,
    hipPos: [0.17, -0.15, -0.46], adsPos: [0, -0.038, -0.55],
  },
];

interface WeaponRuntime {
  spec: WeaponSpec;
  ammo: number;
  reserve: number;
  group: THREE.Group;
  muzzlePoint: THREE.Object3D;
  flash: THREE.Mesh;
  armLeft: THREE.Group;
  armRight: THREE.Group;
  /** Магазин/цевьё — то, что двигается на перезарядке. */
  movingPart: THREE.Object3D | null;
  movingHome: THREE.Vector3;
}

interface Enemy {
  rig: ShooterRig;
  /** Состояние процедурной анимации: фаза шага, выстрел, реакция, смерть. */
  anim: ShooterAnimState;
  pos: THREE.Vector3;
  /** Позиция в прошлом тике — из неё берётся скорость для цикла шага. */
  prev: THREE.Vector3;
  yaw: number;
  hp: number;
  state: EnemyState;
  stateTime: number;
  /** Кадры «увидел → выстрелил»: ноль читается игроком как читерство. */
  reaction: number;
  burstLeft: number;
  burstTimer: number;
  cooldown: number;
  hasToken: boolean;
  firstBurstDone: boolean;
  flash: number;
  muzzleTimer: number;
  /** Сколько ещё лежать до уборки тела, с. */
  corpseTime: number;
  /**
   * Тряпичная кукла. Появляется в момент смерти и с этого кадра целиком
   * заменяет процедурную анимацию: живой позы у трупа больше нет.
   */
  ragdoll: ShooterRagdoll | null;
}

interface Barrel {
  mesh: THREE.Mesh;
  pos: THREE.Vector3;
  hp: number;
  /** Задержка детонации: волна взрывов вместо схлопывания в один кадр. */
  fuse: number;
  exploded: boolean;
}

interface Blast {
  core: THREE.Mesh;
  ring: THREE.Mesh;
  light: THREE.PointLight;
  time: number;
  active: boolean;
}

/**
 * FPS: три ствола, hitscan по BVH, зоны урона, прыжок с гравитацией,
 * процедурная вьюмодель с руками, ИИ с задержкой реакции и токенами атаки,
 * цепные взрывы на таймерах фиксированного шага.
 *
 * Проверяет knowledge/threejs/fps_controller_and_shooting.md и
 * knowledge/threejs/shooter_enemy_ai_and_combat.md.
 */
export class FpsDemo implements Demo {
  readonly id = 'fps';
  readonly title = ['🔫 FPS: стрельба и ИИ', '🔫 FPS: shooting and AI'] as const;
  readonly hint = [
    '<b>Клик</b> захватить мышь · <b>WASD</b> движение · <b>Space</b> прыжок · <b>Ctrl</b> присесть · <b>Shift</b> бег'
    + ' · <b>ЛКМ</b> огонь · <b>ПКМ</b> прицел · <b>1/2/3</b>, <b>Q</b> или <b>колесо</b> — смена оружия · <b>R</b> перезарядка · <b>G</b> рестарт.'
    + ' Красные бочки детонируют цепочкой.',
    '<b>Click</b> to lock the mouse · <b>WASD</b> move · <b>Space</b> jump · <b>Ctrl</b> crouch · <b>Shift</b> sprint'
    + ' · <b>LMB</b> fire · <b>RMB</b> aim · <b>1/2/3</b>, <b>Q</b> or <b>wheel</b> switch weapon · <b>R</b> reload · <b>G</b> restart.'
    + ' Red barrels chain-detonate.',
  ] as const;
  readonly category = ['⚔️ Экшен и боёвка', '⚔️ Action & Combat'] as const;
  readonly tags = [
    'шутер', 'fps', 'стрельба', 'hitscan', 'отдача', 'ии', 'бочки', 'взрывы',
    'оружие', 'прыжок', 'вьюмодель', 'руки', 'shooter', 'gun', 'weapons', 'viewmodel',
  ] as const;

  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(75, 1, 0.02, 300);

  private ctx!: DemoContext;
  private arena!: THREE.Mesh;
  /** Ящики арены в виде AABB — по ним падают рэгдоллы и выпавшее оружие. */
  private readonly solids: RagdollSolid[] = COVERS.map(([x, z, w, d, h]) => ({ x, z, w, d, h }));
  /** Выпавшие из рук стволы. Живут столько же, сколько тела. */
  private drops: DroppedProp[] = [];

  private models: THREE.Group[] = [];
  private enemies: Enemy[] = [];
  private barrels: Barrel[] = [];
  private decals!: THREE.InstancedMesh;
  private decalIndex = 0;
  private bloodDecals!: THREE.InstancedMesh;
  private bloodIndex = 0;
  /** Одна плоскость на все вспышки врагов: их не бывает две в одном кадре. */
  private enemyFlash!: THREE.Mesh;

  // ─── игрок
  private readonly pos = new THREE.Vector3(0, 0, 22);      // ноги, не глаза
  private readonly vel = new THREE.Vector3();
  private yaw = 0;                                        // взгляд от спавна в центр арены
  private pitch = 0;
  private hp = PLAYER_HP;
  private grounded = true;
  private coyote = 0;
  private jumpBuffer = 0;
  private eyeHeight = EYE_STAND;
  private crouching = false;
  private sprinting = false;
  private aiming = false;
  private bob = 0;
  private moveSpeed = 0;
  private damageFlash = 0;
  /** Собственные часы демо: performance.now() в анимации ломает детерминизм. */
  private breath = 0;

  // ─── оружие
  private viewmodel!: THREE.Group;
  private weapons: WeaponRuntime[] = [];
  private weaponIndex = 1;                                  // стартуем с автомата
  private pendingIndex = 1;
  private fireTimer = 0;
  private reloadTimer = 0;
  private reloadTotal = 0;
  private swapTimer = 0;
  private spread = 0;
  private action: ViewAction = 'idle';
  private muzzleLight!: THREE.PointLight;
  private muzzleTimer = 0;
  /** Полуавтомат: выстрел по СОБЫТИЮ нажатия, а не по удержанию. */
  private semiQueued = false;
  private triggerHeld = false;

  // ─── отдача и анимация вьюмодели (пружина, а не мгновенный сдвиг)
  private readonly recoilPos = new THREE.Vector3();
  private readonly recoilRot = new THREE.Vector3();
  private readonly recoilPosTarget = new THREE.Vector3();
  private readonly recoilRotTarget = new THREE.Vector3();
  /** Отдача камеры: подброс, который потом частично «оседает» обратно. */
  private camRecoilPitch = 0;
  private camRecoilYaw = 0;
  private camRecoilRecover = 0;
  private readonly sway = new THREE.Vector2();

  // ─── прицел и обратная связь
  private crosshair!: THREE.Group;
  private crosshairBars: THREE.Mesh[] = [];
  private hitMarker!: THREE.Group;
  private hitMarkerTimer = 0;
  private killMarker = false;

  // ─── VFX
  private sparks = new ParticlePoolSystem(320);
  private smoke = new ParticlePoolSystem(200);
  private sparkMesh!: THREE.InstancedMesh;
  private smokeMesh!: THREE.InstancedMesh;
  private tracers!: THREE.InstancedMesh;
  private tracerLife: number[] = [];
  private tracerIndex = 0;
  private blasts: Blast[] = [];
  private damageVignette!: VignetteEffect;
  private envMap: THREE.Texture | null = null;

  private rng = mulberry32(20240821);
  private shotsFired = 0;
  private shotsHit = 0;
  private kills = 0;

  private unsubKeys: (() => void) | null = null;
  private unsubButtons: (() => void) | null = null;
  private unsubWheel: (() => void) | null = null;
  private statusTimer = 0;

  private readonly raycaster = new THREE.Raycaster();
  private readonly dummy = new THREE.Object3D();
  private readonly color = new THREE.Color();
  private readonly forward = new THREE.Vector3();
  private readonly right = new THREE.Vector3();
  private readonly tmp = new THREE.Vector3();
  private readonly tmp2 = new THREE.Vector3();
  private readonly rayDir = new THREE.Vector3();
  private readonly muzzleWorld = new THREE.Vector3();
  private readonly downDir = new THREE.Vector3(0, -1, 0);

  async init(ctx: DemoContext): Promise<void> {
    this.ctx = ctx;
    // Модели врагов — те же боты Mixamo, что и у файтинга: файл уже лежит в
    // `public/models`, загрузчик кэширует его по url, и вторая вкладка не
    // стоит ни байта трафика. Анимация к ним НЕ грузится — она в бандле
    // числами (`shooterAnimData.ts`).
    this.models = await Promise.all([
      loadBoxerModel(BOXER_MODELS.x),
      loadBoxerModel(BOXER_MODELS.y),
    ]);
    this.scene.background = new THREE.Color(0x171a20);
    this.scene.fog = new THREE.Fog(0x171a20, 30, 110);

    const sun = new THREE.DirectionalLight(0xffe6c0, 2.2);
    sun.position.set(18, 32, 12);
    sun.castShadow = ctx.tier === 'high';
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -45; sun.shadow.camera.right = 45;
    sun.shadow.camera.top = 45; sun.shadow.camera.bottom = -45;
    this.scene.add(sun, sun.target);
    this.scene.add(new THREE.HemisphereLight(0x8095b8, 0x1a1d22, 1.1));

    // Карта окружения для Standard-материалов (модели врагов, оружие).
    // Без неё металл отражает пустоту и выглядит чёрным пятном, а не
    // металлом. RoomEnvironment генерируется на месте — ни файла, ни запроса.
    if (ctx.tier !== 'low' && ctx.renderer) {
      const pmrem = new THREE.PMREMGenerator(ctx.renderer);
      this.envMap = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      this.scene.environment = this.envMap;
      this.scene.environmentIntensity = 0.35;   // подсветка, а не второе солнце
      pmrem.dispose();
    }

    // Импульсный эффект держим в конвейере ПОСТОЯННО и гоняем opacity:
    // пересборка EffectPass компилирует шейдер и даёт фриз ровно в тот кадр,
    // когда в игрока попали (stack/postprocessing.md §3).
    this.damageVignette = new VignetteEffect({ offset: 0.1, darkness: 1.0 });
    this.damageVignette.blendMode.opacity.value = 0;

    this.buildArena();
    this.buildViewmodel();
    this.buildCrosshair();
    this.buildDecals();
    this.buildVfx();
    this.restart();
  }

  effects(): Effect[] {
    return [this.damageVignette];
  }

  enter(): void {
    this.unsubKeys = this.ctx.input.onKey((code) => {
      switch (code) {
        case 'KeyR': this.startReload(); break;
        case 'KeyG': this.restart(); break;
        case 'Space': this.jumpBuffer = JUMP_BUFFER; break;
        case 'Digit1': this.selectWeapon(0); break;
        case 'Digit2': this.selectWeapon(1); break;
        case 'Digit3': this.selectWeapon(2); break;
        case 'KeyQ': this.selectWeapon((this.pendingIndex + 1) % WEAPONS.length); break;
        default: break;
      }
    });

    // Захват мыши — из САМОГО обработчика нажатия. Вызов из rAF отрабатывает
    // не всегда: браузеру нужна «активация пользователем», и после выхода по
    // Esc запрос, отправленный из кадра, молча отклоняется.
    this.unsubButtons = this.ctx.input.onPointerButton((button) => {
      if (button !== 0) return;
      if (!this.ctx.input.isPointerLocked) { this.ctx.input.requestPointerLock(); return; }
      this.semiQueued = true;
    });

    // Колесо — привычный способ листать стволы в шутере.
    this.unsubWheel = this.ctx.input.onWheel((dir) => {
      const next = (this.weaponIndex + (dir > 0 ? 1 : WEAPONS.length - 1)) % WEAPONS.length;
      this.selectWeapon(next);
    });
  }

  exit(): void {
    this.unsubKeys?.();
    this.unsubButtons?.();
    this.unsubWheel?.();
    this.unsubKeys = null;
    this.unsubButtons = null;
    this.unsubWheel = null;
    this.semiQueued = false;
    this.triggerHeld = false;
  }

  fixedUpdate(dt: number): void {
    this.movePlayer(dt);
    this.updateEnemies(dt);
    this.updateBarrels(dt);
  }

  update(dt: number): void {
    this.aimCamera(dt);
    this.updateWeaponTimers(dt);
    this.handleFiring();
    this.animateViewmodel(dt);
    this.animateEnemies(dt);
    this.updateVfx(dt);

    this.hitMarkerTimer = Math.max(0, this.hitMarkerTimer - dt);
    this.muzzleTimer = Math.max(0, this.muzzleTimer - dt);
    const flashing = this.muzzleTimer > 0;
    this.active.flash.visible = flashing;
    this.muzzleLight.intensity = flashing ? 9 * (this.muzzleTimer / 0.045) : 0;
    if (flashing) {
      // Случайные ролл и масштаб: одинаковая вспышка кадр в кадр читается
      // как статичный спрайт, а не как выстрел.
      this.active.flash.rotation.z = this.rng() * Math.PI;
      this.active.flash.scale.setScalar(0.8 + this.rng() * 0.5);
    }

    this.damageFlash = Math.max(0, this.damageFlash - dt * 1.6);
    this.damageVignette.blendMode.opacity.value = this.damageFlash * 0.85;

    this.statusTimer += dt;
    if (this.statusTimer > 0.1) { this.statusTimer = 0; this.pushStatus(); }
  }

  dispose(): void {
    this.envMap?.dispose();
    // Враги убираются из сцены ДО общего обхода. `SkeletonUtils.clone`
    // отдаёт клон, который делит ГЕОМЕТРИЮ с исходной моделью, а модель
    // лежит в общем кэше загрузчика и нужна другим вкладкам. Обход сцены с
    // `geometry.dispose()` убил бы её для всех, кто загрузит того же бота
    // следующим. `rig.dispose()` освобождает только то, что риг создал сам.
    for (const e of this.enemies) e.rig.dispose();
    this.enemies = [];
    this.drops = [];
    this.arena.geometry.disposeBoundsTree?.();
    // Вьюмодель и прицел висят на КАМЕРЕ: обход одной сцены их не увидит,
    // и три ствола с руками останутся в памяти после закрытия вкладки.
    disposeObject(this.camera as unknown as THREE.Object3D);
    disposeObject(this.scene as unknown as THREE.Object3D);
  }

  private get active(): WeaponRuntime {
    return this.weapons[this.weaponIndex];
  }

  // ────────────────────────────────────────────────────────────── игрок
  private movePlayer(dt: number): void {
    const input = this.ctx.input;
    // Камера смотрит вдоль ЛОКАЛЬНОЙ -Z. При rotation.y = yaw мировой «вперёд»
    // равен (-sin yaw, 0, -cos yaw). Знак здесь и был причиной инверсии W/S.
    this.forward.set(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    this.right.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));

    this.crouching = input.isDown('ControlLeft') || input.isDown('ControlRight') || input.isDown('KeyC');
    this.aiming = input.isButtonDown(2) && !this.busy();
    const move = input.moveVector();
    this.sprinting = (input.isDown('ShiftLeft') || input.isDown('ShiftRight'))
      && !this.aiming && !this.crouching && move.y < -0.1;

    let speed = 7.4 * this.active.spec.moveScale;
    if (this.aiming) speed *= 0.55;
    else if (this.crouching) speed *= 0.5;
    else if (this.sprinting) speed *= 1.5;

    // moveVector: y = -1 на W. Проекция на «вперёд» — со знаком минус.
    this.tmp.set(0, 0, 0)
      .addScaledVector(this.forward, -move.y)
      .addScaledVector(this.right, move.x);
    const wish = this.tmp.lengthSq() > 0 ? this.tmp.normalize() : this.tmp;

    // В воздухе управление ослаблено: полный контроль в прыжке убивает вес.
    const accel = this.grounded ? 60 : 12;
    const friction = this.grounded ? 12 : 0.6;
    this.vel.x += wish.x * accel * dt;
    this.vel.z += wish.z * accel * dt;
    this.vel.x -= this.vel.x * friction * dt;
    this.vel.z -= this.vel.z * friction * dt;

    const planar = Math.hypot(this.vel.x, this.vel.z);
    if (planar > speed) {
      this.vel.x = (this.vel.x / planar) * speed;
      this.vel.z = (this.vel.z / planar) * speed;
    }
    this.moveSpeed = Math.hypot(this.vel.x, this.vel.z);

    // Прыжок: койот-тайм + буфер нажатия. Оба окна нужны, чтобы прыжок
    // ощущался «как задумано», а не «как повезло с кадром».
    this.jumpBuffer = Math.max(0, this.jumpBuffer - dt);
    this.coyote = this.grounded ? COYOTE_TIME : Math.max(0, this.coyote - dt);
    if (this.jumpBuffer > 0 && this.coyote > 0 && !this.crouching) {
      this.vel.y = JUMP_SPEED;
      this.grounded = false;
      this.coyote = 0;
      this.jumpBuffer = 0;
    }

    this.vel.y -= GRAVITY * dt;
    this.pos.x += this.vel.x * dt;
    this.pos.z += this.vel.z * dt;
    this.pos.y += this.vel.y * dt;

    this.resolveHorizontal();

    // Опора: луч вниз по ТОЙ ЖЕ геометрии, что видит игрок. Ящики становятся
    // площадками бесплатно — отдельного «списка платформ» не существует.
    const ground = this.groundHeight();
    if (this.pos.y <= ground + 0.001 && this.vel.y <= 0) {
      this.pos.y = ground;
      this.vel.y = 0;
      this.grounded = true;
    } else {
      this.grounded = false;
    }

    if (this.grounded) this.bob += this.moveSpeed * dt * (this.sprinting ? 1.35 : 1.0);
    this.eyeHeight = THREE.MathUtils.lerp(
      this.eyeHeight, this.crouching ? EYE_CROUCH : EYE_STAND, 1 - Math.exp(-14 * dt),
    );
  }

  /** Идёт перезарядка или смена ствола — прицел и огонь заблокированы. */
  private busy(): boolean {
    return this.reloadTimer > 0 || this.swapTimer > 0;
  }

  /** Выталкивание из ящиков и стен: круг против AABB в плоскости XZ. */
  private resolveHorizontal(): void {
    const limit = ARENA - 1.2 - PLAYER_RADIUS * 0.5;
    this.pos.x = THREE.MathUtils.clamp(this.pos.x, -limit, limit);
    this.pos.z = THREE.MathUtils.clamp(this.pos.z, -limit, limit);

    for (const [cx, cz, w, d, h] of COVERS) {
      // Стоя НА ящике выталкивать нельзя, иначе игрока срывает с крыши.
      if (this.pos.y >= h - 0.05) continue;
      const hx = w / 2 + PLAYER_RADIUS;
      const hz = d / 2 + PLAYER_RADIUS;
      const dx = this.pos.x - cx;
      const dz = this.pos.z - cz;
      if (Math.abs(dx) >= hx || Math.abs(dz) >= hz) continue;
      // Выходим по оси наименьшего проникновения — иначе игрока «телепортит».
      const px = hx - Math.abs(dx);
      const pz = hz - Math.abs(dz);
      if (px < pz) { this.pos.x = cx + Math.sign(dx || 1) * hx; this.vel.x = 0; }
      else { this.pos.z = cz + Math.sign(dz || 1) * hz; this.vel.z = 0; }
    }
  }

  private groundHeight(): number {
    this.raycaster.set(this.tmp.set(this.pos.x, this.pos.y + 2.2, this.pos.z), this.downDir);
    this.raycaster.far = 40;
    (this.raycaster as THREE.Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
    const hit = this.raycaster.intersectObject(this.arena, false)[0];
    return hit ? hit.point.y : 0;
  }

  private aimCamera(dt: number): void {
    const input = this.ctx.input;
    if (input.isPointerLocked) {
      const d = input.consumeLockDelta();
      const sens = this.aiming ? 0.0011 : 0.0022;
      this.yaw -= d.x * sens;
      this.pitch = THREE.MathUtils.clamp(this.pitch - d.y * sens, -1.45, 1.45);
      // Инерция вьюмодели за мышью: оружие догоняет взгляд, а не приклеено к нему.
      this.sway.x = THREE.MathUtils.clamp(this.sway.x - d.x * 0.0006, -0.05, 0.05);
      this.sway.y = THREE.MathUtils.clamp(this.sway.y - d.y * 0.0005, -0.04, 0.04);
    }
    this.sway.multiplyScalar(Math.exp(-8 * dt));

    // Отдача камеры оседает обратно не до нуля СРАЗУ: часть подброса игрок
    // компенсирует сам — так работает контроль отдачи в шутерах.
    //
    // Но сама «осевшая» часть обязана таять. Без этой строки уровень оседания
    // остаётся навсегда: после первой же очереди камера задрана вверх на
    // треть подброса, и обратно её уже ничто не опускает. В кадре это видно
    // как уехавший горизонт и провалившееся под нижний край оружие.
    const recover = 1 - Math.exp(-9 * dt);
    this.camRecoilRecover *= Math.exp(-1.6 * dt);
    this.camRecoilRecover = Math.min(this.camRecoilPitch, this.camRecoilRecover);
    this.camRecoilPitch = THREE.MathUtils.lerp(this.camRecoilPitch, this.camRecoilRecover, recover);
    this.camRecoilYaw = THREE.MathUtils.lerp(this.camRecoilYaw, 0, recover);

    const roll = THREE.MathUtils.clamp(-this.vel.dot(this.right) * 0.004, -0.03, 0.03);
    const bobY = this.grounded ? Math.abs(Math.sin(this.bob * 1.1)) * 0.035 * Math.min(1, this.moveSpeed / 6) : 0;

    this.camera.position.set(this.pos.x, this.pos.y + this.eyeHeight + bobY, this.pos.z);
    this.camera.rotation.set(this.pitch + this.camRecoilPitch, this.yaw + this.camRecoilYaw, roll, 'YXZ');

    const targetFov = this.aiming ? this.active.spec.adsFov : (this.sprinting ? 82 : 75);
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, targetFov, 1 - Math.exp(-12 * dt));
    this.camera.updateProjectionMatrix();
  }

  // ─────────────────────────────────────────────────────────── стрельба
  private handleFiring(): void {
    const input = this.ctx.input;
    const held = input.isButtonDown(0) && input.isPointerLocked;
    const spec = this.active.spec;

    // Полуавтомат читает СОБЫТИЕ нажатия, автомат — удержание. Один и тот же
    // код на `down` дал бы пистолету скорострельность автомата.
    const wantsShot = spec.auto ? held : this.semiQueued;
    this.semiQueued = false;
    this.triggerHeld = held;
    if (!wantsShot) return;

    if (this.busy()) return;
    if (this.fireTimer > 0) return;
    if (this.active.ammo <= 0) {
      this.ctx.audio.playButtonClick();
      this.startReload();
      return;
    }
    if (this.sprinting) return;                 // из бега не стреляют
    this.shoot();
  }

  private shoot(): void {
    const spec = this.active.spec;
    this.active.ammo--;
    this.shotsFired++;
    this.fireTimer = 60 / spec.rpm;
    this.muzzleTimer = 0.045;

    // Отдача: пружина вьюмодели + подброс камеры.
    this.recoilPosTarget.z += spec.viewKick;
    this.recoilPosTarget.y += spec.viewKick * 0.35;
    this.recoilRotTarget.x -= spec.viewKick * 2.6;
    this.recoilRotTarget.y += (this.rng() - 0.5) * 0.06;
    this.camRecoilPitch += spec.recoilPitch * (this.aiming ? 0.7 : 1);
    this.camRecoilYaw += (this.rng() - 0.5) * spec.recoilYaw * 2;
    this.camRecoilRecover = this.camRecoilPitch * 0.35;

    this.spread = Math.min(spec.maxSpread, this.spread + spec.spreadPerShot);
    this.ctx.audio.playGunshot(spec.audioPitch, spec.audioPower);
    this.ctx.addTrauma(spec.trauma);

    this.active.muzzlePoint.getWorldPosition(this.muzzleWorld);
    this.ejectShell();
    this.smoke.emitDirected(
      this.muzzleWorld.x, this.muzzleWorld.y, this.muzzleWorld.z,
      this.forward.x, this.forward.y, this.forward.z, 0.6,
      spec.pellets > 1 ? 3 : 1, 1.9, { r: 0.5, g: 0.49, b: 0.47 },
      { life: 0.3, scale: 0.035, endScale: 2.4, gravity: 0.8, drag: 4.0 },
    );

    const baseSpread = (this.aiming ? spec.adsSpread : spec.hipSpread) + this.spread;
    let hitAny = false;
    let killedAny = false;
    for (let i = 0; i < spec.pellets; i++) {
      const r = this.fireRay(baseSpread, spec, spec.pellets > 1 ? 1 / spec.pellets : 1);
      hitAny = hitAny || r.hit;
      killedAny = killedAny || r.killed;
    }
    if (hitAny) {
      this.shotsHit++;
      this.hitMarkerTimer = 0.14;
      this.killMarker = killedAny;
    }
  }

  /** Один луч (пуля или дробинка). Возвращает, было ли попадание по цели. */
  private fireRay(spreadAngle: number, spec: WeaponSpec, damageScale: number): { hit: boolean; killed: boolean } {
    this.camera.getWorldDirection(this.rayDir);
    // Разброс — конус вокруг направления взгляда, а не сдвиг по двум мировым
    // осям: у зенита второй вариант вырождается и пули уходят вбок.
    this.tmp.set(this.rayDir.z, 0, -this.rayDir.x);
    if (this.tmp.lengthSq() < 1e-6) this.tmp.set(1, 0, 0);
    this.tmp.normalize();
    this.tmp2.copy(this.rayDir).cross(this.tmp).normalize();
    const a = this.rng() * Math.PI * 2;
    const r = Math.tan(spreadAngle) * Math.sqrt(this.rng());
    this.rayDir.addScaledVector(this.tmp, Math.cos(a) * r).addScaledVector(this.tmp2, Math.sin(a) * r).normalize();

    const origin = this.camera.position;

    // 1. Враги: отрезок против сфер зон урона — дешевле мешей и даёт
    //    стабильные хедшоты (shooter_enemy_ai_and_combat.md §1).
    const enemyHit = this.castAgainstEnemies(origin);
    // 2. Геометрия уровня: three-mesh-bvh по слитому мешу.
    this.raycaster.set(origin, this.rayDir);
    this.raycaster.far = spec.range;
    (this.raycaster as THREE.Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
    const levelHit = this.raycaster.intersectObject(this.arena, false)[0];
    const barrelHit = this.castAgainstBarrels(origin);

    const enemyDist = enemyHit ? enemyHit.dist : Infinity;
    const barrelDist = barrelHit ? barrelHit.dist : Infinity;
    const levelDist = levelHit ? levelHit.distance : Infinity;
    const nearest = Math.min(enemyDist, barrelDist, levelDist);
    if (!Number.isFinite(nearest)) {
      this.tmp.copy(origin).addScaledVector(this.rayDir, spec.range);
      this.spawnTracer(this.muzzleWorld, this.tmp, spec.tracerColor);
      return { hit: false, killed: false };
    }
    this.tmp2.copy(origin).addScaledVector(this.rayDir, nearest);
    this.spawnTracer(this.muzzleWorld, this.tmp2, spec.tracerColor);

    if (barrelDist === nearest && barrelHit) {
      barrelHit.barrel.hp -= spec.damage * damageScale * 1.5;
      this.sparks.emitDirected(
        this.tmp2.x, this.tmp2.y, this.tmp2.z,
        -this.rayDir.x, -this.rayDir.y, -this.rayDir.z, 0.8,
        5, 4, { r: 1.0, g: 0.75, b: 0.25 }, { life: 0.22, scale: 0.08, drag: 2.4 },
      );
      if (barrelHit.barrel.hp <= 0 && barrelHit.barrel.fuse <= 0) barrelHit.barrel.fuse = 0.001;
      return { hit: true, killed: false };
    }

    if (enemyDist === nearest && enemyHit) {
      const e = enemyHit.enemy;
      const mult = enemyHit.zone === 'head' ? spec.headMult : enemyHit.zone === 'limb' ? spec.limbMult : 1;
      e.hp -= spec.damage * mult * damageScale;
      e.flash = 1;
      // Тело отыгрывает попадание: без реакции пули «проходят насквозь», и
      // игрок не понимает, попал он или промахнулся мимо капсулы.
      triggerHit(e.anim, enemyHit.zone);
      this.spawnBlood(this.tmp2, this.rayDir, enemyHit.zone === 'head' ? 16 : 9, 'hit');
      this.ctx.audio.playCoinPickup();
      const killed = e.hp <= 0;
      // Импульс — вдоль пули: труп должен отлетать от выстрела, а не оседать
      // вертикально там, где стоял. Дробь бьёт сильнее одиночной пули.
      if (killed) {
        this.tmp.copy(this.rayDir).multiplyScalar(spec.pellets > 1 ? 6.5 : 4.2);
        this.killEnemy(e, this.tmp, enemyHit.zone);
      }
      return { hit: true, killed };
    }

    if (levelHit?.face) {
      const n = this.tmp.copy(levelHit.face.normal);
      this.placeDecal(this.tmp2, n);
      this.sparks.emitDirected(
        this.tmp2.x, this.tmp2.y, this.tmp2.z, n.x, n.y, n.z, 0.75,
        4, 3.2, { r: 1.0, g: 0.86, b: 0.5 }, { life: 0.2, scale: 0.06, drag: 3.0 },
      );
      this.smoke.emitDirected(
        this.tmp2.x, this.tmp2.y, this.tmp2.z, n.x, n.y, n.z, 0.9,
        2, 0.9, { r: 0.55, g: 0.53, b: 0.5 },
        { life: 0.4, scale: 0.09, endScale: 2.6, gravity: 0.5, drag: 3.0 },
      );
    }
    return { hit: false, killed: false };
  }

  private castAgainstEnemies(origin: THREE.Vector3): { enemy: Enemy; dist: number; zone: 'head' | 'body' | 'limb' } | null {
    let best: { enemy: Enemy; dist: number; zone: 'head' | 'body' | 'limb' } | null = null;
    for (const e of this.enemies) {
      if (e.state === 'dead') continue;
      // Три сферы вместо геометрии модели: точность по мешу не читается
      // игроком и стоит дорого.
      for (const z of ZONES) {
        this.tmp.set(e.pos.x, e.pos.y + z.y, e.pos.z);
        const d = raySphere(origin, this.rayDir, this.tmp, z.r);
        if (d !== null && d > 0 && (!best || d < best.dist)) best = { enemy: e, dist: d, zone: z.zone };
      }
    }
    return best;
  }

  private castAgainstBarrels(origin: THREE.Vector3): { barrel: Barrel; dist: number } | null {
    let best: { barrel: Barrel; dist: number } | null = null;
    for (const b of this.barrels) {
      if (b.exploded) continue;
      this.tmp.set(b.pos.x, b.pos.y + 0.6, b.pos.z);
      const d = raySphere(origin, this.rayDir, this.tmp, 0.62);
      if (d !== null && d > 0 && (!best || d < best.dist)) best = { barrel: b, dist: d };
    }
    return best;
  }

  private startReload(): void {
    const w = this.active;
    if (this.busy()) return;
    if (w.ammo >= w.spec.mag || w.reserve <= 0) return;
    this.reloadTotal = w.spec.reloadTime;
    this.reloadTimer = w.spec.reloadTime;
    this.action = 'reload';
    this.ctx.audio.playButtonClick();
  }

  private selectWeapon(index: number): void {
    if (this.busy()) return;
    if (index === this.weaponIndex) return;
    this.pendingIndex = index;
    this.swapTimer = 0.45;
    this.action = 'swap';
    this.ctx.audio.playButtonClick();
  }

  private updateWeaponTimers(dt: number): void {
    const spec = this.active.spec;
    this.fireTimer = Math.max(0, this.fireTimer - dt);
    this.spread = Math.max(0, this.spread - spec.spreadDecay * dt * (this.triggerHeld ? 0.4 : 1.6));

    if (this.swapTimer > 0) {
      const before = this.swapTimer;
      this.swapTimer = Math.max(0, this.swapTimer - dt);
      // Смена ствола в СЕРЕДИНЕ анимации: рука уже внизу, подмена не видна.
      if (before > 0.225 && this.swapTimer <= 0.225) {
        this.weapons[this.weaponIndex].group.visible = false;
        this.weaponIndex = this.pendingIndex;
        this.weapons[this.weaponIndex].group.visible = true;
        this.spread = 0;
      }
      if (this.swapTimer === 0) this.action = 'idle';
      return;
    }

    if (this.reloadTimer > 0) {
      this.reloadTimer = Math.max(0, this.reloadTimer - dt);
      if (this.reloadTimer === 0) {
        const w = this.active;
        const need = Math.min(w.spec.mag - w.ammo, w.reserve);
        w.ammo += need;
        w.reserve -= need;
        this.action = 'idle';
        this.ctx.audio.playCoinPickup();
      }
    }
  }

  // ───────────────────────────────────────────────────────────── враги
  private updateEnemies(dt: number): void {
    for (const d of this.drops) d.step(dt, this.propFloor(d.object.position));

    let tokens = ATTACK_TOKENS;
    for (const e of this.enemies) {
      e.prev.copy(e.pos);
      e.muzzleTimer = Math.max(0, e.muzzleTimer - dt);

      if (e.state === 'dead') {
        // Тело лежит ограниченное время: семь скиненных трупов на арене — это
        // семь скелетов, которые продолжают считаться каждый кадр.
        e.corpseTime -= dt;
        if (e.corpseTime <= 0) { e.rig.root.visible = false; continue; }
        // Рэгдолл живёт в фиксированном шаге: у верле шаг зашит в саму
        // формулу, и переменный dt менял бы жёсткость связок от кадра к кадру.
        if (e.ragdoll) e.ragdoll.step(dt);
        else this.driveAnim(e, dt);
        continue;
      }
      e.stateTime += dt;
      e.cooldown = Math.max(0, e.cooldown - dt);

      const eye = this.tmp2.set(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z);
      const dist = Math.hypot(eye.x - e.pos.x, eye.z - e.pos.z);
      const canSee = dist < 42 && this.hasLineOfSight(e.pos, eye);

      switch (e.state) {
        case 'idle':
          if (canSee) { e.state = 'alert'; e.stateTime = 0; e.reaction = 0.25 + this.rng() * 0.35; }
          break;

        case 'alert':
          // Задержка реакции: мгновенный ответ выглядит как читерство.
          if (!canSee) { e.state = 'idle'; break; }
          if (e.stateTime >= e.reaction) { e.state = 'engage'; e.stateTime = 0; e.burstLeft = 0; }
          break;

        case 'engage': {
          if (!canSee) { e.state = 'idle'; break; }
          // Токены атаки: одновременно стреляют 2-3 врага, остальные маневрируют.
          if (!e.hasToken && tokens > 0) { e.hasToken = true; tokens--; }
          else if (!e.hasToken) { this.strafe(e, dt); break; }

          if (dist > 18) this.moveTowards(e, dt, 3.4);
          else if (dist < 7) this.moveTowards(e, dt, -2.6);
          else this.strafe(e, dt);

          if (e.burstLeft > 0) {
            e.burstTimer -= dt;
            if (e.burstTimer <= 0) { this.enemyShoot(e); e.burstTimer = 0.12; e.burstLeft--; }
          } else if (e.cooldown <= 0) {
            e.burstLeft = 3 + Math.floor(this.rng() * 3);   // очередь 3-5
            e.burstTimer = 0;
            e.cooldown = 0.9 + this.rng() * 0.7;            // пауза между очередями
          }
          break;
        }

        default:
          break;
      }

      if (e.state !== 'engage' && e.hasToken) { e.hasToken = false; tokens++; }

      // Курс, на который наводится ОРУЖИЕ. Разворот самого тела считается
      // из него в `animateEnemies` — со сдвигом на бладированную стойку.
      e.yaw = Math.atan2(this.pos.x - e.pos.x, this.pos.z - e.pos.z);
      this.driveAnim(e, dt);
    }
  }

  /**
   * Скормить анимации фактическое перемещение врага.
   *
   * Скорость берётся из РАЗНИЦЫ позиций, а не из намерения ИИ: враг,
   * упёршийся в ящик, обязан перестать перебирать ногами. Направление
   * раскладывается на «вперёд» и «вбок» относительно взгляда — по нему
   * выбирается цикл: бег, приставной шаг или отход спиной.
   */
  private driveAnim(e: Enemy, dt: number): void {
    const dx = e.pos.x - e.prev.x;
    const dz = e.pos.z - e.prev.z;
    const moved = Math.hypot(dx, dz);
    const speed = dt > 0 ? moved / dt : 0;
    let forward = 1;
    let side = 0;
    if (moved > 1e-5) {
      // Раскладка идёт по развороту ТЕЛА: враг стоит боком к цели, и от
      // курса оружия «вперёд» и «вбок» разошлись бы на полста градусов —
      // бегущий на игрока выбирал бы приставной шаг.
      const bodyYaw = e.yaw - e.rig.aimYawOffset;
      const fx = Math.sin(bodyYaw);
      const fz = Math.cos(bodyYaw);
      forward = (dx * fx + dz * fz) / moved;
      side = Math.abs((dx * fz - dz * fx) / moved);
    }
    updateShooterAnim(e.anim, dt, { speed, forward, side });
  }

  private enemyShoot(e: Enemy): void {
    this.ctx.audio.playLaser();
    e.muzzleTimer = 0.06;
    triggerFire(e.anim);
    // Первая очередь по новой цели намеренно мимо: это сигнал «в тебя стреляют»
    // до потери здоровья (§3 документа).
    if (!e.firstBurstDone) { e.firstBurstDone = true; return; }
    if (this.rng() > 0.45) return;               // враги не снайперы
    this.applyDamage(4);
  }

  private applyDamage(amount: number): void {
    this.hp = Math.max(0, this.hp - amount);
    this.damageFlash = Math.min(1, this.damageFlash + amount * 0.06);
    this.ctx.addTrauma(Math.min(0.4, amount * 0.03));
    if (this.hp === 0) this.restart();
  }

  private moveTowards(e: Enemy, dt: number, speed: number): void {
    const dx = this.pos.x - e.pos.x;
    const dz = this.pos.z - e.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    e.pos.x = THREE.MathUtils.clamp(e.pos.x + (dx / len) * speed * dt, -ARENA + 2, ARENA - 2);
    e.pos.z = THREE.MathUtils.clamp(e.pos.z + (dz / len) * speed * dt, -ARENA + 2, ARENA - 2);
  }

  private strafe(e: Enemy, dt: number): void {
    const dx = this.pos.x - e.pos.x;
    const dz = this.pos.z - e.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    const side = Math.sin(e.stateTime * 0.9) * 3.2;
    e.pos.x = THREE.MathUtils.clamp(e.pos.x + (dz / len) * side * dt, -ARENA + 2, ARENA - 2);
    e.pos.z = THREE.MathUtils.clamp(e.pos.z - (dx / len) * side * dt, -ARENA + 2, ARENA - 2);
  }

  /**
   * Высота поверхности под точкой: пол или крыша ящика.
   *
   * Лучом это считать не нужно — укрытия и так лежат списком AABB, а
   * выпавшему стволу от честного рейкаста ничего не прибавится.
   */
  private propFloor(p: THREE.Vector3): number {
    let y = 0;
    for (const s of this.solids) {
      if (Math.abs(p.x - s.x) > s.w / 2 || Math.abs(p.z - s.z) > s.d / 2) continue;
      if (s.h > y && p.y > s.h - 0.4) y = s.h;
    }
    return y;
  }

  private hasLineOfSight(from: THREE.Vector3, to: THREE.Vector3): boolean {
    this.rayDir.set(to.x - from.x, to.y - (from.y + 1.35), to.z - from.z);
    const dist = this.rayDir.length();
    if (dist < 0.01) return true;
    this.rayDir.divideScalar(dist);
    this.raycaster.set(this.tmp.set(from.x, from.y + 1.35, from.z), this.rayDir);
    this.raycaster.far = dist;
    (this.raycaster as THREE.Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
    const hit = this.raycaster.intersectObject(this.arena, false)[0];
    return !hit || hit.distance > dist - 0.5;
  }

  /**
   * @param impulse направление и сила последнего попадания, м/с. Из неё
   *   рэгдолл берёт стартовую скорость: тело падает ОТ выстрела, а не вниз.
   */
  private killEnemy(e: Enemy, impulse: THREE.Vector3, zone: 'head' | 'body' | 'limb' = 'body'): void {
    if (e.state === 'dead') return;
    e.state = 'dead';
    e.hasToken = false;
    e.corpseTime = CORPSE_TIME;

    // Труп — тряпичная кукла, а не запечённое падение. Мокапный клип падает
    // всегда одинаково и всегда на ровный пол; рэгдолл сваливается с ящика,
    // упирается в стену и разворачивается по тому выстрелу, который убил.
    // На низком тире падение остаётся запечённым клипом: рэгдолл дешёвый,
    // но он снимает отсечение по фрустуму и трогает матрицы всего скелета
    // каждый кадр у каждого тела.
    if (this.ctx.tier === 'low') {
      triggerDeath(e.anim);
    } else {
      e.ragdoll = new ShooterRagdoll(e.rig, {
        impulse, zone, solids: this.solids, bounds: ARENA,
      });
    }
    // Оружие выпадает из рук: приваренная к ладони винтовка убивает всё
    // впечатление от падения.
    const dropped = e.rig.dropRifle();
    if (dropped) {
      this.scene.add(dropped);
      this.drops.push(new DroppedProp(dropped, impulse, this.rng));
    }
    this.kills++;
    this.ctx.audio.playExplosion(0.22);
    this.spawnBlood(this.tmp.set(e.pos.x, e.pos.y + 1.1, e.pos.z), UP_AXIS, 20, 'kill');
  }

  /**
   * Разложить процедурную позу по ригам и доставить «живые» мелочи:
   * вспышку от попадания, доворот головы на игрока, вспышку у дула.
   */
  private animateEnemies(dt: number): void {
    this.enemyFlash.visible = false;
    for (const e of this.enemies) {
      if (!e.rig.root.visible) continue;
      const rig = e.rig;
      if (e.flash > 0) {
        e.flash = Math.max(0, e.flash - dt * 9);
        rig.setFlash(e.flash * 0.9);
      }

      // Голова довернута на игрока — но только пока враг видит его и жив.
      if (e.state !== 'dead') {
        const dx = this.pos.x - e.pos.x;
        const dz = this.pos.z - e.pos.z;
        const flat = Math.hypot(dx, dz);
        const want = Math.atan2(dx, dz) - e.yaw;
        e.anim.headYaw = THREE.MathUtils.clamp(wrapAngle(want), -0.7, 0.7);
        e.anim.headPitch = -THREE.MathUtils.clamp(
          Math.atan2(this.pos.y + this.eyeHeight - (e.pos.y + 1.55), Math.max(0.5, flat)), -0.5, 0.5,
        );
      }

      if (e.ragdoll) {
        // У трупа своя поза целиком: `root` остаётся там, где враг умер, а
        // куда уехало тело, знают только точки рэгдолла.
        e.ragdoll.apply(rig);
        continue;
      }

      e.rig.root.position.copy(e.pos);
      // Тело развёрнуто НЕ на игрока, а на курс минус бладирование стойки:
      // в этом развороте ствол смотрит на цель (`ShooterRig.aimYawOffset`).
      // Не весь угол уходит в разворот тела: четверть остаётся доворотом
      // груди. Целиком в корпус — и враг стоит к игроку почти спиной.
      e.rig.root.rotation.y = e.yaw - rig.aimYawOffset * 0.75;
      poseShooter(e.anim, rig);
      // Остаток наводки — доворотом груди: цель бывает выше или ниже, руки
      // качаются в цикле бега, реакция на попадание уводит корпус.
      this.tmp.set(this.pos.x, this.pos.y + this.eyeHeight * 0.9, this.pos.z);
      aimShooterAt(rig, this.tmp, e.state === 'engage' ? 0.6 : 0.35);

      if (e.muzzleTimer > 0 && rig.muzzle) {
        // Вспышка врага живёт В МИРЕ, а не на его оружии: один инстансный
        // пул на всех дешевле семи плоскостей с аддитивным материалом.
        rig.muzzle.getWorldPosition(this.tmp);
        this.enemyFlash.position.copy(this.tmp);
        this.enemyFlash.visible = true;
        this.enemyFlash.quaternion.copy(this.camera.quaternion);
        this.enemyFlash.scale.setScalar(0.8 + this.rng() * 0.5);
      }
    }
  }

  // ──────────────────────────────────────────────────────── цепные взрывы
  private updateBarrels(dt: number): void {
    for (const b of this.barrels) {
      if (b.exploded || b.fuse <= 0) continue;
      // Таймер живёт в фиксированном шаге, а не в setTimeout: setTimeout не
      // знает про паузу, hit-stop и смену вкладки.
      b.fuse += dt;
      const t = Math.min(1, b.fuse / 0.12);
      b.mesh.scale.setScalar(1 + t * 0.25);
      (b.mesh.material as THREE.MeshLambertMaterial).emissive.setScalar(t * 0.9);
      if (b.fuse < 0.12) continue;
      this.explode(b);
    }
  }

  private explode(b: Barrel): void {
    b.exploded = true;
    b.mesh.visible = false;
    this.ctx.audio.playExplosion(1);
    this.ctx.addTrauma(0.5);
    this.spawnBlast(b.pos);

    const R = 7;
    for (const e of this.enemies) {
      if (e.state === 'dead') continue;
      const d = e.pos.distanceTo(b.pos);
      if (d > R) continue;
      // Квадратичный спад: иначе взрывы либо бесполезны, либо всесильны.
      e.hp -= 160 * (1 - d / R) ** 2;
      e.flash = 1;
      triggerHit(e.anim, 'body');
      // Взрыв бросает тело ОТ бочки, и тем сильнее, чем ближе оно было.
      if (e.hp <= 0) {
        this.tmp.set(e.pos.x - b.pos.x, 0.9, e.pos.z - b.pos.z).normalize()
          .multiplyScalar(4 + 7 * (1 - d / R));
        this.killEnemy(e, this.tmp, 'body');
      }
    }
    for (const other of this.barrels) {
      if (other.exploded || other.fuse > 0) continue;
      if (other.pos.distanceTo(b.pos) <= R) other.fuse = 0.001;   // волна, а не один кадр
    }
    this.tmp.set(this.pos.x, this.pos.y + this.eyeHeight, this.pos.z);
    const dp = this.tmp.distanceTo(b.pos);
    if (dp <= R) this.applyDamage(60 * (1 - dp / R) ** 2);
  }

  private spawnBlast(pos: THREE.Vector3): void {
    const blast = this.blasts.find((x) => !x.active) ?? this.blasts[0];
    blast.active = true;
    blast.time = 0;
    blast.core.position.set(pos.x, pos.y + 0.8, pos.z);
    blast.ring.position.set(pos.x, pos.y + 0.15, pos.z);
    blast.light.position.set(pos.x, pos.y + 1.2, pos.z);
    blast.core.visible = true;
    blast.ring.visible = true;

    this.sparks.emitDirected(
      pos.x, pos.y + 0.6, pos.z, 0, 1, 0, 1.35,
      48, 11, { r: 1.0, g: 0.62, b: 0.16 }, { life: 0.7, scale: 0.16, gravity: -12, drag: 1.1 },
    );
    this.smoke.emitDirected(
      pos.x, pos.y + 0.8, pos.z, 0, 1, 0, 1.2,
      22, 3.2, { r: 0.28, g: 0.26, b: 0.25 },
      { life: 1.4, scale: 0.5, endScale: 3.4, gravity: 1.4, drag: 1.8 },
    );
  }

  // ─────────────────────────────────────────────────────────────── сцена
  private buildArena(): void {
    const parts: THREE.BufferGeometry[] = [];
    const floor = new THREE.BoxGeometry(ARENA * 2, 1, ARENA * 2);
    floor.translate(0, -0.5, 0);
    parts.push(floor);

    for (const [x, z, w, d, h] of COVERS) {
      const box = new THREE.BoxGeometry(w, h, d);
      box.translate(x, h / 2, z);
      parts.push(box);
    }
    for (const [sx, sz] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const wall = new THREE.BoxGeometry(sx ? 1 : ARENA * 2, 6, sz ? 1 : ARENA * 2);
      wall.translate(sx * ARENA, 3, sz * ARENA);
      parts.push(wall);
    }

    const merged = BufferGeometryUtils.mergeGeometries(parts, false)!;
    parts.forEach((p) => p.dispose());
    merged.computeVertexNormals();
    // Коллизия, опора под ногами и прицеливание — из ТЕХ ЖЕ буферов, что и
    // видимая геометрия. BVH ускоряет обычный THREE.Raycaster.
    merged.computeBoundsTree({ targetLeafSize: 10 });

    this.arena = new THREE.Mesh(merged, new THREE.MeshLambertMaterial({ color: 0x4b5563 }));
    this.arena.receiveShadow = true;
    this.arena.castShadow = true;
    this.scene.add(this.arena);
  }

  // ────────────────────────────────────────────────────────── вьюмодель
  private buildViewmodel(): void {
    this.viewmodel = new THREE.Group();
    for (const spec of WEAPONS) {
      const rt = this.buildWeapon(spec);
      rt.group.visible = false;
      this.viewmodel.add(rt.group);
      this.weapons.push(rt);
    }
    this.weapons[this.weaponIndex].group.visible = true;

    // Свет вспышки живёт ОДИН на все стволы и переставляется к активному дулу:
    // три PointLight в сцене — три бюджета освещения ради одного кадра.
    this.muzzleLight = new THREE.PointLight(0xffcf7a, 0, 9, 2);
    this.muzzleLight.position.set(0.18, -0.05, -0.7);
    this.viewmodel.add(this.muzzleLight);

    // Масштаб и вынос подобраны под FOV 75: при z ближе -0.4 ствол занимает
    // половину кадра, а дальше -1.0 начинает входить в стены (радиус игрока).
    this.viewmodel.scale.setScalar(0.62);
    this.camera.add(this.viewmodel);
    this.scene.add(this.camera);
  }

  private buildWeapon(spec: WeaponSpec): WeaponRuntime {
    const group = new THREE.Group();
    // Standard, а не Lambert: у оружия половина читаемости — в бликах на
    // затворе и на стволе. Ламберт даёт плоское пятно, и любая деталь,
    // добавленная сверху, пропадает.
    // metalness ≤ 0.4 намеренно: чистый металл БЕЗ карты окружения
    // рендерится чёрным силуэтом — отражать ему нечего. Среда сцены есть
    // (`scene.environment`), но на неё одну полагаться нельзя: на низком
    // тире её отключают, и оружие не должно превращаться в дыру в кадре.
    const metal = new THREE.MeshStandardMaterial({ color: 0x5b636e, roughness: 0.38, metalness: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.55, metalness: 0.3 });
    const polymer = new THREE.MeshStandardMaterial({ color: 0x33373d, roughness: 0.86, metalness: 0.05 });
    const wood = new THREE.MeshStandardMaterial({ color: 0x6d4526, roughness: 0.8, metalness: 0.02 });
    const brass = new THREE.MeshStandardMaterial({ color: 0xc99b45, roughness: 0.42, metalness: 0.45 });

    const add = (
      geo: THREE.BufferGeometry, mat: THREE.Material,
      x: number, y: number, z: number, rx = 0, ry = 0, rz = 0,
    ): THREE.Mesh => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x, y, z);
      m.rotation.set(rx, ry, rz);
      group.add(m);
      return m;
    };
    const box = (w: number, h: number, d: number): THREE.BoxGeometry => new THREE.BoxGeometry(w, h, d);
    const tube = (r: number, len: number, seg = 10): THREE.CylinderGeometry =>
      new THREE.CylinderGeometry(r, r, len, seg);
    /** Насечки: ряд тонких рёбер. Без них затвор — просто параллелепипед. */
    const serrations = (
      count: number, mat: THREE.Material, w: number, h: number,
      x: number, y: number, z0: number, step: number,
    ): void => {
      for (let i = 0; i < count; i++) add(box(w, h, 0.006), mat, x, y, z0 + i * step);
    };

    let muzzleY = 0.015;
    let muzzleZ = -0.3;
    let gripAt = new THREE.Vector3(0, -0.08, 0.03);
    let foreAt = new THREE.Vector3(0, -0.02, -0.22);
    let moving: THREE.Object3D | null = null;

    if (spec.id === 'pistol') {
      // Затвор с насечками, рамка, спусковая скоба, целик и мушка.
      add(box(0.05, 0.062, 0.235), metal, 0, 0.028, -0.10);
      serrations(6, dark, 0.052, 0.05, 0, 0.028, -0.005, 0.011);
      add(box(0.046, 0.03, 0.20), polymer, 0, -0.012, -0.10);
      add(tube(0.011, 0.05, 8), dark, 0, 0.028, -0.235, Math.PI / 2);
      // Окно выброса гильз — справа, там же, откуда вылетает гильза.
      add(box(0.004, 0.026, 0.05), dark, 0.026, 0.034, -0.05);
      add(box(0.008, 0.012, 0.01), dark, 0, 0.062, -0.20);        // мушка
      add(box(0.02, 0.012, 0.012), dark, 0, 0.062, -0.005);       // целик
      add(box(0.03, 0.008, 0.055), polymer, 0, -0.036, -0.045);   // скоба, низ
      add(box(0.008, 0.03, 0.008), polymer, 0, -0.024, -0.07);    // скоба, перед
      add(box(0.012, 0.022, 0.008), dark, 0, -0.028, -0.028);     // спуск
      moving = add(box(0.04, 0.115, 0.048), polymer, 0, -0.078, 0.006, 0.22);
      for (let i = 0; i < 4; i++) add(box(0.042, 0.006, 0.05), dark, 0, -0.04 - i * 0.02, 0.011, 0.22);
      add(box(0.044, 0.012, 0.052), metal, 0, -0.132, 0.017, 0.22);  // пятка магазина
      muzzleZ = -0.265;
      muzzleY = 0.028;
      // Хват — сбоку-снизу от рамки: кисть, наведённая в осевую линию
      // ствола, оказывается ВНУТРИ него и не видна вовсе. Поддерживающая
      // рука кладётся на ЛЕВЫЙ борт — при развале оружия (см.
      // `animateViewmodel`) камере повёрнут именно он.
      gripAt = new THREE.Vector3(0.026, -0.086, 0.016);
      foreAt = new THREE.Vector3(-0.052, -0.048, -0.03);
    } else if (spec.id === 'rifle') {
      // Ствольная коробка + планка + цевьё с рёбрами + дульный тормоз.
      add(box(0.062, 0.088, 0.36), metal, 0, 0.006, -0.11);
      add(box(0.07, 0.014, 0.30), dark, 0, 0.054, -0.13);            // планка
      for (let i = 0; i < 9; i++) add(box(0.072, 0.006, 0.008), metal, 0, 0.062, -0.26 + i * 0.032);
      add(tube(0.013, 0.28, 8), dark, 0, 0.012, -0.40, Math.PI / 2);
      add(box(0.05, 0.05, 0.19), polymer, 0, 0.002, -0.33);          // цевьё
      for (let i = 0; i < 5; i++) add(box(0.054, 0.008, 0.01), dark, 0, -0.022, -0.40 + i * 0.036);
      // Дульный тормоз с прорезями: силуэт «дула» на кадре вспышки.
      add(tube(0.021, 0.075, 8), metal, 0, 0.012, -0.545, Math.PI / 2);
      add(box(0.044, 0.006, 0.03), dark, 0, 0.012, -0.545);
      add(box(0.006, 0.044, 0.03), dark, 0, 0.012, -0.545);
      // Магазин: два сегмента под углом — прямой «кирпич» выдаёт коробку.
      moving = new THREE.Group();
      const mag1 = new THREE.Mesh(box(0.04, 0.10, 0.072), polymer);
      mag1.position.set(0, -0.062, -0.052);
      mag1.rotation.x = 0.12;
      const mag2 = new THREE.Mesh(box(0.04, 0.085, 0.07), polymer);
      mag2.position.set(0, -0.142, -0.03);
      mag2.rotation.x = 0.34;
      const round = new THREE.Mesh(tube(0.008, 0.03, 6), brass);
      round.position.set(0, -0.012, -0.055);
      round.rotation.x = Math.PI / 2;
      moving.add(mag1, mag2, round);
      group.add(moving);
      add(box(0.04, 0.115, 0.05), polymer, 0, -0.072, 0.062, -0.32);  // рукоять
      add(box(0.03, 0.008, 0.06), polymer, 0, -0.03, -0.006);         // скоба
      add(box(0.011, 0.02, 0.008), dark, 0, -0.026, 0.012);           // спуск
      add(box(0.044, 0.075, 0.17), polymer, 0, 0.004, 0.20);          // приклад
      add(box(0.05, 0.09, 0.028), dark, 0, 0.004, 0.295);             // затыльник
      add(box(0.03, 0.03, 0.10), dark, 0, 0.05, 0.16);                // щека
      add(box(0.012, 0.03, 0.026), dark, 0.03, 0.03, -0.01, 0, 0, 0.4); // рукоять затвора
      add(box(0.01, 0.026, 0.01), dark, 0, 0.078, -0.42);             // мушка
      add(box(0.024, 0.02, 0.012), dark, 0, 0.074, -0.02);            // целик
      muzzleZ = -0.585;
      muzzleY = 0.012;
      gripAt = new THREE.Vector3(0.03, -0.088, 0.05);
      foreAt = new THREE.Vector3(-0.055, -0.036, -0.32);
    } else {
      // Помповый: ствол с кожухом, трубчатый магазин, деревянные цевьё и приклад.
      add(box(0.068, 0.09, 0.30), metal, 0, 0, -0.05);
      add(tube(0.021, 0.32, 10), dark, 0, 0.034, -0.36, Math.PI / 2);
      // Кожух ствола — три кольца: чистая труба читается как палка.
      for (let i = 0; i < 3; i++) add(new THREE.TorusGeometry(0.027, 0.005, 6, 12), metal, 0, 0.034, -0.26 - i * 0.09);
      add(tube(0.016, 0.28, 8), metal, 0, -0.032, -0.34, Math.PI / 2);   // подствольный магазин
      moving = new THREE.Group();
      const pump = new THREE.Mesh(box(0.062, 0.062, 0.14), wood);
      pump.position.set(0, -0.032, -0.28);
      moving.add(pump);
      for (let i = 0; i < 4; i++) {
        const rib = new THREE.Mesh(box(0.066, 0.008, 0.012), dark);
        rib.position.set(0, -0.062, -0.33 + i * 0.033);
        moving.add(rib);
      }
      group.add(moving);
      add(box(0.038, 0.10, 0.048), polymer, 0, -0.068, 0.055, -0.30);   // рукоять
      add(box(0.028, 0.008, 0.056), metal, 0, -0.028, 0.0);             // скоба
      add(box(0.011, 0.02, 0.008), dark, 0, -0.024, 0.02);              // спуск
      add(box(0.05, 0.10, 0.22), wood, 0, -0.012, 0.22, -0.07);         // приклад
      add(box(0.052, 0.105, 0.024), dark, 0, -0.026, 0.335, -0.07);     // затыльник
      add(new THREE.SphereGeometry(0.008, 6, 5), brass, 0, 0.058, -0.50);  // бусина-мушка
      // Патроны на боку ствольной коробки — деталь, по которой узнаётся дробовик.
      for (let i = 0; i < 4; i++) add(tube(0.011, 0.05, 6), brass, -0.04, -0.018, -0.12 + i * 0.05, 0, 0, Math.PI / 2);
      muzzleY = 0.034;
      muzzleZ = -0.525;
      gripAt = new THREE.Vector3(0.03, -0.082, 0.055);
      foreAt = new THREE.Vector3(-0.058, -0.042, -0.28);
    }

    // Руки. Плечи РАЗНЕСЕНЫ по краям кадра: правая рука, выходящая из-под
    // самого ствола, полностью прячется в его геометрии — именно так
    // «пропадала» вторая рука.
    const armRight = this.buildArm(new THREE.Vector3(0.25, -0.50, 0.38), gripAt, 'trigger');
    const armLeft = this.buildArm(new THREE.Vector3(-0.27, -0.44, 0.14), foreAt, 'support');
    group.add(armRight, armLeft);

    const muzzlePoint = new THREE.Object3D();
    muzzlePoint.position.set(0, muzzleY, muzzleZ);
    group.add(muzzlePoint);

    // Вспышка — плоскость с аддитивным материалом: плашка-«звезда» читается
    // лучше сферы и стоит два треугольника.
    const flash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.24, 0.24),
      new THREE.MeshBasicMaterial({
        color: 0xffd98a, transparent: true, opacity: 0.95,
        blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
      }),
    );
    flash.position.set(0, muzzleY, muzzleZ - 0.04);
    flash.visible = false;
    group.add(flash);

    return {
      spec, ammo: spec.mag, reserve: spec.reserve, group, muzzlePoint, flash,
      armLeft, armRight, movingPart: moving,
      movingHome: moving ? moving.position.clone() : new THREE.Vector3(),
    };
  }

  /**
   * Рука как отрезок «плечо → кисть».
   *
   * Два узла, а не один, и это принципиально:
   *
   *   pivot (в плече, ЕГО крутит анимация)  →  aim (наводка на хват)  →  сегменты
   *
   * Наводка живёт в отдельном узле, потому что она задана `lookAt`, то есть
   * кватернионом. Анимация перезарядки, которая «возвращает руку в покой»
   * через `rotation.x = lerp(rotation.x, 0, k)`, читает Эйлер этого самого
   * кватерниона и гасит его — вместе с наводкой. Рука уезжает от оружия
   * куда-то за камеру, и в кадре остаётся ровно одна кисть. Это и была
   * «пропавшая вторая рука»: она не отсутствовала, она отворачивалась.
   *
   * Ось наводки — +Z: `Object3D.lookAt` разворачивает к цели ПЛЮС Z (минус
   * Z — только у камер и источников света).
   *
   * Кисть собирается из фаланг, а не из одного бруска: пальцы, обхватившие
   * рукоять, — это то, чем «рука на оружии» отличается от «бруска рядом с
   * оружием».
   */
  private buildArm(from: THREE.Vector3, to: THREE.Vector3, role: 'trigger' | 'support'): THREE.Group {
    const pivot = new THREE.Group();
    pivot.position.copy(from);
    const g = new THREE.Group();
    pivot.add(g);

    const len = Math.max(0.12, from.distanceTo(to));
    const sleeve = new THREE.MeshStandardMaterial({ color: 0x424d42, roughness: 0.92 });
    const cuff = new THREE.MeshStandardMaterial({ color: 0x2b332c, roughness: 0.95 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xbd8f66, roughness: 0.72 });

    const upper = new THREE.Mesh(new THREE.BoxGeometry(0.078, 0.078, len * 0.58), sleeve);
    upper.position.z = len * 0.29;
    g.add(upper);
    const fore = new THREE.Mesh(new THREE.BoxGeometry(0.066, 0.066, len * 0.44), sleeve);
    fore.position.z = len * 0.79;
    g.add(fore);
    const wrist = new THREE.Mesh(new THREE.BoxGeometry(0.072, 0.072, 0.03), cuff);
    wrist.position.z = len - 0.055;
    g.add(wrist);

    // Ладонь и пальцы. Локальные оси кисти: +Z — вдоль руки, +Y — «вверх».
    const hand = new THREE.Group();
    hand.position.z = len - 0.02;
    g.add(hand);
    const palm = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.07, 0.05), skin);
    hand.add(palm);
    const side = role === 'trigger' ? 1 : -1;
    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.016, 0.036), skin);
      // Пальцы загибаются ВОКРУГ рукояти: прямые торчат как вилка.
      finger.position.set(0, 0.028 - i * 0.018, 0.034 - Math.abs(i - 1.5) * 0.004);
      finger.rotation.x = role === 'trigger' ? -0.9 - i * 0.06 : -1.05 - i * 0.05;
      hand.add(finger);
    }
    const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.048, 0.02), skin);
    thumb.position.set(side * 0.03, 0.01, 0.028);
    thumb.rotation.z = side * 0.5;
    hand.add(thumb);

    // Наводка ставится ПОСЛЕ сборки и только на внутренний узел: снаружи
    // остаётся чистый пивот с нулевым поворотом, который анимация вольна
    // крутить как угодно.
    // Цель — в МИРОВЫХ координатах: `lookAt` считает от мировой позиции узла,
    // а она в момент сборки равна `from` (пивот ещё ни к чему не подключён).
    g.lookAt(to);
    return pivot;
  }

  private animateViewmodel(dt: number): void {
    const w = this.active;
    const k = 1 - Math.exp(-16 * dt);

    // Пружина отдачи: цель спадает к нулю, текущее значение догоняет цель.
    this.recoilPosTarget.multiplyScalar(Math.exp(-13 * dt));
    this.recoilRotTarget.multiplyScalar(Math.exp(-13 * dt));
    this.recoilPos.lerp(this.recoilPosTarget, Math.min(1, 26 * dt));
    this.recoilRot.lerp(this.recoilRotTarget, Math.min(1, 26 * dt));

    // Базовая поза: бедро / прицел / бег. Три позы, один лерп — переключение
    // «телепортом» между ними и есть та дёрганость, от которой избавляются.
    const ads = this.aiming ? 1 : 0;
    const sprint = this.sprinting ? 1 : 0;
    const hip = w.spec.hipPos;
    const aim = w.spec.adsPos;
    const baseX = THREE.MathUtils.lerp(hip[0], aim[0], ads) + sprint * 0.07;
    const baseY = THREE.MathUtils.lerp(hip[1], aim[1], ads) - sprint * 0.07;
    const baseZ = THREE.MathUtils.lerp(hip[2], aim[2], ads) + sprint * 0.06;

    const moving = this.grounded ? Math.min(1, this.moveSpeed / 6) : 0;
    const bobX = Math.sin(this.bob * 1.1) * 0.018 * moving * (1 - ads * 0.85);
    const bobY = Math.abs(Math.cos(this.bob * 1.1)) * 0.014 * moving * (1 - ads * 0.85);
    // Дыхание: медленная синусоида, заметная только в прицеле и в покое.
    this.breath += dt;
    const breath = Math.sin(this.breath * 1.6) * 0.004 * (1 - moving * 0.7);

    // Перезарядка: ствол уходит вниз и вбок, левая рука ныряет к магазину.
    let reloadDip = 0;
    let reloadRoll = 0;
    if (this.reloadTimer > 0 && this.reloadTotal > 0) {
      const p = 1 - this.reloadTimer / this.reloadTotal;
      const arc = Math.sin(Math.PI * Math.min(1, p * 1.1));
      reloadDip = arc * 0.16;
      reloadRoll = arc * 0.55;
      const magPhase = THREE.MathUtils.clamp((p - 0.15) / 0.5, 0, 1);
      const drop = Math.sin(Math.PI * magPhase);
      if (w.movingPart) {
        // У дробовика «двигается» цевьё вдоль ствола, у остальных — магазин вниз.
        w.movingPart.position.set(
          w.movingHome.x,
          w.movingHome.y - (w.spec.id === 'shotgun' ? 0 : drop * 0.16),
          w.movingHome.z + (w.spec.id === 'shotgun' ? drop * 0.12 : 0),
        );
      }
      w.armLeft.rotation.x = drop * 0.9;
      w.armLeft.rotation.y = drop * 0.35;
      w.armRight.rotation.z = arc * 0.12;
    } else {
      if (w.movingPart) w.movingPart.position.copy(w.movingHome);
      w.armLeft.rotation.x = THREE.MathUtils.lerp(w.armLeft.rotation.x, 0, k);
      w.armLeft.rotation.y = THREE.MathUtils.lerp(w.armLeft.rotation.y, 0, k);
      w.armRight.rotation.z = THREE.MathUtils.lerp(w.armRight.rotation.z, 0, k);
    }

    // Смена ствола: провал вниз и подъём. Сама подмена — на дне дуги.
    let swapDip = 0;
    if (this.swapTimer > 0) {
      const p = 1 - this.swapTimer / 0.45;
      swapDip = Math.sin(Math.PI * p) * 0.34;
    }

    this.viewmodel.position.set(
      baseX + this.recoilPos.x + bobX + this.sway.x,
      baseY + this.recoilPos.y + bobY + breath - reloadDip - swapDip + this.sway.y,
      baseZ + this.recoilPos.z,
    );
    // Развал оружия от бедра. Без него ствол смотрит строго вдоль взгляда,
    // и обе руки выстраиваются в одну линию по глубине: поддерживающая
    // оказывается ровно за ведущей и не видна ни в одном кадре. Разворот на
    // 8° разносит их по горизонтали — и хват сразу читается как хват двумя
    // руками. В прицеле развал уходит в ноль: там ствол обязан смотреть в
    // центр экрана.
    const cantY = THREE.MathUtils.lerp(0.145, 0, ads);
    const cantZ = THREE.MathUtils.lerp(-0.055, 0, ads);
    this.viewmodel.rotation.set(
      this.recoilRot.x + reloadDip * 1.4 + swapDip * 1.2 + sprint * 0.28,
      this.recoilRot.y + cantY - this.sway.x * 2.2 + sprint * 0.5,
      this.recoilRot.z + cantZ + reloadRoll * 0.6 + Math.sin(this.bob * 1.1) * 0.02 * moving,
    );

    this.muzzleLight.position.copy(this.viewmodel.position).add(w.muzzlePoint.position);
  }

  // ─────────────────────────────────────────────────────────── прицел
  private buildCrosshair(): void {
    this.crosshair = new THREE.Group();
    // depthTest: false — прицел обязан быть виден поверх стен и оружия.
    const mat = new THREE.MeshBasicMaterial({
      color: 0xdff0ff, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false,
    });
    for (let i = 0; i < 4; i++) {
      const geo = i < 2
        ? new THREE.BoxGeometry(0.0016, 0.006, 0.0001)
        : new THREE.BoxGeometry(0.006, 0.0016, 0.0001);
      const m = new THREE.Mesh(geo, mat);
      m.renderOrder = 999;
      this.crosshair.add(m);
      this.crosshairBars.push(m);
    }
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.0009, 8), mat);
    dot.renderOrder = 999;
    this.crosshair.add(dot);

    // Хитмаркер: четыре косые чёрточки, классическая обратная связь «попал».
    this.hitMarker = new THREE.Group();
    const hitMat = new THREE.MeshBasicMaterial({
      color: 0xffffff, transparent: true, opacity: 0, depthTest: false, depthWrite: false,
    });
    for (let i = 0; i < 4; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.0016, 0.0055, 0.0001), hitMat);
      const a = Math.PI / 4 + (i * Math.PI) / 2;
      m.position.set(Math.cos(a) * 0.011, Math.sin(a) * 0.011, 0);
      m.rotation.z = a - Math.PI / 2;
      m.renderOrder = 1000;
      this.hitMarker.add(m);
    }
    this.crosshair.add(this.hitMarker);

    this.crosshair.position.set(0, 0, -0.2);
    this.camera.add(this.crosshair);
  }

  private updateCrosshair(): void {
    const spec = this.active.spec;
    const total = (this.aiming ? spec.adsSpread : spec.hipSpread) + this.spread;
    // Прицел ПОКАЗЫВАЕТ текущий разброс: иначе рост разброса от очереди —
    // невидимое для игрока правило, и он винит игру, а не себя.
    const gap = 0.004 + total * 0.32 + (this.moveSpeed / 8) * 0.004;
    this.crosshairBars[0].position.set(-gap, 0, 0);
    this.crosshairBars[1].position.set(gap, 0, 0);
    this.crosshairBars[2].position.set(0, gap, 0);
    this.crosshairBars[3].position.set(0, -gap, 0);
    // В прицеле роль перекрестья играет мушка ствола — рисовать оба значит
    // сбивать наводку двумя разными «центрами экрана».
    this.crosshair.visible = !this.sprinting && !this.aiming;

    const marker = this.hitMarker.children[0] as THREE.Mesh;
    const m = marker.material as THREE.MeshBasicMaterial;
    const t = Math.min(1, this.hitMarkerTimer / 0.14);
    m.opacity = t;
    m.color.setHex(this.killMarker ? 0xff5a4a : 0xffffff);
    this.hitMarker.scale.setScalar(1 + (1 - t) * 0.35);
  }

  // ─────────────────────────────────────────────────────────────── VFX
  private buildVfx(): void {
    const mkPool = (
      geo: THREE.BufferGeometry, mat: THREE.Material, count: number,
    ): THREE.InstancedMesh => {
      const im = new THREE.InstancedMesh(geo, mat, count);
      im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      // Частицы живут в мировых координатах, а меш стоит в начале координат:
      // кэш сферы отсечения запирает их у спавна, и после отхода игрока
      // не рисуется ничего (тот же капкан, что у следов шин).
      im.frustumCulled = false;
      im.count = 0;
      this.scene.add(im);
      return im;
    };

    this.sparkMesh = mkPool(
      new THREE.OctahedronGeometry(0.5, 0),
      new THREE.MeshBasicMaterial({
        transparent: true, opacity: 0.95, blending: THREE.AdditiveBlending, depthWrite: false,
      }),
      this.sparks.maxCapacity,
    );
    this.smokeMesh = mkPool(
      new THREE.DodecahedronGeometry(0.5, 0),
      new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.3, depthWrite: false }),
      this.smoke.maxCapacity,
    );

    const tracerGeo = new THREE.BoxGeometry(0.028, 0.028, 1);
    // Вдоль +Z по той же причине, что и руки: lookAt наводит на цель +Z.
    tracerGeo.translate(0, 0, 0.5);
    this.tracers = mkPool(
      tracerGeo,
      new THREE.MeshBasicMaterial({
        transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false,
      }),
      MAX_TRACERS,
    );
    this.tracers.count = MAX_TRACERS;
    this.tracerLife = new Array(MAX_TRACERS).fill(0);
    for (let i = 0; i < MAX_TRACERS; i++) {
      this.dummy.position.set(0, 0, 0);
      this.dummy.quaternion.identity();
      this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.tracers.setMatrixAt(i, this.dummy.matrix);
      this.tracers.setColorAt(i, this.color.setHex(0xffd070));
    }

    // Взрывы: заранее собранный пул. Создавать меш в кадре детонации —
    // компиляция шейдера ровно там, где нужен ровный кадр.
    for (let i = 0; i < 4; i++) {
      const core = new THREE.Mesh(
        new THREE.SphereGeometry(1, 12, 10),
        new THREE.MeshBasicMaterial({
          color: 0xffb347, transparent: true, opacity: 0.9,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
      const ringGeo = new THREE.RingGeometry(0.6, 1, 24);
      ringGeo.rotateX(-Math.PI / 2);
      const ring = new THREE.Mesh(
        ringGeo,
        new THREE.MeshBasicMaterial({
          color: 0xffe0a0, transparent: true, opacity: 0.8, side: THREE.DoubleSide,
          blending: THREE.AdditiveBlending, depthWrite: false,
        }),
      );
      const light = new THREE.PointLight(0xff9a3c, 0, 18, 2);
      core.visible = false;
      ring.visible = false;
      this.scene.add(core, ring, light);
      this.blasts.push({ core, ring, light, time: 0, active: false });
    }
  }

  private spawnTracer(from: THREE.Vector3, to: THREE.Vector3, colorHex: number): void {
    const i = this.tracerIndex % MAX_TRACERS;
    this.tracerIndex++;
    const len = from.distanceTo(to);
    this.dummy.position.copy(from);
    this.dummy.lookAt(to);                     // +Z объекта смотрит в цель
    this.dummy.scale.set(1, 1, len);
    this.dummy.updateMatrix();
    this.tracers.setMatrixAt(i, this.dummy.matrix);
    this.tracers.setColorAt(i, this.color.setHex(colorHex));
    this.tracers.instanceMatrix.needsUpdate = true;
    if (this.tracers.instanceColor) this.tracers.instanceColor.needsUpdate = true;
    this.tracerLife[i] = 0.055;
  }

  private ejectShell(): void {
    // Гильза летит вправо-вверх от камеры: мелочь, которую замечают только
    // когда её нет.
    this.tmp2.copy(this.right).multiplyScalar(1.6);
    this.tmp2.y = 1.4;
    this.sparks.emitDirected(
      this.muzzleWorld.x, this.muzzleWorld.y, this.muzzleWorld.z,
      this.tmp2.x, this.tmp2.y, this.tmp2.z, 0.25,
      1, 2.6, { r: 0.95, g: 0.78, b: 0.35 },
      { life: 0.9, lifeJitter: 0.1, scale: 0.045, scaleJitter: 0.1, endScale: 1, gravity: -16, drag: 0.4 },
    );
  }

  private updateVfx(dt: number): void {
    this.sparks.update(dt);
    this.smoke.update(dt);
    this.writePool(this.sparks, this.sparkMesh);
    this.writePool(this.smoke, this.smokeMesh);
    this.updateCrosshair();

    let tracersDirty = false;
    for (let i = 0; i < MAX_TRACERS; i++) {
      if (this.tracerLife[i] <= 0) continue;
      this.tracerLife[i] -= dt;
      if (this.tracerLife[i] > 0) continue;
      this.dummy.position.set(0, 0, 0);
      this.dummy.quaternion.identity();
      this.dummy.scale.setScalar(0);
      this.dummy.updateMatrix();
      this.tracers.setMatrixAt(i, this.dummy.matrix);
      tracersDirty = true;
    }
    if (tracersDirty) this.tracers.instanceMatrix.needsUpdate = true;

    for (const b of this.blasts) {
      if (!b.active) continue;
      b.time += dt;
      const t = b.time / 0.55;
      if (t >= 1) {
        b.active = false;
        b.core.visible = false;
        b.ring.visible = false;
        b.light.intensity = 0;
        continue;
      }
      const ease = 1 - (1 - t) * (1 - t);
      b.core.scale.setScalar(0.5 + ease * 3.4);
      (b.core.material as THREE.MeshBasicMaterial).opacity = 0.95 * (1 - t) ** 1.6;
      b.ring.scale.setScalar(1 + ease * 7);
      (b.ring.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - t) ** 2;
      b.light.intensity = 40 * (1 - t) ** 2;
    }
  }

  private writePool(pool: ParticlePoolSystem, mesh: THREE.InstancedMesh): void {
    let n = 0;
    const capacity = mesh.instanceMatrix.count;
    for (const p of pool.particles) {
      if (!p.active) continue;
      if (n >= capacity) break;
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.quaternion.identity();
      this.dummy.scale.setScalar(Math.max(0.0001, p.currentScale));
      this.dummy.updateMatrix();
      mesh.setMatrixAt(n, this.dummy.matrix);
      // Затухание — через цвет инстанса: отдельный материал на частицу
      // разрушил бы весь смысл InstancedMesh.
      const fade = 1 - p.life / p.maxLife;
      mesh.setColorAt(n, this.color.setRGB(p.r * fade, p.g * fade, p.b * fade));
      n++;
    }
    mesh.count = n;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  private buildDecals(): void {
    this.decals = new THREE.InstancedMesh(
      new THREE.CircleGeometry(0.09, 8),
      new THREE.MeshBasicMaterial({ color: 0x12141a, transparent: true, opacity: 0.85, depthWrite: false }),
      MAX_DECALS,
    );
    this.decals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.decals.frustumCulled = false;
    this.decals.count = 0;
    this.scene.add(this.decals);

    this.bloodDecals = new THREE.InstancedMesh(
      new THREE.CircleGeometry(0.16, 7),
      new THREE.MeshBasicMaterial({ color: 0x5e0d10, transparent: true, opacity: 0.7, depthWrite: false }),
      MAX_BLOOD,
    );
    this.bloodDecals.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.bloodDecals.frustumCulled = false;
    this.bloodDecals.count = 0;
    this.scene.add(this.bloodDecals);

    this.enemyFlash = new THREE.Mesh(
      new THREE.PlaneGeometry(0.3, 0.3),
      new THREE.MeshBasicMaterial({
        color: 0xfff0b0, transparent: true, opacity: 0.9, side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    this.enemyFlash.visible = false;
    this.enemyFlash.frustumCulled = false;
    this.scene.add(this.enemyFlash);
  }

  /**
   * Кровь: искры красным + туман + пятно на ближайшей поверхности.
   *
   * Одних частиц мало — они живут полсекунды и исчезают, и через минуту боя
   * по арене не видно, где шёл бой. Пятно остаётся, и именно оно превращает
   * попадание в событие с последствием.
   */
  private spawnBlood(point: THREE.Vector3, dir: THREE.Vector3, count: number, kind: 'hit' | 'kill'): void {
    this.sparks.emitDirected(
      point.x, point.y, point.z, dir.x, dir.y, dir.z, kind === 'kill' ? 1.2 : 0.85,
      count, kind === 'kill' ? 3.8 : 3.2,
      { r: 0.62, g: 0.04, b: 0.06 },
      { life: 0.5, scale: 0.085, gravity: -14, drag: 1.5 },
    );
    // Красная взвесь: держится дольше брызг и читается как «попал в тело».
    this.smoke.emitDirected(
      point.x, point.y, point.z, dir.x, dir.y, dir.z, 1.1,
      kind === 'kill' ? 6 : 2, 1.1, { r: 0.32, g: 0.03, b: 0.04 },
      { life: 0.55, scale: 0.1, endScale: 2.4, gravity: -1.2, drag: 3.2 },
    );

    // Пятно ищется лучом вниз: под врагом может быть ящик, а не пол.
    this.raycaster.set(this.tmp.set(point.x, point.y, point.z), this.downDir);
    this.raycaster.far = 4;
    (this.raycaster as THREE.Raycaster & { firstHitOnly?: boolean }).firstHitOnly = true;
    const hit = this.raycaster.intersectObject(this.arena, false)[0];
    if (!hit?.face) return;
    this.dummy.position.copy(hit.point).addScaledVector(hit.face.normal, 0.014);
    this.dummy.lookAt(this.tmp2.copy(this.dummy.position).add(hit.face.normal));
    this.dummy.rotateZ(this.rng() * Math.PI * 2);
    this.dummy.scale.setScalar((kind === 'kill' ? 2.4 : 1.1) * (0.7 + this.rng() * 0.6));
    this.dummy.updateMatrix();
    this.bloodDecals.setMatrixAt(this.bloodIndex % MAX_BLOOD, this.dummy.matrix);
    this.bloodIndex++;
    this.bloodDecals.count = Math.min(this.bloodIndex, MAX_BLOOD);
    this.bloodDecals.instanceMatrix.needsUpdate = true;
  }

  private placeDecal(point: THREE.Vector3, normal: THREE.Vector3): void {
    this.dummy.position.copy(point).addScaledVector(normal, 0.012);
    this.dummy.lookAt(this.tmp2.copy(this.dummy.position).add(normal));
    this.dummy.scale.setScalar(0.8 + this.rng() * 0.5);
    this.dummy.updateMatrix();
    // Кольцевой буфер: без потолка декали растут весь бой.
    this.decals.setMatrixAt(this.decalIndex % MAX_DECALS, this.dummy.matrix);
    this.decalIndex++;
    this.decals.count = Math.min(this.decalIndex, MAX_DECALS);
    this.decals.instanceMatrix.needsUpdate = true;
  }

  private restart(): void {
    for (const e of this.enemies) e.rig.dispose();
    // Выпавшие стволы уже не принадлежат ригу: он их отпустил, значит
    // убирать со сцены их некому, кроме этого места.
    for (const d of this.drops) d.object.removeFromParent();
    this.drops = [];
    for (const b of this.barrels) b.mesh.removeFromParent();
    this.enemies = [];
    this.barrels = [];
    this.hp = PLAYER_HP;
    this.reloadTimer = 0;
    this.swapTimer = 0;
    this.fireTimer = 0;
    this.spread = 0;
    this.action = 'idle';
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.kills = 0;
    this.damageFlash = 0;
    this.camRecoilPitch = 0;
    this.camRecoilYaw = 0;
    this.camRecoilRecover = 0;
    this.pos.set(0, 0, 22);
    this.vel.set(0, 0, 0);
    this.yaw = 0;
    this.pitch = 0;
    this.decalIndex = 0;
    this.decals.count = 0;
    this.bloodIndex = 0;
    this.bloodDecals.count = 0;
    this.sparks.clear();
    this.smoke.clear();
    this.rng = mulberry32(20240821);
    for (const w of this.weapons) { w.ammo = w.spec.mag; w.reserve = w.spec.reserve; }

    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2;
      const r = 14 + (i % 3) * 6;
      this.enemies.push(this.makeEnemy(Math.cos(a) * r, Math.sin(a) * r - 6, i));
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.4;
      this.barrels.push(this.makeBarrel(Math.cos(a) * 11, Math.sin(a) * 11 - 4));
    }
  }

  private makeEnemy(x: number, z: number, index: number): Enemy {
    // Две модели вперемешку: семь одинаковых силуэтов читаются как копии
    // одного врага, а два — уже как отряд.
    const source = index % 2 === 0 ? this.models[0] : this.models[1];
    const rig = buildShooterRig({
      source,
      body: index % 2 === 0 ? 0xb44a44 : 0x9a4f38,
      gear: 0x2f333a,
      lowDetail: this.ctx.tier === 'low',
    });
    rig.root.position.set(x, 0, z);
    this.scene.add(rig.root);
    // Замер «на сколько мокапная стойка уводит ствол вбок» — один раз на
    // риг: у X Bot и Y Bot пропорции разные, значит и угол разный.
    calibrateAim(rig);

    return {
      rig,
      anim: createShooterAnim(index),
      pos: new THREE.Vector3(x, 0, z),
      prev: new THREE.Vector3(x, 0, z),
      yaw: 0,
      hp: 120, state: 'idle', stateTime: 0, reaction: 0.4,
      burstLeft: 0, burstTimer: 0, cooldown: 0,
      hasToken: false, firstBurstDone: false, flash: 0,
      muzzleTimer: 0, corpseTime: CORPSE_TIME, ragdoll: null,
    };
  }

  private makeBarrel(x: number, z: number): Barrel {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.5, 1.2, 10),
      new THREE.MeshLambertMaterial({ color: 0xc0392b, emissive: 0x2a0806 }),
    );
    mesh.position.set(x, 0.6, z);
    mesh.castShadow = true;
    this.scene.add(mesh);
    return { mesh, pos: new THREE.Vector3(x, 0, z), hp: 40, fuse: 0, exploded: false };
  }

  private pushStatus(): void {
    const w = this.active;
    const alive = this.enemies.filter((e) => e.state !== 'dead').length;
    const engaged = this.enemies.filter((e) => e.state === 'engage' && e.hasToken).length;
    const acc = this.shotsFired ? (this.shotsHit / this.shotsFired) * 100 : 0;
    const slots = WEAPONS
      .map((s, i) => (i === this.weaponIndex ? `<b>[${i + 1} ${s.name}]</b>` : `${i + 1} ${s.name}`))
      .join(' · ');
    this.ctx.setStatus(
      `HP <span class="hp">${this.hp}</span>`
      + ` · ${w.spec.name} <b>${w.ammo}/${w.spec.mag}</b> (запас ${w.reserve})${this.reloadTimer > 0 ? ' — перезарядка' : ''}`
      + ` · ${slots}`
      + ` · врагов ${alive}, стреляют ${engaged}/${ATTACK_TOKENS} (токены атаки)`
      + ` · убито ${this.kills} · точность ${acc.toFixed(0)} %`
      + ` · разброс ${((this.spread / Math.max(w.spec.maxSpread, 1e-4)) * 100).toFixed(0)} %`
      + (this.grounded ? '' : ' · <b>в воздухе</b>')
      + (this.hitMarkerTimer > 0 ? (this.killMarker ? ' · <b>УБИТ</b>' : ' · <b>попадание</b>') : '')
      + (this.ctx.input.isPointerLocked ? '' : ' · <b>кликните, чтобы захватить мышь</b>'),
    );
  }
}

/** Зоны урона: голова, корпус, ноги. Высоты — от ступней врага. */
const ZONES: ReadonlyArray<{ y: number; r: number; zone: 'head' | 'body' | 'limb' }> = [
  { y: 1.62, r: 0.25, zone: 'head' },
  { y: 1.10, r: 0.40, zone: 'body' },
  { y: 0.45, r: 0.34, zone: 'limb' },
];

/** Угол в диапазон −π..π: доворот головы не должен идти «длинной дугой». */
function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

/** Пересечение луча со сферой; возвращает расстояние или null. */
function raySphere(
  origin: THREE.Vector3, dir: THREE.Vector3, center: THREE.Vector3, radius: number,
): number | null {
  const ox = center.x - origin.x;
  const oy = center.y - origin.y;
  const oz = center.z - origin.z;
  const t = ox * dir.x + oy * dir.y + oz * dir.z;
  if (t < 0) return null;
  const dx = ox - dir.x * t;
  const dy = oy - dir.y * t;
  const dz = oz - dir.z * t;
  const d2 = dx * dx + dy * dy + dz * dz;
  if (d2 > radius * radius) return null;
  return t - Math.sqrt(radius * radius - d2);
}

const COVERS: Array<[number, number, number, number, number]> = [
  [-12, -4, 4, 2, 1.3], [10, 2, 5, 2, 1.6], [0, -14, 6, 2, 1.2],
  [-18, 10, 2, 6, 1.8], [16, -12, 2, 6, 1.5], [4, 14, 5, 2, 1.1],
];
