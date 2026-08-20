import * as THREE from 'three';
import { CameraController } from './CameraController';
import { DynamicLightManager } from './DynamicLightManager';

export class SceneRenderer {
  public scene: THREE.Scene;
  public renderer: THREE.WebGLRenderer;
  public cameraController: CameraController;
  public sunLight: THREE.DirectionalLight;
  public hemiLight: THREE.HemisphereLight;
  public rimLight: THREE.DirectionalLight;
  public dynamicLights: DynamicLightManager;

  private skyDome: THREE.Mesh;

  constructor(container: HTMLElement) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x181411);
    this.scene.fog = new THREE.FogExp2(0x181411, 0.007);

    this.cameraController = new CameraController();
    this.dynamicLights = new DynamicLightManager();

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;

    container.appendChild(this.renderer.domElement);

    // 1. Atmospheric Sky Dome
    this.skyDome = this.createSkyDome();
    this.scene.add(this.skyDome);

    // 2. Wasteland Directional Sun Light (Warm Golden / Amber Sun)
    this.sunLight = new THREE.DirectionalLight(0xfff0db, 2.5);
    this.sunLight.position.set(45, 65, 35);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 5;
    this.sunLight.shadow.camera.far = 175;
    const d = 48;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    // normalBias eliminates shadow acne on curved geometry (wheels, car hoods, zombies)
    this.sunLight.shadow.normalBias = 0.04;
    this.sunLight.shadow.bias = -0.0003;
    this.scene.add(this.sunLight);

    // 3. Hemisphere Ambient Light (Warm dusty sky + Dark earthy soil bounce)
    this.hemiLight = new THREE.HemisphereLight(0xffdfba, 0x221814, 1.15);
    this.scene.add(this.hemiLight);

    // 4. Cool Rim / Key Fill Light (Gives crisp 3D edge separation on metal and silhouettes)
    this.rimLight = new THREE.DirectionalLight(0x5c88b0, 0.8);
    this.rimLight.position.set(-40, 25, -40);
    this.scene.add(this.rimLight);

    // 5. Dynamic Flash Light Pool
    this.scene.add(this.dynamicLights.group);

    window.addEventListener('resize', this.onResize.bind(this));
  }

  private createSkyDome(): THREE.Mesh {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Vertical atmospheric gradient: Dark dusk zenith -> Dusty orange-gold wasteland horizon
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, '#100c0a');
    grad.addColorStop(0.35, '#1e1612');
    grad.addColorStop(0.7, '#3d2517');
    grad.addColorStop(0.9, '#63371f');
    grad.addColorStop(1.0, '#7f4523');

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);

    const texture = new THREE.CanvasTexture(canvas);
    const geo = new THREE.SphereGeometry(240, 32, 16);
    const mat = new THREE.MeshBasicMaterial({
      map: texture,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = -10;
    return mesh;
  }

  private onResize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer.setSize(w, h);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.cameraController.resize(w, h);
  }

  public updateSunTarget(targetPos: THREE.Vector3): void {
    this.sunLight.position.set(targetPos.x + 40, 60, targetPos.z + 30);
    this.sunLight.target.position.copy(targetPos);
    this.sunLight.target.updateMatrixWorld();

    this.rimLight.position.set(targetPos.x - 40, 25, targetPos.z - 40);
    this.skyDome.position.set(targetPos.x, -10, targetPos.z);
  }

  public update(dt: number): void {
    this.dynamicLights.update(dt);
  }

  public render(): void {
    this.renderer.render(this.scene, this.cameraController.camera);
  }
}
