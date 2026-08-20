import * as THREE from 'three';
import { PhysicsWorld } from './physics/PhysicsWorld';
import { SceneManager } from './rendering/SceneManager';
import { RoadGenerator } from './world/RoadGenerator';
import { TruckController } from './vehicle/TruckController';
import { LEVELS } from './world/levels';
import { InputManager } from './input/InputManager';
import { AudioManager } from './audio/AudioManager';

// Modes
import { FpsMode } from './modes/FpsMode';
import { MeleeMode } from './modes/MeleeMode';
import { PhysicsSandboxMode } from './modes/PhysicsSandboxMode';
import { FluidDestructionMode } from './modes/FluidDestructionMode';
import { SwarmSurvivorMode } from './modes/SwarmSurvivorMode';
import { GridBuildingMode } from './modes/GridBuildingMode';
import { StealthMode } from './modes/StealthMode';
import { ShowroomMode } from './modes/ShowroomMode';
import { Pixi2DMode } from './modes/Pixi2DMode';
import { VfxMode } from './modes/VfxMode';
import { SoundboardMode } from './modes/SoundboardMode';

export class ShowcaseApp {
  public currentMode = 'truck';
  public audioManager: AudioManager;
  public inputManager: InputManager;
  public sceneManager: SceneManager | null = null;
  public physics: PhysicsWorld | null = null;
  public roadGenerator: RoadGenerator | null = null;
  public truck: TruckController | null = null;

  // 12 Showcase Modes
  public fpsMode: FpsMode | null = null;
  public meleeMode: MeleeMode | null = null;
  public physicsSandboxMode: PhysicsSandboxMode | null = null;
  public fluidDestructionMode: FluidDestructionMode | null = null;
  public swarmSurvivorMode: SwarmSurvivorMode | null = null;
  public gridBuildingMode: GridBuildingMode | null = null;
  public stealthMode: StealthMode | null = null;
  public showroomMode: ShowroomMode | null = null;
  public pixi2DMode: Pixi2DMode | null = null;
  public vfxMode: VfxMode | null = null;
  public soundboardMode: SoundboardMode | null = null;

  // 2D Canvas Overlay
  private canvas2D: HTMLCanvasElement;
  private ctx2D: CanvasRenderingContext2D;

  // Camera Shake Trauma
  private trauma = 0;
  private maxShakeAngle = 0.06;
  private maxShakeOffset = 0.25;

  private isInitialized = false;

  constructor(private container: HTMLElement) {
    this.canvas2D = document.getElementById('canvas-2d-overlay') as HTMLCanvasElement;
    this.ctx2D = this.canvas2D.getContext('2d')!;
    this.audioManager = new AudioManager();
    this.inputManager = new InputManager();
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // 1. Initialize WASM Physics
    this.physics = new PhysicsWorld();
    await this.physics.initialize();

    // 2. Initialize Scene Manager
    this.sceneManager = new SceneManager();
    this.sceneManager.initialize();
    this.sceneManager.onResize();

    this.canvas2D.width = window.innerWidth;
    this.canvas2D.height = window.innerHeight;

    window.addEventListener('resize', () => {
      this.sceneManager?.onResize();
      this.canvas2D.width = window.innerWidth;
      this.canvas2D.height = window.innerHeight;
    });

    const scene = this.sceneManager.scene;
    const camera = this.sceneManager.camera;

    // 3. Build Road and Truck for VehicleMode
    this.roadGenerator = new RoadGenerator();
    this.roadGenerator.build(this.sceneManager, this.physics, LEVELS[0]);
    this.truck = new TruckController(this.physics, this.sceneManager, this.roadGenerator);
    this.truck.build('zil');

    const addTrauma = (amount: number) => {
      this.trauma = Math.min(1.0, this.trauma + amount);
    };

    // 4. Instantiate all Modes
    this.fpsMode = new FpsMode(scene, camera, this.audioManager, addTrauma);
    this.meleeMode = new MeleeMode(scene, this.audioManager, addTrauma);
    this.physicsSandboxMode = new PhysicsSandboxMode(scene, this.audioManager, addTrauma);
    this.fluidDestructionMode = new FluidDestructionMode(scene, this.audioManager, addTrauma);
    this.swarmSurvivorMode = new SwarmSurvivorMode(scene, this.audioManager, addTrauma);
    this.gridBuildingMode = new GridBuildingMode(scene, this.audioManager);
    this.stealthMode = new StealthMode(scene, this.audioManager, addTrauma);
    this.showroomMode = new ShowroomMode(scene, this.audioManager);
    this.pixi2DMode = new Pixi2DMode(this.canvas2D, this.ctx2D, this.audioManager);
    this.vfxMode = new VfxMode(scene, this.audioManager, addTrauma);
    this.soundboardMode = new SoundboardMode(this.audioManager);
    this.soundboardMode.initialize('audio-analyser-canvas');

    this.setupEventHandlers();
    this.isInitialized = true;

    // Default to truck mode
    this.switchMode('truck');

    // Start game loop
    this.startLoop();
  }

