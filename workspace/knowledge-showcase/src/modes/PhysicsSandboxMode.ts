import * as THREE from 'three';
import { AudioManager } from '../audio/AudioManager';

interface StateSnapshot {
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  rotY: number;
}

export class PhysicsSandboxMode {
  public group = new THREE.Group();
  public player = new THREE.Group();
  public echoGhost = new THREE.Group();

  // Player physics
  public position = new THREE.Vector3(0, 1.2, 0);
  public velocity = new THREE.Vector3();
  public isGrounded = true;

  // Grappling hook
  public isHookAttached = false;
  public hookAnchor = new THREE.Vector3(0, 8, -4);
  public ropeLength = 6.0;
  private ropeLine: THREE.Line;

  // Dash
  public isDashing = false;
  public dashTimer = 0;
  public ghostTrails: { mesh: THREE.Group; life: number }[] = [];

  // Time Rewind (Ring buffer 120 slots = 6 seconds at 20Hz)
  public snapshots: StateSnapshot[] = [];
  public maxSnapshots = 120;
  public isRewinding = false;
  private recordTimer = 0;
  private echoReplayIndex = 0;
  public hasEcho = false;
  private echoSnapshots: StateSnapshot[] = [];

  // Anchor points in arena
  public anchors: THREE.Mesh[] = [];

  constructor(
    private parentScene: THREE.Scene,
    private audio: AudioManager,
    private onCameraShake: (trauma: number) => void
  ) {
    this.group.visible = false;
    this.parentScene.add(this.group);

    this.buildArena();
    this.buildPlayer();
    this.buildEchoGhost();
    this.buildRopeRenderer();
  }

