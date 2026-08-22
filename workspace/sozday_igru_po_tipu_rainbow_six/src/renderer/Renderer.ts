import * as THREE from "three";

export class Renderer {
  public renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement;
  private currentPixelRatio = 1.0;
  private resolutionScale = 1.0;
  private width = window.innerWidth;
  private height = window.innerHeight;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: "high-performance",
      stencil: false,
      depth: true,
    });

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;

    this.currentPixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
    this.renderer.setPixelRatio(this.currentPixelRatio);

    this.handleResize();
    window.addEventListener("resize", () => this.handleResize());
  }

  handleResize(): void {
    const w = window.visualViewport ? window.visualViewport.width : window.innerWidth;
    const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;

    this.width = Math.floor(w);
    this.height = Math.floor(h);

    this.renderer.setSize(this.width * this.resolutionScale, this.height * this.resolutionScale, false);
    this.canvas.style.width = `${this.width}px`;
    this.canvas.style.height = `${this.height}px`;
  }

  setResolutionScale(scale: number): void {
    this.resolutionScale = Math.max(0.7, Math.min(1.0, scale));
    this.handleResize();
  }

  render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.renderer.render(scene, camera);
  }

  getWidth(): number {
    return this.width;
  }

  getHeight(): number {
    return this.height;
  }

  getAspectRatio(): number {
    return this.width / Math.max(1, this.height);
  }
}
