import * as THREE from 'three';
import { ARENA_SIZE, ARENA_HALF } from '../core/Constants';

export interface ArenaObstacle {
  id: string;
  type: 'box' | 'cylinder';
  x: number;
  z: number;
  width: number;    // Half-width along X in local space (or radius for cylinder)
  depth: number;    // Half-depth along Z in local space
  radius?: number;  // For cylinders
  rotation: number; // Y rotation in radians
  height: number;
  isDestructible?: boolean;
  health?: number;
  maxHealth?: number;
  isBarrel?: boolean;
  isCrate?: boolean;
  isTireStack?: boolean;
  mesh: THREE.Object3D;
  active: boolean;
  respawnTimer?: number;
  respawnTime?: number;
}

export interface ExplosiveBarrel {
  id: string;
  mesh: THREE.Group;
  position: THREE.Vector3;
  health: number;
  exploded: boolean;
  obstacleRef: ArenaObstacle;
  respawnTimer: number;
}

export interface SupplyCrate {
  id: string;
  mesh: THREE.Group;
  position: THREE.Vector3;
  destroyed: boolean;
  obstacleRef: ArenaObstacle;
  respawnTimer: number;
}

export class ArenaBuilder {
  public group = new THREE.Group();
  public obstacles: ArenaObstacle[] = [];
  public barrels: ExplosiveBarrel[] = [];
  public crates: SupplyCrate[] = [];

  private pulsingMaterials: THREE.MeshStandardMaterial[] = [];

  constructor() {
    this.buildGround();
    this.buildPerimeterBarriers();
    this.buildFloodlightTowers();
    this.buildCityBuildings();
    this.buildIndustrialWarehouses();
    this.buildGasStationDepot();
    this.buildStreetPropsAndWrecks();
    this.buildSupplyCrates();
    this.buildExplosiveBarrels();
  }

