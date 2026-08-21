import * as THREE from 'three';
import { ParticleSystem } from './ParticleSystem';
import { TireTracksManager } from './TireTracksManager';

export class SceneManager {
  private static instance: SceneManager;

  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly renderer: THREE.WebGLRenderer;

  // Scene structure groups
  readonly environmentGroup = new THREE.Group();
  readonly trackGroup = new THREE.Group();
  readonly entityGroup = new THREE.Group();

  // Particle & Track Managers
  readonly particles: ParticleSystem;
  readonly tireTracks: TireTracksManager;

  // Camera dynamics
  private cameraTarget = new THREE.Vector3();
  private lookTarget = new THREE.Vector3();
  private smoothedForward = new THREE.Vector3(0, 0, 1);
  private currentFov = 60;
  private shakeIntensity = 0;
  private shakeDecay = 5.0;

  // Bullet time orbit camera mode
  public isCinematicOrbit = false;
  private orbitCenter = new THREE.Vector3();
  private orbitDistance = 5.2;
  private orbitAngle = 0;

  static get(container?: HTMLElement): SceneManager {
    if (!SceneManager.instance && container) {
      SceneManager.instance = new SceneManager(container);
    }
    return SceneManager.instance;
  }

  constructor(container: HTMLElement) {
    // 1. Scene & Atmosphere
    this.scene.background = new THREE.Color(0x060810);
    this.scene.fog = new THREE.FogExp2(0x060810, 0.012);

    this.scene.add(this.environmentGroup);
    this.scene.add(this.trackGroup);
    this.scene.add(this.entityGroup);

    // 2. Camera
    this.camera = new THREE.PerspectiveCamera(
      60,
      window.innerWidth / window.innerHeight,
      0.5,
      600
    );
    this.camera.position.set(0, 12, -18);
    this.camera.lookAt(0, 0, 0);

    // 3. Renderer
    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: true,
      stencil: false,
      depth: true,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    container.appendChild(this.renderer.domElement);

    // 4. Particle & Track Systems
    this.particles = new ParticleSystem(this.scene);
    this.tireTracks = new TireTracksManager(this.scene);

    // 5. Lights & City
    this.setupLighting();
    this.buildCityEnvironment();

    window.addEventListener('resize', () => this.onWindowResize());
  }

  private setupLighting(): void {
    // Ambient / Moon light
    const ambient = new THREE.AmbientLight(0x1a2638, 1.2);
    this.scene.add(ambient);

    // Main moonlight direction
    const dirLight = new THREE.DirectionalLight(0x88bbff, 2.2);
    dirLight.position.set(40, 70, -30);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.shadow.camera.near = 10;
    dirLight.shadow.camera.far = 180;
    dirLight.shadow.camera.left = -45;
    dirLight.shadow.camera.right = 45;
    dirLight.shadow.camera.top = 45;
    dirLight.shadow.camera.bottom = -45;
    dirLight.shadow.bias = -0.001;
    this.scene.add(dirLight);

    // Neon Accent Backlight
    const orangeRim = new THREE.DirectionalLight(0xff5500, 1.0);
    orangeRim.position.set(-50, 30, 50);
    this.scene.add(orangeRim);
  }

