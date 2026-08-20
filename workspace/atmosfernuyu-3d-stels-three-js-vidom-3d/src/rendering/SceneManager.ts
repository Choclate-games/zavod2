import * as THREE from 'three';
import { createSonarRingMaterial } from './Shaders';
import { MeshPool } from './MeshPool';

export interface QualitySetting {
  pixelRatio: number;
  shadowMapSize: number;
  enableShadows: boolean;
}

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public meshPool: MeshPool;

  private canvas: HTMLCanvasElement;
  private cameraTarget = new THREE.Vector3();
  private cameraOffset = new THREE.Vector3(0, 18, 18);
  private currentCameraPos = new THREE.Vector3();

  // Screen shake
  private shakeTime = 0;
  private shakeDuration = 0;
  private shakeMagnitude = 0;

  // Hit-stop freeze
  public hitstopTimer = 0;

  // Sonar Ripple Effect
  private sonarMesh!: THREE.Mesh;
  private sonarMaterial!: THREE.ShaderMaterial;
  private sonarRadius = 0;
  private sonarMaxRadius = 14;
  private isSonarActive = false;

  // Quality governor
  private qualityLevels: QualitySetting[] = [
    { pixelRatio: 1.0, shadowMapSize: 512, enableShadows: false },
    { pixelRatio: 1.25, shadowMapSize: 1024, enableShadows: true },
    { pixelRatio: 1.5, shadowMapSize: 1024, enableShadows: true },
  ];
  private currentQualityIndex = 2; // Start optimistic
  private lastRenderTime = performance.now();
  private frameCadenceEMA = 16.67;

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#141c13');
    this.scene.fog = new THREE.FogExp2('#141c13', 0.022);

    // Camera setup (Isometric 45-degree angle)
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(48, aspect, 0.1, 150);
    this.camera.position.copy(this.cameraOffset);
    this.camera.lookAt(0, 0, 0);

    // WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    this.meshPool = new MeshPool(this.scene);

    this.setupLighting();
    this.buildEnvironment();
    this.setupSonarMesh();
    this.setupResizeListener();
  }

  private setupLighting(): void {
    // Soft ambient green/earth light
    const ambient = new THREE.AmbientLight('#a8c99e', 0.85);
    this.scene.add(ambient);

    // Warm directional sunlight / library lantern
    const sunLight = new THREE.DirectionalLight('#fff4d4', 1.8);
    sunLight.position.set(16, 32, 18);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 1;
    sunLight.shadow.camera.far = 70;
    const d = 30;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    sunLight.shadow.bias = -0.0005;
    this.scene.add(sunLight);

    // Subtle blue/green rim light
    const rimLight = new THREE.DirectionalLight('#4caf50', 0.6);
    rimLight.position.set(-15, 12, -15);
    this.scene.add(rimLight);
  }

  private buildEnvironment(): void {
    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(64, 64, 32, 32);
    const groundMat = new THREE.MeshStandardMaterial({
      color: '#283625',
      roughness: 0.85,
      metalness: 0.1,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.scene.add(ground);

    // Surrounding boundary walls & library bookshelves
    const shelfGeo = new THREE.BoxGeometry(3, 5.5, 1.2);
    const shelfMat = new THREE.MeshStandardMaterial({
      color: '#3e2723',
      roughness: 0.7,
    });

    const bookColors = ['#e53935', '#1e88e5', '#fdd835', '#43a047'];

    // Place boundary bookcases and ruins
    for (let i = -28; i <= 28; i += 7) {
      this.createBookcase(i, -28, 0, shelfGeo, shelfMat, bookColors);
      this.createBookcase(i, 28, 0, shelfGeo, shelfMat, bookColors);
      this.createBookcase(-28, i, Math.PI / 2, shelfGeo, shelfMat, bookColors);
      this.createBookcase(28, i, Math.PI / 2, shelfGeo, shelfMat, bookColors);
    }

    // Interior obstacle bookshelves forming stealth maze alleys
    const mazePositions = [
      { x: -14, z: -10, rot: 0 },
      { x: -14, z: 10, rot: 0 },
      { x: 14, z: -10, rot: 0 },
      { x: 14, z: 10, rot: 0 },
      { x: -6, z: 0, rot: Math.PI / 2 },
      { x: 6, z: 0, rot: Math.PI / 2 },
      { x: 0, z: -16, rot: 0 },
      { x: 0, z: 16, rot: 0 },
    ];

    mazePositions.forEach((pos) => {
      this.createBookcase(pos.x, pos.z, pos.rot, shelfGeo, shelfMat, bookColors);
    });

    // Glowing lanterns & magic mushrooms
    this.createGlowingProps();
  }

  private createBookcase(
    x: number,
    z: number,
    rot: number,
    geo: THREE.BoxGeometry,
    mat: THREE.Material,
    bookColors: string[]
  ): void {
    const group = new THREE.Group();
    group.position.set(x, 2.75, z);
    group.rotation.y = rot;

    const shelf = new THREE.Mesh(geo, mat);
    shelf.castShadow = true;
    shelf.receiveShadow = true;
    group.add(shelf);

    // Add colorful book rows
    for (let row = -1.8; row <= 1.8; row += 1.2) {
      for (let b = -1.1; b <= 1.1; b += 0.4) {
        const bookGeo = new THREE.BoxGeometry(0.28, 0.8, 0.9);
        const bookMat = new THREE.MeshLambertMaterial({
          color: bookColors[Math.floor(Math.random() * bookColors.length)],
        });
        const book = new THREE.Mesh(bookGeo, bookMat);
        book.position.set(b, row, 0.1);
        group.add(book);
      }
    }

    this.scene.add(group);
  }

  private createGlowingProps(): void {
    const propLocations = [
      { x: -8, z: -8 }, { x: 8, z: -8 }, { x: -8, z: 8 }, { x: 8, z: 8 },
      { x: -20, z: 0 }, { x: 20, z: 0 }, { x: 0, z: -20 }, { x: 0, z: 20 }
    ];

    const mushroomGeo = new THREE.SphereGeometry(0.4, 8, 8);
    const mushroomMat = new THREE.MeshStandardMaterial({
      color: '#81c784',
      emissive: '#4caf50',
      emissiveIntensity: 0.6,
    });

    propLocations.forEach((loc) => {
      const mushroom = new THREE.Mesh(mushroomGeo, mushroomMat);
      mushroom.position.set(loc.x, 0.4, loc.z);
      this.scene.add(mushroom);

      const light = new THREE.PointLight('#81c784', 0.8, 6);
      light.position.set(loc.x, 1.2, loc.z);
      this.scene.add(light);
    });
  }

  private setupSonarMesh(): void {
    const geo = new THREE.PlaneGeometry(36, 36);
    this.sonarMaterial = createSonarRingMaterial();
    this.sonarMesh = new THREE.Mesh(geo, this.sonarMaterial);
    this.sonarMesh.rotation.x = -Math.PI / 2;
    this.sonarMesh.position.y = 0.05;
    this.sonarMesh.visible = false;
    this.scene.add(this.sonarMesh);
  }

  triggerSonar(center: THREE.Vector3, maxRadius = 14): void {
    this.sonarRadius = 0;
    this.sonarMaxRadius = maxRadius;
    this.isSonarActive = true;
    this.sonarMesh.visible = true;
    this.sonarMesh.position.x = center.x;
    this.sonarMesh.position.z = center.z;
    this.sonarMaterial.uniforms.uCenter.value.set(center.x, center.z);
    this.sonarMaterial.uniforms.uMaxRadius.value = maxRadius;
  }

  triggerScreenShake(duration = 0.25, magnitude = 0.4): void {
    this.shakeDuration = duration;
    this.shakeTime = duration;
    this.shakeMagnitude = magnitude;
  }

  triggerHitstop(duration = 0.04): void {
    this.hitstopTimer = duration;
  }

  private setupResizeListener(): void {
    window.addEventListener('resize', () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    });
  }

  updateCamera(targetPos: THREE.Vector3, dt: number): void {
    // Smooth target follow
    this.cameraTarget.lerp(targetPos, Math.min(dt * 6, 1));
    this.currentCameraPos.copy(this.cameraTarget).add(this.cameraOffset);

    // Apply screen shake
    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      const progress = this.shakeTime / this.shakeDuration;
      const mag = this.shakeMagnitude * progress;
      this.currentCameraPos.x += (Math.random() - 0.5) * mag;
      this.currentCameraPos.y += (Math.random() - 0.5) * mag;
      this.currentCameraPos.z += (Math.random() - 0.5) * mag;
    }

    this.camera.position.copy(this.currentCameraPos);
    this.camera.lookAt(this.cameraTarget);
  }

  update(dt: number, targetPos: THREE.Vector3): void {
    // Hitstop freeze
    if (this.hitstopTimer > 0) {
      this.hitstopTimer -= dt;
      return;
    }

    this.updateCamera(targetPos, dt);
    this.meshPool.update(dt);

    // Sonar ring expansion
    if (this.isSonarActive) {
      this.sonarRadius += dt * 18;
      this.sonarMaterial.uniforms.uRadius.value = this.sonarRadius;
      if (this.sonarRadius >= this.sonarMaxRadius) {
        this.isSonarActive = false;
        this.sonarMesh.visible = false;
      }
    }
  }

  render(): void {
    // Auto-tune quality before render
    this.adaptQuality();
    this.renderer.render(this.scene, this.camera);
    this.lastRenderTime = performance.now();
  }

  private adaptQuality(): void {
    const now = performance.now();
    const delta = now - this.lastRenderTime;
    this.frameCadenceEMA = this.frameCadenceEMA * 0.9 + delta * 0.1;

    // If frame cadence drops below 45 FPS (> 22ms) for sustained periods, degrade quality
    if (this.frameCadenceEMA > 24 && this.currentQualityIndex > 0) {
      this.currentQualityIndex--;
      const q = this.qualityLevels[this.currentQualityIndex];
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, q.pixelRatio));
      this.renderer.shadowMap.enabled = q.enableShadows;
    }
  }
}