  // ==============================================================
  // 1. CLEAN REPEATING CONCRETE SLAB / ASPHALT TILE TEXTURE
  // ==============================================================
  private createGroundTextures(): { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d')!;

    // Wasteland dark asphalt/dirt base
    ctx.fillStyle = '#1c1815';
    ctx.fillRect(0, 0, 1024, 1024);

    // Dirt noise & asphalt pebbles
    for (let i = 0; i < 7000; i++) {
      const rx = Math.random() * 1024;
      const ry = Math.random() * 1024;
      const rw = Math.random() * 4.5 + 1.2;
      const shade = Math.floor(24 + Math.random() * 22);
      ctx.fillStyle = `rgb(${shade + 5}, ${shade}, ${shade - 3})`;
      ctx.fillRect(rx, ry, rw, rw);
    }

    // Asphalt cracks
    ctx.strokeStyle = '#100e0c';
    ctx.lineWidth = 3;
    for (let c = 0; c < 30; c++) {
      let cx = Math.random() * 1024;
      let cy = Math.random() * 1024;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      for (let s = 0; s < 6; s++) {
        cx += (Math.random() - 0.5) * 55;
        cy += (Math.random() - 0.5) * 55;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }

    // Clean concrete slab tile seams grid (128x128 tiles)
    ctx.strokeStyle = '#13100e';
    ctx.lineWidth = 4;
    const step = 128;
    for (let x = 0; x <= 1024; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, 1024);
      ctx.stroke();
    }
    for (let y = 0; y <= 1024; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(1024, y);
      ctx.stroke();
    }

    // Subtle oil spots
    for (let p = 0; p < 8; p++) {
      const px = Math.random() * 1024;
      const py = Math.random() * 1024;
      const pr = 25 + Math.random() * 45;
      const grad = ctx.createRadialGradient(px, py, pr * 0.1, px, py, pr);
      grad.addColorStop(0, 'rgba(10, 8, 7, 0.7)');
      grad.addColorStop(0.7, 'rgba(18, 15, 12, 0.3)');
      grad.addColorStop(1.0, 'rgba(28, 24, 21, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(px, py, pr, 0, Math.PI * 2);
      ctx.fill();
    }

    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(4, 4);

    // Roughness Map (Matte concrete slabs with slight oil sheen)
    const roughCanvas = document.createElement('canvas');
    roughCanvas.width = 512;
    roughCanvas.height = 512;
    const rCtx = roughCanvas.getContext('2d')!;

    rCtx.fillStyle = '#c8c8c8'; // ~0.8 roughness
    rCtx.fillRect(0, 0, 512, 512);

    // Tile seams roughness
    rCtx.strokeStyle = '#666666';
    rCtx.lineWidth = 2;
    const rStep = 64;
    for (let x = 0; x <= 512; x += rStep) {
      rCtx.beginPath();
      rCtx.moveTo(x, 0);
      rCtx.lineTo(x, 512);
      rCtx.stroke();
    }
    for (let y = 0; y <= 512; y += rStep) {
      rCtx.beginPath();
      rCtx.moveTo(0, y);
      rCtx.lineTo(512, y);
      rCtx.stroke();
    }

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
      metalness: 0.15,
    });

    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    this.group.add(ground);
  }

  // ==============================================================
  // 2. PERIMETER FORTIFIED WALLS
  // ==============================================================
  private buildPerimeterBarriers(): void {
    const wallHeight = 4.0;
    const containerLength = 8.0;
    const containerWidth = 2.5;

    const containerMat1 = new THREE.MeshStandardMaterial({ color: 0x8b2518, roughness: 0.65, metalness: 0.55 });
    const containerMat2 = new THREE.MeshStandardMaterial({ color: 0x1f3c5a, roughness: 0.7, metalness: 0.5 });
    const containerMat3 = new THREE.MeshStandardMaterial({ color: 0x3d4a2b, roughness: 0.75, metalness: 0.45 });
    const containerMat4 = new THREE.MeshStandardMaterial({ color: 0x4a443b, roughness: 0.8, metalness: 0.4 });
    const mats = [containerMat1, containerMat2, containerMat3, containerMat4];

    const wallGeom = new THREE.BoxGeometry(containerLength, wallHeight, containerWidth);

    const placeWallSide = (
      startX: number,
      startZ: number,
      stepX: number,
      stepZ: number,
      count: number,
      rotY = 0
    ) => {
      for (let i = 0; i < count; i++) {
        const mat = mats[i % mats.length];
        const container = new THREE.Mesh(wallGeom, mat);
        const px = startX + stepX * i;
        const pz = startZ + stepZ * i;
        container.position.set(px, wallHeight / 2, pz);
        container.rotation.y = rotY;
        container.castShadow = true;
        container.receiveShadow = true;
        this.group.add(container);

        // Steel beam top rim
        const roofTrimGeo = new THREE.BoxGeometry(containerLength * 0.98, 0.4, 0.4);
        const roofTrimMat = new THREE.MeshStandardMaterial({ color: 0x141414, metalness: 0.9, roughness: 0.3 });
        const trim = new THREE.Mesh(roofTrimGeo, roofTrimMat);
        trim.position.set(0, wallHeight / 2 + 0.2, 0);
        container.add(trim);

        // Warning reflector beacon on every 2nd container
        if (i % 2 === 0) {
          const beaconGeo = new THREE.BoxGeometry(0.3, 0.18, 0.18);
          const beaconMat = new THREE.MeshStandardMaterial({
            color: 0xff2200,
            emissive: 0xff1100,
            emissiveIntensity: 1.2,
          });
          this.pulsingMaterials.push(beaconMat);
          const beacon = new THREE.Mesh(beaconGeo, beaconMat);
          beacon.position.set(0, wallHeight / 2 + 0.4, containerWidth / 2 + 0.05);
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

  // ==============================================================
  // 3. FLOODLIGHT TOWERS
  // ==============================================================
  private buildFloodlightTowers(): void {
    const towerLocations = [
      { x: -ARENA_HALF + 9, z: -ARENA_HALF + 9, targetX: -20, targetZ: -20 },
      { x: ARENA_HALF - 9, z: -ARENA_HALF + 9, targetX: 20, targetZ: -20 },
      { x: -ARENA_HALF + 9, z: ARENA_HALF - 9, targetX: -20, targetZ: 20 },
      { x: ARENA_HALF - 9, z: ARENA_HALF - 9, targetX: 20, targetZ: 20 },
      { x: 0, z: -ARENA_HALF + 6, targetX: 0, targetZ: -15 },
      { x: 0, z: ARENA_HALF - 6, targetX: 0, targetZ: 15 },
      { x: -ARENA_HALF + 6, z: 0, targetX: -15, targetZ: 0 },
      { x: ARENA_HALF - 6, z: 0, targetX: 15, targetZ: 0 },
    ];

    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x242424,
      metalness: 0.85,
      roughness: 0.35,
    });

    const concreteBaseMat = new THREE.MeshStandardMaterial({
      color: 0x444444,
      roughness: 0.92,
      metalness: 0.1,
    });

    const lampHousingMat = new THREE.MeshStandardMaterial({
      color: 0x141414,
      metalness: 0.9,
      roughness: 0.2,
    });

    const lampGlowMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfffae0,
      emissiveIntensity: 3.5,
      roughness: 0.1,
    });

    towerLocations.forEach((loc, index) => {
      const towerGroup = new THREE.Group();
      const towerHeight = 16.0;

      // Concrete Pier Base
      const baseGeo = new THREE.BoxGeometry(2.2, 1.5, 2.2);
      const baseMesh = new THREE.Mesh(baseGeo, concreteBaseMat);
      baseMesh.position.set(0, 0.75, 0);
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      towerGroup.add(baseMesh);

      // Collider
      this.obstacles.push({
        id: `tower_base_${index}`,
        type: 'box',
        x: loc.x,
        z: loc.z,
        width: 1.15,
        depth: 1.15,
        rotation: 0,
        height: 1.6,
        mesh: baseMesh,
        active: true,
      });

      // Steel truss vertical post
      const poleGeo = new THREE.CylinderGeometry(0.35, 0.5, towerHeight, 8);
      const pole = new THREE.Mesh(poleGeo, steelMat);
      pole.position.set(0, towerHeight / 2, 0);
      pole.castShadow = true;
      towerGroup.add(pole);

      // Head crossbar
      const headBarGeo = new THREE.BoxGeometry(3.5, 0.35, 0.5);
      const headBar = new THREE.Mesh(headBarGeo, steelMat);
      headBar.position.set(0, towerHeight, 0);
      towerGroup.add(headBar);

      // 3 Halogen Lamp fixtures
      for (let li = -1.1; li <= 1.1; li += 1.1) {
        const fixtureGroup = new THREE.Group();
        fixtureGroup.position.set(li, towerHeight, 0);

        const boxGeo = new THREE.BoxGeometry(0.7, 0.5, 0.4);
        const box = new THREE.Mesh(boxGeo, lampHousingMat);
        fixtureGroup.add(box);

        const lensGeo = new THREE.PlaneGeometry(0.65, 0.45);
        const lens = new THREE.Mesh(lensGeo, lampGlowMat);
        lens.position.set(0, 0, 0.21);
        fixtureGroup.add(lens);

        fixtureGroup.lookAt(new THREE.Vector3(loc.targetX, 0, loc.targetZ));
        towerGroup.add(fixtureGroup);
      }

      towerGroup.position.set(loc.x, 0, loc.z);
      this.group.add(towerGroup);
    });
  }

  // ==============================================================
  // 4. RUINED MULTI-STORY CITY BUILDINGS
  // ==============================================================
  private buildCityBuildings(): void {
    const buildings = [
      // 1. North-East 3-Story Commercial Complex
      { x: 38, z: 42, len: 16.0, wid: 12.0, hgt: 11.0, floors: 3, rot: 0, color: 0x4a453f },
      // 2. North-West 2-Story Office Block
      { x: -42, z: 38, len: 14.0, wid: 10.0, hgt: 8.5, floors: 2, rot: 0.15, color: 0x3d4447 },
      // 3. South-East Ruined Hotel / Apartments
      { x: 44, z: -38, len: 15.0, wid: 11.0, hgt: 10.0, floors: 3, rot: -0.1, color: 0x54473e },
      // 4. South-West 2-Story Brick Factory Block
      { x: -44, z: -42, len: 13.0, wid: 11.0, hgt: 8.0, floors: 2, rot: 0, color: 0x5a382e },
    ];

    const concreteTrimMat = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.8, roughness: 0.4 });
    const windowMat = new THREE.MeshStandardMaterial({ color: 0x15222e, roughness: 0.2, metalness: 0.9 });
    const acMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.6, metalness: 0.7 });
    const waterTankMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.9, metalness: 0.2 });

    buildings.forEach((b, idx) => {
      const bGroup = new THREE.Group();
      bGroup.position.set(b.x, 0, b.z);
      bGroup.rotation.y = b.rot;

      const wallMat = new THREE.MeshStandardMaterial({
        color: b.color,
        roughness: 0.9,
        metalness: 0.15,
      });

      // Main Building Core
      const coreGeo = new THREE.BoxGeometry(b.len, b.hgt, b.wid);
      const core = new THREE.Mesh(coreGeo, wallMat);
      core.position.y = b.hgt / 2;
      core.castShadow = true;
      core.receiveShadow = true;
      bGroup.add(core);

      // Floor separator bands & Parapet roof rim
      for (let f = 1; f <= b.floors; f++) {
        const floorY = (b.hgt / b.floors) * f;
        const bandGeo = new THREE.BoxGeometry(b.len + 0.3, 0.4, b.wid + 0.3);
        const band = new THREE.Mesh(bandGeo, concreteTrimMat);
        band.position.y = floorY;
        bGroup.add(band);
      }

      // Parapet roof border
      const parapetGeo = new THREE.BoxGeometry(b.len + 0.2, 0.6, b.wid + 0.2);
      const parapet = new THREE.Mesh(parapetGeo, concreteTrimMat);
      parapet.position.y = b.hgt + 0.3;
      bGroup.add(parapet);

      // Recessed Windows on Front & Back Facades
      const windowRows = b.floors;
      const windowsPerRow = Math.floor(b.len / 3.2);
      for (let f = 0; f < windowRows; f++) {
        const winY = 2.0 + f * 3.0;
        if (winY >= b.hgt - 1) break;

        for (let wi = 0; wi < windowsPerRow; wi++) {
          const winX = -b.len / 2 + 2.0 + wi * 3.0;
          const winGeo = new THREE.PlaneGeometry(1.5, 1.6);

          // Front window
          const winF = new THREE.Mesh(winGeo, windowMat);
          winF.position.set(winX, winY, b.wid / 2 + 0.02);
          bGroup.add(winF);

          // Back window
          const winB = new THREE.Mesh(winGeo, windowMat);
          winB.rotation.y = Math.PI;
          winB.position.set(winX, winY, -b.wid / 2 - 0.02);
          bGroup.add(winB);
        }
      }

      // Ground Floor Entrance Awning & Door
      const awningGeo = new THREE.BoxGeometry(3.6, 0.3, 1.6);
      const awning = new THREE.Mesh(awningGeo, concreteTrimMat);
      awning.position.set(0, 3.0, b.wid / 2 + 0.8);
      bGroup.add(awning);

      // Rooftop Props: HVAC Units
      const hvacGeo = new THREE.BoxGeometry(2.2, 1.4, 1.8);
      const hvac1 = new THREE.Mesh(hvacGeo, acMat);
      hvac1.position.set(b.len / 4, b.hgt + 0.7, -b.wid / 4);
      bGroup.add(hvac1);

      // Rooftop Water Tower on 3-story buildings
      if (b.floors >= 3) {
        const tankGroup = new THREE.Group();
        tankGroup.position.set(-b.len / 4, b.hgt, b.wid / 4);

        const legGeo = new THREE.CylinderGeometry(0.12, 0.12, 2.5, 6);
        for (const lx of [-0.9, 0.9]) {
          for (const lz of [-0.9, 0.9]) {
            const leg = new THREE.Mesh(legGeo, concreteTrimMat);
            leg.position.set(lx, 1.25, lz);
            tankGroup.add(leg);
          }
        }

        const tankGeo = new THREE.CylinderGeometry(1.6, 1.6, 2.4, 12);
        const tank = new THREE.Mesh(tankGeo, waterTankMat);
        tank.position.y = 3.4;
        tankGroup.add(tank);

        bGroup.add(tankGroup);
      }

      this.group.add(bGroup);

      // Solid Box Collider for Vehicle & Zombies
      this.obstacles.push({
        id: `city_bldg_${idx}`,
        type: 'box',
        x: b.x,
        z: b.z,
        width: b.len / 2 + 0.2,
        depth: b.wid / 2 + 0.2,
        rotation: b.rot,
        height: b.hgt,
        mesh: bGroup,
        active: true,
      });
    });
  }

  // ==============================================================
  // 5. INDUSTRIAL WAREHOUSES & HANGARS
  // ==============================================================
  private buildIndustrialWarehouses(): void {
    const warehouses = [
      // North Main Logistics Warehouse
      { x: 0, z: 52, len: 24.0, wid: 13.0, hgt: 7.5, rot: 0, color: 0x333b42 },
      // South Maintenance Depot
      { x: 0, z: -52, len: 22.0, wid: 12.0, hgt: 7.0, rot: 0, color: 0x423833 },
    ];

    const steelMat = new THREE.MeshStandardMaterial({ color: 0x1f1f1f, metalness: 0.85, roughness: 0.3 });
    const shutterMat = new THREE.MeshStandardMaterial({ color: 0xd49b43, roughness: 0.6, metalness: 0.5 });
    const hazardStripeMat = new THREE.MeshStandardMaterial({ color: 0xffba08, emissive: 0x885500, emissiveIntensity: 0.4 });
    this.pulsingMaterials.push(hazardStripeMat);

    warehouses.forEach((w, idx) => {
      const wGroup = new THREE.Group();
      wGroup.position.set(w.x, 0, w.z);
      wGroup.rotation.y = w.rot;

      const wallMat = new THREE.MeshStandardMaterial({
        color: w.color,
        roughness: 0.75,
        metalness: 0.45,
      });

      // Main Hangar Box
      const bodyGeo = new THREE.BoxGeometry(w.len, w.hgt, w.wid);
      const body = new THREE.Mesh(bodyGeo, wallMat);
      body.position.y = w.hgt / 2;
      body.castShadow = true;
      body.receiveShadow = true;
      wGroup.add(body);

      // Pitched Industrial Roof Cap
      const roofGeo = new THREE.ConeGeometry(w.wid * 0.75, 2.2, 4);
      const roof = new THREE.Mesh(roofGeo, steelMat);
      roof.scale.set(w.len / (w.wid * 0.75), 1, 1);
      roof.rotation.y = Math.PI / 4;
      roof.position.y = w.hgt + 1.1;
      wGroup.add(roof);

      // 2 Large Industrial Roll-up Garage Doors (Front)
      for (const gx of [-w.len / 4, w.len / 4]) {
        const doorGeo = new THREE.PlaneGeometry(5.0, 4.2);
        const door = new THREE.Mesh(doorGeo, shutterMat);
        door.position.set(gx, 2.1, w.wid / 2 + 0.02);
        wGroup.add(door);

        // Hazard warning frame
        const frameGeo = new THREE.BoxGeometry(5.4, 0.35, 0.4);
        const frame = new THREE.Mesh(frameGeo, hazardStripeMat);
        frame.position.set(gx, 4.3, w.wid / 2 + 0.2);
        wGroup.add(frame);
      }

      // Roof Industrial Ventilation Pipes
      for (let pi = -w.len / 3; pi <= w.len / 3; pi += w.len / 3) {
        const pipeGeo = new THREE.CylinderGeometry(0.4, 0.4, 2.0, 8);
        const pipe = new THREE.Mesh(pipeGeo, steelMat);
        pipe.position.set(pi, w.hgt + 1.8, 0);
        wGroup.add(pipe);
      }

      this.group.add(wGroup);

      // Solid Box Collider
      this.obstacles.push({
        id: `warehouse_${idx}`,
        type: 'box',
        x: w.x,
        z: w.z,
        width: w.len / 2 + 0.2,
        depth: w.wid / 2 + 0.2,
        rotation: w.rot,
        height: w.hgt,
        mesh: wGroup,
        active: true,
      });
    });
  }

  // ==============================================================
  // 6. GAS STATION & CANOPY DEPOT
  // ==============================================================
  private buildGasStationDepot(): void {
    const stationX = -18;
    const stationZ = 0;
    const stationGroup = new THREE.Group();
    stationGroup.position.set(stationX, 0, stationZ);

    const boothMat = new THREE.MeshStandardMaterial({ color: 0x4a453f, roughness: 0.85, metalness: 0.2 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x152535, roughness: 0.2, metalness: 0.9 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.5, metalness: 0.7 });
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xd49b43, roughness: 0.6, metalness: 0.4 });
    const pumpMat = new THREE.MeshStandardMaterial({ color: 0xb71c1c, roughness: 0.5, metalness: 0.6 });

    // 1. Convenience Shop Booth (6m x 4.5m x 3.6m)
    const shopGeo = new THREE.BoxGeometry(6.0, 3.6, 4.5);
    const shop = new THREE.Mesh(shopGeo, boothMat);
    shop.position.set(-6.5, 1.8, 0);
    shop.castShadow = true;
    shop.receiveShadow = true;
    stationGroup.add(shop);

    // Front Window
    const shopWinGeo = new THREE.PlaneGeometry(4.5, 2.0);
    const shopWin = new THREE.Mesh(shopWinGeo, glassMat);
    shopWin.rotation.y = Math.PI / 2;
    shopWin.position.set(-3.48, 1.8, 0);
    stationGroup.add(shopWin);

    // Shop Collider
    this.obstacles.push({
      id: 'gas_shop_booth',
      type: 'box',
      x: stationX - 6.5,
      z: stationZ,
      width: 3.1,
      depth: 2.35,
      rotation: 0,
      height: 3.6,
      mesh: shop,
      active: true,
    });

    // 2. Large Overhead Canopy Roof (11m x 7.5m x 0.6m at 4.8m height)
    const canopyGeo = new THREE.BoxGeometry(11.0, 0.6, 7.5);
    const canopy = new THREE.Mesh(canopyGeo, canopyMat);
    canopy.position.set(3.0, 4.8, 0);
    canopy.castShadow = true;
    stationGroup.add(canopy);

    // 2 Heavy Support Pillars with Yellow Hazard Stripes
    for (const pz of [-2.4, 2.4]) {
      const pGeo = new THREE.BoxGeometry(0.9, 4.8, 0.9);
      const pillar = new THREE.Mesh(pGeo, pillarMat);
      pillar.position.set(3.0, 2.4, pz);
      pillar.castShadow = true;
      stationGroup.add(pillar);

      // Pillar Collider
      this.obstacles.push({
        id: `canopy_pillar_${pz}`,
        type: 'box',
        x: stationX + 3.0,
        z: stationZ + pz,
        width: 0.55,
        depth: 0.55,
        rotation: 0,
        height: 4.8,
        mesh: pillar,
        active: true,
      });

      // Fuel Pump Island
      const pumpGeo = new THREE.BoxGeometry(1.1, 1.8, 0.8);
      const pump = new THREE.Mesh(pumpGeo, pumpMat);
      pump.position.set(3.0, 0.9, pz + (pz > 0 ? -1.1 : 1.1));
      pump.castShadow = true;
      stationGroup.add(pump);
    }

    this.group.add(stationGroup);
  }

  // ==============================================================
  // 7. STREET PROPS, WRECKS & CONCRETE BARRIERS
  // ==============================================================
  private buildStreetPropsAndWrecks(): void {
    // 4 Heavy Concrete K-Rail Barricades at Street Choke Points
    const barrierConfigs = [
      { x: 18, z: 16, rot: 0.4 },
      { x: 18, z: -16, rot: -0.4 },
      { x: -16, z: 22, rot: 1.1 },
      { x: -16, z: -22, rot: -1.1 },
    ];

    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x525659, roughness: 0.9, metalness: 0.1 });
    const hazardCapMat = new THREE.MeshStandardMaterial({ color: 0xd49b43, roughness: 0.6, metalness: 0.3 });

    barrierConfigs.forEach((bc, idx) => {
      const bGroup = new THREE.Group();
      bGroup.position.set(bc.x, 0, bc.z);
      bGroup.rotation.y = bc.rot;

      const kRailGeo = new THREE.BoxGeometry(5.0, 1.3, 1.1);
      const kRail = new THREE.Mesh(kRailGeo, barrierMat);
      kRail.position.y = 0.65;
      kRail.castShadow = true;
      kRail.receiveShadow = true;
      bGroup.add(kRail);

      const capGeo = new THREE.BoxGeometry(4.9, 0.15, 0.8);
      const cap = new THREE.Mesh(capGeo, hazardCapMat);
      cap.position.y = 1.35;
      bGroup.add(cap);

      this.group.add(bGroup);

      this.obstacles.push({
        id: `street_barrier_${idx}`,
        type: 'box',
        x: bc.x,
        z: bc.z,
        width: 2.6,
        depth: 0.6,
        rotation: bc.rot,
        height: 1.4,
        mesh: bGroup,
        active: true,
      });
    });

    // 2 Wrecked Post-Apocalyptic Vehicles
    const wrecks = [
      { x: 24, z: 0, rot: 0.6, color: 0x5a2d22 }, // Rusted Muscle Car
      { x: -32, z: -12, rot: -0.5, color: 0x2d3a35 }, // Armored Van Carcass
    ];

    wrecks.forEach((w, idx) => {
      const wGroup = new THREE.Group();
      wGroup.position.set(w.x, 0, w.z);
      wGroup.rotation.y = w.rot;

      const rustMat = new THREE.MeshStandardMaterial({ color: w.color, roughness: 0.88, metalness: 0.3 });
      const trimMat = new THREE.MeshStandardMaterial({ color: 0x181818, metalness: 0.85, roughness: 0.35 });

      const bodyGeo = new THREE.BoxGeometry(4.8, 1.2, 2.2);
      const body = new THREE.Mesh(bodyGeo, rustMat);
      body.position.y = 0.6;
      body.castShadow = true;
      body.receiveShadow = true;
      wGroup.add(body);

      const cabinGeo = new THREE.BoxGeometry(2.4, 0.9, 1.8);
      const cabin = new THREE.Mesh(cabinGeo, rustMat);
      cabin.position.set(-0.2, 1.4, 0);
      cabin.rotation.z = -0.1;
      wGroup.add(cabin);

      const rollGeo = new THREE.BoxGeometry(2.5, 1.0, 1.9);
      const roll = new THREE.Mesh(rollGeo, trimMat);
      roll.position.set(-0.2, 1.4, 0);
      wGroup.add(roll);

      this.group.add(wGroup);

      this.obstacles.push({
        id: `wreck_${idx}`,
        type: 'box',
        x: w.x,
        z: w.z,
        width: 2.5,
        depth: 1.2,
        rotation: w.rot,
        height: 1.8,
        mesh: wGroup,
        active: true,
      });
    });
  }

  // ==============================================================
  // 8. SUPPLY CRATES (LOOT DROPS)
  // ==============================================================
  private buildSupplyCrates(): void {
    const crateLocations = [
      { x: -16, z: 32 },
      { x: 16, z: 32 },
      { x: -16, z: -32 },
      { x: 16, z: -32 },
      { x: 28, z: 24 },
      { x: -28, z: 24 },
      { x: 28, z: -24 },
      { x: -28, z: -24 },
    ];

    const woodMat = new THREE.MeshStandardMaterial({
      color: 0x9c6634,
      roughness: 0.85,
      metalness: 0.1,
    });

    const ironBandMat = new THREE.MeshStandardMaterial({
      color: 0x1f1f1f,
      metalness: 0.9,
      roughness: 0.25,
    });

    crateLocations.forEach((loc, idx) => {
      const cGroup = new THREE.Group();
      cGroup.position.set(loc.x, 0, loc.z);

      const boxGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
      const box = new THREE.Mesh(boxGeo, woodMat);
      box.position.y = 0.8;
      box.castShadow = true;
      box.receiveShadow = true;
      cGroup.add(box);

      // Iron strapping bands
      const bandGeo = new THREE.BoxGeometry(1.64, 0.2, 1.64);
      const bandTop = new THREE.Mesh(bandGeo, ironBandMat);
      bandTop.position.y = 1.3;
      cGroup.add(bandTop);
      const bandBot = new THREE.Mesh(bandGeo, ironBandMat);
      bandBot.position.y = 0.3;
      cGroup.add(bandBot);

      this.group.add(cGroup);

      const obstacle: ArenaObstacle = {
        id: `supply_crate_${idx}`,
        type: 'box',
        x: loc.x,
        z: loc.z,
        width: 0.85,
        depth: 0.85,
        rotation: 0,
        height: 1.6,
        isDestructible: true,
        isCrate: true,
        health: 10,
        maxHealth: 10,
        mesh: cGroup,
        active: true,
        respawnTimer: 0,
        respawnTime: 35,
      };

      this.obstacles.push(obstacle);

      this.crates.push({
        id: `crate_${idx}`,
        mesh: cGroup,
        position: new THREE.Vector3(loc.x, 0.8, loc.z),
        destroyed: false,
        obstacleRef: obstacle,
        respawnTimer: 0,
      });
    });
  }

  // ==============================================================
  // 9. EXPLOSIVE RED FUEL BARRELS
  // ==============================================================
  private buildExplosiveBarrels(): void {
    const barrelLocations = [
      { x: -8, z: -18 },
      { x: 8, z: -18 },
      { x: -8, z: 18 },
      { x: 8, z: 18 },
      { x: -28, z: 4 },
      { x: 28, z: -4 },
      { x: -22, z: 36 },
      { x: 22, z: 36 },
      { x: -22, z: -36 },
      { x: 22, z: -36 },
    ];

    const barrelGeo = new THREE.CylinderGeometry(0.72, 0.72, 1.65, 12);
    const barrelMat = new THREE.MeshStandardMaterial({
      color: 0xd91e18,
      roughness: 0.45,
      metalness: 0.65,
    });

    const hazardBandMat = new THREE.MeshStandardMaterial({
      color: 0xffba08,
      emissive: 0xff8800,
      emissiveIntensity: 0.6,
      roughness: 0.35,
    });
    this.pulsingMaterials.push(hazardBandMat);

    barrelLocations.forEach((loc, idx) => {
      const clusterGroup = new THREE.Group();
      clusterGroup.position.set(loc.x, 0, loc.z);

      const bMesh = new THREE.Mesh(barrelGeo, barrelMat);
      bMesh.position.y = 0.82;
      bMesh.castShadow = true;
      bMesh.receiveShadow = true;
      clusterGroup.add(bMesh);

      const bandGeo = new THREE.CylinderGeometry(0.74, 0.74, 0.32, 12);
      const band = new THREE.Mesh(bandGeo, hazardBandMat);
      band.position.y = 0.82;
      clusterGroup.add(band);

      this.group.add(clusterGroup);

      const obstacle: ArenaObstacle = {
        id: `barrel_obstacle_${idx}`,
        type: 'cylinder',
        x: loc.x,
        z: loc.z,
        width: 0.75,
        depth: 0.75,
        radius: 0.75,
        rotation: 0,
        height: 1.65,
        isDestructible: true,
        isBarrel: true,
        health: 15,
        maxHealth: 15,
        mesh: clusterGroup,
        active: true,
        respawnTimer: 0,
        respawnTime: 25,
      };

      this.obstacles.push(obstacle);

      this.barrels.push({
        id: `barrel_${idx}`,
        mesh: clusterGroup,
        position: new THREE.Vector3(loc.x, 0.82, loc.z),
        health: 15,
        exploded: false,
        obstacleRef: obstacle,
        respawnTimer: 0,
      });
    });
  }

  // ==============================================================
  // UPDATE LOOP: RESPAWNS & PULSES
  // ==============================================================
  public update(dt: number): void {
    const time = performance.now() * 0.003;
    const pulse = 0.5 + 0.4 * Math.sin(time * 3.5);

    // Hazard lights
    for (let i = 0; i < this.pulsingMaterials.length; i++) {
      this.pulsingMaterials[i].emissiveIntensity = pulse;
    }

    // Barrel Respawns
    for (let i = 0; i < this.barrels.length; i++) {
      const b = this.barrels[i];
      if (b.exploded) {
        b.respawnTimer -= dt;
        if (b.respawnTimer <= 0) {
          b.exploded = false;
          b.health = 15;
          b.mesh.visible = true;
          b.obstacleRef.active = true;
          b.mesh.position.y = 0;
        }
      }
    }

    // Crate Respawns
    for (let i = 0; i < this.crates.length; i++) {
      const c = this.crates[i];
      if (c.destroyed) {
        c.respawnTimer -= dt;
        if (c.respawnTimer <= 0) {
          c.destroyed = false;
          c.mesh.visible = true;
          c.obstacleRef.active = true;
          c.mesh.position.y = 0;
        }
      }
    }
  }
}