  private setupEventHandlers(): void {
    const dom = this.sceneManager!.renderer.domElement;

    // Desktop PointerLock & Clicks
    dom.addEventListener('click', (e) => {
      if (this.currentMode === 'fps') {
        if (document.pointerLockElement !== dom) {
          dom.requestPointerLock?.();
        } else {
          this.fpsMode?.shoot();
        }
      } else if (this.currentMode === 'melee') {
        this.meleeMode?.requestAttack();
      } else if (this.currentMode === 'physics_sandbox') {
        this.physicsSandboxMode?.triggerGrapple();
      } else if (this.currentMode === 'grid_building') {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2(
          (e.clientX / window.innerWidth) * 2 - 1,
          -(e.clientY / window.innerHeight) * 2 + 1
        );
        raycaster.setFromCamera(mouse, this.sceneManager!.camera);
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const hit = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(plane, hit)) {
          const half = this.gridBuildingMode!.gridSize / 2;
          const gx = Math.floor(hit.x / this.gridBuildingMode!.cellSize + half);
          const gz = Math.floor(hit.z / this.gridBuildingMode!.cellSize + half);
          this.gridBuildingMode?.placeBuilding(gx, gz);
        }
      }
    });

    // Mouse Move for FPS & Grid Ghost
    document.addEventListener('mousemove', (e) => {
      if (this.currentMode === 'fps' && document.pointerLockElement === dom) {
        const sensitivity = 0.0022;
        this.fpsMode!.yawObject.rotation.y -= e.movementX * sensitivity;
        this.fpsMode!.pitchObject.rotation.x -= e.movementY * sensitivity;
        this.fpsMode!.pitchObject.rotation.x = Math.max(
          -Math.PI / 2.2,
          Math.min(Math.PI / 2.2, this.fpsMode!.pitchObject.rotation.x)
        );
      } else if (this.currentMode === 'grid_building') {
        const raycaster = new THREE.Raycaster();
        const mouse = new THREE.Vector2(
          (e.clientX / window.innerWidth) * 2 - 1,
          -(e.clientY / window.innerHeight) * 2 + 1
        );
        raycaster.setFromCamera(mouse, this.sceneManager!.camera);
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const hit = new THREE.Vector3();
        if (raycaster.ray.intersectPlane(plane, hit)) {
          this.gridBuildingMode?.updateGhost(hit);
        }
      }
    });

