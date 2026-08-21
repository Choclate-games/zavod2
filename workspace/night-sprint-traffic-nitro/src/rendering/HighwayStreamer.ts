import * as THREE from 'three';
import { proceduralModels } from './ProceduralModels';
import { PhysicsWorld, physicsWorld } from '../physics/PhysicsWorld';

export class HighwayStreamer {
  readonly group = new THREE.Group();

  private readonly segmentLength = 100;
  private readonly numSegments = 10; // 1000m corridor
  private segments: THREE.Group[] = [];

  private roadMat: THREE.MeshStandardMaterial;
  private barrierMat: THREE.MeshStandardMaterial;
  private ledCyanMat: THREE.MeshBasicMaterial;
  private ledMagentaMat: THREE.MeshBasicMaterial;
  private streetLightMat: THREE.MeshBasicMaterial;
  private buildingMat: THREE.MeshStandardMaterial;
  private windowMats: THREE.MeshBasicMaterial[] = [];

  constructor(
    private readonly scene: THREE.Scene,
    private readonly physics: PhysicsWorld = physicsWorld
  ) {
    // Wet Asphalt PBR Material
    this.roadMat = new THREE.MeshStandardMaterial({
      color: 0x0a1117,
      roughness: 0.18, // Shiny wet surface
      metalness: 0.50,
    });

    this.barrierMat = new THREE.MeshStandardMaterial({
      color: 0x3a3a3e,
      roughness: 0.60,
      metalness: 0.30,
    });

    this.ledCyanMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    this.ledMagentaMat = new THREE.MeshBasicMaterial({ color: 0xff007f });
    this.streetLightMat = new THREE.MeshBasicMaterial({ color: 0xffffdd });

    this.buildingMat = new THREE.MeshStandardMaterial({
      color: 0x090b10,
      roughness: 0.90,
      metalness: 0.10,
    });

    this.windowMats = [
      new THREE.MeshBasicMaterial({ color: 0x00f0ff }),
      new THREE.MeshBasicMaterial({ color: 0xff007f }),
      new THREE.MeshBasicMaterial({ color: 0xffd700 }),
      new THREE.MeshBasicMaterial({ color: 0x2979ff }),
    ];

    this.scene.add(this.group);
    this.buildInitialCorridor();
  }

  private buildInitialCorridor(): void {
    for (let i = 0; i < this.numSegments; i++) {
      const z = (i - 2) * this.segmentLength;
      const seg = this.createSegment(z);
      this.segments.push(seg);
      this.group.add(seg);
    }
  }

  initPhysics(): void {
    for (let i = 0; i < this.numSegments; i++) {
      const z = (i - 2) * this.segmentLength;
      this.physics.createRoadSegment(0, -0.5, z, 16.0, this.segmentLength);
    }
  }

  private createSegment(z: number): THREE.Group {
    const seg = new THREE.Group();
    seg.position.z = z;

    const roadGeo = new THREE.PlaneGeometry(16.0, this.segmentLength, 1, 1);
    const roadMesh = new THREE.Mesh(roadGeo, this.roadMat);
    roadMesh.rotation.x = -Math.PI / 2;
    roadMesh.receiveShadow = true;
    seg.add(roadMesh);

    const lineMat = new THREE.MeshBasicMaterial({ color: 0xeeeeee });
    const yellowMat = new THREE.MeshBasicMaterial({ color: 0xffcc00 });

    // Yellow dividing center lines
    for (const x of [-0.15, 0.15]) {
      const line = new THREE.Mesh(new THREE.PlaneGeometry(0.10, this.segmentLength), yellowMat);
      line.rotation.x = -Math.PI / 2;
      line.position.set(x, 0.01, 0);
      seg.add(line);
    }

    // Dashed white lane markings
    for (let dz = -this.segmentLength / 2; dz < this.segmentLength / 2; dz += 8) {
      for (const x of [-4.0, 4.0]) {
        const dash = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 4.0), lineMat);
        dash.rotation.x = -Math.PI / 2;
        dash.position.set(x, 0.01, dz + 2.0);
        seg.add(dash);
      }
    }

    const barrierGeo = new THREE.BoxGeometry(0.5, 0.90, this.segmentLength);
    const barrierL = new THREE.Mesh(barrierGeo, this.barrierMat);
    barrierL.position.set(-8.25, 0.45, 0);
    seg.add(barrierL);

    const barrierR = new THREE.Mesh(barrierGeo, this.barrierMat);
    barrierR.position.set(8.25, 0.45, 0);
    seg.add(barrierR);

    // LED Guide Strips
    const ledLeft = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, this.segmentLength), this.ledCyanMat);
    ledLeft.position.set(-8.0, 0.85, 0);
    seg.add(ledLeft);

    const ledRight = new THREE.Mesh(new THREE.BoxGeometry(0.10, 0.10, this.segmentLength), this.ledMagentaMat);
    ledRight.position.set(8.0, 0.85, 0);
    seg.add(ledRight);

    for (const lz of [-this.segmentLength / 4, this.segmentLength / 4]) {
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 8.0, 8), this.barrierMat);
      pole.position.set(-9.0, 4.0, lz);
      seg.add(pole);

      const arm = new THREE.Mesh(new THREE.BoxGeometry(3.0, 0.12, 0.12), this.barrierMat);
      arm.position.set(-7.5, 7.9, lz);
      seg.add(arm);

      const lamp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.4), this.streetLightMat);
      lamp.position.set(-6.0, 7.8, lz);
      seg.add(lamp);
    }

    for (const bx of [-25.0, 25.0]) {
      const height = 20 + Math.random() * 40;
      const width = 12 + Math.random() * 16;
      const blug = new THREE.Mesh(new THREE.BoxGeometry(width, height, width), this.buildingMat);
      blug.position.set(bx, height / 2, (Math.random() - 0.5) * 50);
      seg.add(blug);

      const wMat = this.windowMats[Math.floor(Math.random() * this.windowMats.length)];
      const winGeo = new THREE.PlaneGeometry(width * 0.8, height * 0.7);
      const winMesh = new THREE.Mesh(winGeo, wMat);
      winMesh.position.set(bx > 0 ? bx - width / 2 - 0.1 : bx + width / 2 + 0.1, height / 2, blug.position.z);
      winMesh.rotation.y = bx > 0 ? -Math.PI / 2 : Math.PI / 2;
      seg.add(winMesh);
    }

    if (Math.log2(Math.abs(z) + 64) % 1 < 0.3) {
      const arch = proceduralModels.createCheckpointArch('NIGHT SPRINT');
      arch.position.z = 0;
      seg.add(arch);
    }

    return seg;
  }

  update(playerZPos: number): void {
    for (const seg of this.segments) {
      if (seg.position.z < playerZPos - this.segmentLength * 1.5) {
        seg.position.z += this.segmentLength * this.numSegments;
      }
    }
  }

  reset(startZ = 0): void {
    for (let i = 0; i < this.numSegments; i++) {
      this.segments[i].position.z = startZ + (i - 2) * this.segmentLength;
    }
  }
}