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
  private neonMaterials: THREE.MeshStandardMaterial[] = [];

  constructor() {
    this.buildGround();
    this.buildPerimeterFortress();
    this.buildGatewayWatchtowers();
    this.buildCentralDriftArena();
    this.buildNorthEastMachineShop();
    this.buildNorthWestContainerFort();
    this.buildSouthEastRefinerySilos();
    this.buildSouthWestMilitaryBunker();
    this.buildWestHighwayGasStation();
    this.buildEastScrapJunkyard();
    this.buildStreetChicanesAndProps();
    this.buildSupplyCrates();
    this.buildExplosiveBarrels();
  }

  // =========================================================================
  // 1. MASTER ULTRA-HD PROCEDURAL GROUND TEXTURE (2048x2048)
  // =========================================================================
  private createGroundTextures(): { map: THREE.CanvasTexture; roughnessMap: THREE.CanvasTexture } {
    const size = 2048;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;

    // 1. Dark Wasteland Asphalt Base
    ctx.fillStyle = '#1c1916';
    ctx.fillRect(0, 0, size, size);

    // 2. Aggregate & Dust Micro-Noise
    for (let i = 0; i < 32000; i++) {
      const rx = Math.random() * size;
      const ry = Math.random() * size;
      const rw = Math.random() * 3.2 + 0.8;
      const shade = Math.floor(26 + Math.random() * 26);
      const r = shade + Math.floor(Math.random() * 5);
      const g = shade + Math.floor(Math.random() * 3);
      const b = shade - Math.floor(Math.random() * 3);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.fillRect(rx, ry, rw, rw);
    }

    // 3. Concrete Slab Tile Grid in Outer Sectors
    ctx.strokeStyle = '#141210';
    ctx.lineWidth = 3.5;
    const step = 128;
    for (let x = 0; x <= size; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
    for (let y = 0; y <= size; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }

    const mid = size / 2; // (1024, 1024)
    const toCanvasDist = (worldDist: number) => (worldDist / ARENA_SIZE) * size;
    const toCanvasCoord = (worldVal: number) => ((worldVal + ARENA_HALF) / ARENA_SIZE) * size;

    // 4. MAIN ASPHALT HIGHWAYS (North-South & East-West)
    const roadW = toCanvasDist(15); // ~192 px wide

    ctx.fillStyle = '#131110';
    ctx.fillRect(mid - roadW / 2, 0, roadW, size);
    ctx.fillRect(0, mid - roadW / 2, size, roadW);

    // 5. CENTRAL DRIFT ROUNDABOUT
    const outerR = toCanvasDist(25); // ~320 px
    const innerR = toCanvasDist(11.5); // ~147 px
    const trackMidR = (outerR + innerR) / 2;

    ctx.beginPath();
    ctx.arc(mid, mid, outerR, 0, Math.PI * 2);
    ctx.fillStyle = '#131110';
    ctx.fill();

    // 6. PAVED PARKING APRONS & SERVICE PLAZAS FOR ROADSIDE ZONES
    ctx.fillStyle = '#161412';
    // North-East Machine Shop Apron
    ctx.fillRect(toCanvasCoord(18), toCanvasCoord(30), toCanvasDist(36), toCanvasDist(32));
    // North-West Container Fort Yard
    ctx.fillRect(toCanvasCoord(-54), toCanvasCoord(30), toCanvasDist(34), toCanvasDist(32));
    // South-East Refinery Slab
    ctx.fillRect(toCanvasCoord(18), toCanvasCoord(-62), toCanvasDist(36), toCanvasDist(30));
    // South-West Military Bunker Lot
    ctx.fillRect(toCanvasCoord(-60), toCanvasCoord(-60), toCanvasDist(36), toCanvasDist(36));
    // West Gas Station Forecourt (North of Highway)
    ctx.fillRect(toCanvasCoord(-62), toCanvasCoord(-36), toCanvasDist(36), toCanvasDist(30));
    // East Junkyard Yard (North of Highway)
    ctx.fillStyle = '#221a15';
    ctx.fillRect(toCanvasCoord(24), toCanvasCoord(6), toCanvasDist(36), toCanvasDist(30));

    // 7. ROAD PAINT MARKINGS: Double Amber Lines & Dashed Lane Dividers
    const drawDoubleYellow = (x1: number, y1: number, x2: number, y2: number) => {
      ctx.save();
      ctx.strokeStyle = '#c89226';
      ctx.lineWidth = 4;
      if (x1 === x2) {
        ctx.beginPath(); ctx.moveTo(x1 - 4, y1); ctx.lineTo(x2 - 4, y2); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x1 + 4, y1); ctx.lineTo(x2 + 4, y2); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(x1, y1 - 4); ctx.lineTo(x2, y2 - 4); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(x1 + 4, y1); ctx.lineTo(x2 + 4, y2); ctx.stroke();
      }
      ctx.restore();
    };

    drawDoubleYellow(mid, 0, mid, mid - outerR);
    drawDoubleYellow(mid, mid + outerR, mid, size);
    drawDoubleYellow(0, mid, mid - outerR, mid);
    drawDoubleYellow(mid + outerR, mid, size, mid);

    // Dashed Roundabout Track Line
    ctx.save();
    ctx.strokeStyle = '#c89226';
    ctx.lineWidth = 5;
    ctx.setLineDash([22, 18]);
    ctx.beginPath();
    ctx.arc(mid, mid, trackMidR, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // Drift Apex Arrows on Roundabout
    ctx.fillStyle = '#c89226';
    const arrowCount = 8;
    for (let a = 0; a < arrowCount; a++) {
      const ang = (a / arrowCount) * Math.PI * 2;
      const ax = mid + Math.cos(ang) * trackMidR;
      const ay = mid + Math.sin(ang) * trackMidR;

      ctx.save();
      ctx.translate(ax, ay);
      ctx.rotate(ang + Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(-10, -6);
      ctx.lineTo(0, 8);
      ctx.lineTo(10, -6);
      ctx.lineTo(4, -6);
      ctx.lineTo(0, 0);
      ctx.lineTo(-4, -6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 8. RED & WHITE RUMBLE CURBS
    const drawCurbRing = (cx: number, cy: number, radius: number, width: number) => {
      const segs = 36;
      const dAng = (Math.PI * 2) / segs;
      ctx.lineWidth = width;
      for (let s = 0; s < segs; s++) {
        ctx.strokeStyle = s % 2 === 0 ? '#b71c1c' : '#dedede';
        ctx.beginPath();
        ctx.arc(cx, cy, radius, s * dAng, (s + 1) * dAng);
        ctx.stroke();
      }
    };

    drawCurbRing(mid, mid, innerR + 4, 8);

    // Central Burnout Ring in Center
    ctx.save();
    ctx.strokeStyle = 'rgba(200, 146, 38, 0.45)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(mid, mid, innerR * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // 9. CROSSWALK / HAZARD STRIPES at Major Intersections
    const drawHazardCrosswalk = (cx: number, cy: number, w: number, h: number, horizontal: boolean) => {
      ctx.save();
      ctx.fillStyle = '#bfa145';
      const stripeW = 12;
      if (horizontal) {
        for (let x = cx - w / 2; x < cx + w / 2; x += stripeW * 2) {
          ctx.fillRect(x, cy - h / 2, stripeW, h);
        }
      } else {
        for (let y = cy - h / 2; y < cy + h / 2; y += stripeW * 2) {
          ctx.fillRect(cx - w / 2, y, w, stripeW);
        }
      }
      ctx.restore();
    };

    drawHazardCrosswalk(mid, mid - outerR - 22, roadW - 14, 16, true);
    drawHazardCrosswalk(mid, mid + outerR + 22, roadW - 14, 16, true);
    drawHazardCrosswalk(mid - outerR - 22, mid, 16, roadW - 14, false);
    drawHazardCrosswalk(mid + outerR + 22, mid, 16, roadW - 14, false);

    // 10. TIRE BURNOUT SKID MARKS
    ctx.strokeStyle = 'rgba(6, 5, 4, 0.48)';
    ctx.lineWidth = 7;
    for (let sm = 0; sm < 24; sm++) {
      const driftAng = Math.random() * Math.PI * 2;
      const driftDist = trackMidR + (Math.random() - 0.5) * 35;
      ctx.beginPath();
      ctx.arc(mid, mid, driftDist, driftAng, driftAng + 0.6 + Math.random() * 0.9);
      ctx.stroke();
    }

    // 11. OIL SLICKS & HIGH-SPECULAR PUDDLES
    const oilPuddles: { x: number; y: number; r: number }[] = [];
    const puddleLocs = [
      { x: toCanvasCoord(-48), y: toCanvasCoord(-16), r: 46 },
      { x: toCanvasCoord(36), y: toCanvasCoord(42), r: 48 },
      { x: toCanvasCoord(40), y: toCanvasCoord(18), r: 52 },
      { x: toCanvasCoord(38), y: toCanvasCoord(-44), r: 50 },
      { x: mid + toCanvasDist(18), y: mid + toCanvasDist(18), r: 40 },
      { x: mid - toCanvasDist(20), y: mid - toCanvasDist(20), r: 42 },
      { x: mid, y: mid + toCanvasDist(28), r: 44 },
      { x: mid, y: mid - toCanvasDist(28), r: 44 },
    ];

    puddleLocs.forEach((p) => {
      oilPuddles.push(p);
      const grad = ctx.createRadialGradient(p.x, p.y, p.r * 0.15, p.x, p.y, p.r);
      grad.addColorStop(0, 'rgba(5, 4, 3, 0.92)');
      grad.addColorStop(0.55, 'rgba(12, 10, 8, 0.65)');
      grad.addColorStop(0.85, 'rgba(18, 15, 12, 0.25)');
      grad.addColorStop(1.0, 'rgba(28, 24, 21, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, p.r, p.r * (0.65 + Math.random() * 0.35), Math.random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    });

    // 12. DRIED ZOMBIE BLOOD STAINS
    for (let b = 0; b < 28; b++) {
      const bx = mid + (Math.random() - 0.5) * (size * 0.75);
      const by = mid + (Math.random() - 0.5) * (size * 0.75);
      const br = 14 + Math.random() * 32;

      const bloodGrad = ctx.createRadialGradient(bx, by, 2, bx, by, br);
      bloodGrad.addColorStop(0, 'rgba(75, 10, 10, 0.6)');
      bloodGrad.addColorStop(0.6, 'rgba(45, 8, 8, 0.32)');
      bloodGrad.addColorStop(1, 'rgba(30, 6, 6, 0)');
      ctx.fillStyle = bloodGrad;
      ctx.beginPath();
      ctx.arc(bx, by, br, 0, Math.PI * 2);
      ctx.fill();
    }

    // 13. METALLIC MANHOLE COVERS & DRAIN GRATES
    const manholeLocs = [
      { x: toCanvasCoord(-12), y: toCanvasCoord(14) },
      { x: toCanvasCoord(14), y: toCanvasCoord(-12) },
      { x: toCanvasCoord(-34), y: toCanvasCoord(10) },
      { x: toCanvasCoord(34), y: toCanvasCoord(14) },
      { x: toCanvasCoord(10), y: toCanvasCoord(34) },
      { x: toCanvasCoord(-10), y: toCanvasCoord(-34) },
    ];

    manholeLocs.forEach((mh) => {
      ctx.fillStyle = '#222222';
      ctx.beginPath();
      ctx.arc(mh.x, mh.y, 14, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#3c3c3c';
      ctx.beginPath();
      ctx.arc(mh.x, mh.y, 11, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = '#181818';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(mh.x - 9, mh.y); ctx.lineTo(mh.x + 9, mh.y);
      ctx.moveTo(mh.x, mh.y - 9); ctx.lineTo(mh.x, mh.y + 9);
      ctx.stroke();
    });

    // 14. FINE ASPHALT TAR CRACKS
    ctx.strokeStyle = '#0e0c0a';
    ctx.lineWidth = 2.5;
    for (let c = 0; c < 50; c++) {
      let cx = Math.random() * size;
      let cy = Math.random() * size;
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      const segments = 4 + Math.floor(Math.random() * 4);
      for (let s = 0; s < segments; s++) {
        cx += (Math.random() - 0.5) * 35;
        cy += (Math.random() - 0.5) * 35;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }

    const map = new THREE.CanvasTexture(canvas);
    map.wrapS = THREE.RepeatWrapping;
    map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(1, 1);

    // ==============================================================
    // ROUGHNESS MAP (Glossy Oil Slicks, Smooth Road Wear, Rough Grit)
    // ==============================================================
    const rCanvas = document.createElement('canvas');
    rCanvas.width = 1024;
    rCanvas.height = 1024;
    const rCtx = rCanvas.getContext('2d')!;

    rCtx.fillStyle = '#d6d6d6';
    rCtx.fillRect(0, 0, 1024, 1024);

    rCtx.fillStyle = '#a6a6a6';
    const rRoadW = roadW / 2;
    const rMid = 512;
    rCtx.fillRect(rMid - rRoadW / 2, 0, rRoadW, 1024);
    rCtx.fillRect(0, rMid - rRoadW / 2, 1024, rRoadW);
    rCtx.beginPath();
    rCtx.arc(rMid, rMid, outerR / 2, 0, Math.PI * 2);
    rCtx.fill();

    oilPuddles.forEach((p) => {
      const rx = p.x / 2;
      const ry = p.y / 2;
      const rr = p.r / 2;
      const rGrad = rCtx.createRadialGradient(rx, ry, rr * 0.1, rx, ry, rr);
      rGrad.addColorStop(0, '#121212');
      rGrad.addColorStop(0.7, '#383838');
      rGrad.addColorStop(1, '#d6d6d6');
      rCtx.fillStyle = rGrad;
      rCtx.beginPath();
      rCtx.arc(rx, ry, rr, 0, Math.PI * 2);
      rCtx.fill();
    });

    manholeLocs.forEach((mh) => {
      rCtx.fillStyle = '#383838';
      rCtx.beginPath();
      rCtx.arc(mh.x / 2, mh.y / 2, 7, 0, Math.PI * 2);
      rCtx.fill();
    });

    const roughnessMap = new THREE.CanvasTexture(rCanvas);
    roughnessMap.wrapS = THREE.RepeatWrapping;
    roughnessMap.wrapT = THREE.RepeatWrapping;
    roughnessMap.repeat.set(1, 1);

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

  // =========================================================================
  // 2. PERIMETER FORTRESS WALLS & CORRUGATED CONTAINERS
  // =========================================================================
  private buildPerimeterFortress(): void {
    const wallHeight = 4.2;
    const containerLen = 8.0;
    const containerWid = 2.6;

    const cMatRust = new THREE.MeshStandardMaterial({ color: 0x82291e, roughness: 0.65, metalness: 0.55 });
    const cMatBlue = new THREE.MeshStandardMaterial({ color: 0x1f3d59, roughness: 0.68, metalness: 0.52 });
    const cMatOlive = new THREE.MeshStandardMaterial({ color: 0x3d472c, roughness: 0.72, metalness: 0.48 });
    const cMatSteel = new THREE.MeshStandardMaterial({ color: 0x383b40, roughness: 0.75, metalness: 0.5 });
    const containerMats = [cMatRust, cMatBlue, cMatOlive, cMatSteel];

    const steelTrimMat = new THREE.MeshStandardMaterial({ color: 0x121212, metalness: 0.9, roughness: 0.3 });
    const beaconMat = new THREE.MeshStandardMaterial({
      color: 0xff1e00,
      emissive: 0xff1100,
      emissiveIntensity: 1.5,
      roughness: 0.2,
    });
    this.pulsingMaterials.push(beaconMat);

    const wallGeom = new THREE.BoxGeometry(containerLen, wallHeight, containerWid);

    const placeWallSide = (
      startX: number,
      startZ: number,
      stepX: number,
      stepZ: number,
      count: number,
      rotY = 0
    ) => {
      for (let i = 0; i < count; i++) {
        const mat = containerMats[i % containerMats.length];
        const container = new THREE.Mesh(wallGeom, mat);
        const px = startX + stepX * i;
        const pz = startZ + stepZ * i;
        container.position.set(px, wallHeight / 2, pz);
        container.rotation.y = rotY;
        container.castShadow = true;
        container.receiveShadow = true;
        this.group.add(container);

        // Steel frame reinforcement rim
        const trimGeo = new THREE.BoxGeometry(containerLen * 0.99, 0.35, containerWid * 0.99);
        const trim = new THREE.Mesh(trimGeo, steelTrimMat);
        trim.position.set(0, wallHeight / 2 + 0.17, 0);
        container.add(trim);

        // Corrugated vertical side ridges
        for (let cr = -containerLen * 0.4; cr <= containerLen * 0.4; cr += 0.8) {
          const ribGeo = new THREE.BoxGeometry(0.12, wallHeight * 0.85, containerWid + 0.08);
          const rib = new THREE.Mesh(ribGeo, steelTrimMat);
          rib.position.set(cr, 0, 0);
          container.add(rib);
        }

        // Red hazard beacon on every 3rd container
        if (i % 3 === 0) {
          const beaconGeo = new THREE.CylinderGeometry(0.16, 0.16, 0.3, 8);
          const beacon = new THREE.Mesh(beaconGeo, beaconMat);
          beacon.position.set(0, wallHeight / 2 + 0.45, 0);
          container.add(beacon);
        }
      }
    };

    const count = Math.ceil(ARENA_SIZE / containerLen);
    const half = ARENA_HALF;

    // North & South perimeter
    placeWallSide(-half + containerLen / 2, half, containerLen, 0, count, 0);
    placeWallSide(-half + containerLen / 2, -half, containerLen, 0, count, 0);

    // East & West perimeter
    placeWallSide(half, -half + containerLen / 2, 0, containerLen, count, Math.PI / 2);
    placeWallSide(-half, -half + containerLen / 2, 0, containerLen, count, Math.PI / 2);
  }

  // =========================================================================
  // 3. GATEWAY & CORNER WATCHTOWERS (FLANKING HIGHWAYS, NEVER BLOCKING)
  // =========================================================================
  private buildGatewayWatchtowers(): void {
    const towerLocations = [
      // 4 Perimeter Corners
      { x: -ARENA_HALF + 8, z: -ARENA_HALF + 8, targetX: -20, targetZ: -20 },
      { x: ARENA_HALF - 8, z: -ARENA_HALF + 8, targetX: 20, targetZ: -20 },
      { x: -ARENA_HALF + 8, z: ARENA_HALF - 8, targetX: -20, targetZ: 20 },
      { x: ARENA_HALF - 8, z: ARENA_HALF - 8, targetX: 20, targetZ: 20 },
      // Flanking North & South Highway Gates
      { x: 12, z: ARENA_HALF - 6, targetX: 0, targetZ: 25 },
      { x: -12, z: ARENA_HALF - 6, targetX: 0, targetZ: 25 },
      { x: 12, z: -ARENA_HALF + 6, targetX: 0, targetZ: -25 },
      { x: -12, z: -ARENA_HALF + 6, targetX: 0, targetZ: -25 },
    ];

    const steelTrussMat = new THREE.MeshStandardMaterial({ color: 0x222428, metalness: 0.88, roughness: 0.32 });
    const concreteBaseMat = new THREE.MeshStandardMaterial({ color: 0x484b4f, roughness: 0.9, metalness: 0.1 });
    const lampHousingMat = new THREE.MeshStandardMaterial({ color: 0x141414, metalness: 0.92, roughness: 0.2 });
    const lampGlowMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xfffae0,
      emissiveIntensity: 3.2,
      roughness: 0.1,
    });

    towerLocations.forEach((loc, idx) => {
      const towerGroup = new THREE.Group();
      const towerH = 15.0;

      // Solid Concrete Pedestal Base (Obstacle collider)
      const baseGeo = new THREE.BoxGeometry(2.4, 1.6, 2.4);
      const baseMesh = new THREE.Mesh(baseGeo, concreteBaseMat);
      baseMesh.position.set(0, 0.8, 0);
      baseMesh.castShadow = true;
      baseMesh.receiveShadow = true;
      towerGroup.add(baseMesh);

      this.obstacles.push({
        id: `tower_base_${idx}`,
        type: 'box',
        x: loc.x,
        z: loc.z,
        width: 1.25,
        depth: 1.25,
        rotation: 0,
        height: 1.6,
        mesh: baseMesh,
        active: true,
      });

      // 4 Steel Leg Truss Columns
      const legGeo = new THREE.CylinderGeometry(0.12, 0.18, towerH, 6);
      for (const lx of [-0.75, 0.75]) {
        for (const lz of [-0.75, 0.75]) {
          const leg = new THREE.Mesh(legGeo, steelTrussMat);
          leg.position.set(lx, towerH / 2 + 0.8, lz);
          leg.castShadow = true;
          towerGroup.add(leg);
        }
      }

      // Observation Catwalk Platform
      const platformGeo = new THREE.BoxGeometry(2.6, 0.25, 2.6);
      const platform = new THREE.Mesh(platformGeo, steelTrussMat);
      platform.position.set(0, towerH + 0.8, 0);
      towerGroup.add(platform);

      // Floodlight Fixture Array (3 High-Powered Halogen Lamps)
      for (let li = -0.9; li <= 0.9; li += 0.9) {
        const fixGroup = new THREE.Group();
        fixGroup.position.set(li, towerH + 1.2, 0);

        const housingGeo = new THREE.BoxGeometry(0.65, 0.45, 0.35);
        const housing = new THREE.Mesh(housingGeo, lampHousingMat);
        fixGroup.add(housing);

        const lensGeo = new THREE.PlaneGeometry(0.58, 0.38);
        const lens = new THREE.Mesh(lensGeo, lampGlowMat);
        lens.position.set(0, 0, 0.18);
        fixGroup.add(lens);

        fixGroup.lookAt(new THREE.Vector3(loc.targetX, 0, loc.targetZ));
        towerGroup.add(fixGroup);
      }

      towerGroup.position.set(loc.x, 0, loc.z);
      this.group.add(towerGroup);
    });
  }

  // =========================================================================
  // 4. ZONE 1: OPEN CENTRAL DRIFT ROUNDABOUT & APEX TIRE PYLONS
  // =========================================================================
  private buildCentralDriftArena(): void {
    const tireRadius = 0.85;
    const tireAngles = [Math.PI / 4, (3 * Math.PI) / 4, (5 * Math.PI) / 4, (7 * Math.PI) / 4];

    const tireMat = new THREE.MeshStandardMaterial({ color: 0x161616, roughness: 0.95, metalness: 0.05 });
    const tireRimMat = new THREE.MeshStandardMaterial({ color: 0xb71c1c, roughness: 0.5, metalness: 0.6 });

    tireAngles.forEach((ang, tidx) => {
      const dist = 11.0;
      const tx = Math.cos(ang) * dist;
      const tz = Math.sin(ang) * dist;

      const stackGroup = new THREE.Group();
      stackGroup.position.set(tx, 0, tz);

      for (let t = 0; t < 3; t++) {
        const tGeo = new THREE.CylinderGeometry(tireRadius, tireRadius, 0.45, 12);
        const tMesh = new THREE.Mesh(tGeo, t % 2 === 0 ? tireMat : tireRimMat);
        tMesh.position.y = 0.225 + t * 0.44;
        tMesh.castShadow = true;
        tMesh.receiveShadow = true;
        stackGroup.add(tMesh);
      }

      this.group.add(stackGroup);

      this.obstacles.push({
        id: `center_apex_tire_${tidx}`,
        type: 'cylinder',
        x: tx,
        z: tz,
        width: tireRadius,
        depth: tireRadius,
        radius: tireRadius,
        rotation: 0,
        height: 1.4,
        isTireStack: true,
        mesh: stackGroup,
        active: true,
      });
    });
  }

  // =========================================================================
  // 5. NORTH-EAST SECTOR: INDUSTRIAL MACHINE SHOP & STEELWORKS [X: 38, Z: 54]
  // =========================================================================
  private buildNorthEastMachineShop(): void {
    const shopX = 38;
    const shopZ = 54;
    const shopGroup = new THREE.Group();
    shopGroup.position.set(shopX, 0, shopZ);

    const length = 18.0;
    const width = 10.0;
    const height = 4.2;

    const wallMat = new THREE.MeshStandardMaterial({ color: 0x2e353b, roughness: 0.72, metalness: 0.52 });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x1e2024, roughness: 0.6, metalness: 0.65 });
    const shutterMat = new THREE.MeshStandardMaterial({ color: 0xbb822a, roughness: 0.55, metalness: 0.5 });
    const steelTrimMat = new THREE.MeshStandardMaterial({ color: 0x161616, metalness: 0.9, roughness: 0.3 });
    const hazardMat = new THREE.MeshStandardMaterial({ color: 0xffba08, emissive: 0x664400, emissiveIntensity: 0.5 });
    this.pulsingMaterials.push(hazardMat);

    // 1. Main Workshop Building
    const bodyGeo = new THREE.BoxGeometry(length, height, width);
    const body = new THREE.Mesh(bodyGeo, wallMat);
    body.position.y = height / 2;
    body.castShadow = true;
    body.receiveShadow = true;
    shopGroup.add(body);

    // 2. Corrugated Industrial Roof with Skylights
    const roofGeo = new THREE.BoxGeometry(length + 0.6, 0.4, width + 0.6);
    const roof = new THREE.Mesh(roofGeo, roofMat);
    roof.position.y = height + 0.2;
    roof.castShadow = true;
    roof.receiveShadow = true;
    shopGroup.add(roof);

    const skyMat = new THREE.MeshStandardMaterial({ color: 0x6fa8dc, roughness: 0.2, metalness: 0.8 });
    for (const sx of [-length / 4, length / 4]) {
      const skylight = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.25, 2.2), skyMat);
      skylight.position.set(sx, height + 0.4, 0);
      shopGroup.add(skylight);
    }

    // Rooftop Chimneys
    for (const cx of [-length * 0.35, length * 0.35]) {
      const pipeGeo = new THREE.CylinderGeometry(0.32, 0.32, 1.6, 8);
      const pipe = new THREE.Mesh(pipeGeo, steelTrimMat);
      pipe.position.set(cx, height + 1.0, -width * 0.3);
      shopGroup.add(pipe);

      const cap = new THREE.Mesh(new THREE.ConeGeometry(0.5, 0.3, 8), steelTrimMat);
      cap.position.set(cx, height + 1.9, -width * 0.3);
      shopGroup.add(cap);
    }

    // 3. Roll-up Garage Bay Doors (North & South)
    for (const side of [-1, 1]) {
      const doorGeo = new THREE.PlaneGeometry(5.0, 3.2);
      const door = new THREE.Mesh(doorGeo, shutterMat);
      door.position.set(0, 1.6, (side * width) / 2 + side * 0.02);
      if (side < 0) door.rotation.y = Math.PI;
      shopGroup.add(door);

      const headerGeo = new THREE.BoxGeometry(5.4, 0.35, 0.35);
      const header = new THREE.Mesh(headerGeo, hazardMat);
      header.position.set(0, 3.4, (side * width) / 2 + side * 0.1);
      shopGroup.add(header);
    }

    this.group.add(shopGroup);

    this.obstacles.push({
      id: 'ne_machine_shop',
      type: 'box',
      x: shopX,
      z: shopZ,
      width: length / 2 + 0.3,
      depth: width / 2 + 0.3,
      rotation: 0,
      height: height,
      mesh: shopGroup,
      active: true,
    });
  }

  // =========================================================================
  // 6. NORTH-WEST SECTOR: CONTAINER FORTRESS & CRANE POST [X: -42, Z: 52]
  // =========================================================================
  private buildNorthWestContainerFort(): void {
    const fX = -42;
    const fZ = 52;
    const fGroup = new THREE.Group();
    fGroup.position.set(fX, 0, fZ);

    const cMat1 = new THREE.MeshStandardMaterial({ color: 0x1f3c5a, roughness: 0.68, metalness: 0.52 });
    const cMat2 = new THREE.MeshStandardMaterial({ color: 0x8b2518, roughness: 0.65, metalness: 0.55 });
    const cMat3 = new THREE.MeshStandardMaterial({ color: 0x3d472c, roughness: 0.72, metalness: 0.48 });

    // Lower Container 1
    const boxGeo = new THREE.BoxGeometry(8.0, 3.2, 2.8);
    const c1 = new THREE.Mesh(boxGeo, cMat1);
    c1.position.set(0, 1.6, -1.8);
    c1.castShadow = true;
    c1.receiveShadow = true;
    fGroup.add(c1);

    // Lower Container 2
    const c2 = new THREE.Mesh(boxGeo, cMat3);
    c2.position.set(0, 1.6, 1.8);
    c2.castShadow = true;
    c2.receiveShadow = true;
    fGroup.add(c2);

    // Upper Container
    const c3 = new THREE.Mesh(boxGeo, cMat2);
    c3.position.set(0, 4.4, 0);
    c3.rotation.y = 0.25;
    c3.castShadow = true;
    c3.receiveShadow = true;
    fGroup.add(c3);

    this.group.add(fGroup);

    this.obstacles.push({
      id: 'nw_container_fort',
      type: 'box',
      x: fX,
      z: fZ,
      width: 4.4,
      depth: 3.4,
      rotation: 0,
      height: 4.8,
      mesh: fGroup,
      active: true,
    });
  }

  // =========================================================================
  // 7. SOUTH-EAST SECTOR: CHEMICAL REFINERY & SILOS [X: 38, Z: -54]
  // =========================================================================
  private buildSouthEastRefinerySilos(): void {
    const refX = 38;
    const refZ = -54;
    const refGroup = new THREE.Group();
    refGroup.position.set(refX, 0, refZ);

    const siloMat = new THREE.MeshStandardMaterial({ color: 0x5a5e63, roughness: 0.5, metalness: 0.7 });
    const pipeMat = new THREE.MeshStandardMaterial({ color: 0xd48828, roughness: 0.45, metalness: 0.65 });
    const concreteMat = new THREE.MeshStandardMaterial({ color: 0x42403c, roughness: 0.9, metalness: 0.1 });
    const warningMat = new THREE.MeshStandardMaterial({ color: 0x00ff88, emissive: 0x00aa44, emissiveIntensity: 0.4 });
    this.pulsingMaterials.push(warningMat);

    // Concrete Containment Berm
    const bermGeo = new THREE.BoxGeometry(16.0, 0.6, 9.0);
    const berm = new THREE.Mesh(bermGeo, concreteMat);
    berm.position.y = 0.3;
    berm.receiveShadow = true;
    refGroup.add(berm);

    // 3 Silos with Domed Caps
    const siloRadius = 2.2;
    const siloHeight = 4.4;
    const siloGeo = new THREE.CylinderGeometry(siloRadius, siloRadius, siloHeight, 16);
    const domeGeo = new THREE.SphereGeometry(siloRadius, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);

    const siloOffsets = [-4.8, 0, 4.8];

    siloOffsets.forEach((sx, idx) => {
      const silo = new THREE.Mesh(siloGeo, siloMat);
      silo.position.set(sx, siloHeight / 2 + 0.4, 0);
      silo.castShadow = true;
      silo.receiveShadow = true;
      refGroup.add(silo);

      const dome = new THREE.Mesh(domeGeo, siloMat);
      dome.position.set(sx, siloHeight + 0.4, 0);
      dome.castShadow = true;
      refGroup.add(dome);

      // Warning Biohazard Band
      const bandGeo = new THREE.CylinderGeometry(siloRadius + 0.05, siloRadius + 0.05, 0.35, 16);
      const band = new THREE.Mesh(bandGeo, warningMat);
      band.position.set(sx, siloHeight * 0.6 + 0.4, 0);
      refGroup.add(band);

      this.obstacles.push({
        id: `refinery_silo_${idx}`,
        type: 'cylinder',
        x: refX + sx,
        z: refZ,
        width: siloRadius + 0.1,
        depth: siloRadius + 0.1,
        radius: siloRadius + 0.1,
        rotation: 0,
        height: siloHeight + 0.8,
        mesh: silo,
        active: true,
      });
    });

    // Connecting Overhead Pipe
    const pipeGeo = new THREE.CylinderGeometry(0.18, 0.18, 11.5, 8);
    const mainPipe = new THREE.Mesh(pipeGeo, pipeMat);
    mainPipe.rotation.z = Math.PI / 2;
    mainPipe.position.set(0, siloHeight * 0.75 + 0.4, 0);
    refGroup.add(mainPipe);

    this.group.add(refGroup);
  }

  // =========================================================================
  // 8. SOUTH-WEST SECTOR: MILITARY SANDBAG BUNKER [X: -45, Z: -45]
  // =========================================================================
  private buildSouthWestMilitaryBunker(): void {
    const bX = -45;
    const bZ = -45;
    const bGroup = new THREE.Group();
    bGroup.position.set(bX, 0, bZ);

    const sandbagMat = new THREE.MeshStandardMaterial({ color: 0x6e624c, roughness: 0.92, metalness: 0.1 });
    const steelMat = new THREE.MeshStandardMaterial({ color: 0x1e1e1e, metalness: 0.88, roughness: 0.35 });

    // Sandbag Curved Wall
    const wall = new THREE.Mesh(new THREE.BoxGeometry(7.0, 1.4, 1.4), sandbagMat);
    wall.position.y = 0.7;
    wall.rotation.y = Math.PI / 4;
    wall.castShadow = true;
    wall.receiveShadow = true;
    bGroup.add(wall);

    // Anti-Tank Czech Hedgehog
    const hBeamGeo = new THREE.BoxGeometry(2.4, 0.25, 0.25);
    const b1 = new THREE.Mesh(hBeamGeo, steelMat);
    b1.position.set(1.5, 0.8, 1.5);
    b1.rotation.set(0.6, 0.4, 0.7);
    bGroup.add(b1);

    this.group.add(bGroup);

    this.obstacles.push({
      id: 'sw_military_bunker',
      type: 'box',
      x: bX,
      z: bZ,
      width: 3.5,
      depth: 1.0,
      rotation: Math.PI / 4,
      height: 1.5,
      mesh: bGroup,
      active: true,
    });
  }

  // =========================================================================
  // 9. WEST HIGHWAY GAS STATION & DINER [X: -50, Z: -22] (NORTH OF WEST HWY)
  // =========================================================================
  private buildWestHighwayGasStation(): void {
    const stX = -50;
    const stZ = -22;
    const stGroup = new THREE.Group();
    stGroup.position.set(stX, 0, stZ);

    const brickMat = new THREE.MeshStandardMaterial({ color: 0x5a3c2e, roughness: 0.85, metalness: 0.2 });
    const canopyRoofMat = new THREE.MeshStandardMaterial({ color: 0x181818, roughness: 0.6, metalness: 0.65 });
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xcca020, roughness: 0.55, metalness: 0.45 });
    const pumpMat = new THREE.MeshStandardMaterial({ color: 0xb71c1c, roughness: 0.45, metalness: 0.65 });
    const glassMat = new THREE.MeshStandardMaterial({ color: 0x152535, roughness: 0.2, metalness: 0.9 });
    const neonSignMat = new THREE.MeshStandardMaterial({
      color: 0x00e5ff,
      emissive: 0x00c4ff,
      emissiveIntensity: 1.8,
      roughness: 0.2,
    });
    this.neonMaterials.push(neonSignMat);

    // 1. Station Convenience Store (North of canopy)
    const storeGeo = new THREE.BoxGeometry(9.0, 3.6, 5.5);
    const store = new THREE.Mesh(storeGeo, brickMat);
    store.position.set(0, 1.8, -6.5);
    store.castShadow = true;
    store.receiveShadow = true;
    stGroup.add(store);

    const winGeo = new THREE.PlaneGeometry(4.4, 1.8);
    const win = new THREE.Mesh(winGeo, glassMat);
    win.position.set(0, 1.8, -3.73);
    stGroup.add(win);

    this.obstacles.push({
      id: 'gas_station_store',
      type: 'box',
      x: stX,
      z: stZ - 6.5,
      width: 4.7,
      depth: 2.9,
      rotation: 0,
      height: 3.6,
      mesh: store,
      active: true,
    });

    // 2. Overhead Canopy (Facing South towards West Highway)
    const canopyGeo = new THREE.BoxGeometry(12.0, 0.4, 7.5);
    const canopy = new THREE.Mesh(canopyGeo, canopyRoofMat);
    canopy.position.set(0, 4.2, 2.5);
    canopy.castShadow = true;
    canopy.receiveShadow = true;
    stGroup.add(canopy);

    // Neon Fascia Sign
    const signGeo = new THREE.BoxGeometry(7.0, 0.55, 0.2);
    const sign = new THREE.Mesh(signGeo, neonSignMat);
    sign.position.set(0, 4.2, 6.3);
    stGroup.add(sign);

    // 2 Support Pillars with Dual Fuel Pumps
    const islandGeo = new THREE.BoxGeometry(7.0, 0.3, 1.4);
    const island = new THREE.Mesh(islandGeo, brickMat);
    island.position.set(0, 0.15, 2.5);
    island.receiveShadow = true;
    stGroup.add(island);

    for (const px of [-2.4, 2.4]) {
      const pGeo = new THREE.BoxGeometry(0.7, 4.2, 0.7);
      const pillar = new THREE.Mesh(pGeo, pillarMat);
      pillar.position.set(px, 2.1, 2.5);
      pillar.castShadow = true;
      stGroup.add(pillar);

      this.obstacles.push({
        id: `gas_pillar_${px}`,
        type: 'box',
        x: stX + px,
        z: stZ + 2.5,
        width: 0.5,
        depth: 0.5,
        rotation: 0,
        height: 4.2,
        mesh: pillar,
        active: true,
      });

      const pumpGeo = new THREE.BoxGeometry(0.85, 1.6, 0.6);
      const pump = new THREE.Mesh(pumpGeo, pumpMat);
      pump.position.set(px + (px > 0 ? -0.9 : 0.9), 0.8, 2.5);
      pump.castShadow = true;
      pump.receiveShadow = true;
      stGroup.add(pump);
    }

    this.group.add(stGroup);
  }

  // =========================================================================
  // 10. EAST JUNKYARD & CRANE COMPOUND [X: 50, Z: 20] (NORTH OF EAST HWY)
  // =========================================================================
  private buildEastScrapJunkyard(): void {
    const yardX = 50;
    const yardZ = 20;
    const yardGroup = new THREE.Group();
    yardGroup.position.set(yardX, 0, yardZ);

    const rustMat = new THREE.MeshStandardMaterial({ color: 0x6e3b2b, roughness: 0.85, metalness: 0.35 });
    const steelTrimMat = new THREE.MeshStandardMaterial({ color: 0x1c1c1c, metalness: 0.9, roughness: 0.3 });
    const woodRoofMat = new THREE.MeshStandardMaterial({ color: 0x4a3728, roughness: 0.9, metalness: 0.1 });
    const crushedCarMat1 = new THREE.MeshStandardMaterial({ color: 0x2b4259, roughness: 0.8, metalness: 0.45 });
    const crushedCarMat2 = new THREE.MeshStandardMaterial({ color: 0x8a382c, roughness: 0.82, metalness: 0.4 });

    // 1. Scrap Yard Office Shack
    const cabinGeo = new THREE.BoxGeometry(5.5, 3.4, 4.5);
    const cabin = new THREE.Mesh(cabinGeo, rustMat);
    cabin.position.set(4.0, 1.7, 4.0);
    cabin.castShadow = true;
    cabin.receiveShadow = true;
    yardGroup.add(cabin);

    const cRoofGeo = new THREE.BoxGeometry(6.0, 0.3, 5.0);
    const cRoof = new THREE.Mesh(cRoofGeo, woodRoofMat);
    cRoof.position.set(4.0, 3.5, 4.0);
    yardGroup.add(cRoof);

    this.obstacles.push({
      id: 'junkyard_cabin',
      type: 'box',
      x: yardX + 4.0,
      z: yardZ + 4.0,
      width: 2.9,
      depth: 2.4,
      rotation: 0,
      height: 3.5,
      mesh: cabin,
      active: true,
    });

    // 2. Industrial Scrap Crane Base & Boom
    const craneBaseGeo = new THREE.CylinderGeometry(1.1, 1.3, 1.8, 8);
    const craneBase = new THREE.Mesh(craneBaseGeo, steelTrimMat);
    craneBase.position.set(-3.0, 0.9, -2.0);
    craneBase.castShadow = true;
    yardGroup.add(craneBase);

    const boomGeo = new THREE.BoxGeometry(0.45, 0.45, 5.5);
    const boom = new THREE.Mesh(boomGeo, steelTrimMat);
    boom.position.set(-3.0, 3.2, 0.0);
    boom.rotation.x = 0.45;
    yardGroup.add(boom);

    this.obstacles.push({
      id: 'junkyard_crane',
      type: 'cylinder',
      x: yardX - 3.0,
      z: yardZ - 2.0,
      width: 1.3,
      depth: 1.3,
      radius: 1.3,
      rotation: 0,
      height: 3.2,
      mesh: craneBase,
      active: true,
    });

    // 3. Compacted Scrap Metal Cubes
    const scrapCubeGeo = new THREE.BoxGeometry(2.2, 1.2, 2.2);
    const cube1 = new THREE.Mesh(scrapCubeGeo, crushedCarMat1);
    cube1.position.set(-4.0, 0.6, 2.5);
    cube1.castShadow = true;
    yardGroup.add(cube1);

    const cube2 = new THREE.Mesh(scrapCubeGeo, crushedCarMat2);
    cube2.position.set(-4.0, 1.8, 2.5);
    cube2.castShadow = true;
    yardGroup.add(cube2);

    this.obstacles.push({
      id: 'scrap_stack_east',
      type: 'box',
      x: yardX - 4.0,
      z: yardZ + 2.5,
      width: 1.2,
      depth: 1.2,
      rotation: 0,
      height: 2.4,
      mesh: yardGroup,
      active: true,
    });

    this.group.add(yardGroup);
  }

  // =========================================================================
  // 11. STREET CHICANES, K-RAILS & ROAD PROPS
  // =========================================================================
  private buildStreetChicanesAndProps(): void {
    const kRails = [
      { x: 16, z: 20, rot: 0.4 },
      { x: -16, z: 20, rot: -0.4 },
      { x: 16, z: -20, rot: -0.4 },
      { x: -16, z: -20, rot: 0.4 },
    ];

    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x54585c, roughness: 0.88, metalness: 0.12 });
    const chevronMat = new THREE.MeshStandardMaterial({
      color: 0xffba08,
      emissive: 0x553300,
      emissiveIntensity: 0.4,
      roughness: 0.4,
    });
    this.pulsingMaterials.push(chevronMat);

    kRails.forEach((kr, idx) => {
      const kGroup = new THREE.Group();
      kGroup.position.set(kr.x, 0, kr.z);
      kGroup.rotation.y = kr.rot;

      const kGeo = new THREE.BoxGeometry(4.4, 1.2, 0.85);
      const kMesh = new THREE.Mesh(kGeo, barrierMat);
      kMesh.position.y = 0.6;
      kMesh.castShadow = true;
      kMesh.receiveShadow = true;
      kGroup.add(kMesh);

      const topGeo = new THREE.BoxGeometry(4.3, 0.14, 0.65);
      const topPlate = new THREE.Mesh(topGeo, chevronMat);
      topPlate.position.y = 1.24;
      kGroup.add(topPlate);

      this.group.add(kGroup);

      this.obstacles.push({
        id: `k_rail_${idx}`,
        type: 'box',
        x: kr.x,
        z: kr.z,
        width: 2.3,
        depth: 0.5,
        rotation: kr.rot,
        height: 1.3,
        mesh: kGroup,
        active: true,
      });
    });
  }

  // =========================================================================
  // 12. SUPPLY CRATES (LOOT & REPAIR DROPS)
  // =========================================================================
  private buildSupplyCrates(): void {
    const crateLocations = [
      { x: -14, z: 24 },
      { x: 14, z: 24 },
      { x: -14, z: -24 },
      { x: 14, z: -24 },
      { x: 28, z: 18 },
      { x: -28, z: 18 },
      { x: 28, z: -18 },
      { x: -28, z: -18 },
      { x: 0, z: 26 },
      { x: 0, z: -26 },
    ];

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x9c6634, roughness: 0.85, metalness: 0.1 });
    const ironBandMat = new THREE.MeshStandardMaterial({ color: 0x1f1f1f, metalness: 0.9, roughness: 0.25 });

    crateLocations.forEach((loc, idx) => {
      const cGroup = new THREE.Group();
      cGroup.position.set(loc.x, 0, loc.z);

      const boxGeo = new THREE.BoxGeometry(1.6, 1.6, 1.6);
      const box = new THREE.Mesh(boxGeo, woodMat);
      box.position.y = 0.8;
      box.castShadow = true;
      box.receiveShadow = true;
      cGroup.add(box);

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

  // =========================================================================
  // 13. EXPLOSIVE RED FUEL BARRELS
  // =========================================================================
  private buildExplosiveBarrels(): void {
    const barrelLocations = [
      { x: -8, z: -16 },
      { x: 8, z: -16 },
      { x: -8, z: 16 },
      { x: 8, z: 16 },
      { x: -24, z: 6 },
      { x: 24, z: -6 },
      { x: -18, z: 32 },
      { x: 18, z: 32 },
      { x: -18, z: -32 },
      { x: 18, z: -32 },
      { x: 34, z: 16 },
      { x: -34, z: 16 },
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

  // =========================================================================
  // UPDATE LOOP: RESPAWNS & PULSES
  // =========================================================================
  public update(dt: number): void {
    const time = performance.now() * 0.003;
    const pulse = 0.5 + 0.4 * Math.sin(time * 3.5);

    // Hazard lights pulsing
    for (let i = 0; i < this.pulsingMaterials.length; i++) {
      this.pulsingMaterials[i].emissiveIntensity = pulse;
    }

    // Neon signs subtle flicker
    const neonFlicker = 1.6 + 0.3 * Math.sin(time * 6.0) + (Math.random() < 0.02 ? -0.5 : 0);
    for (let i = 0; i < this.neonMaterials.length; i++) {
      this.neonMaterials[i].emissiveIntensity = Math.max(0.8, neonFlicker);
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
