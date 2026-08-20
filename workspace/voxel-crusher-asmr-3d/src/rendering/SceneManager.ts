import * as THREE from 'three';

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;

  private container: HTMLElement;
  private keyLight!: THREE.DirectionalLight;
  private ambientLight!: THREE.AmbientLight;
  private rimLight1!: THREE.DirectionalLight;
  private rimLight2!: THREE.DirectionalLight;

  private isShaking = false;
  private shakeIntensity = 0;
  private baseCamPos = new THREE.Vector3(0, 7.2, 11.5);
  private baseLookAt = new THREE.Vector3(0, 0.4, 0);

  constructor(container: HTMLElement) {
    this.container = container;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x12141c);
    this.scene.fog = new THREE.FogExp2(0x12141c, 0.035);

    // Camera setup per specification: FOV: 42°, Pitch: ~38°
    const aspect = container.clientWidth / (container.clientHeight || 1);
    this.camera = new THREE.PerspectiveCamera(42, aspect, 0.1, 100);
    this.camera.position.copy(this.baseCamPos);
    this.camera.lookAt(this.baseLookAt);

    // WebGL Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      powerPreference: 'high-performance',
      antialias: true,
      alpha: false
    });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    const maxDpr = ('ontouchstart' in window || navigator.maxTouchPoints > 0) ? 1.25 : Math.min(window.devicePixelRatio, 1.75);
    this.renderer.setPixelRatio(maxDpr);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    container.appendChild(this.renderer.domElement);

    this.setupLighting();
    this.setupStudioEnvironment();
    this.setupResizeListener();
  }

  private setupLighting(): void {
    // Ambient Light (soft studio fill)
    this.ambientLight = new THREE.AmbientLight(0x8da2be, 1.1);
    this.scene.add(this.ambientLight);

    // Key Directional Light with soft shadows
    this.keyLight = new THREE.DirectionalLight(0xffffff, 2.0);
    this.keyLight.position.set(6, 14, 8);
    this.keyLight.castShadow = true;
    this.keyLight.shadow.mapSize.width = 512;
    this.keyLight.shadow.mapSize.height = 512;
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 30;
    const shadowDist = 6;
    this.keyLight.shadow.camera.left = -shadowDist;
    this.keyLight.shadow.camera.right = shadowDist;
    this.keyLight.shadow.camera.top = shadowDist;
    this.keyLight.shadow.camera.bottom = -shadowDist;
    this.keyLight.shadow.bias = -0.0005;
    this.scene.add(this.keyLight);

    // Rim Cyan Light
    this.rimLight1 = new THREE.DirectionalLight(0x00f2fe, 1.2);
    this.rimLight1.position.set(-8, 5, -6);
    this.scene.add(this.rimLight1);

    // Rim Warm Light
    this.rimLight2 = new THREE.DirectionalLight(0xff5722, 0.9);
    this.rimLight2.position.set(8, 3, -6);
    this.scene.add(this.rimLight2);
  }

  private setupStudioEnvironment(): void {
    // Studio curved floor / backdrop
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x161a24,
      roughness: 0.85,
      metalness: 0.15
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -4.5;
    floor.receiveShadow = true;
    this.scene.add(floor);

    // Funnel / Hopper Chute Guides above rollers
    const chuteMat = new THREE.MeshStandardMaterial({
      color: 0x242b3d,
      roughness: 0.6,
      metalness: 0.4
    });

    const chuteGeoLeft = new THREE.BoxGeometry(0.2, 5, 4);
    const chuteLeft = new THREE.Mesh(chuteGeoLeft, chuteMat);
    chuteLeft.position.set(-2.2, 3.2, 0);
    chuteLeft.rotation.z = -0.15;
    chuteLeft.castShadow = true;
    chuteLeft.receiveShadow = true;
    this.scene.add(chuteLeft);

    const chuteRight = new THREE.Mesh(chuteGeoLeft, chuteMat);
    chuteRight.position.set(2.2, 3.2, 0);
    chuteRight.rotation.z = 0.15;
    chuteRight.castShadow = true;
    chuteRight.receiveShadow = true;
    this.scene.add(chuteRight);

    // Bottom Collection Basket / Hopper Box
    const basketMat = new THREE.MeshStandardMaterial({
      color: 0x1e2433,
      roughness: 0.5,
      metalness: 0.6
    });

    const basketBack = new THREE.Mesh(new THREE.BoxGeometry(4.8, 2.2, 0.2), basketMat);
    basketBack.position.set(0, -3.2, -1.8);
    basketBack.receiveShadow = true;
    this.scene.add(basketBack);

    const basketFront = new THREE.Mesh(new THREE.BoxGeometry(4.8, 1.4, 0.2), basketMat);
    basketFront.position.set(0, -3.6, 1.8);
    basketFront.receiveShadow = true;
    this.scene.add(basketFront);

    // Basket internal glow light
    const basketGlow = new THREE.PointLight(0xffd700, 1.0, 5);
    basketGlow.position.set(0, -3.0, 0);
    this.scene.add(basketGlow);
  }

  public triggerScreenShake(intensity = 0.08): void {
    this.isShaking = true;
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
  }

  public update(dt: number): void {
    if (this.isShaking) {
      const offsetX = (Math.random() * 2 - 1) * this.shakeIntensity;
      const offsetY = (Math.random() * 2 - 1) * this.shakeIntensity;
      this.camera.position.set(
        this.baseCamPos.x + offsetX,
        this.baseCamPos.y + offsetY,
        this.baseCamPos.z
      );
      this.shakeIntensity = Math.max(0, this.shakeIntensity - dt * 0.5);
      if (this.shakeIntensity <= 0.005) {
        this.isShaking = false;
        this.camera.position.copy(this.baseCamPos);
      }
    }
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private setupResizeListener(): void {
    window.addEventListener('resize', () => {
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      if (w > 0 && h > 0) {
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(w, h);
      }
    });
  }
}
