import * as THREE from 'three';
import { EventBus } from './EventBus';
import { GameLoop } from './GameLoop';
import { AudioService } from '../audio/AudioService';
import { InputManager } from '../input/InputManager';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { ColonySystem, type ColonyStats } from '../systems/ColonySystem';
import { EnemySpawner, type EnemyState } from '../systems/EnemySpawner';
import { GAME_CONFIG, type RouteState, type SnailRole } from '../game/config';
import type { GameEvents } from '../game/GameEvents';
import { PlaygamaService, type PlayerSave } from '../platform/PlaygamaService';

interface RouteVisual {
  state: RouteState;
  line: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial>;
}

interface EnemyVisual {
  state: EnemyState;
  object: THREE.Group;
}

export class Game {
  private readonly canvas: HTMLCanvasElement;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  private readonly worldPoint = new THREE.Vector3();
  private readonly routeStart = new THREE.Vector3();
  private readonly routeEnd = new THREE.Vector3();
  private readonly routePreviewPoints = [new THREE.Vector3(), new THREE.Vector3()];
  private readonly eventBus: EventBus<GameEvents>;
  private readonly input: InputManager;
  private readonly physics: PhysicsWorld;
  private readonly colony: ColonySystem;
  private readonly enemies: EnemySpawner;
  private readonly platform: PlaygamaService;
  private readonly audio: AudioService;
  private readonly loop: GameLoop;
  private readonly stats: ColonyStats = { day: 1, dew: 64, nectar: 36, trust: 0, humidity: 0.78, delivered: 0, totalMails: 4, deliveredMails: 0 };
  private readonly snailMeshes: THREE.Group[] = [];
  private readonly snailShellMaterials: THREE.MeshLambertMaterial[] = [];
  private readonly routeVisuals: RouteVisual[] = [];
  private readonly enemyVisuals: EnemyVisual[] = [];
  private readonly flowerGroups: THREE.Group[] = [];
  private readonly roleColors: Record<SnailRole, number> = { courier: 0xf6c66e, gatherer: 0x86d8ad, guard: 0xd993c5 };
  private readonly lastSave: PlayerSave = { version: 1, day: 1, dew: 64, nectar: 36, trust: 0, delivered: 0 };
  private temporaryRoute: THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> | null = null;
  private pointerDownId: number | null = null;
  private pointerMoved = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private cameraX = 0;
  private cameraZ = 5;
  private toastTimer = 0;
  private saveTimer = 0;
  private userPaused = false;
  private platformPaused = false;

  public constructor(
    canvas: HTMLCanvasElement,
    eventBus: EventBus<GameEvents>,
    input: InputManager,
    physics: PhysicsWorld,
    colony: ColonySystem,
    enemies: EnemySpawner,
    platform: PlaygamaService,
    audio: AudioService,
    save: PlayerSave,
  ) {
    this.canvas = canvas;
    this.eventBus = eventBus;
    this.input = input;
    this.physics = physics;
    this.colony = colony;
    this.enemies = enemies;
    this.platform = platform;
    this.audio = audio;
    this.lastSave.day = save.day;
    this.lastSave.dew = save.dew;
    this.lastSave.nectar = save.nectar;
    this.lastSave.trust = save.trust;
    this.lastSave.delivered = save.delivered;
    this.colony.setInitialSave(save.day, save.dew, save.nectar, save.trust, save.delivered);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = true;
    this.scene.background = new THREE.Color(0x10251f);
    this.eventBus.on('toast', ({ message }) => this.showToast(message));
    this.eventBus.on('route:created', () => { this.audio.click(); this.persistSoon(); });
    this.eventBus.on('mail:delivered', () => { this.audio.click(); this.showToast('Росинная печать вручена'); this.persistSoon(); });
    this.eventBus.on('mail:failed', ({ reason }) => { this.showToast(`Письмо повреждено: ${reason}`); this.persistSoon(); });
    this.eventBus.on('threat:spawned', ({ kind }) => this.showToast(`${this.enemyName(kind)} замечен в саду`));
    this.buildScene();
    this.bindCanvasInput();
    this.bindUi();
    this.loop = new GameLoop({ fixedUpdate: this.fixedUpdate.bind(this), update: this.update.bind(this), render: this.render.bind(this) });
    this.resize();
    window.addEventListener('resize', () => this.resize());
    window.addEventListener('pagehide', () => { void this.saveNow(); });
  }

