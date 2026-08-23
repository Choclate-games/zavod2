import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';

export interface CheckpointData {
  index: number;
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  radius: number;
}

export interface TrackData {
  curve: THREE.CatmullRomCurve3;
  checkpoints: CheckpointData[];
  startPosition: THREE.Vector3;
  startRotation: THREE.Quaternion;
  opponentStarts: { position: THREE.Vector3; rotation: THREE.Quaternion }[];
  visualGroup: THREE.Group;
  roadWidth: number;
  totalLength: number;
  minimapPoints: { x: number; y: number }[];
}

export class TrackGenerator {
  static buildTrack(
    trackId: string,
    scene: THREE.Scene,
    physics: PhysicsWorld
  ): TrackData {
    const group = new THREE.Group();
    scene.add(group);

    // 1. Control points for 3 Tracks
    let controlPoints: THREE.Vector3[];
    let roadWidth = 14.0;
    let isClosed = true;

    if (trackId === 'neon_highway') {
      roadWidth = 12.0;
      isClosed = false;
      controlPoints = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 150),
        new THREE.Vector3(60, 4, 350),
        new THREE.Vector3(-80, 8, 600),
        new THREE.Vector3(-120, 4, 900),
        new THREE.Vector3(40, 0, 1250),
        new THREE.Vector3(140, -4, 1600),
        new THREE.Vector3(80, 0, 2000),
        new THREE.Vector3(-40, 6, 2400),
        new THREE.Vector3(0, 0, 2800),
        new THREE.Vector3(0, 0, 3500),
      ];
    } else if (trackId === 'port_docks') {
      roadWidth = 16.0;
      isClosed = true;
      controlPoints = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 140),
        new THREE.Vector3(110, 0, 240),
        new THREE.Vector3(200, 0, 200),
        new THREE.Vector3(210, 0, 80),
        new THREE.Vector3(120, 0, -20),
        new THREE.Vector3(180, 0, -140),
        new THREE.Vector3(120, 0, -240),
        new THREE.Vector3(-40, 0, -260),
        new THREE.Vector3(-140, 0, -180),
        new THREE.Vector3(-160, 0, -60),
        new THREE.Vector3(-80, 0, 40),
      ];
    } else {
      // downtown_loop (Default)
      roadWidth = 15.0;
      isClosed = true;
      controlPoints = [
        new THREE.Vector3(0, 0, 0),
        new THREE.Vector3(0, 0, 200),
        new THREE.Vector3(120, 4, 380),
        new THREE.Vector3(280, 8, 420),
        new THREE.Vector3(420, 4, 320),
        new THREE.Vector3(460, 0, 160),
        new THREE.Vector3(400, -3, -60),
        new THREE.Vector3(260, 0, -220),
        new THREE.Vector3(100, 5, -280),
        new THREE.Vector3(-80, 8, -220),
        new THREE.Vector3(-180, 4, -80),
        new THREE.Vector3(-160, 0, 80),
      ];
    }

    const curve = new THREE.CatmullRomCurve3(controlPoints, isClosed, 'centripetal', 0.5);
    const SAMPLES = isClosed ? 360 : 300;
    const totalLength = curve.getLength();

    // 2. Materials
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x11131a,
      roughness: 0.28,
      metalness: 0.35,
    });

    const curbRedMat = new THREE.MeshStandardMaterial({ color: 0xee2233, roughness: 0.5 });
    const curbWhiteMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 });
    const barrierMat = new THREE.MeshStandardMaterial({ color: 0x1a243b, metalness: 0.5, roughness: 0.3 });
    const neonSignMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const buildingMat = new THREE.MeshStandardMaterial({ color: 0x090b12, roughness: 0.7 });
    const windowGlowMat = new THREE.MeshBasicMaterial({ color: 0x183060 });

    // 3. Build Extruded Road Surface & Colliders
    const roadPositions: number[] = [];
    const roadIndices: number[] = [];
    const roadUVs: number[] = [];

    const halfW = roadWidth / 2;
    const worldUp = new THREE.Vector3(0, 1, 0);

    const leftEdgePts: THREE.Vector3[] = [];
    const rightEdgePts: THREE.Vector3[] = [];

    for (let i = 0; i <= SAMPLES; i++) {
      const t = (i / SAMPLES) % 1;
      const pt = curve.getPointAt(t);
      const tan = curve.getTangentAt(t).normalize();

      const rawRight = new THREE.Vector3().crossVectors(tan, worldUp).normalize();
      if (rawRight.lengthSq() < 1e-4) rawRight.set(1, 0, 0);

      const leftPt = pt.clone().addScaledVector(rawRight, -halfW);
      const rightPt = pt.clone().addScaledVector(rawRight, halfW);

      leftEdgePts.push(leftPt);
      rightEdgePts.push(rightPt);

      // Vertex left & right
      roadPositions.push(leftPt.x, leftPt.y, leftPt.z);
      roadPositions.push(rightPt.x, rightPt.y, rightPt.z);

      const vProgress = (i / SAMPLES) * 40;
      roadUVs.push(0, vProgress);
      roadUVs.push(1, vProgress);

      if (i < SAMPLES) {
        const base = i * 2;
        roadIndices.push(base, base + 1, base + 2);
        roadIndices.push(base + 1, base + 3, base + 2);
      }
    }

    const roadGeo = new THREE.BufferGeometry();
    roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPositions, 3));
    roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUVs, 2));
    roadGeo.setIndex(roadIndices);
    roadGeo.computeVertexNormals();

    const roadMesh = new THREE.Mesh(roadGeo, roadMat);
    roadMesh.receiveShadow = true;
    group.add(roadMesh);

    // Create Rapier terrain trimesh for road
    physics.createTerrain(new Float32Array(roadPositions), new Uint32Array(roadIndices));

    // 4. Barrier Walls and City Props along edges
    const barrierGeo = new THREE.BoxGeometry(0.5, 1.2, 12.0);
    const wallStep = 10;

    for (let i = 0; i < leftEdgePts.length; i += wallStep) {
      const pL = leftEdgePts[i];
      const pR = rightEdgePts[i];
      const nextIdx = Math.min(leftEdgePts.length - 1, i + wallStep);

      // Left Barrier
      const bL = new THREE.Mesh(barrierGeo, barrierMat);
      bL.position.copy(pL).add(new THREE.Vector3(0, 0.6, 0));
      bL.lookAt(leftEdgePts[nextIdx].clone().add(new THREE.Vector3(0, 0.6, 0)));
      group.add(bL);

      // Right Barrier
      const bR = new THREE.Mesh(barrierGeo, barrierMat);
      bR.position.copy(pR).add(new THREE.Vector3(0, 0.6, 0));
      bR.lookAt(rightEdgePts[nextIdx].clone().add(new THREE.Vector3(0, 0.6, 0)));
      group.add(bR);

      // Add physical wall box colliders for safety boundaries
      physics.createWallCollider(0.6, 1.5, 6.0, pL.x, pL.y + 0.6, pL.z);
      physics.createWallCollider(0.6, 1.5, 6.0, pR.x, pR.y + 0.6, pR.z);

      // City Skyscraper Props
      if (i % 20 === 0) {
        const h = 40 + Math.random() * 80;
        const bldgGeo = new THREE.BoxGeometry(25 + Math.random() * 20, h, 25 + Math.random() * 20);
        const bldg = new THREE.Mesh(bldgGeo, buildingMat);
        const offsetDist = halfW + 35 + Math.random() * 25;
        const side = (i / 20) % 2 === 0 ? 1 : -1;
        const edgePt = side === 1 ? pR : pL;
        const outDir = edgePt.clone().sub(curve.getPointAt((i / SAMPLES) % 1)).normalize();

        bldg.position.copy(edgePt).addScaledVector(outDir, offsetDist);
        bldg.position.y += h / 2 - 2;
        group.add(bldg);

        // Billboard / Window Neon Glow
        const signGeo = new THREE.PlaneGeometry(12, 5);
        const signMesh = new THREE.Mesh(signGeo, neonSignMat);
        signMesh.position.copy(bldg.position);
        signMesh.position.y += 12;
        signMesh.lookAt(curve.getPointAt((i / SAMPLES) % 1));
        group.add(signMesh);
      }
    }

    // 5. Checkpoints setup
    const CP_COUNT = 32;
    const checkpoints: CheckpointData[] = [];
    const minimapPoints: { x: number; y: number }[] = [];

    for (let c = 0; c < CP_COUNT; c++) {
      const t = c / CP_COUNT;
      const pt = curve.getPointAt(t);
      const tan = curve.getTangentAt(t).normalize();

      checkpoints.push({
        index: c,
        position: pt,
        tangent: tan,
        radius: roadWidth * 0.9,
      });

      minimapPoints.push({ x: pt.x, y: pt.z });
    }

    // 6. Start Grid Arch & Grid Positions
    const startPt = curve.getPointAt(0);
    const startTan = curve.getTangentAt(0).normalize();
    const startRot = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), startTan);

    const startArch = new THREE.Group();
    const archPillarGeo = new THREE.BoxGeometry(0.8, 8, 0.8);
    const archTopGeo = new THREE.BoxGeometry(roadWidth + 4, 1.2, 1.2);

    const pillarL = new THREE.Mesh(archPillarGeo, barrierMat);
    pillarL.position.set(-halfW - 1.5, 4, 0);
    const pillarR = new THREE.Mesh(archPillarGeo, barrierMat);
    pillarR.position.set(halfW + 1.5, 4, 0);
    const archTop = new THREE.Mesh(archTopGeo, barrierMat);
    archTop.position.set(0, 7.5, 0);

    const startBannerMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(roadWidth, 2), startBannerMat);
    banner.position.set(0, 7.2, 0.65);
    banner.rotation.y = Math.PI;

    startArch.add(pillarL, pillarR, archTop, banner);
    startArch.position.copy(startPt);
    startArch.quaternion.copy(startRot);
    group.add(startArch);

    // Opponent starting grid positions (staggered P2, P3, P4)
    const opponentStarts = [
      {
        position: startPt.clone().add(new THREE.Vector3(2.5, 0, -10).applyQuaternion(startRot)),
        rotation: startRot.clone(),
      },
      {
        position: startPt.clone().add(new THREE.Vector3(-2.5, 0, -20).applyQuaternion(startRot)),
        rotation: startRot.clone(),
      },
      {
        position: startPt.clone().add(new THREE.Vector3(2.5, 0, -30).applyQuaternion(startRot)),
        rotation: startRot.clone(),
      },
    ];

    return {
      curve,
      checkpoints,
      startPosition: startPt.clone().add(new THREE.Vector3(0, 0.2, 0)),
      startRotation: startRot,
      opponentStarts,
      visualGroup: group,
      roadWidth,
      totalLength,
      minimapPoints,
    };
  }
}
