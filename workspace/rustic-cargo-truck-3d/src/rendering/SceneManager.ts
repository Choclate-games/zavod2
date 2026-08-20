import * as THREE from 'three';

export class SceneManager {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(52, 1, 0.1, 560);
  readonly renderer: THREE.WebGLRenderer;
  readonly roadGroup = new THREE.Group();
  readonly decorationGroup = new THREE.Group();
  readonly truckGroup = new THREE.Group();
  readonly cargoGroup = new THREE.Group();
  readonly particleGroup = new THREE.Group();

  readonly materials = {
    terrain: new THREE.MeshLambertMaterial({ vertexColors: true }),
    pine: new THREE.MeshLambertMaterial({ color: 0x274a38 }),
    pineDark: new THREE.MeshLambertMaterial({ color: 0x1c372b }),
    pineMed: new THREE.MeshLambertMaterial({ color: 0x274d39 }),
    pineLight: new THREE.MeshLambertMaterial({ color: 0x38674d }),
    trunk: new THREE.MeshLambertMaterial({ color: 0x59422e }),

    birchTrunk: new THREE.MeshLambertMaterial({ color: 0xd6d1c4 }),
    birchLeaves: new THREE.MeshLambertMaterial({ color: 0x6e8e3d }),
    bush: new THREE.MeshLambertMaterial({ color: 0x446d37 }),
    rock: new THREE.MeshLambertMaterial({ color: 0x636159 }),
    rockDark: new THREE.MeshLambertMaterial({ color: 0x46443e }),
    woodPlank: new THREE.MeshLambertMaterial({ color: 0x96734d }),
    signBoard: new THREE.MeshLambertMaterial({ color: 0xd4a86a }),
    banner: new THREE.MeshLambertMaterial({ color: 0xbd3a2b }),
    house: new THREE.MeshLambertMaterial({ color: 0x875a3c }),
    roof: new THREE.MeshLambertMaterial({ color: 0x43362a }),
    foundation: new THREE.MeshLambertMaterial({ color: 0x54524c }),
    mudTrack: new THREE.MeshLambertMaterial({ color: 0x302014, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    mudParticle: new THREE.MeshLambertMaterial({ color: 0x3b2817 }),
    water: new THREE.MeshLambertMaterial({ color: 0x3b7582, transparent: true, opacity: 0.72, depthWrite: false }),
    waterParticle: new THREE.MeshLambertMaterial({ color: 0x93cbd6, transparent: true, opacity: 0.75 }),
    smokeParticle: new THREE.MeshLambertMaterial({ color: 0xd8d3cb, transparent: true, opacity: 0.55 }),
    truck: new THREE.MeshLambertMaterial({ color: 0xc75c32 }),
    truckDark: new THREE.MeshLambertMaterial({ color: 0x51362b }),
    metal: new THREE.MeshLambertMaterial({ color: 0xb4a991 }),
    glass: new THREE.MeshLambertMaterial({ color: 0x9fc4c9 }),
    tire: new THREE.MeshLambertMaterial({ color: 0x242522 }),
    log: new THREE.MeshLambertMaterial({ color: 0x9b633d }),
    logEnd: new THREE.MeshLambertMaterial({ color: 0xd4a16c }),
    crate: new THREE.MeshLambertMaterial({ color: 0xb68148 }),
    crateDark: new THREE.MeshLambertMaterial({ color: 0x7a5127 }),
    barrel: new THREE.MeshLambertMaterial({ color: 0x2c5378 }),
    barrelBand: new THREE.MeshLambertMaterial({ color: 0xd4a837 }),
    concrete: new THREE.MeshLambertMaterial({ color: 0x7d8182 }),
    hay: new THREE.MeshLambertMaterial({ color: 0xd9b852 }),
    hayBand: new THREE.MeshLambertMaterial({ color: 0x423320 }),
    pipe: new THREE.MeshLambertMaterial({ color: 0x40464d }),
    pipeEnd: new THREE.MeshLambertMaterial({ color: 0x6e7782 }),
    fragile: new THREE.MeshLambertMaterial({ color: 0xe6e0d3 }),
    fragileCross: new THREE.MeshLambertMaterial({ color: 0xc93232 }),
    rollcage: new THREE.MeshLambertMaterial({ color: 0x2a2c2e }),
    gold: new THREE.MeshLambertMaterial({ color: 0xf0b832 }),
  };

  private readonly lookTarget = new THREE.Vector3();
  private readonly cameraTarget = new THREE.Vector3();
  private readonly aim = new THREE.Vector3();
  private readonly smoothedForward = new THREE.Vector3(0, 0, 1);
  private readonly sky = new THREE.Color(0x95ad9e);
  private sun: THREE.DirectionalLight | null = null;
  private garageOrbitAngle = 0;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setClearColor(this.sky, 1);
  }

  initialize(): void {
    this.renderer.domElement.className = 'game-canvas';
    this.renderer.domElement.addEventListener('contextmenu', (event) => event.preventDefault());
    document.getElementById('game-root')?.append(this.renderer.domElement);
    this.scene.fog = new THREE.Fog(0x95ad9e, 90, 360);
    this.scene.add(this.roadGroup, this.decorationGroup, this.truckGroup, this.cargoGroup, this.particleGroup);
    this.scene.add(new THREE.HemisphereLight(0xe4ede2, 0x504130, 2.2));

    const sun = new THREE.DirectionalLight(0xffc583, 3.4);
    sun.position.set(-35, 50, -25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -32;
    sun.shadow.camera.right = 32;
    sun.shadow.camera.top = 32;
    sun.shadow.camera.bottom = -32;
    sun.shadow.camera.far = 160;
    sun.shadow.bias = -0.0012;
    this.scene.add(sun, sun.target);
    this.sun = sun;

    this.camera.position.set(0, 5.2, -11);
  }

  private followSun(target: THREE.Vector3): void {
    const sun = this.sun;
    if (!sun) return;
    sun.target.position.copy(target);
    sun.target.updateMatrixWorld();
    sun.position.set(target.x - 35, target.y + 50, target.z - 25);
  }

  onResize = (): void => {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(width, height, false);
  };

  /**
   * Smooth, stable chase camera.
   * Smoothes vehicle heading to eliminate jitter on bumps and avoids disorienting reverse yaw swings.
   */
  render(target: THREE.Vector3, forward: THREE.Vector3, speed: number): void {
    const forwardXZ = new THREE.Vector3(forward.x, 0, forward.z);
    if (forwardXZ.lengthSq() < 1e-4) forwardXZ.set(0, 0, 1);
    forwardXZ.normalize();

    // Smooth forward heading to follow truck orientation without jarring
    this.smoothedForward.lerp(forwardXZ, 0.12).normalize();

    const distance = 10.2 + Math.min(2.8, Math.max(0, speed) * 0.06);
    const heightOffset = 4.2;

    this.cameraTarget
      .copy(target)
      .addScaledVector(this.smoothedForward, -distance)
      .setY(target.y + heightOffset);

    this.camera.position.lerp(this.cameraTarget, 0.10);

    // Look directly at the truck chassis center to prevent counter-steer screen drift
    this.aim
      .copy(target)
      .setY(target.y + 1.2);

    this.lookTarget.lerp(this.aim, 0.16);
    this.camera.lookAt(this.lookTarget);

    this.followSun(target);
    this.renderer.render(this.scene, this.camera);
  }

  /** Showroom camera for the Garage */
  renderGarage(target: THREE.Vector3, dt: number): void {
    this.garageOrbitAngle += dt * 0.35;
    const radius = 7.4;
    const camX = target.x + Math.sin(this.garageOrbitAngle) * radius;
    const camZ = target.z + Math.cos(this.garageOrbitAngle) * radius;
    const camY = target.y + 2.8;

    this.cameraTarget.set(camX, camY, camZ);
    this.camera.position.lerp(this.cameraTarget, 0.12);

    this.lookTarget.set(target.x, target.y + 1.1, target.z);
    this.camera.lookAt(this.lookTarget);

    this.followSun(target);
    this.renderer.render(this.scene, this.camera);
  }

  resetCamera(target: THREE.Vector3): void {
    this.smoothedForward.set(0, 0, 1);
    this.camera.position.copy(target).add(new THREE.Vector3(0, 4.2, -10.2));
    this.lookTarget.copy(target).add(new THREE.Vector3(0, 1.2, 0));
    this.camera.lookAt(this.lookTarget);
  }

  clearGroup(group: THREE.Group): void {
    while (group.children.length > 0) {
      const child = group.children[group.children.length - 1];
      child.traverse((object) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.InstancedMesh) object.geometry.dispose();
      });
      group.remove(child);
    }
  }
}