  public start(): void { this.applyPauseState(); this.loop.start(); }

  public pause(): void {
    this.userPaused = true;
    this.applyPauseState();
  }

  public resume(): void {
    this.userPaused = false;
    this.platformPaused = false;
    this.applyPauseState();
  }

  public setPlatformPaused(paused: boolean): void {
    this.platformPaused = paused;
    this.applyPauseState();
  }

  public dispose(): void { this.loop.stop(); this.physics.dispose(); this.renderer.dispose(); }

  private fixedUpdate(deltaSeconds: number): void {
    const input = this.input.read();
    this.cameraX += input.panX * deltaSeconds * 4;
    this.cameraZ += input.panY * deltaSeconds * 4;
    this.cameraX = THREE.MathUtils.clamp(this.cameraX, -9, 9);
    this.cameraZ = THREE.MathUtils.clamp(this.cameraZ, -3, 16);
    this.enemies.update(deltaSeconds, this.guardCount());
    this.colony.setPredatorPressure(this.enemies.predatorPressure);
    this.colony.update(deltaSeconds, input);
    this.saveTimer += deltaSeconds;
    if (this.saveTimer > 8) { this.saveTimer = 0; void this.saveNow(); }
  }

  private update(deltaSeconds: number): void {
    this.toastTimer -= deltaSeconds;
    if (this.toastTimer <= 0) document.getElementById('event-toast')?.classList.remove('visible');
  }

  private render(_interpolation: number, _timestamp: number): void {
    this.syncCamera();
    this.syncSnails();
    this.syncEnemies();
    this.syncHud();
    for (const route of this.routeVisuals) {
      route.line.material.color.setHSL(0.11 + route.state.pheromone * 0.22, 0.8, 0.42 + route.state.pheromone * 0.2);
      route.line.material.opacity = 0.35 + route.state.pheromone * 0.55;
    }
    this.renderer.render(this.scene, this.camera);
  }

