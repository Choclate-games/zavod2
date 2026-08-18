import * as THREE from 'three';

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  
  private container: HTMLElement;
  private cameraTarget: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  private cameraOffset: THREE.Vector3 = new THREE.Vector3(0, 14, 15);
  private shakeIntensity: number = 0;
  private shakeDecay: number = 5.0;

  // Blade Trail Ribbon
  private trailGeometry!: THREE.BufferGeometry;
  private trailMaterial!: THREE.MeshBasicMaterial;
  private trailMesh!: THREE.Mesh;
  private trailPoints: THREE.Vector3[] = [];
  private readonly MAX_TRAIL_POINTS = 32;

  // Adaptive Quality
  private lastRenderMs: number = 0;
  private avgFrameCadence: number = 16.6;
  private qualityLevel: number = 2; // 0: low, 1: med, 2: high

  constructor(container: HTMLElement) {
    this.container = container;

    // Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060814);
    this.scene.fog = new THREE.FogExp2(0x060814, 0.022);

    // Camera: Dynamic Isometric Action Angle (FOV: 52°, pitch ~42°)
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(52, aspect, 0.1, 200);
    this.camera.position.copy(this.cameraOffset);
    this.camera.lookAt(0, 0, 0);

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: true,
      alpha: false
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.container.appendChild(this.renderer.domElement);

    // Build Cyberpunk City Arena
    this.setupLighting();
    this.setupArenaEnvironment();
    this.setupTrailRibbon();

    window.addEventListener('resize', this.onWindowResize.bind(this));
  }

  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight(0x091428, 1.2);
    this.scene.add(ambientLight);

    const keyLight = new THREE.DirectionalLight(0xddeeff, 1.8);
    keyLight.position.set(15, 30, 20);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 1024;
    keyLight.shadow.mapSize.height = 1024;
    keyLight.shadow.camera.near = 5;
    keyLight.shadow.camera.far = 70;
    keyLight.shadow.camera.left = -22;
    keyLight.shadow.camera.right = 22;
    keyLight.shadow.camera.top = 22;
    keyLight.shadow.camera.bottom = -22;
    this.scene.add(keyLight);

    const cyanRim = new THREE.PointLight(0x00f3ff, 2.5, 45);
    cyanRim.position.set(-18, 6, -15);
    this.scene.add(cyanRim);

    const magentaRim = new THREE.PointLight(0xff0055, 2.5, 45);
    magentaRim.position.set(18, 6, -15);
    this.scene.add(magentaRim);

    const yellowAccent = new THREE.PointLight(0xffd700, 1.5, 30);
    yellowAccent.position.set(0, 8, 16);
    this.scene.add(yellowAccent);
  }

  private setupArenaEnvironment(): void {
    const floorGeo = new THREE.PlaneGeometry(50, 50, 32, 32);
    floorGeo.rotateX(-Math.PI / 2);

    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0a0f1d,
      roughness: 0.2,
      metalness: 0.8
    });

    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.receiveShadow = true;
    this.scene.add(floor);

    const gridHelper = new THREE.GridHelper(50, 25, 0x00f3ff, 0x1a2942);
    gridHelper.position.y = 0.02;
    this.scene.add(gridHelper);

    const pillarGeo = new THREE.CylinderGeometry(0.3, 0.4, 6, 8);
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x111c2e,
      emissive: 0x00f3ff,
      emissiveIntensity: 0.6,
      metalness: 0.9,
      roughness: 0.2
    });

    const arenaRadius = 22;
    const pillarCount = 16;
    for (let i = 0; i < pillarCount; i++) {
      const angle = (i / pillarCount) * Math.PI * 2;
      const p = new THREE.Mesh(pillarGeo, pillarMat);
      p.position.set(Math.cos(angle) * arenaRadius, 3, Math.sin(angle) * arenaRadius);
      p.castShadow = true;
      this.scene.add(p);
    }

    const cityGroup = new THREE.Group();
    const buildingColors = [0x081020, 0x0c172c, 0x101b33];

    for (let i = 0; i < 36; i++) {
      const dist = 32 + Math.random() * 30;
      const angle = Math.random() * Math.PI * 2;
      const width = 6 + Math.random() * 8;
      const depth = 6 + Math.random() * 8;
      const height = 20 + Math.random() * 45;

      const buildingGeo = new THREE.BoxGeometry(width, height, depth);
      const buildingMat = new THREE.MeshStandardMaterial({
        color: buildingColors[Math.floor(Math.random() * buildingColors.length)],
        roughness: 0.4,
        metalness: 0.7
      });

      const b = new THREE.Mesh(buildingGeo, buildingMat);
      b.position.set(Math.cos(angle) * dist, height / 2 - 5, Math.sin(angle) * dist);
      cityGroup.add(b);

      if (Math.random() > 0.4) {
        const stripGeo = new THREE.PlaneGeometry(width * 0.8, height * 0.08);
        const stripColor = Math.random() > 0.5 ? 0x00f3ff : 0xff0055;
        const stripMat = new THREE.MeshBasicMaterial({
          color: stripColor,
          side: THREE.DoubleSide
        });
        const strip = new THREE.Mesh(stripGeo, stripMat);
        strip.position.copy(b.position);
        strip.position.y += (Math.random() - 0.2) * (height * 0.4);
        strip.position.z += depth / 2 + 0.1;
        cityGroup.add(strip);
      }
    }
    this.scene.add(cityGroup);
  }

  private setupTrailRibbon(): void {
    const positions = new Float32Array(this.MAX_TRAIL_POINTS * 3 * 2);
    this.trailGeometry = new THREE.BufferGeometry();
    this.trailGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    this.trailMaterial = new THREE.MeshBasicMaterial({
      color: 0x00f3ff,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false
    });

    this.trailMesh = new THREE.Mesh(this.trailGeometry, this.trailMaterial);
    this.trailMesh.frustumCulled = false;
    this.scene.add(this.trailMesh);
  }

  public addTrailPoint(point: THREE.Vector3): void {
    this.trailPoints.unshift(point.clone());
    if (this.trailPoints.length > this.MAX_TRAIL_POINTS) {
      this.trailPoints.pop();
    }
    this.updateTrailRibbon();
  }

  public setTrailColor(colorHex: number): void {
    this.trailMaterial.color.setHex(colorHex);
  }

  public clearTrail(): void {
    this.trailPoints = [];
    this.updateTrailRibbon();
  }

  private updateTrailRibbon(): void {
    const posAttr = this.trailGeometry.getAttribute('position') as THREE.BufferAttribute;
    const array = posAttr.array as Float32Array;

    const width = 0.45;
    for (let i = 0; i < this.MAX_TRAIL_POINTS; i++) {
      const idx = i * 6;
      if (i < this.trailPoints.length) {
        const pt = this.trailPoints[i];
        const progress = i / this.MAX_TRAIL_POINTS;
        const currentWidth = width * (1 - progress);

        array[idx] = pt.x;
        array[idx + 1] = pt.y + currentWidth;
        array[idx + 2] = pt.z;

        array[idx + 3] = pt.x;
        array[idx + 4] = pt.y - currentWidth;
        array[idx + 5] = pt.z;
      } else {
        array[idx] = 0;
        array[idx + 1] = -999;
        array[idx + 2] = 0;
        array[idx + 3] = 0;
        array[idx + 4] = -999;
        array[idx + 5] = 0;
      }
    }
    posAttr.needsUpdate = true;
  }

  public setCameraTarget(target: THREE.Vector3): void {
    this.cameraTarget.copy(target);
  }

  public triggerScreenShake(intensity: number = 0.5): void {
    this.shakeIntensity = Math.min(1.5, this.shakeIntensity + intensity);
  }

  public update(dt: number): void {
    const desiredPos = this.cameraTarget.clone().add(this.cameraOffset);
    this.camera.position.lerp(desiredPos, 6.0 * dt);

    if (this.shakeIntensity > 0.01) {
      const shakeX = (Math.random() - 0.5) * this.shakeIntensity;
      const shakeY = (Math.random() - 0.5) * this.shakeIntensity;
      const shakeZ = (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.add(new THREE.Vector3(shakeX, shakeY, shakeZ));
      this.shakeIntensity = Math.max(0, this.shakeIntensity - this.shakeDecay * dt);
    }

    this.camera.lookAt(this.cameraTarget.x, this.cameraTarget.y + 0.8, this.cameraTarget.z);

    if (this.trailPoints.length > 0) {
      this.trailPoints.pop();
      this.updateTrailRibbon();
    }
  }

  public render(): void {
    const now = performance.now();
    if (this.lastRenderMs > 0) {
      const rdt = now - this.lastRenderMs;
      if (rdt < 400) {
        this.avgFrameCadence = this.avgFrameCadence * 0.9 + rdt * 0.1;
        this.autoTuneQuality();
      }
    }
    this.lastRenderMs = now;

    this.renderer.render(this.scene, this.camera);
  }

  private autoTuneQuality(): void {
    if (this.avgFrameCadence > 22 && this.qualityLevel > 0) {
      this.qualityLevel--;
      if (this.qualityLevel === 0) {
        this.renderer.setPixelRatio(1.0);
        this.renderer.shadowMap.enabled = false;
      }
    }
  }

  private onWindowResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  public screenToWorldPlane(screenX: number, screenY: number, targetY: number = 1.0): THREE.Vector3 | null {
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2(
      (screenX / window.innerWidth) * 2 - 1,
      -(screenY / window.innerHeight) * 2 + 1
    );
    raycaster.setFromCamera(ndc, this.camera);

    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -targetY);
    const target = new THREE.Vector3();
    const hit = raycaster.ray.intersectPlane(plane, target);
    return hit ? target : null;
  }
}
