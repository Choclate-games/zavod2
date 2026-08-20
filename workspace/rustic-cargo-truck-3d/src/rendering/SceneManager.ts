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
    waterParticle: new THREE.MeshLambertMaterial({ color: 0x82d0de, transparent: true, opacity: 0.70, depthWrite: false }),
    waterSpray: new THREE.MeshLambertMaterial({ color: 0x9fe6f2, transparent: true, opacity: 0.58, depthWrite: false, side: THREE.DoubleSide }),
    waterFoam: new THREE.MeshLambertMaterial({ color: 0xf4f9fb, transparent: true, opacity: 0.38, depthWrite: false }),
    waterRipple: new THREE.MeshLambertMaterial({ color: 0xa6ebf7, transparent: true, opacity: 0.50, depthWrite: false, side: THREE.DoubleSide }),
    waterMist: new THREE.MeshLambertMaterial({ color: 0xdaf2f7, transparent: true, opacity: 0.20, depthWrite: false }),
    dustParticle: new THREE.MeshLambertMaterial({ color: 0xbfad93, transparent: true, opacity: 0.28, depthWrite: false }),
    smokeParticle: new THREE.MeshLambertMaterial({ color: 0x2e2c2a, transparent: true, opacity: 0.50, depthWrite: false }),
    smokeIdle: new THREE.MeshLambertMaterial({ color: 0xb5b2ad, transparent: true, opacity: 0.20, depthWrite: false }),
    sparkParticle: new THREE.MeshBasicMaterial({ color: 0xffe066 }),
    leafGold: new THREE.MeshLambertMaterial({ color: 0xdf9b20, side: THREE.DoubleSide }),
    leafOrange: new THREE.MeshLambertMaterial({ color: 0xd95725, side: THREE.DoubleSide }),
    leafRed: new THREE.MeshLambertMaterial({ color: 0xab2328, side: THREE.DoubleSide }),
    confettiGold: new THREE.MeshBasicMaterial({ color: 0xffd21f, side: THREE.DoubleSide }),
    confettiPink: new THREE.MeshBasicMaterial({ color: 0xff3b69, side: THREE.DoubleSide }),
    confettiBlue: new THREE.MeshBasicMaterial({ color: 0x22a6f5, side: THREE.DoubleSide }),
    confettiGreen: new THREE.MeshBasicMaterial({ color: 0x2ec956, side: THREE.DoubleSide }),
    truck: new THREE.MeshLambertMaterial({ color: 0xc75c32 }),
    truckDark: new THREE.MeshLambertMaterial({ color: 0x51362b }),
    truckWhite: new THREE.MeshLambertMaterial({ color: 0xededeb }),
    truckCabTop: new THREE.MeshLambertMaterial({ color: 0xdfe2e5 }),
    chrome: new THREE.MeshLambertMaterial({ color: 0xe8e8e6 }),
    metal: new THREE.MeshLambertMaterial({ color: 0x9e988a }),
    metalDark: new THREE.MeshLambertMaterial({ color: 0x38393d }),
    glass: new THREE.MeshLambertMaterial({ color: 0xa5c9ce, transparent: true, opacity: 0.82 }),
    tire: new THREE.MeshLambertMaterial({ color: 0x222320 }),
    tireTread: new THREE.MeshLambertMaterial({ color: 0x1b1c1a }),
    rim: new THREE.MeshLambertMaterial({ color: 0xbbb6aa }),
    rimHub: new THREE.MeshLambertMaterial({ color: 0x48494b }),
    headlightGlass: new THREE.MeshBasicMaterial({ color: 0xfffae6 }),
    headlightBezel: new THREE.MeshLambertMaterial({ color: 0xd4d0c5 }),
    turnSignalAmber: new THREE.MeshBasicMaterial({ color: 0xf59e0b }),
    taillightRed: new THREE.MeshBasicMaterial({ color: 0xdd2222 }),
    mudflap: new THREE.MeshLambertMaterial({ color: 0x1a1a1b }),
    rubber: new THREE.MeshLambertMaterial({ color: 0x202124 }),
    suspensionSpring: new THREE.MeshLambertMaterial({ color: 0xd93829 }),
    jerryCanGreen: new THREE.MeshLambertMaterial({ color: 0x415b28 }),
    jerryCanRed: new THREE.MeshLambertMaterial({ color: 0xab2b24 }),
    exhaustDark: new THREE.MeshLambertMaterial({ color: 0x333130 }),
    hazardYellow: new THREE.MeshLambertMaterial({ color: 0xf2be22 }),
    woodDark: new THREE.MeshLambertMaterial({ color: 0x543922 }),
    interiorDark: new THREE.MeshLambertMaterial({ color: 0x262729 }),
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
  private readonly scratchForwardXZ = new THREE.Vector3();
  private readonly sky = new THREE.Color(0x95ad9e);
  private sun: THREE.DirectionalLight | null = null;
  private garageOrbitAngle = 0;

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.shadowMap.enabled = true;
    // PCFSoftShadowMap at 1024px gives visually acceptable soft shadows.
    // BasicShadowMap was too pixelated/aliased for this style of game.
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
    const aspect = width / height;
    this.camera.aspect = aspect;

    // Dynamic FOV for portrait vs landscape:
    // When in portrait (aspect < 1.0), expand vertical FOV to preserve horizontal field of view
    if (aspect < 1.0) {
      const baseFovRad = (52 * Math.PI) / 180;
      const targetFov = 2 * Math.atan(Math.tan(baseFovRad / 2) / aspect) * (180 / Math.PI);
      this.camera.fov = Math.max(52, Math.min(82, targetFov));
    } else {
      this.camera.fov = 52;
    }

    this.camera.updateProjectionMatrix();
    // Cap at 1.0 DPR: on retina/mobile screens 1.5+ DPR doubles GPU fillrate cost
    // with minimal visual improvement in a fast 3D game.
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.0));
    this.renderer.setSize(width, height, false);
  };

  /**
   * Smooth, stable chase camera.
   * Smoothes vehicle heading to eliminate jitter on bumps and avoids disorienting reverse yaw swings.
   */
  render(target: THREE.Vector3, forward: THREE.Vector3, speed: number): void {
    const forwardXZ = this.scratchForwardXZ.set(forward.x, 0, forward.z);
    if (forwardXZ.lengthSq() < 1e-4) forwardXZ.set(0, 0, 1);
    forwardXZ.normalize();

    // Smooth forward heading to follow truck orientation without jarring
    this.smoothedForward.lerp(forwardXZ, 0.12).normalize();

    const isPortrait = window.innerWidth < window.innerHeight;
    const baseDistance = isPortrait ? 11.6 : 10.2;
    const heightOffset = isPortrait ? 5.0 : 4.2;
    const lookHeight = isPortrait ? 1.4 : 1.2;

    const distance = baseDistance + Math.min(2.8, Math.max(0, speed) * 0.06);

    this.cameraTarget
      .copy(target)
      .addScaledVector(this.smoothedForward, -distance)
      .setY(target.y + heightOffset);

    this.camera.position.lerp(this.cameraTarget, 0.10);

    // Look directly at the truck chassis center to prevent counter-steer screen drift
    this.aim
      .copy(target)
      .setY(target.y + lookHeight);

    this.lookTarget.lerp(this.aim, 0.16);
    this.camera.lookAt(this.lookTarget);

    this.followSun(target);
    this.renderer.render(this.scene, this.camera);
  }

  /** Showroom camera for the Garage */
  renderGarage(target: THREE.Vector3, dt: number): void {
    this.garageOrbitAngle += dt * 0.35;
    const isPortrait = window.innerWidth < window.innerHeight;
    const radius = isPortrait ? 8.6 : 7.4;
    const camX = target.x + Math.sin(this.garageOrbitAngle) * radius;
    const camZ = target.z + Math.cos(this.garageOrbitAngle) * radius;
    const camY = target.y + (isPortrait ? 3.4 : 2.8);

    this.cameraTarget.set(camX, camY, camZ);
    this.camera.position.lerp(this.cameraTarget, 0.12);

    this.lookTarget.set(target.x, target.y + 1.1, target.z);
    this.camera.lookAt(this.lookTarget);

    this.followSun(target);
    this.renderer.render(this.scene, this.camera);
  }

  resetCamera(target: THREE.Vector3): void {
    this.smoothedForward.set(0, 0, 1);
    const isPortrait = window.innerWidth < window.innerHeight;
    const baseDistance = isPortrait ? 11.6 : 10.2;
    const heightOffset = isPortrait ? 5.0 : 4.2;
    const lookHeight = isPortrait ? 1.4 : 1.2;
    this.camera.position.copy(target).add(new THREE.Vector3(0, heightOffset, -baseDistance));
    this.lookTarget.copy(target).add(new THREE.Vector3(0, lookHeight, 0));
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
