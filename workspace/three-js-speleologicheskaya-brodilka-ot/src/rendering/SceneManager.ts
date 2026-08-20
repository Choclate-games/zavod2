import * as THREE from "three";
import { PointCloudRenderer } from "./PointCloudRenderer";
import { ParticleEffects } from "./ParticleEffects";
import { MathUtils } from "../utils/MathUtils";

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  public pointCloud: PointCloudRenderer;
  public fx: ParticleEffects;

  private canvas: HTMLCanvasElement;
  private cameraTarget: THREE.Vector3 = new THREE.Vector3();
  private cameraOffset: THREE.Vector3 = new THREE.Vector3(0, 15, 13);
  private currentCameraPos: THREE.Vector3 = new THREE.Vector3(0, 15, 13);

  // Screen shake
  private shakeIntensity: number = 0;
  private shakeDuration: number = 0;

  // Lighting
  public playerLight: THREE.PointLight;
  private ambientLight: THREE.AmbientLight;

  constructor(canvasId: string = "game-canvas") {
    this.canvas = document.getElementById(canvasId) as HTMLCanvasElement;

    // 1. Scene
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x02050c);
    this.scene.fog = new THREE.FogExp2(0x02050c, 0.03);

    // 2. Camera (Isometric 45° Pitch, 50° FOV)
    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(50, aspect, 0.1, 200);
    this.camera.position.set(0, 15, 13);
    this.camera.lookAt(0, 0, 0);

    // 3. Renderer with strict performance parameters
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    // 4. PointCloud & FX Subsystems
    this.pointCloud = new PointCloudRenderer(65000);
    this.scene.add(this.pointCloud.pointsMesh);

    this.fx = new ParticleEffects(this.scene);

    // 5. Lighting (Dark pitch black with local glowing sources)
    this.ambientLight = new THREE.AmbientLight(0x0a1428, 0.3);
    this.scene.add(this.ambientLight);

    this.playerLight = new THREE.PointLight(0x00f0ff, 1.8, 14, 1.8);
    this.playerLight.position.set(0, 2, 0);
    this.scene.add(this.playerLight);

    // Resize listener
    window.addEventListener("resize", () => this.onResize());
  }

  public setCameraTarget(target: THREE.Vector3): void {
    this.cameraTarget.copy(target);
  }

  public triggerScreenShake(intensity: number = 0.5, duration: number = 0.3): void {
    this.shakeIntensity = intensity;
    this.shakeDuration = duration;
  }

  public update(dt: number): void {
    // 1. Smooth Camera Follow
    const desiredPos = this.cameraTarget.clone().add(this.cameraOffset);
    this.currentCameraPos.lerp(desiredPos, 1 - Math.exp(-8.0 * dt));

    // Screen Shake
    if (this.shakeDuration > 0) {
      this.shakeDuration -= dt;
      const ox = MathUtils.randomRange(-1, 1) * this.shakeIntensity;
      const oz = MathUtils.randomRange(-1, 1) * this.shakeIntensity;
      this.camera.position.set(
        this.currentCameraPos.x + ox,
        this.currentCameraPos.y,
        this.currentCameraPos.z + oz
      );
    } else {
      this.camera.position.copy(this.currentCameraPos);
    }

    this.camera.lookAt(
      this.cameraTarget.x,
      this.cameraTarget.y + 0.8,
      this.cameraTarget.z
    );

    // 2. Update PointCloud & FX
    this.pointCloud.update(dt);
    this.fx.update(dt);
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  public onResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
  }

  public clearSceneObjects(): void {
    this.pointCloud.clear();
    this.fx.clear();
  }
}