  private buildCityEnvironment(): void {
    // Wet Reflective Asphalt Ground
    const groundGeo = new THREE.PlaneGeometry(450, 450);
    groundGeo.rotateX(-Math.PI / 2);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x0a0c10,
      roughness: 0.25,
      metalness: 0.7,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.receiveShadow = true;
    this.environmentGroup.add(ground);

    // Road Grid Markings (Neon Cyan & Yellow)
    const roadLines = new THREE.Group();
    const lineMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.5 });
    const yellowMat = new THREE.MeshBasicMaterial({ color: 0xffaa00, transparent: true, opacity: 0.6 });

    for (let x = -180; x <= 180; x += 60) {
      const lineX = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 400).rotateX(-Math.PI / 2), yellowMat);
      lineX.position.set(x, 0.01, 0);
      roadLines.add(lineX);
    }
    for (let z = -180; z <= 180; z += 60) {
      const lineZ = new THREE.Mesh(new THREE.PlaneGeometry(400, 0.5).rotateX(-Math.PI / 2), lineMat);
      lineZ.position.set(0, 0.01, z);
      roadLines.add(lineZ);
    }
    this.environmentGroup.add(roadLines);

    // Distant Skyscrapers Skyline
    const buildingGeo = new THREE.BoxGeometry(1, 1, 1);
    const buildingMat = new THREE.MeshStandardMaterial({
      color: 0x070b14,
      roughness: 0.5,
      metalness: 0.8
    });
    const windowMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.6
    });

    const bldCount = 70;
    for (let i = 0; i < bldCount; i++) {
      const angle = (i / bldCount) * Math.PI * 2;
      const radius = 160 + Math.random() * 60;
      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;

      const w = 18 + Math.random() * 24;
      const d = 18 + Math.random() * 24;
      const h = 40 + Math.random() * 90;

      const bld = new THREE.Mesh(buildingGeo, buildingMat);
      bld.scale.set(w, h, d);
      bld.position.set(x, h / 2, z);
      bld.castShadow = true;
      this.environmentGroup.add(bld);

      // Window grid strips
      if (Math.random() > 0.3) {
        const win = new THREE.Mesh(
          new THREE.BoxGeometry(w * 0.9, h * 0.7, d * 1.01),
          windowMat
        );
        win.position.set(x, h / 2, z);
        this.environmentGroup.add(win);
      }
    }

    // Streetlights & Neon Props
    const lightCoords = [
      [-30, -30], [30, -30], [-30, 30], [30, 30],
      [-90, -90], [90, -90], [-90, 90], [90, 90],
      [-90, 0], [90, 0], [0, -90], [0, 90],
      [-60, 60], [60, -60]
    ];

    lightCoords.forEach(([lx, lz]) => {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.22, 9.0),
        new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.8 })
      );
      pole.position.set(lx, 4.5, lz);
      pole.castShadow = true;

      const bulb = new THREE.Mesh(
        new THREE.SphereGeometry(0.6, 8, 8),
        new THREE.MeshBasicMaterial({ color: 0x00f0ff })
      );
      bulb.position.set(lx, 9.2, lz);

      const pLight = new THREE.PointLight(0x00f0ff, 25, 28, 1.2);
      pLight.position.set(lx, 9.0, lz);

      this.environmentGroup.add(pole, bulb, pLight);
    });
  }

  public triggerScreenShake(intensity = 0.4): void {
    this.shakeIntensity = Math.min(1.0, this.shakeIntensity + intensity);
  }

  public triggerBulletTimeOrbit(targetPos: THREE.Vector3, distance = 5.2): void {
    this.isCinematicOrbit = true;
    this.orbitCenter.copy(targetPos);
    this.orbitDistance = distance;
    this.orbitAngle = 0;
  }

  public stopBulletTimeOrbit(): void {
    this.isCinematicOrbit = false;
  }

  public updateCamera(
    playerPos: THREE.Vector3,
    playerForward: THREE.Vector3,
    speedKmH: number,
    isDrifting: boolean,
    isNitro: boolean,
    dt: number
  ): void {
    if (this.isCinematicOrbit) {
      this.orbitAngle += dt * 2.5;
      const cx = this.orbitCenter.x + Math.cos(this.orbitAngle) * this.orbitDistance;
      const cz = this.orbitCenter.z + Math.sin(this.orbitAngle) * this.orbitDistance;
      const cy = this.orbitCenter.y + 2.4;

      this.camera.position.set(cx, cy, cz);
      this.camera.lookAt(this.orbitCenter.x, this.orbitCenter.y + 1.2, this.orbitCenter.z);
      return;
    }

    // Dynamic FOV (Nitro & Speed expansion)
    let targetFov = 60 + Math.min(18, speedKmH * 0.12);
    if (isNitro) targetFov = 82;
    this.currentFov = THREE.MathUtils.lerp(this.currentFov, targetFov, 6.0 * dt);
    this.camera.fov = this.currentFov;
    this.camera.updateProjectionMatrix();

    // Smoothed forward with counter-steer lookahead
    this.smoothedForward.lerp(playerForward, 5.0 * dt);

    const isPortrait = window.innerWidth < window.innerHeight;
    const baseDistance = isPortrait ? 12.0 : 10.5;
    const heightOffset = isPortrait ? 5.8 : 4.6;
    const speedBackOffset = Math.min(3.0, Math.max(0, speedKmH) * 0.025);

    const distance = baseDistance + speedBackOffset;

    this.cameraTarget
      .copy(playerPos)
      .addScaledVector(this.smoothedForward, -distance)
      .setY(playerPos.y + heightOffset);

    // Apply Screen Shake
    if (this.shakeIntensity > 0.001) {
      const sx = (Math.random() - 0.5) * this.shakeIntensity * 1.5;
      const sy = (Math.random() - 0.5) * this.shakeIntensity * 1.5;
      const sz = (Math.random() - 0.5) * this.shakeIntensity * 1.5;
      this.cameraTarget.add(new THREE.Vector3(sx, sy, sz));
      this.shakeIntensity = Math.max(0, this.shakeIntensity - this.shakeDecay * dt);
    }

    this.camera.position.lerp(this.cameraTarget, 8.0 * dt);
    this.lookTarget.lerp(
      new THREE.Vector3(playerPos.x, playerPos.y + 1.2, playerPos.z).addScaledVector(playerForward, 4.0),
      10.0 * dt
    );
    this.camera.lookAt(this.lookTarget);
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private onWindowResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
