import * as THREE from 'three';

export class SceneManager {
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(52, 1, 0.1, 520);
  readonly renderer: THREE.WebGLRenderer;
  readonly roadGroup = new THREE.Group();
  readonly decorationGroup = new THREE.Group();
  readonly truckGroup = new THREE.Group();
  readonly cargoGroup = new THREE.Group();
  readonly materials = {
    /** One vertex-coloured material for the whole terrain ribbon: road and verges in a single draw call. */
    terrain: new THREE.MeshLambertMaterial({ vertexColors: true }),
    pine: new THREE.MeshLambertMaterial({ color: 0x315947 }),
    trunk: new THREE.MeshLambertMaterial({ color: 0x614b35 }),
    house: new THREE.MeshLambertMaterial({ color: 0x9a694b }),
    roof: new THREE.MeshLambertMaterial({ color: 0x493c32 }),
    truck: new THREE.MeshLambertMaterial({ color: 0xc75c32 }),
    truckDark: new THREE.MeshLambertMaterial({ color: 0x51362b }),
    metal: new THREE.MeshLambertMaterial({ color: 0xb4a991 }),
    glass: new THREE.MeshLambertMaterial({ color: 0x9fc4c9 }),
    tire: new THREE.MeshLambertMaterial({ color: 0x242522 }),
    log: new THREE.MeshLambertMaterial({ color: 0x9b633d }),
    logEnd: new THREE.MeshLambertMaterial({ color: 0xd4a16c }),
    crate: new THREE.MeshLambertMaterial({ color: 0xb68148 }),
  };
  private readonly lookTarget = new THREE.Vector3();
  private readonly cameraTarget = new THREE.Vector3();
  private readonly aim = new THREE.Vector3();
  private readonly flatForward = new THREE.Vector3(0, 0, 1);
  private readonly sky = new THREE.Color(0x9fb6aa);
  private sun: THREE.DirectionalLight | null = null;

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
    this.scene.fog = new THREE.Fog(0x9fb6aa, 80, 340);
    this.scene.add(this.roadGroup, this.decorationGroup, this.truckGroup, this.cargoGroup);
    this.scene.add(new THREE.HemisphereLight(0xdce8d8, 0x584634, 2.1));
    const sun = new THREE.DirectionalLight(0xffc17e, 3.5);
    sun.position.set(-30, 45, -25);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    // Tight box around the truck; it is re-centred every frame in followSun().
    sun.shadow.camera.left = -28;
    sun.shadow.camera.right = 28;
    sun.shadow.camera.top = 28;
    sun.shadow.camera.bottom = -28;
    sun.shadow.camera.far = 140;
    sun.shadow.bias = -0.0012;
    this.scene.add(sun, sun.target);
    this.sun = sun;
    this.camera.position.set(0, 6, -12);
  }

  /** A 300 m route needs the shadow frustum to travel with the truck, or shadows vanish after the first bend. */
  private followSun(target: THREE.Vector3): void {
    const sun = this.sun;
    if (!sun) return;
    sun.target.position.copy(target);
    sun.target.updateMatrixWorld();
    sun.position.set(target.x - 30, target.y + 45, target.z - 25);
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
   * Chase camera. The truck's forward vector is flattened onto the XZ plane first — following the
   * raw vector would roll the camera with the chassis every time a wheel drops into a rut.
   */
  render(target: THREE.Vector3, forward: THREE.Vector3, speed: number): void {
    this.flatForward.set(forward.x, 0, forward.z);
    if (this.flatForward.lengthSq() < 1e-4) this.flatForward.set(0, 0, 1);
    this.flatForward.normalize();
    const distance = 12 + Math.min(4, speed * 0.06);
    this.cameraTarget
      .copy(target)
      .addScaledVector(this.flatForward, -distance)
      .add(new THREE.Vector3(0, 5.6, 0));
    this.camera.position.lerp(this.cameraTarget, 0.08);
    this.aim.copy(target).addScaledVector(this.flatForward, 6).setY(target.y + 1.4);
    this.lookTarget.lerp(this.aim, 0.14);
    this.camera.lookAt(this.lookTarget);
    this.followSun(target);
    this.renderer.render(this.scene, this.camera);
  }

  /** Snap the camera behind the truck instead of sweeping across the map when a run starts. */
  resetCamera(target: THREE.Vector3): void {
    this.flatForward.set(0, 0, 1);
    this.camera.position.copy(target).add(new THREE.Vector3(0, 5.6, -12));
    this.lookTarget.copy(target).add(new THREE.Vector3(0, 1.4, 6));
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
