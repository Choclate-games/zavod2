import * as THREE from 'three';

export interface BaseObjectRef {
  mesh: THREE.Object3D;
  id: string;
  type: 'terrain' | 'building' | 'tower' | 'spotlight' | 'barrel' | 'cable' | 'enemy';
}

export class SceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public renderer: THREE.WebGLRenderer;
  private canvas: HTMLCanvasElement;
  private snowParticles: THREE.Points | null = null;
  private spotlights: THREE.SpotLight[] = [];
  private baseObjects: BaseObjectRef[] = [];
  private currentZoom = 4; // 4x, 8x, 16x
  private baseFov = 45;
  private targetFov = 30;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b1017);
    this.scene.fog = new THREE.FogExp2(0x0b1017, 0.0035);

    const aspect = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(this.baseFov, aspect, 0.5, 2000);
    this.camera.position.set(0, 45, 380); // Sniper vantage point overlooking the base
    this.camera.lookAt(0, 10, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.setupLighting();
    this.setupEnvironment();
    this.setupBlizzard();

    window.addEventListener('resize', () => this.onWindowResize());
  }

  private setupLighting(): void {
    // Ambient moonlight
    const ambientLight = new THREE.AmbientLight(0x1a2634, 0.6);
    this.scene.add(ambientLight);

    // Directional moonlight (cool blue)
    const moonLight = new THREE.DirectionalLight(0x8ba4c9, 0.4);
    moonLight.position.set(150, 200, 100);
    moonLight.castShadow = true;
    moonLight.shadow.mapSize.width = 1024;
    moonLight.shadow.mapSize.height = 1024;
    moonLight.shadow.camera.near = 50;
    moonLight.shadow.camera.far = 600;
    moonLight.shadow.camera.left = -200;
    moonLight.shadow.camera.right = 200;
    moonLight.shadow.camera.top = 200;
    moonLight.shadow.camera.bottom = -200;
    this.scene.add(moonLight);

    // Patrol spotlights on the base (warm tungsten)
    const spot1 = new THREE.SpotLight(0xffeedd, 3.5, 120, Math.PI / 6, 0.4, 1.2);
    spot1.position.set(-30, 32, 0);
    spot1.target.position.set(-20, 0, 20);
    spot1.castShadow = true;
    this.scene.add(spot1);
    this.scene.add(spot1.target);
    this.spotlights.push(spot1);

    const spot2 = new THREE.SpotLight(0xffd8a8, 3.0, 100, Math.PI / 5, 0.3, 1.2);
    spot2.position.set(40, 28, -20);
    spot2.target.position.set(30, 0, 10);
    spot2.castShadow = true;
    this.scene.add(spot2);
    this.scene.add(spot2.target);
    this.spotlights.push(spot2);
  }

  private setupEnvironment(): void {
    // Snow ground terrain
    const groundGeo = new THREE.PlaneGeometry(1000, 1000, 64, 64);
    groundGeo.rotateX(-Math.PI / 2);

    // Add some terrain elevation variation
    const posAttr = groundGeo.attributes.position;
    for (let i = 0; i < posAttr.count; i++) {
      const vx = posAttr.getX(i);
      const vz = posAttr.getZ(i);
      const dist = Math.sqrt(vx * vx + vz * vz);
      let vy = Math.sin(vx * 0.02) * Math.cos(vz * 0.02) * 3;
      if (dist > 150) {
        vy += (dist - 150) * 0.25; // Mountains around perimeter
      }
      posAttr.setY(i, vy);
    }
    groundGeo.computeVertexNormals();

    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xd8e2ec,
      roughness: 0.9,
      metalness: 0.1
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);

    // Radar dome building
    const domeGeo = new THREE.SphereGeometry(18, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const domeMat = new THREE.MeshStandardMaterial({ color: 0x4a5568, roughness: 0.7, metalness: 0.2 });
    const domeMesh = new THREE.Mesh(domeGeo, domeMat);
    domeMesh.position.set(0, 10, -50);
    domeMesh.castShadow = true;
    this.scene.add(domeMesh);

    const baseGeo = new THREE.CylinderGeometry(20, 20, 10, 24);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x2d3748, roughness: 0.8 });
    const baseMesh = new THREE.Mesh(baseGeo, baseMat);
    baseMesh.position.set(0, 5, -50);
    baseMesh.castShadow = true;
    this.scene.add(baseMesh);

    // Concrete bunkers and guard towers
    this.createGuardTower(-40, 0, 10, 'tower_west');
    this.createGuardTower(50, 0, -10, 'tower_east');
    this.createBunker(-15, 0, 30, 25, 6, 16);
    this.createBunker(20, 0, 40, 30, 7, 20);
  }

  private createGuardTower(x: number, y: number, z: number, id: string): void {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Legs
    const legGeo = new THREE.CylinderGeometry(0.4, 0.4, 25, 8);
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.4, roughness: 0.6 });

    const leg1 = new THREE.Mesh(legGeo, metalMat);
    leg1.position.set(-3, 12.5, -3);
    group.add(leg1);

    const leg2 = new THREE.Mesh(legGeo, metalMat);
    leg2.position.set(3, 12.5, -3);
    group.add(leg2);

    const leg3 = new THREE.Mesh(legGeo, metalMat);
    leg3.position.set(-3, 12.5, 3);
    group.add(leg3);

    const leg4 = new THREE.Mesh(legGeo, metalMat);
    leg4.position.set(3, 12.5, 3);
    group.add(leg4);

    // Platform cabin
    const cabinGeo = new THREE.BoxGeometry(8, 5, 8);
    const cabinMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.8 });
    const cabin = new THREE.Mesh(cabinGeo, cabinMat);
    cabin.position.set(0, 26, 0);
    cabin.castShadow = true;
    group.add(cabin);

    this.scene.add(group);
    this.baseObjects.push({ mesh: group, id, type: 'tower' });
  }

  private createBunker(x: number, y: number, z: number, w: number, h: number, d: number): void {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.9, metalness: 0.1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, y + h / 2, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    this.baseObjects.push({ mesh, id: `bunker_${x}_${z}`, type: 'building' });
  }

  private setupBlizzard(): void {
    const count = 3500;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(count * 3);
    const vels = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 500;
      pos[i * 3 + 1] = Math.random() * 100;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 500 + 150;

      vels[i * 3] = -4 - Math.random() * 6; // wind drift X
      vels[i * 3 + 1] = -1.5 - Math.random() * 2.5; // gravity Y
      vels[i * 3 + 2] = (Math.random() - 0.5) * 2;
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('velocity', new THREE.BufferAttribute(vels, 3));

    const mat = new THREE.PointsMaterial({
      color: 0xe2e8f0,
      size: 1.2,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending
    });

    this.snowParticles = new THREE.Points(geo, mat);
    this.scene.add(this.snowParticles);
  }

  public updateBlizzard(dt: number, windSpeed: number): void {
    if (!this.snowParticles) return;
    const posAttr = this.snowParticles.geometry.attributes.position as THREE.BufferAttribute;
    const velAttr = this.snowParticles.geometry.attributes.velocity as THREE.BufferAttribute;

    const count = posAttr.count;
    for (let i = 0; i < count; i++) {
      let x = posAttr.getX(i);
      let y = posAttr.getY(i);
      let z = posAttr.getZ(i);

      const vx = velAttr.getX(i) - windSpeed * 0.4;
      const vy = velAttr.getY(i);
      const vz = velAttr.getZ(i);

      x += vx * dt;
      y += vy * dt;
      z += vz * dt;

      if (y < 0) {
        y = 90 + Math.random() * 10;
        x = (Math.random() - 0.5) * 400 + 100;
      }
      if (x < -250) x = 250;

      posAttr.setXYZ(i, x, y, z);
    }
    posAttr.needsUpdate = true;
  }

  public setZoom(level: 4 | 8 | 16): void {
    this.currentZoom = level;
    if (level === 4) this.targetFov = 30;
    else if (level === 8) this.targetFov = 16;
    else if (level === 16) this.targetFov = 8;
  }

  public getZoom(): number {
    return this.currentZoom;
  }

  public updateCamera(dt: number, pitchOffset: number, yawOffset: number, breathFovDelta = 0): void {
    // Smooth FOV zoom
    this.camera.fov = THREE.MathUtils.lerp(this.camera.fov, this.targetFov - breathFovDelta, dt * 8);
    this.camera.updateProjectionMatrix();

    // Aim orientation
    const baseTarget = new THREE.Vector3(0, 10, 0);
    baseTarget.x += yawOffset * 150;
    baseTarget.y += pitchOffset * 100;
    this.camera.lookAt(baseTarget);
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera);
  }

  private onWindowResize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  public getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
}
