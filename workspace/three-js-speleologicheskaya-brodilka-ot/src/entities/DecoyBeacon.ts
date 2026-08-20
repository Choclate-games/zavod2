import * as THREE from "three";
import { CollisionBody } from "../physics/CollisionBody";
import { GAME_CONSTANTS } from "../utils/Constants";
import { EventBus } from "../core/EventBus";

export class DecoyBeacon {
  public mesh: THREE.Group;
  public body: CollisionBody;
  public isActive: boolean = true;
  private lifeTimer: number = 0;
  private maxLife: number = GAME_CONSTANTS.DECOY_LIFETIME;
  private pingInterval: number = 1.0;
  private pingTimer: number = 0;

  private light: THREE.PointLight;
  private eventBus: EventBus;

  constructor(position: THREE.Vector3, velocity: THREE.Vector3, eventBus: EventBus) {
    this.eventBus = eventBus;

    // 1. Build 3D Mesh
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);

    const baseGeo = new THREE.CylinderGeometry(0.18, 0.25, 0.4, 8);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.8 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.2;
    this.mesh.add(base);

    const emitterGeo = new THREE.SphereGeometry(0.14, 12, 12);
    const emitterMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff });
    const emitter = new THREE.Mesh(emitterGeo, emitterMat);
    emitter.position.y = 0.45;
    this.mesh.add(emitter);

    this.light = new THREE.PointLight(0x00f0ff, 2.0, 12, 1.8);
    this.light.position.set(0, 0.6, 0);
    this.mesh.add(this.light);

    // 2. Physics Body
    this.body = new CollisionBody(
      "decoy_beacon",
      position,
      "DECOY",
      false,
      0.3,
      0.6
    );
    this.body.velocity.copy(velocity);
  }

  public update(dt: number): void {
    if (!this.isActive) return;

    this.lifeTimer += dt;
    this.pingTimer += dt;

    if (this.pingTimer >= this.pingInterval) {
      this.pingTimer = 0;
      this.emitPing();
    }

    if (this.lifeTimer >= this.maxLife) {
      this.isActive = false;
      this.body.enabled = false;
      this.mesh.visible = false;
    }

    this.mesh.position.copy(this.body.position);
  }

  private emitPing(): void {
    this.eventBus.emit("decoy:ping", {
      position: { x: this.body.position.x, y: this.body.position.y, z: this.body.position.z }
    });
  }
}