  private buildScene(): void {
    const ambient = new THREE.HemisphereLight(0xd8f3db, 0x183629, 2.3);
    this.scene.add(ambient);
    const sun = new THREE.DirectionalLight(0xffe4b0, 3.4);
    sun.position.set(-8, 18, 7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -24; sun.shadow.camera.right = 24; sun.shadow.camera.top = 20; sun.shadow.camera.bottom = -20;
    this.scene.add(sun);
    const ground = new THREE.Mesh(new THREE.CircleGeometry(27, 48), new THREE.MeshLambertMaterial({ color: 0x355f48 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);
    const innerGround = new THREE.Mesh(new THREE.CircleGeometry(19, 48), new THREE.MeshLambertMaterial({ color: 0x4a7953 }));
    innerGround.rotation.x = -Math.PI / 2;
    innerGround.position.y = 0.01;
    this.scene.add(innerGround);
    this.buildNest();
    for (let index = 0; index < GAME_CONFIG.flowers.length; index += 1) this.buildFlower(index);
    this.buildSnails();
    this.buildEnemyPool();
    this.buildScenery();
  }

  private buildNest(): void {
    const nest = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.TorusGeometry(2.1, 0.32, 8, 32), new THREE.MeshLambertMaterial({ color: 0x7c5840 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.28;
    ring.castShadow = true;
    nest.add(ring);
    const center = new THREE.Mesh(new THREE.CylinderGeometry(1.75, 2, 0.42, 24), new THREE.MeshLambertMaterial({ color: 0x58402f }));
    center.position.y = 0.16;
    center.castShadow = true;
    nest.add(center);
    const dew = new THREE.Mesh(new THREE.CircleGeometry(1.1, 24), new THREE.MeshLambertMaterial({ color: 0x8fd5c9, transparent: true, opacity: 0.8 }));
    dew.rotation.x = -Math.PI / 2;
    dew.position.y = 0.39;
    nest.add(dew);
    this.scene.add(nest);
  }

  private buildFlower(index: number): void {
    const data = GAME_CONFIG.flowers[index];
    const flower = new THREE.Group();
    flower.position.set(data.x, 0, data.z);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 1.5, 7), new THREE.MeshLambertMaterial({ color: 0x3d8d5b }));
    stem.position.y = 0.75;
    flower.add(stem);
    const core = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 8), new THREE.MeshLambertMaterial({ color: 0xf6c66e }));
    core.position.y = 1.55;
    flower.add(core);
    const petalMaterial = new THREE.MeshLambertMaterial({ color: data.color, transparent: true, opacity: 0.92 });
    for (let petalIndex = 0; petalIndex < 5; petalIndex += 1) {
      const petal = new THREE.Mesh(new THREE.SphereGeometry(0.46, 10, 6), petalMaterial);
      const angle = petalIndex / 5 * Math.PI * 2;
      petal.position.set(Math.cos(angle) * 0.38, 1.55, Math.sin(angle) * 0.38);
      petal.scale.set(1, 0.42, 0.7);
      flower.add(petal);
    }
    flower.traverse((child) => { child.castShadow = true; });
    this.flowerGroups.push(flower);
    this.scene.add(flower);
  }

  private buildSnails(): void {
    const bodyGeometry = new THREE.SphereGeometry(0.48, 12, 8);
    const shellGeometry = new THREE.SphereGeometry(0.46, 14, 10);
    const eyeGeometry = new THREE.SphereGeometry(0.07, 8, 6);
    const bodyMaterial = new THREE.MeshLambertMaterial({ color: 0xd6a676 });
    const eyeMaterial = new THREE.MeshLambertMaterial({ color: 0x15241b });
    for (let index = 0; index < this.colony.snails.length; index += 1) {
      const snail = this.colony.snails[index];
      const group = new THREE.Group();
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      body.scale.set(1.35, 0.45, 0.8);
      body.position.y = 0.35;
      group.add(body);
      const shellMaterial = new THREE.MeshLambertMaterial({ color: this.roleColors[snail.role] });
      this.snailShellMaterials.push(shellMaterial);
      const shell = new THREE.Mesh(shellGeometry, shellMaterial);
      shell.position.set(-0.08, 0.68, 0);
      shell.scale.set(0.88, 1, 0.9);
      shell.userData.snailId = snail.id;
      group.add(shell);
      const eyeLeft = new THREE.Mesh(eyeGeometry, eyeMaterial); eyeLeft.position.set(0.3, 0.55, -0.23); group.add(eyeLeft);
      const eyeRight = new THREE.Mesh(eyeGeometry, eyeMaterial); eyeRight.position.set(0.3, 0.55, 0.23); group.add(eyeRight);
      group.position.set(snail.x, 0, snail.z);
      group.traverse((child) => { child.castShadow = true; });
      this.snailMeshes.push(group);
      this.scene.add(group);
    }
  }

  private buildEnemyPool(): void {
    for (let index = 0; index < GAME_CONFIG.maxEnemies; index += 1) {
      const object = new THREE.Group();
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.42, 10, 8), new THREE.MeshLambertMaterial({ color: index % 2 === 0 ? 0x293038 : 0xe0a53d }));
      object.add(body);
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.5), new THREE.MeshLambertMaterial({ color: 0xb8d9ce, transparent: true, opacity: 0.7, side: THREE.DoubleSide }));
      wing.rotation.x = Math.PI / 2;
      wing.position.y = 0.1;
      object.add(wing);
      object.visible = false;
      this.enemyVisuals.push({ state: { id: -1, kind: 'bird', x: 0, z: 0, age: 0, active: false }, object });
      this.scene.add(object);
    }
  }

  private buildScenery(): void {
    const pebbleGeometry = new THREE.DodecahedronGeometry(0.28, 0);
    const pebbleMaterial = new THREE.MeshLambertMaterial({ color: 0x6b8f68 });
    for (let index = 0; index < 16; index += 1) {
      const pebble = new THREE.Mesh(pebbleGeometry, pebbleMaterial);
      const angle = index * 2.399;
      const radius = 12 + (index % 4) * 2;
      pebble.position.set(Math.cos(angle) * radius, 0.2, Math.sin(angle) * radius);
      pebble.scale.set(1.2, 0.5, 0.8);
      pebble.castShadow = true;
      this.scene.add(pebble);
    }
  }

  private bindCanvasInput(): void {
    this.canvas.addEventListener('contextmenu', (event) => event.preventDefault());
    this.canvas.addEventListener('dragstart', (event) => event.preventDefault());
    this.canvas.addEventListener('pointerdown', (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      this.pointerDownId = event.pointerId;
      this.pointerMoved = false;
      this.lastPointerX = event.clientX;
      this.lastPointerY = event.clientY;
      this.canvas.setPointerCapture(event.pointerId);
      if (this.toWorld(event.clientX, event.clientY, this.routeStart)) {
        this.routeEnd.copy(this.routeStart);
        this.routePreviewPoints[0].copy(this.routeStart);
        this.routePreviewPoints[1].copy(this.routeEnd);
        this.temporaryRoute = this.makeLine(this.routePreviewPoints, 0xf6c66e, 0.65);
        this.scene.add(this.temporaryRoute);
      }
    });
    this.canvas.addEventListener('pointermove', (event: PointerEvent) => {
      if (event.pointerId !== this.pointerDownId) return;
      if (Math.hypot(event.clientX - this.lastPointerX, event.clientY - this.lastPointerY) > 5) this.pointerMoved = true;
      if (!this.toWorld(event.clientX, event.clientY, this.routeEnd)) return;
      this.routePreviewPoints[1].copy(this.routeEnd);
      this.temporaryRoute?.geometry.setFromPoints(this.routePreviewPoints);
    });
    const release = (event: PointerEvent): void => {
      if (event.pointerId !== this.pointerDownId) return;
      this.pointerDownId = null;
      if (this.temporaryRoute) { this.scene.remove(this.temporaryRoute); this.temporaryRoute.geometry.dispose(); this.temporaryRoute = null; }
      if (this.pointerMoved) {
        const route = this.colony.createRoute(this.routeStart.x, this.routeStart.z, this.routeEnd.x, this.routeEnd.z);
        if (route) this.addRouteVisual(route);
      } else this.selectSnail(event.clientX, event.clientY);
    };
    this.canvas.addEventListener('pointerup', release);
    this.canvas.addEventListener('pointercancel', release);
    this.canvas.addEventListener('lostpointercapture', release);
  }

  private bindUi(): void {
    document.getElementById('pause-button')?.addEventListener('click', () => { this.pause(); this.audio.click(); });
    document.getElementById('resume-button')?.addEventListener('click', () => { this.resume(); this.audio.click(); });
    window.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.repeat || (event.code !== 'KeyP' && event.code !== 'Escape')) return;
      event.preventDefault();
      if (this.userPaused) {
        this.resume();
      } else {
        this.pause();
      }
      this.audio.click();
    });
  }

  private applyPauseState(): void {
    const paused = this.userPaused || this.platformPaused;
    this.loop.setPaused(paused);
    this.input.touchControls.setVisible(!paused);
    const pausePanel = document.getElementById('pause-panel');
    if (pausePanel) pausePanel.toggleAttribute('hidden', !paused);
  }

  private addRouteVisual(route: RouteState): void {
    const points = [new THREE.Vector3(route.startX, 0.07, route.startZ), new THREE.Vector3(route.endX, 0.07, route.endZ)];
    const line = this.makeLine(points, 0xf6c66e, 0.85);
    this.routeVisuals.push({ state: route, line });
    this.scene.add(line);
  }

  private makeLine(points: THREE.Vector3[], color: number, opacity: number): THREE.Line<THREE.BufferGeometry, THREE.LineBasicMaterial> {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity, linewidth: 2 });
    return new THREE.Line(geometry, material);
  }

  private selectSnail(clientX: number, clientY: number): void {
    this.setPointer(clientX, clientY);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const hits = this.raycaster.intersectObjects(this.snailMeshes, true);
    if (hits.length === 0) return;
    const id = hits[0].object.userData.snailId as number | undefined;
    if (id === undefined) return;
    this.colony.rotateRole(id);
    this.audio.click();
    const snailIndex = this.colony.snails.findIndex((snail) => snail.id === id);
    if (snailIndex >= 0) this.snailShellMaterials[snailIndex].color.setHex(this.roleColors[this.colony.snails[snailIndex].role]);
  }

  private toWorld(clientX: number, clientY: number, target: THREE.Vector3): boolean {
    this.setPointer(clientX, clientY);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    return this.raycaster.ray.intersectPlane(this.groundPlane, target) !== null;
  }

  private setPointer(clientX: number, clientY: number): void {
    const rect = this.canvas.getBoundingClientRect();
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  }

  private syncCamera(): void {
    this.camera.position.set(this.cameraX, 23, this.cameraZ + 17);
    this.camera.lookAt(this.cameraX * 0.2, 0, this.cameraZ * 0.2);
  }

  private syncSnails(): void {
    for (let index = 0; index < this.colony.snails.length; index += 1) {
      const snail = this.colony.snails[index];
      const mesh = this.snailMeshes[index];
      mesh.position.set(snail.x, 0, snail.z);
      mesh.rotation.y = snail.returning ? Math.PI : 0;
      meshShellScale(mesh, 1 + Math.sin(performance.now() * 0.004 + snail.id) * 0.025);
    }
  }

  private syncEnemies(): void {
    for (let index = 0; index < this.enemyVisuals.length; index += 1) {
      const visual = this.enemyVisuals[index];
      const state = this.enemies.enemies[index];
      visual.object.visible = state?.active === true;
      if (!state) continue;
      visual.object.position.set(state.x, state.kind === 'bird' ? 5.5 : 2.5, state.z);
      visual.object.rotation.y = state.age * 0.7;
    }
  }

  private syncHud(): void {
    this.colony.getStats(this.stats);
    setText('day-value', String(this.stats.day));
    setText('dew-value', String(Math.floor(this.stats.dew)));
    setText('nectar-value', String(Math.floor(this.stats.nectar)));
    setText('trust-value', String(this.stats.trust));
    const delivered = this.stats.deliveredMails;
    const progress = this.stats.totalMails > 0 ? delivered / this.stats.totalMails * 100 : 0;
    const progressBar = document.getElementById('mission-progress');
    if (progressBar) progressBar.style.width = `${progress}%`;
    setText('mission-value', delivered >= this.stats.totalMails ? 'Почта дня доставлена' : `Доставьте письма · ${delivered}/${this.stats.totalMails}`);
    setText('weather-value', `Утро: влажность ${Math.round(this.stats.humidity * 100)}% · ${this.enemies.enemies.length > 0 ? 'хищники рядом' : 'тень движется'}`);
  }

  private resize(): void {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(width, height, false);
  }

  private guardCount(): number { return this.colony.snails.reduce((count, snail) => count + (snail.role === 'guard' ? 1 : 0), 0); }

  private enemyName(kind: string): string { return kind === 'bird' ? 'Птица' : kind === 'wasp' ? 'Оса' : 'Жук'; }

  private showToast(message: string): void {
    const toast = document.getElementById('event-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add('visible');
    this.toastTimer = 3;
  }

  private persistSoon(): void { this.saveTimer = 7.5; }

  private async saveNow(): Promise<void> {
    const value = this.colony.getSave();
    this.lastSave.day = value.day;
    this.lastSave.dew = value.dew;
    this.lastSave.nectar = value.nectar;
    this.lastSave.trust = value.trust;
    this.lastSave.delivered = value.delivered;
    await this.platform.save(this.lastSave);
  }
}

function setText(id: string, value: string): void {
  const element = document.getElementById(id);
  if (element && element.textContent !== value) element.textContent = value;
}

function meshShellScale(group: THREE.Group, scale: number): void {
  const shell = group.children[1];
  shell.scale.y = scale;
}
