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

  private skyCanvas: HTMLCanvasElement | null = null;
  private skyTexture: THREE.CanvasTexture | null = null;

  private createSkyDome(): THREE.Mesh {
    this.skyCanvas = document.createElement('canvas');
    this.skyCanvas.width = 512;
    this.skyCanvas.height = 512;
    this.drawSkyGradient(['#100c0a', '#1e1612', '#3d2517', '#63371f', '#7f4523']);

    this.skyTexture = new THREE.CanvasTexture(this.skyCanvas);
    const geo = new THREE.SphereGeometry(240, 32, 16);
    const mat = new THREE.MeshBasicMaterial({
      map: this.skyTexture,
      side: THREE.BackSide,
      fog: false,
      depthWrite: false,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = -10;
    return mesh;
  }

  private drawSkyGradient(colors: string[]): void {
    if (!this.skyCanvas) return;
    const ctx = this.skyCanvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 512);
    const stops = [0, 0.35, 0.7, 0.9, 1.0];
    for (let i = 0; i < colors.length; i++) {
      grad.addColorStop(stops[i] !== undefined ? stops[i] : i / (colors.length - 1), colors[i]);
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
  }

  public setBiome(biome = 'OUTSKIRTS'): void {
    interface BiomePreset {
      sunColor: number;
      sunIntensity: number;
      hemiSky: number;
      hemiGround: number;
      hemiIntensity: number;
      rimColor: number;
      rimIntensity: number;
      fogColor: number;
      fogDensity: number;
      skyColors: string[];
    }

    const presets: Record<string, BiomePreset> = {
      OUTSKIRTS: {
        sunColor: 0xfff0db,
        sunIntensity: 2.5,
        hemiSky: 0xffdfba,
        hemiGround: 0x221814,
        hemiIntensity: 1.15,
        rimColor: 0x5c88b0,
        rimIntensity: 0.8,
        fogColor: 0x181411,
        fogDensity: 0.007,
        skyColors: ['#100c0a', '#1e1612', '#3d2517', '#63371f', '#7f4523'],
      },
      INDUSTRIAL: {
        sunColor: 0xd0e0ff,
        sunIntensity: 2.3,
        hemiSky: 0x8fa3b8,
        hemiGround: 0x1c2229,
        hemiIntensity: 1.1,
        rimColor: 0x3a5f80,
        rimIntensity: 0.9,
        fogColor: 0x14181c,
        fogDensity: 0.008,
        skyColors: ['#0c1014', '#141a22', '#222c38', '#38485c', '#4a5e78'],
      },
      TOXIC: {
        sunColor: 0xccff99,
        sunIntensity: 2.4,
        hemiSky: 0x76c843,
        hemiGround: 0x152410,
        hemiIntensity: 1.2,
        rimColor: 0x3d7a22,
        rimIntensity: 0.9,
        fogColor: 0x101a0e,
        fogDensity: 0.0085,
        skyColors: ['#081206', '#121f0e', '#233d18', '#3e6627', '#5f993a'],
      },
      REFINERY: {
        sunColor: 0xff8833,
        sunIntensity: 2.6,
        hemiSky: 0xff5500,
        hemiGround: 0x261005,
        hemiIntensity: 1.25,
        rimColor: 0xcc2200,
        rimIntensity: 1.0,
        fogColor: 0x221008,
        fogDensity: 0.0075,
        skyColors: ['#140804', '#260f07', '#4a1b0a', '#75290d', '#a33912'],
      },
      NIGHT_NEON: {
        sunColor: 0x3366ff,
        sunIntensity: 1.4,
        hemiSky: 0x00f0ff,
        hemiGround: 0x08081a,
        hemiIntensity: 1.0,
        rimColor: 0xff00ff,
        rimIntensity: 1.1,
        fogColor: 0x070812,
        fogDensity: 0.009,
        skyColors: ['#030308', '#070714', '#0d1026', '#141e42', '#1a2e66'],
      },
      DUST_STORM: {
        sunColor: 0xffaa22,
        sunIntensity: 2.2,
        hemiSky: 0xdd8811,
        hemiGround: 0x2b1c08,
        hemiIntensity: 1.3,
        rimColor: 0x884400,
        rimIntensity: 0.8,
        fogColor: 0x2b1c08,
        fogDensity: 0.012,
        skyColors: ['#140e06', '#261a0a', '#4a3312', '#75501b', '#9e6d24'],
      },
      CRIMSON: {
        sunColor: 0xff2244,
        sunIntensity: 2.5,
        hemiSky: 0xcc0033,
        hemiGround: 0x200508,
        hemiIntensity: 1.2,
        rimColor: 0x880022,
        rimIntensity: 1.0,
        fogColor: 0x1e060a,
        fogDensity: 0.008,
        skyColors: ['#100204', '#1f0508', '#3d0810', '#630d1a', '#8a1224'],
      },
      NUCLEAR_ASH: {
        sunColor: 0xeeeeee,
        sunIntensity: 2.2,
        hemiSky: 0xb0b0b0,
        hemiGround: 0x181818,
        hemiIntensity: 1.1,
        rimColor: 0x666666,
        rimIntensity: 0.8,
        fogColor: 0x1a1a1a,
        fogDensity: 0.009,
        skyColors: ['#0a0a0a', '#141414', '#242424', '#383838', '#505050'],
      },
      INFERNAL: {
        sunColor: 0xff4400,
        sunIntensity: 2.7,
        hemiSky: 0x990033,
        hemiGround: 0x200010,
        hemiIntensity: 1.3,
        rimColor: 0xff0044,
        rimIntensity: 1.1,
        fogColor: 0x1c000c,
        fogDensity: 0.008,
        skyColors: ['#100008', '#200010', '#40001a', '#6b0028', '#99003a'],
      },
      APOCALYPSE: {
        sunColor: 0xff1111,
        sunIntensity: 3.0,
        hemiSky: 0x770000,
        hemiGround: 0x0d0003,
        hemiIntensity: 1.4,
        rimColor: 0xff0000,
        rimIntensity: 1.3,
        fogColor: 0x100004,
        fogDensity: 0.01,
        skyColors: ['#080002', '#140005', '#2b000b', '#4d0014', '#78001f'],
      },
    };

    const p = presets[biome] || presets.OUTSKIRTS;

    this.sunLight.color.setHex(p.sunColor);
    this.sunLight.intensity = p.sunIntensity;

    this.hemiLight.color.setHex(p.hemiSky);
    this.hemiLight.groundColor.setHex(p.hemiGround);
    this.hemiLight.intensity = p.hemiIntensity;

    this.rimLight.color.setHex(p.rimColor);
    this.rimLight.intensity = p.rimIntensity;

    this.scene.background = new THREE.Color(p.fogColor);
    if (this.scene.fog) {
      this.scene.fog.color.setHex(p.fogColor);
      (this.scene.fog as THREE.FogExp2).density = p.fogDensity;
    }

    this.drawSkyGradient(p.skyColors);
    if (this.skyTexture) {
      this.skyTexture.needsUpdate = true;
    }
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