    // Keydown Controls
    window.addEventListener('keydown', (e) => {
      // FPS Movement & Kick
      if (this.currentMode === 'fps') {
        if (e.code === 'KeyW') this.fpsMode!.moveForward = true;
        if (e.code === 'KeyS') this.fpsMode!.moveBackward = true;
        if (e.code === 'KeyA') this.fpsMode!.moveLeft = true;
        if (e.code === 'KeyD') this.fpsMode!.moveRight = true;
        if (e.code === 'KeyF') this.fpsMode!.triggerSpartanKick();
      }

      // Melee Attacks & Parry
      if (this.currentMode === 'melee') {
        if (e.code === 'Space' || e.code === 'KeyE') this.meleeMode?.requestAttack();
        if (e.code === 'KeyQ') this.meleeMode?.requestParry();
      }

      // Physics Sandbox
      if (this.currentMode === 'physics_sandbox') {
        if (e.code === 'KeyR') this.physicsSandboxMode?.startRewind();
        if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') {
          const move = this.getWASDVector();
          this.physicsSandboxMode?.triggerDash(move.x || 1, move.z);
        }
      }

      // Rhythm Hit in Soundboard
      if (this.currentMode === 'soundboard' && e.code === 'Space') {
        this.soundboardMode?.triggerRhythmHit();
      }
    });

    window.addEventListener('keyup', (e) => {
      if (this.currentMode === 'fps') {
        if (e.code === 'KeyW') this.fpsMode!.moveForward = false;
        if (e.code === 'KeyS') this.fpsMode!.moveBackward = false;
        if (e.code === 'KeyA') this.fpsMode!.moveLeft = false;
        if (e.code === 'KeyD') this.fpsMode!.moveRight = false;
      }
      if (this.currentMode === 'physics_sandbox' && e.code === 'KeyR') {
        this.physicsSandboxMode?.stopRewind();
      }
    });
  }

  private getWASDVector(): { x: number; z: number } {
    const input = this.inputManager.snapshot();
    let x = 0;
    let z = 0;
    if (input.throttle > 0) z -= 1;
    if (input.brake > 0) z += 1;
    if (input.steer < 0) x -= 1;
    if (input.steer > 0) x += 1;
    return { x, z };
  }

  public switchMode(mode: string): void {
    this.currentMode = mode;
    const isTruck = mode === 'truck';

    // Stop truck engine if not in truck mode
    if (!isTruck && mode !== 'soundboard') {
      this.audioManager.stopEngine();
    }

    // Toggle 3D scene elements
    if (this.sceneManager) {
      this.sceneManager.roadGroup.visible = isTruck;
      this.sceneManager.decorationGroup.visible = isTruck;
    }
    if (this.truck) {
      this.truck.chassis.visible = isTruck;
    }

    // Set Visibility on all Mode controllers
    this.fpsMode?.setVisible(mode === 'fps');
    this.meleeMode?.setVisible(mode === 'melee');
    this.physicsSandboxMode?.setVisible(mode === 'physics_sandbox');
    this.fluidDestructionMode?.setVisible(mode === 'fluid_destruction');
    this.swarmSurvivorMode?.setVisible(mode === 'swarm_survivor');
    this.gridBuildingMode?.setVisible(mode === 'grid_building');
    this.stealthMode?.setVisible(mode === 'stealth');
    this.showroomMode?.setVisible(mode === 'models');
    this.vfxMode?.setVisible(mode === 'vfx');

    // 2D Canvas Display
    this.canvas2D.style.display = (mode === 'pixijs_2d') ? 'block' : 'none';

    // Show/Hide DOM Overlay Panels
    const panels = ['speedometer', 'fps-crosshair', 'vfx-controls', 'soundboard-panel', 'models-controls', 'building-controls', 'fluid-controls', 'pixi-controls'];
    panels.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.style.display = 'none';
    });

    if (isTruck) {
      const spd = document.getElementById('speedometer');
      if (spd) spd.style.display = 'block';
    } else if (mode === 'fps') {
      const cross = document.getElementById('fps-crosshair');
      if (cross) cross.style.display = 'block';
    } else if (mode === 'vfx') {
      const vfx = document.getElementById('vfx-controls');
      if (vfx) vfx.style.display = 'flex';
    } else if (mode === 'soundboard') {
      const snd = document.getElementById('soundboard-panel');
      if (snd) snd.style.display = 'block';
    } else if (mode === 'models') {
      const mdl = document.getElementById('models-controls');
      if (mdl) mdl.style.display = 'flex';
    } else if (mode === 'grid_building') {
      const bld = document.getElementById('building-controls');
      if (bld) bld.style.display = 'flex';
    } else if (mode === 'fluid_destruction') {
      const fld = document.getElementById('fluid-controls');
      if (fld) fld.style.display = 'flex';
    } else if (mode === 'pixijs_2d') {
      const px = document.getElementById('pixi-controls');
      if (px) px.style.display = 'flex';
    }
  }

  private startLoop(): void {
    let lastTime = performance.now();

    const tick = (now: number) => {
      requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;

      const camera = this.sceneManager!.camera;
      const input = this.inputManager.snapshot();
      const move = this.getWASDVector();

      // ────────────────────────────────────────── MODE UPDATES
      if (this.currentMode === 'truck' && this.physics && this.truck) {
        this.physics.step();
        this.truck.fixedUpdate(dt, input);
        this.truck.render(1.0);

        // Update engine sound & speedometer
        const spdRatio = Math.abs(this.truck.speed) / 60;
        this.audioManager.updateEngineRPM(spdRatio, input.throttle);

        const spdEl = document.getElementById('speed-val');
        if (spdEl) spdEl.textContent = Math.round(this.truck.speed).toString();

        this.sceneManager!.render(this.truck.position, this.truck.forward, this.truck.speed);

      } else if (this.currentMode === 'fps') {
        this.fpsMode?.update(dt);
        this.sceneManager!.renderer.render(this.sceneManager!.scene, camera);

      } else if (this.currentMode === 'melee') {
        this.meleeMode?.update(dt);
        camera.position.set(0, 3.2, 5.8);
        camera.lookAt(0, 1.2, -1.5);
        this.sceneManager!.renderer.render(this.sceneManager!.scene, camera);

      } else if (this.currentMode === 'physics_sandbox') {
        this.physicsSandboxMode?.update(dt, move);
        const pPos = this.physicsSandboxMode!.player.position;
        camera.position.set(pPos.x, pPos.y + 4.5, pPos.z + 10.0);
        camera.lookAt(pPos.x, pPos.y + 1.2, pPos.z);
        this.sceneManager!.renderer.render(this.sceneManager!.scene, camera);

      } else if (this.currentMode === 'fluid_destruction') {
        this.fluidDestructionMode?.update(dt);
        camera.position.set(0, 8.5, 14.0);
        camera.lookAt(0, 1.0, 0);
        this.sceneManager!.renderer.render(this.sceneManager!.scene, camera);

      } else if (this.currentMode === 'swarm_survivor') {
        this.swarmSurvivorMode?.update(dt, move);
        const hPos = this.swarmSurvivorMode!.heroPos;
        camera.position.set(hPos.x, 14.0, hPos.z + 12.0);
        camera.lookAt(hPos.x, 0.5, hPos.z);
        this.sceneManager!.renderer.render(this.sceneManager!.scene, camera);

      } else if (this.currentMode === 'grid_building') {
        this.gridBuildingMode?.update(dt);
        camera.position.set(0, 16.0, 18.0);
        camera.lookAt(0, 0, 0);
        this.sceneManager!.renderer.render(this.sceneManager!.scene, camera);

      } else if (this.currentMode === 'stealth') {
        this.stealthMode?.update(dt, move);
        camera.position.set(0, 16.0, 16.0);
        camera.lookAt(0, 0, 0);
        this.sceneManager!.renderer.render(this.sceneManager!.scene, camera);

      } else if (this.currentMode === 'models') {
        this.showroomMode?.update(dt);
        camera.position.set(0, 3.8, 8.5);
        camera.lookAt(0, 1.2, 0);
        this.sceneManager!.renderer.render(this.sceneManager!.scene, camera);

      } else if (this.currentMode === 'vfx') {
        this.vfxMode?.update(dt);
        camera.position.set(0, 6.0, 12.0);
        camera.lookAt(0, 1.0, 0);
        this.sceneManager!.renderer.render(this.sceneManager!.scene, camera);

      } else if (this.currentMode === 'soundboard') {
        this.soundboardMode?.updateAndRender(dt);
        camera.position.set(0, 4.0, 10.0);
        camera.lookAt(0, 0, 0);
        this.sceneManager!.renderer.render(this.sceneManager!.scene, camera);
      }

      // 2D Pixi/Canvas Mode Rendering
      if (this.currentMode === 'pixijs_2d') {
        this.pixi2DMode?.updateAndRender(dt);
      }

      // ────────────────────────────────────────── CAMERA SHAKE TRAUMA
      if (this.trauma > 0.001) {
        const shake = this.trauma * this.trauma;
        const yaw = (Math.random() * 2 - 1) * this.maxShakeAngle * shake;
        const pitch = (Math.random() * 2 - 1) * this.maxShakeAngle * shake;
        const offX = (Math.random() * 2 - 1) * this.maxShakeOffset * shake;
        const offY = (Math.random() * 2 - 1) * this.maxShakeOffset * shake;

        camera.rotation.y += yaw;
        camera.rotation.x += pitch;
        camera.position.x += offX;
        camera.position.y += offY;

        this.trauma = Math.max(0, this.trauma - dt * 2.2);
      }
    };

    requestAnimationFrame(tick);
  }
}
