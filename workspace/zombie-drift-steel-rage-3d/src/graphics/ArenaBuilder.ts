import * as THREE from 'three';
import { ARENA_SIZE, ARENA_HALF } from '../core/Constants';

export class ArenaBuilder {
  public group = new THREE.Group();
  public obstacles: THREE.Box3[] = [];
  public barrels: { mesh: THREE.Group; position: THREE.Vector3; health: number; exploded: boolean }[] = [];
  private pulsingMaterials: THREE.MeshStandardMaterial[] = [];

  constructor() {
    this.buildGround();
    this.buildPerimeterBarriers();
    this.buildFloodlightTowers();
    this.buildScatterProps();
  }

  private createGroundTextures(): { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
    // 1. Color Map
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Wasteland dark gritty asphalt / dirt base
    ctx.fillStyle = '#1c1815';
    ctx.fillRect(0, 0, 1024, 1024);

    // Dirt noise & asphalt pebbles
    for (let i = 0; i < 6000; i++) {
      const rx = Math.random() * 1024;
      const ry = Math.random() * 1024;
      const rw = Math.random() * 5 + 1.5;
      const shade = Math.floor(25 + Math.random() * 20);
      ctx.fillStyle = `rgb(${shade + 5}, ${shade}, ${shade - 3})`;
      ctx.fillRect(rx, ry, rw, rw);
    }

    // Asphalt cracks
    ctx.strokeStyle = '#120f0d';
    ctx.lineWidth = 3;
    for (let c = 0; c < 30; c++) {
      let cx = Math.random() * 1024;
      let cy = Math.random() * 1024;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let s = 0; s < 6; s++) {
        cx += (Math.random() - 0.5) * 60;
        cy += (Math.random() - 0.5) * 60;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }

    // Grid markings / concrete slab seams
    ctx.strokeStyle = '#15110e';
    ctx.lineWidth = 3;
    const step = 128;
    for (let x = 0; x < 1024; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1024);
      ctx.stroke();
    }
    for (let y = 0; y < 1024; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    // Dark oily slick puddles in arena center & zones
    const puddleCenters = [
      { x: 512, y: 512, r: 80 },
      { x: 260, y: 320, r: 60 },
      { x: 780, y: 720, r: 70 },
      { x: 300, y: 780, r: 50 },
      { x: 740, y: 280, r: 65 },
    ];
    puddleCenters.forEach((p) => {
      const grad = ctx.createRadialGradient(p.x, p.y, p.r * 0.2, p.x, p.y, p.r);
      grad.addColorStop(0, 'rgba(12, 10, 9, 0.85)');
      grad.addColorStop(0.7, 'rgba(18, 15, 12, 0.45)');
      grad.addColorStop(1.0, 'rgba(28, 24, 21, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    });

    // Yellow & Red Hazard Demolition Markings in Center
    ctx.strokeStyle = '#d49b43';
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(512, 512, 220, 0, Math.PI * 2);
    ctx.stroke();

    // Hazard stripes ring
    ctx.save();
    ctx.translate(512, 512);
    for (let a = 0; a < Math.PI * 2; a += 0.25) {
      ctx.fillStyle = (Math.floor(a * 4) % 2 === 0) ? '#d49b43' : '#1e1b18';
      ctx.beginPath();
      ctx.arc(0, 0, 225, a, a + 0.15);
      ctx.arc(0, 0, 205, a + 0.15, a, true);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    ctx.strokeStyle = '#c1121f';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(512, 512, 140, 0, Math.PI * 2);
    ctx.stroke();

    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(4, 4);

    // 2. Roughness / Specular Map: Puddles are very smooth (reflective), asphalt is rough
    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = 512;
    roughCanvas.height = 512;
    const rCtx = roughCanvas.getContext('2d')!;

    rCtx.fillStyle = '#d5d5d5'; // Rough base asphalt (~0.85 roughness)
    rCtx.fillRect(0, 0, 512, 512);

    puddleCenters.forEach((p) => {
      const px = p.x / 2;
      const py = p.y / 2;
      const pr = p.r / 2;
      const grad = rCtx.createRadialGradient(px, py, pr * 0.1, px, py, pr);
      grad.addColorStop(0, '#444444'); // Very smooth/shiny oil reflection
      grad.addColorStop(0.8, '#888888');
      grad.addColorStop(1.0, '#d5d5d5');
      rCtx.fillStyle = grad;
      rCtx.beginPath();
      rCtx.arc(px, py, pr, 0, Math.PI * 2);
      rCtx.fill();
    });

    const roughnessMap = new THREE.CanvasTexture(roughCanvas);
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.repeat.set(4, 4);

    return { map, roughnessMap };
  }

  private buildGround(): void {
    const groundGeo = new THREE.PlaneGeometry(ARENA_SIZE, ARENA_SIZE, 32, 32);
    const { map, roughnessMap } = this.createGroundTextures();

    const groundMat = new THREE.MeshStandardMaterial({
      map,
      roughnessMap,
      roughness: 0.85,
      metalness: 0.18,
    });

    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  private buildPerimeterBarriers(): void {
    const wallHeight = 3.6;
    const containerLength = 8.0;
    const containerWidth = 2.4;

    const containerMat1 = new THREE.MeshStandardMaterial({ color: 0x943d2c, roughness: 0.65, metalness: 0.55 });
    const containerMat2 = new THREE.MeshStandardMaterial({ color: 0x334d6e, roughness: 0.7, metalness: 0.5 });
    const containerMat3 = new THREE.MeshStandardMaterial({ color: 0xc4974f, roughness: 0.8, metalness: 0.4 });
    const mats = [containerMat1, containerMat2, containerMat3];

    const wallGeom = new THREE.BoxGeometry(containerLength, wallHeight, containerWidth);

    const placeWallSide = (startX: number, startZ: number, stepX: number, stepZ: number, count: number, rotY = 0) => {
      for (let i = 0; i < count; i++) {
        const mat = mats[i % mats.length];
        const container = new THREE.Mesh(wallGeom, mat);
        const px = startX + stepX * i;
        const pz = startZ + stepZ * i;
        container.position.set(px, wallHeight / 2, pz);
        container.rotation.y = rotY + (Math.random() - 0.5) * 0.06;
        container.castShadow = true;
        container.receiveShadow = true;
        this.group.add(container);

        // Top heavy protective steel beam with warning reflector
        const roofTrimGeo = new THREE.BoxGeometry(containerLength * 0.96, 0.4, 0.4);
        const roofTrimMat = new THREE.MeshStandardMaterial({ color: 0x181818, metalness: 0.9, roughness: 0.3 });
        const trim = new THREE.Mesh(roofTrimGeo, roofTrimMat);
        trim.position.set(0, wallHeight / 2 + 0.2, 0);
        container.add(trim);

        // Warning reflector beacon on every 2nd container
        if (i % 2 === 0) {
          const beaconGeo = new THREE.BoxGeometry(0.3, 0.15, 0.15);
          const beaconMat = new THREE.MeshStandardMaterial({
            color: 0xff3b30,
            emissive: 0xff2a1a,
            emissiveIntensity: 1.2,
          });
          const beacon = new THREE.Mesh(beaconGeo, beaconMat);
          beacon.position.set(0, wallHeight / 2 + 0.5, containerWidth / 2 + 0.05);
          container.add(beacon);
        }
      }
    };

    const count = Math.ceil(ARENA_SIZE / containerLength);
    const half = ARENA_HALF;

    // North & South walls
    placeWallSide(-half + containerLength / 2, half, containerLength, 0, count, 0);
    placeWallSide(-half + containerLength / 2, -half, containerLength, 0, count, 0);

    // East & West walls
    placeWallSide(half, -half + containerLength / 2, 0, containerLength, count, Math.PI / 2);
    placeWallSide(-half, -half + containerLength / 2, 0, containerLength, count, Math.PI / 2);
  }

  private buildFloodlightTowers(): void {
    // 4 Corner Stadium Towers + 4 Mid-Wall Towers
    const towerLocations = [
      { x: -ARENA_HALF + 8, z: -ARENA_HALF + 8, targetX: -20, targetZ: -20 },
      { x: ARENA_HALF - 8, z: -ARENA_HALF + 8, targetX: 20, targetZ: -20 },
      { x: -ARENA_HALF + 8, z: ARENA_HALF - 8, targetX: -20, targetZ: 20 },
      { x: ARENA_HALF - 8, z: ARENA_HALF - 8, targetX: 20, targetZ: 20 },
      { x: 0, z: -ARENA_HALF + 5, targetX: 0, targetZ: -15 },
      { x: 0, z: ARENA_HALF - 5, targetX: 0, targetZ: 15 },
      { x: -ARENA_HALF + 5, z: 0, targetX: -15, targetZ: 0 },
      { x: ARENA_HALF - 5, z: 0, targetX: 15, targetZ: 0 },
    ];

    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x2b2b2b,
      metalness: 0.85,
      roughness: 0.35,
    });

    const lampHousingMat = new THREE.MeshStandardMaterial({
      color: 0x151515,
      metalness: 0.9,
      roughness: 0.2,
    });

    const lampGlowMat = new THREE.MeshStandardMaterial({
      color: 0xfffae0,
      emissive: 0xffeed0,
      emissiveIntensity: 3.5,
      roughness: 0.1,
    });

    // Semi-transparent volumetric beam material
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffecd0,
      transparent: true,
      opacity: 0.08,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    towerLocations.forEach((loc) => {
      const towerGroup = new THREE.Group();
      const towerHeight = 16.0;

      // Steel truss vertical post
      const poleGeo = new THREE.CylinderGeometry(0.35, 0.5, towerHeight, 8);
      const pole = new THREE.Mesh(poleGeo, steelMat);
      pole.position.set(0, towerHeight / 2, 0);
      pole.castShadow = true;
      towerGroup.add(pole);

      // Support cross braces
      for (let y = 3; y < towerHeight; y += 3) {
        const braceGeo = new THREE.BoxGeometry(1.2, 0.1, 1.2);
        const brace = new THREE.Mesh(braceGeo, steelMat);
        brace.position.set(0, y, 0);
        towerGroup.add(brace);
      }

      // Top floodlight head crossbar
      const headBarGeo = new THREE.BoxGeometry(3.2, 0.3, 0.4);
      const headBar = new THREE.Mesh(headBarGeo, steelMat);
      headBar.position.set(0, towerHeight, 0);
      towerGroup.add(headBar);

      // Aim direction towards arena center
      const toTarget = new THREE.Vector3(loc.targetX - loc.x, -towerHeight + 2, loc.targetZ - loc.z).normalize();

      // 3 Halogen Lamp fixtures per tower
      for (let li = -1.1; li <= 1.1; li += 1.1) {
        const fixtureGroup = new THREE.Group();
        fixtureGroup.position.set(li, towerHeight, 0);

        // Housing box
        const boxGeo = new THREE.BoxGeometry(0.7, 0.5, 0.4);
        const box = new THREE.Mesh(boxGeo, lampHousingMat);
        fixtureGroup.add(box);

        // Glowing Lens
        const lensGeo = new THREE.PlaneGeometry(0.65, 0.45);
        const lens = new THREE.Mesh(lensGeo, lampGlowMat);
        lens.position.set(0, 0, 0.21);
        fixtureGroup.add(lens);

        fixtureGroup.lookAt(new THREE.Vector3(loc.targetX, 0, loc.targetZ));
        towerGroup.add(fixtureGroup);
      }

      // Atmosphere volumetric beam cone pointing down into arena
      const beamLength = 40.0;
      const beamGeo = new THREE.ConeGeometry(8.0, beamLength, 12, 1, true);
      beamGeo.translate(0, -beamLength / 2, 0);
      beamGeo.rotateX(Math.PI / 2);
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.position.set(0, towerHeight, 0);
      beam.lookAt(new THREE.Vector3(loc.targetX, 0, loc.targetZ));
      towerGroup.add(beam);

      // Arena SpotLight (casts atmospheric pool on the arena ground)
      const spot = new THREE.SpotLight(0xfffae6, 1.4, 65, Math.PI / 4, 0.65, 1.2);
      spot.position.set(0, towerHeight, 0);
      spot.target.position.set(loc.targetX, 0, loc.targetZ);
      towerGroup.add(spot);
      towerGroup.add(spot.target);

      towerGroup.position.set(loc.x, 0, loc.z);
      this.group.add(towerGroup);
    });
  }

  private buildScatterProps(): void {
    // Explosive fuel barrels cluster
    const barrelLocations = [
      { x: -35, z: -35 },
      { x: 35, z: -35 },
      { x: -35, z: 35 },
      { x: 35, z: 35 },
      { x: 0, z: -45 },
      { x: 0, z: 45 },
      { x: -45, z: 0 },
      { x: 45, z: 0 },
      { x: -20, z: 20 },
      { x: 20, z: -20 },
    ];

    const barrelGeo = new THREE.CylinderGeometry(0.7, 0.7, 1.6, 12);
    const barrelMat = new THREE.MeshStandardMaterial({
      color: 0xcc1111,
      roughness: 0.45,
      metalness: 0.65,
    });

    const hazardBandMat = new THREE.MeshStandardMaterial({
      color: 0xffba08,
      emissive: 0xff9900,
      emissiveIntensity: 0.5,
      roughness: 0.3,
    });
    this.pulsingMaterials.push(hazardBandMat);

    barrelLocations.forEach((loc) => {
      const clusterGroup = new THREE.Group();
      const bMesh = new THREE.Mesh(barrelGeo, barrelMat);
      bMesh.position.set(0, 0.8, 0);
      bMesh.castShadow = true;
      bMesh.receiveShadow = true;
      clusterGroup.add(bMesh);

      // Yellow hazard stripe band
      const bandGeo = new THREE.CylinderGeometry(0.72, 0.72, 0.3, 12);
      const band = new THREE.Mesh(bandGeo, hazardBandMat);
      band.position.set(0, 0.8, 0);
      clusterGroup.add(band);

      clusterGroup.position.set(loc.x, 0, loc.z);
      this.group.add(clusterGroup);

      this.barrels.push({
        mesh: clusterGroup,
        position: new THREE.Vector3(loc.x, 0.8, loc.z),
        health: 20,
        exploded: false,
      });
    });

    // Concrete barrier blocks in inner corners
    const barrierGeo = new THREE.BoxGeometry(4.0, 1.2, 1.2);
    const barrierMat = new THREE.MeshStandardMaterial({
      color: 0x5a6065,
      roughness: 0.9,
      metalness: 0.1,
    });

    const barrierPositions = [
      { x: -25, z: -10, rot: 0.3 },
      { x: 25, z: 10, rot: -0.4 },
      { x: -10, z: 25, rot: 1.2 },
      { x: 10, z: -25, rot: -1.1 },
    ];

    barrierPositions.forEach((bp) => {
      const barrier = new THREE.Mesh(barrierGeo, barrierMat);
      barrier.position.set(bp.x, 0.6, bp.z);
      barrier.rotation.y = bp.rot;
      barrier.castShadow = true;
      barrier.receiveShadow = true;
      this.group.add(barrier);
    });
  }

  public update(dt: number): void {
    const time = performance.now() * 0.003;
    const pulse = 0.4 + 0.3 * Math.sin(time * 3);
    for (let i = 0; i < this.pulsingMaterials.length; i++) {
      this.pulsingMaterials[i].emissiveIntensity = pulse;
    }
  }
}
