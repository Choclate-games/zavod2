import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';

export type GuardState = 'PATROL' | 'SUSPICIOUS' | 'COMBAT';

export class StealthMode {
  public group = new THREE.Group();

  // Guard & Vision Cone
  public guard = new THREE.Group();
  public guardMesh: THREE.Mesh;
  public coneMesh: THREE.Mesh;
  private coneGeom: THREE.BufferGeometry;
  public guardState: GuardState = 'PATROL';
  public suspicion = 0; // 0..100%

  // Patrol waypoints
  private waypoints = [
    new THREE.Vector3(-8, 0, -6),
    new THREE.Vector3(8, 0, -6),
    new THREE.Vector3(8, 0, 6),
    new THREE.Vector3(-8, 0, 6),
  ];
  private currentWaypoint = 0;
  private guardSpeed = 3.5;

  // Obstacles for raycast clipping
  public obstacles: THREE.Object3D[] = [];

  // Sneaking Player
  public player = new THREE.Group();
  public playerPos = new THREE.Vector3(0, 0, 8);

  constructor(
    private parentScene: THREE.Scene,
    private audio: AudioManager,
    private onCameraShake: (trauma: number) => void
  ) {
    this.group.visible = false;
    this.parentScene.add(this.group);

    this.buildArenaAndObstacles();
    this.buildGuardAndVisionCone();
    this.buildPlayer();
  }

  private buildArenaAndObstacles(): void {
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(36, 36),
      new THREE.MeshStandardMaterial({ color: 0x1e272e, roughness: 0.8 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Pillars / Cover Walls
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x34495e, roughness: 0.5 });
    const wallPositions = [
      new THREE.Vector3(-4, 1.5, -2),
      new THREE.Vector3(4, 1.5, -2),
      new THREE.Vector3(0, 1.5, 3),
      new THREE.Vector3(-5, 1.5, 4),
      new THREE.Vector3(5, 1.5, 4),
    ];

    wallPositions.forEach((pos) => {
      const box = new THREE.Mesh(new THREE.BoxGeometry(2.4, 3.0, 1.4), pillarMat);
      box.position.copy(pos);
      box.castShadow = true;
      this.group.add(box);
      this.obstacles.push(box);
    });
  }

  private buildGuardAndVisionCone(): void {
    // Guard Model
    this.guardMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.45, 0.45, 1.8, 12),
      new THREE.MeshStandardMaterial({ color: 0xe74c3c, roughness: 0.4 })
    );
    this.guardMesh.position.y = 0.9;
    this.guardMesh.castShadow = true;
    this.guard.add(this.guardMesh);

    // Vision Cone Procedural Mesh
    this.coneGeom = new THREE.BufferGeometry();
    const coneMat = new THREE.MeshBasicMaterial({
      color: 0x2ecc71,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    this.coneMesh = new THREE.Mesh(this.coneGeom, coneMat);
    this.group.add(this.coneMesh);

    this.guard.position.copy(this.waypoints[0]);
    this.group.add(this.guard);
  }

  private buildPlayer(): void {
    const pMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.35, 0.8, 8, 12),
      new THREE.MeshStandardMaterial({ color: 0x00cec9, roughness: 0.3, metalness: 0.7 })
    );
    pMesh.position.y = 0.75;
    pMesh.castShadow = true;
    this.player.add(pMesh);
    this.player.position.copy(this.playerPos);
    this.group.add(this.player);
  }

  private updateVisionConeMesh(raycaster: THREE.Raycaster): boolean {
    const origin = this.guard.position.clone().add(new THREE.Vector3(0, 1.4, 0));
    const forwardAngle = this.guard.rotation.y;
    const fovAngle = Math.PI / 2.2; // ~82 deg
    const maxDistance = 12.0;
    const segments = 28;

    const vertices: number[] = [origin.x, origin.y, origin.z];
    const halfFov = fovAngle / 2;
    let isPlayerSeen = false;

    for (let i = 0; i <= segments; i++) {
      const angle = forwardAngle - halfFov + (i / segments) * fovAngle;
      const dir = new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)).normalize();

      raycaster.set(origin, dir);
      raycaster.far = maxDistance;

      const hits = raycaster.intersectObjects(this.obstacles, false);
      let dist = maxDistance;
      if (hits.length > 0) {
        dist = hits[0].distance;
      }

      // Check if player in sight cone
      const toPlayer = this.player.position.clone().add(new THREE.Vector3(0, 0.8, 0)).sub(origin);
      const playerDist = toPlayer.length();
      if (playerDist < dist) {
        const playerDir = toPlayer.clone().normalize();
        const angleDiff = Math.abs(forwardAngle - Math.atan2(playerDir.x, playerDir.z));
        if (angleDiff < halfFov) {
          // Raycast check to player
          raycaster.set(origin, playerDir);
          const pObstacleHits = raycaster.intersectObjects(this.obstacles, false);
          if (pObstacleHits.length === 0 || pObstacleHits[0].distance > playerDist) {
            isPlayerSeen = true;
          }
        }
      }

      // Ground vertex of vision cone
      vertices.push(
        origin.x + dir.x * dist,
        0.05,
        origin.z + dir.z * dist
      );
    }

    const indices: number[] = [];
    for (let i = 1; i <= segments; i++) {
      indices.push(0, i, i + 1);
    }

    this.coneGeom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    this.coneGeom.setIndex(indices);
    this.coneGeom.computeVertexNormals();

    return isPlayerSeen;
  }

  public update(dt: number, playerMove: { x: number; z: number }): void {
    if (!this.group.visible) return;

    // 1. Move Player
    this.playerPos.x += playerMove.x * 6.5 * dt;
    this.playerPos.z += playerMove.z * 6.5 * dt;
    this.player.position.copy(this.playerPos);

    // 2. Guard Patrol AI
    const targetWp = this.waypoints[this.currentWaypoint];
    const toWp = targetWp.clone().sub(this.guard.position);
    const distToWp = toWp.length();

    if (distToWp > 0.3) {
      toWp.normalize();
      this.guard.position.addScaledVector(toWp, this.guardSpeed * dt);
      const targetAngle = Math.atan2(toWp.x, toWp.z);
      this.guard.rotation.y = THREE.MathUtils.lerp(this.guard.rotation.y, targetAngle, 8.0 * dt);
    } else {
      this.currentWaypoint = (this.currentWaypoint + 1) % this.waypoints.length;
    }

    // 3. Vision Cone Real-Time Raycasting
    const raycaster = new THREE.Raycaster();
    const isPlayerInSight = this.updateVisionConeMesh(raycaster);

    // 4. Suspicion and Alert State
    if (isPlayerInSight) {
      this.suspicion = Math.min(100, this.suspicion + 45 * dt);
    } else {
      this.suspicion = Math.max(0, this.suspicion - 25 * dt);
    }

    const coneMat = this.coneMesh.material as THREE.MeshBasicMaterial;
    if (this.suspicion >= 100) {
      if (this.guardState !== 'COMBAT') {
        this.guardState = 'COMBAT';
        this.audio.playAlarm();
        this.onCameraShake(0.3);
      }
      coneMat.color.setHex(0xe74c3c); // RED ALERT
    } else if (this.suspicion > 20) {
      this.guardState = 'SUSPICIOUS';
      coneMat.color.setHex(0xf39c12); // YELLOW SUSPICIOUS
    } else {
      this.guardState = 'PATROL';
      coneMat.color.setHex(0x2ecc71); // GREEN PATROL
    }
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
