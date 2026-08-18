import * as THREE from 'three';
import { AdaptiveQuality } from './AdaptiveQuality.ts';
import { ModelBuilder } from './ModelBuilder.ts';

export class SceneManager {
  public container: HTMLElement;
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public quality: AdaptiveQuality;

  public dirLight: THREE.DirectionalLight;
  public hemiLight: THREE.HemisphereLight;

  // Raycasting
  public raycaster: THREE.Raycaster;
  public mousePos: THREE.Vector2;
  public groundPlane: THREE.Plane;

  // Ocean wave mesh
  private oceanMesh: THREE.Mesh;
  private oceanTime: number = 0;

  // Camera Target & Pan Controls
  public cameraTarget: THREE.Vector3 = new THREE.Vector3(0, 0, 0);
  public cameraDistance: number = 24;
  public minDistance: number = 12;
  public maxDistance: number = 36;
  public cameraPitch: number = 55 * (Math.PI / 180); // 55 degrees

  constructor(container: HTMLElement) {
    this.container = container;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x228896); // Tropical sea turquoise horizon
    this.scene.fog = new THREE.FogExp2(0x228896, 0.018);

    // 2. Camera (Isometric Top-Down 3D)
    this.camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.5,
      150
    );
    this.updateCameraPosition();

    // 3. WebGL Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: false,
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // 4. Lighting Setup
    this.hemiLight = new THREE.HemisphereLight(0xCCE7FF, 0xF7D070, 0.75);
    this.hemiLight.position.set(0, 50, 0);
    this.scene.add(this.hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xFFF6D6, 1.35);
    this.dirLight.position.set(20, 35, 18);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.camera.top = 22;
    this.dirLight.shadow.camera.bottom = -22;
    this.dirLight.shadow.camera.left = -22;
    this.dirLight.shadow.camera.right = 22;
    this.dirLight.shadow.camera.near = 1;
    this.dirLight.shadow.camera.far = 80;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    // 5. Adaptive Quality Governor
    this.quality = new AdaptiveQuality(this.renderer);
    this.quality.setSunLight(this.dirLight);

    // 6. Raycasting
    this.raycaster = new THREE.Raycaster();
    this.mousePos = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

    // 7. Ocean & Scenery Decoration
    this.oceanMesh = this.createOcean();
    this.scene.add(this.oceanMesh);
    this.createDecorations();

    // 8. Window resize handler
    window.addEventListener('resize', this.onResize.bind(this));
  }

  private createOcean(): THREE.Mesh {
    const geo = new THREE.PlaneGeometry(120, 120, 32, 32);
    geo.rotateX(-Math.PI / 2);
    const mat = new THREE.MeshLambertMaterial({
      color: 0x29C5B5,
      transparent: true,
      opacity: 0.85,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(0, -0.05, 0);
    return mesh;
  }

  private createDecorations(): void {
    // Palm Trees around the borders
    const palmPositions = [
      [-16, -11], [-14, 11], [-18, 5], [-17, -6],
      [16, -11], [15, 11], [18, 3], [17, -5],
      [5, 12], [-5, 12], [0, -12], [8, -12]
    ];

    palmPositions.forEach(([px, pz]) => {
      const palm = ModelBuilder.createPalmTree();
      palm.position.set(px, 0, pz);
      palm.rotation.y = Math.random() * Math.PI * 2;
      palm.scale.setScalar(0.9 + Math.random() * 0.3);
      this.scene.add(palm);
    });

    // Beach Umbrellas
    const umbrella1 = ModelBuilder.createBeachUmbrella();
    umbrella1.position.set(-13, 0, 8);
    this.scene.add(umbrella1);

    const umbrella2 = ModelBuilder.createBeachUmbrella();
    umbrella2.position.set(14, 0, -8);
    this.scene.add(umbrella2);
  }

  public updateCameraPosition(): void {
    const cy = this.cameraDistance * Math.sin(this.cameraPitch);
    const cz = this.cameraDistance * Math.cos(this.cameraPitch);
    this.camera.position.set(this.cameraTarget.x, this.cameraTarget.y + cy, this.cameraTarget.z + cz);
    this.camera.lookAt(this.cameraTarget);
  }

  public panCamera(deltaX: number, deltaZ: number): void {
    this.cameraTarget.x = Math.max(-10, Math.min(10, this.cameraTarget.x + deltaX));
    this.cameraTarget.z = Math.max(-8, Math.min(8, this.cameraTarget.z + deltaZ));
    this.updateCameraPosition();
  }

  public zoomCamera(delta: number): void {
    this.cameraDistance = Math.max(this.minDistance, Math.min(this.maxDistance, this.cameraDistance + delta));
    this.updateCameraPosition();
  }

  public raycastGround(screenX: number, screenY: number): THREE.Vector3 | null {
    this.mousePos.x = (screenX / window.innerWidth) * 2 - 1;
    this.mousePos.y = -(screenY / window.innerHeight) * 2 + 1;
    this.raycaster.setFromCamera(this.mousePos, this.camera);

    const hit = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.groundPlane, hit)) {
      return hit;
    }
    return null;
  }

  public render(dt: number): void {
    this.oceanTime += dt;
    // Subtle ocean tide bobbing
    if (this.oceanMesh) {
      this.oceanMesh.position.y = -0.05 + Math.sin(this.oceanTime * 1.5) * 0.03;
    }

    const now = performance.now();
    this.quality.onRenderFrame(now);
    this.renderer.render(this.scene, this.camera);
  }

  public onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }
}
