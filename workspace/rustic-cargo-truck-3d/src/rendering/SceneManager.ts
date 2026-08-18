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
    road: new THREE.MeshLambertMaterial({ color: 0x80694b }),
    roadEdge: new THREE.MeshLambertMaterial({ color: 0x5d513c }),
    grass: new THREE.MeshLambertMaterial({ color: 0x6e8c58 }),
    pine: new THREE.MeshLambertMaterial({ color: 0x315947 }),
    pineLight: new THREE.MeshLambertMaterial({ color: 0x557c54 }),
    trunk: new THREE.MeshLambertMaterial({ color: 0x614b35 }),
    house: new THREE.MeshLambertMaterial({ color: 0x9a694b }),
    roof: new THREE.MeshLambertMaterial({ color: 0x493c32 }),
    truck: new THREE.MeshLambertMaterial({ color: 0xc75c32 }),
    truckDark: new THREE.MeshLambertMaterial({ color: 0x51362b }),
    metal: new THREE.MeshLambertMaterial({ color: 0xb4a991 }),
    tire: new THREE.MeshLambertMaterial({ color: 0x242522 }),
    log: new THREE.MeshLambertMaterial({ color: 0x9b633d }),
    logEnd: new THREE.MeshLambertMaterial({ color: 0xd4a16c }),
    crate: new THREE.MeshLambertMaterial({ color: 0xb68148 }),
  };
  private readonly lookTarget = new THREE.Vector3();
  private readonly cameraTarget = new THREE.Vector3();
  private readonly sky = new THREE.Color(0x9fb6aa);

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
    sun.position.set(-35, 60, -35);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -80;
    sun.shadow.camera.right = 80;
    sun.shadow.camera.top = 100;
    sun.shadow.camera.bottom = -20;
    this.scene.add(sun);
    this.camera.position.set(12, 8, -18);
  }

  onResize = (): void => {
    const width = Math.max(1, window.innerWidth);
    const height = Math.max(1, window.innerHeight);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(width, height, false);
  };

  render(truckZ: number, speed: number): void {
    const cameraOffsetZ = -18 - Math.min(3, speed * 0.03);
    this.cameraTarget.set(0, 2.1, truckZ + 3);
    this.camera.position.x += (12 - this.camera.position.x) * 0.06;
    this.camera.position.y += (7.5 - this.camera.position.y) * 0.06;
    this.camera.position.z += (truckZ + cameraOffsetZ - this.camera.position.z) * 0.08;
    this.lookTarget.lerp(this.cameraTarget, 0.12);
    this.camera.lookAt(this.lookTarget);
    this.renderer.render(this.scene, this.camera);
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