  private buildArena(): void {
    // Floor
    const floor = new THREE.Mesh(
      new THREE.BoxGeometry(40, 0.5, 40),
      new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.8, metalness: 0.2 })
    );
    floor.position.y = -0.25;
    floor.receiveShadow = true;
    this.group.add(floor);

    // Pillars / Anchors
    const anchorPositions = [
      new THREE.Vector3(-6, 7, -6),
      new THREE.Vector3(0, 8.5, -4),
      new THREE.Vector3(6, 7, -6),
      new THREE.Vector3(0, 7.5, 6),
    ];

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x34495e, roughness: 0.5 });
    const orbMat = new THREE.MeshStandardMaterial({ color: 0x00cec9, emissive: 0x00cec9, emissiveIntensity: 0.6 });

    anchorPositions.forEach((pos) => {
      // Pillar
      const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.45, pos.y, 12), pillarMat);
      pillar.position.set(pos.x, pos.y / 2, pos.z);
      pillar.castShadow = true;
      this.group.add(pillar);

      // Glowing anchor orb
      const orb = new THREE.Mesh(new THREE.SphereGeometry(0.55, 16, 16), orbMat);
      orb.position.copy(pos);
      this.group.add(orb);
      this.anchors.push(orb);
    });
  }

  private buildPlayer(): void {
    const body = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.4, 0.8, 8, 12),
      new THREE.MeshStandardMaterial({ color: 0x00cec9, roughness: 0.3, metalness: 0.7 })
    );
    body.position.y = 0.8;
    body.castShadow = true;
    this.player.add(body);
    this.group.add(this.player);
  }

  private buildEchoGhost(): void {
    const ghostBody = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.4, 0.8, 8, 12),
      new THREE.MeshStandardMaterial({
        color: 0xff7675,
        transparent: true,
        opacity: 0.5,
        roughness: 0.2,
      })
    );
    ghostBody.position.y = 0.8;
    this.echoGhost.add(ghostBody);
    this.echoGhost.visible = false;
    this.group.add(this.echoGhost);
  }

  private buildRopeRenderer(): void {
    const geom = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
    this.ropeLine = new THREE.Line(
      geom,
      new THREE.LineBasicMaterial({ color: 0xffd32a, linewidth: 3 })
    );
    this.ropeLine.visible = false;
    this.group.add(this.ropeLine);
  }

  public triggerGrapple(): void {
    if (this.isHookAttached) {
      // Detach and release boost (multiply speed by 1.15)
      this.isHookAttached = false;
      this.ropeLine.visible = false;
      this.velocity.multiplyScalar(1.18);
      this.velocity.y += 2.5;
      this.audio.playDash();
      return;
    }

    // Find nearest anchor
    let nearest: THREE.Mesh | null = null;
    let minDist = 999;

    this.anchors.forEach((a) => {
      const d = this.player.position.distanceTo(a.position);
      if (d < minDist && d < 22) {
        minDist = d;
        nearest = a;
      }
    });

    if (nearest) {
      this.isHookAttached = true;
      this.hookAnchor.copy((nearest as THREE.Mesh).position);
      this.ropeLength = this.player.position.distanceTo(this.hookAnchor);
      this.ropeLine.visible = true;
      this.audio.playCoinPickup();
    }
  }

  public triggerDash(dirX: number, dirZ: number): void {
    if (this.isDashing) return;
    this.isDashing = true;
    this.dashTimer = 0.22;

    this.audio.playDash();
    this.onCameraShake(0.2);

    const len = Math.hypot(dirX, dirZ) || 1;
    this.velocity.x = (dirX / len) * 26.0;
    this.velocity.z = (dirZ / len) * 26.0;
    this.velocity.y = 3.0;

    // Spawn ghost trail after-image
    const ghost = this.player.clone();
    (ghost.children[0] as THREE.Mesh).material = new THREE.MeshStandardMaterial({
      color: 0x00cec9,
      transparent: true,
      opacity: 0.6,
    });
    this.group.add(ghost);
    this.ghostTrails.push({ mesh: ghost, life: 0.35 });
  }

  public startRewind(): void {
    if (this.snapshots.length > 5) {
      this.isRewinding = true;
      this.echoSnapshots = [...this.snapshots]; // clone for echo clone
      this.hasEcho = true;
      this.echoReplayIndex = 0;
      this.echoGhost.visible = true;
      this.audio.playLaser();
    }
  }

  public stopRewind(): void {
    this.isRewinding = false;
  }

  public update(dt: number, inputMove: { x: number; z: number }): void {
    if (!this.group.visible) return;

    // 1. Time Rewind Logic
    if (this.isRewinding) {
      if (this.snapshots.length > 0) {
        const snap = this.snapshots.pop()!;
        this.player.position.copy(snap.pos);
        this.velocity.copy(snap.vel).negate().multiplyScalar(0.5);
        this.position.copy(snap.pos);
      } else {
        this.isRewinding = false;
      }
      return;
    }

    // 2. Snapshot Recording at 20Hz (every 50ms)
    this.recordTimer += dt;
    if (this.recordTimer >= 0.05) {
      this.recordTimer = 0;
      this.snapshots.push({
        pos: this.player.position.clone(),
        vel: this.velocity.clone(),
        rotY: this.player.rotation.y,
      });
      if (this.snapshots.length > this.maxSnapshots) {
        this.snapshots.shift();
      }
    }

    // 3. Temporal Echo Clone Replay
    if (this.hasEcho && this.echoSnapshots.length > 0) {
      this.echoReplayIndex = (this.echoReplayIndex + 1) % this.echoSnapshots.length;
      const eSnap = this.echoSnapshots[this.echoReplayIndex];
      this.echoGhost.position.copy(eSnap.pos);
      this.echoGhost.position.x += 1.2; // slight visual offset
    }

    // 4. Grappling Hook Spring-Damper Pendulum Physics
    if (this.isHookAttached) {
      const toAnchor = this.hookAnchor.clone().sub(this.player.position);
      const currentDist = toAnchor.length();
      const rHat = toAnchor.normalize();

      if (currentDist > this.ropeLength) {
        const delta = currentDist - this.ropeLength;
        const springForce = delta * 45.0;
        const dampForce = this.velocity.dot(rHat) * 1.5;

        const ropeImpulse = rHat.clone().multiplyScalar(springForce + dampForce);
        this.velocity.addScaledVector(ropeImpulse, dt);
      }

      // Air steering swing impulse
      if (inputMove.x !== 0 || inputMove.z !== 0) {
        this.velocity.x += inputMove.x * 12.0 * dt;
        this.velocity.z += inputMove.z * 12.0 * dt;
      }

      // Update Rope Line
      const pts = [this.player.position.clone().add(new THREE.Vector3(0, 0.8, 0)), this.hookAnchor];
      this.ropeLine.geometry.setFromPoints(pts);
    } else {
      // Normal Ground / Air movement
      this.velocity.x += inputMove.x * 24.0 * dt;
      this.velocity.z += inputMove.z * 24.0 * dt;
      this.velocity.x *= Math.pow(0.85, dt * 60);
      this.velocity.z *= Math.pow(0.85, dt * 60);
    }

    // Gravity
    this.velocity.y -= 18.0 * dt;

    // Integrate
    this.player.position.addScaledVector(this.velocity, dt);

    // Ground collision
    if (this.player.position.y <= 0) {
      this.player.position.y = 0;
      this.velocity.y = 0;
      this.isGrounded = true;
    }

    // Dash decay & ghost trails
    if (this.isDashing) {
      this.dashTimer -= dt;
      if (this.dashTimer <= 0) this.isDashing = false;
    }

    for (let i = this.ghostTrails.length - 1; i >= 0; i--) {
      const g = this.ghostTrails[i];
      g.life -= dt;
      if (g.life <= 0) {
        this.group.remove(g.mesh);
        this.ghostTrails.splice(i, 1);
      }
    }
  }

  public setVisible(visible: boolean): void {
    this.group.visible = visible;
  }
}
