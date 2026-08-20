import * as THREE from "three";
import { CollisionBody } from "../physics/CollisionBody";
import { GAME_CONSTANTS } from "../utils/Constants";
import { MathUtils } from "../utils/MathUtils";
import { EventBus } from "../core/EventBus";

export type StalkerState = "ASLEEP" | "PATROL" | "ALERTED" | "HUNTING" | "STUNNED";

export class StalkerEnemy {
  public id: string;
  public mesh: THREE.Group;
  public body: CollisionBody;
  public state: StalkerState = "ASLEEP";

  private eventBus: EventBus;
  private attackCooldown: number = 0;
  private stunTimer: number = 0;
  private patrolTimer: number = 0;
  private patrolTarget: THREE.Vector3 = new THREE.Vector3();
  private huntTarget: THREE.Vector3 = new THREE.Vector3();
  private homePosition: THREE.Vector3 = new THREE.Vector3();

  // Visual Nodes
  private eyesLight: THREE.PointLight;
  private eyeMesh: THREE.Mesh;
  private bodyMesh: THREE.Mesh;

  public isAlive: boolean = true;

  constructor(id: string, position: THREE.Vector3, eventBus: EventBus) {
    this.id = id;
    this.eventBus = eventBus;
    this.homePosition.copy(position);
    this.patrolTarget.copy(position);

    // 1. Build 3D Mesh
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);

    // Dark carapace body
    const bodyGeo = new THREE.DodecahedronGeometry(0.65, 1);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x11050a,
      roughness: 0.8,
      metalness: 0.4
    });
    this.bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    this.bodyMesh.position.y = 0.65;
    this.mesh.add(this.bodyMesh);

    // Spines / Claws
    for (let i = 0; i < 4; i++) {
      const legGeo = new THREE.ConeGeometry(0.12, 0.9, 5);
      const legMat = new THREE.MeshStandardMaterial({ color: 0x2b0f19 });
      const leg = new THREE.Mesh(legGeo, legMat);
      const angle = (i / 4) * Math.PI * 2;
      leg.position.set(Math.cos(angle) * 0.5, 0.3, Math.sin(angle) * 0.5);
      leg.rotation.z = Math.cos(angle) * 0.6;
      leg.rotation.x = Math.sin(angle) * 0.6;
      this.mesh.add(leg);
    }

    // Glowing Crimson Sensory Organ / Eyes
    const eyeGeo = new THREE.SphereGeometry(0.18, 12, 12);
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff1144 });
    this.eyeMesh = new THREE.Mesh(eyeGeo, eyeMat);
    this.eyeMesh.position.set(0, 0.95, 0.45);
    this.mesh.add(this.eyeMesh);

    this.eyesLight = new THREE.PointLight(0xff1144, 1.2, 8, 2.0);
    this.eyesLight.position.set(0, 1.0, 0.5);
    this.mesh.add(this.eyesLight);

    // 2. Physics Body
    this.body = new CollisionBody(
      `stalker_${id}`,
      position,
      "ENEMY",
      false,
      0.65,
      1.3
    );
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    playerNoise: number,
    activeDecoyPos: THREE.Vector3 | null
  ): void {
    if (!this.isAlive) return;

    if (this.attackCooldown > 0) this.attackCooldown -= dt;

    // 1. Stun State
    if (this.state === "STUNNED") {
      this.stunTimer -= dt;
      this.body.velocity.x = 0;
      this.body.velocity.z = 0;
      (this.eyeMesh.material as THREE.MeshBasicMaterial).color.setHex(0xffd700);
      this.eyesLight.color.setHex(0xffd700);

      if (this.stunTimer <= 0) {
        this.state = "PATROL";
        (this.eyeMesh.material as THREE.MeshBasicMaterial).color.setHex(0xff1144);
        this.eyesLight.color.setHex(0xff1144);
      }
      this.mesh.position.copy(this.body.position);
      return;
    }

    // 2. Check Acoustic Detection (Decoy vs Player)
    if (activeDecoyPos) {
      const distDecoy = this.body.position.distanceTo(activeDecoyPos);
      if (distDecoy < 25.0) {
        this.huntTarget.copy(activeDecoyPos);
        this.state = "HUNTING";
      }
    } else {
      const distPlayer = this.body.position.distanceTo(playerPos);
      // Exact specification formula:
      // stalker_alert = (noise_level / (distance^1.5 + 1.0)) >= stalker_sensitivity_threshold (0.75)
      const alertScore = playerNoise / (Math.pow(distPlayer, 1.5) + 1.0);
      if (alertScore >= GAME_CONSTANTS.STALKER_SENSITIVITY_THRESHOLD) {
        if (this.state !== "HUNTING") {
          this.eventBus.emit("stalker:alert", {
            position: { x: this.body.position.x, y: this.body.position.y, z: this.body.position.z },
            target: { x: playerPos.x, y: playerPos.y, z: playerPos.z }
          });
        }
        this.huntTarget.copy(playerPos);
        this.state = "HUNTING";
      }
    }

    // 3. State Actions
    if (this.state === "HUNTING") {
      this.eyesLight.intensity = 2.5;
      const dx = this.huntTarget.x - this.body.position.x;
      const dz = this.huntTarget.z - this.body.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > 0.4) {
        const speed = GAME_CONSTANTS.STALKER_AGGRO_SPEED;
        this.body.velocity.x = (dx / dist) * speed;
        this.body.velocity.z = (dz / dist) * speed;

        const targetRot = Math.atan2(dx, dz);
        this.mesh.rotation.y = MathUtils.damp(this.mesh.rotation.y, targetRot, 10, dt);
      } else {
        // Reached hunt target and no more noise: switch to patrol
        this.state = "PATROL";
      }

      // Check attack range on player
      const distToPlayer = this.body.position.distanceTo(playerPos);
      if (distToPlayer <= GAME_CONSTANTS.STALKER_ATTACK_RADIUS && this.attackCooldown <= 0) {
        this.attack(playerPos);
      }
    } else if (this.state === "PATROL") {
      this.eyesLight.intensity = 0.8;
      this.patrolTimer -= dt;
      if (this.patrolTimer <= 0) {
        this.patrolTimer = MathUtils.randomRange(3.0, 6.0);
        this.patrolTarget.set(
          this.homePosition.x + MathUtils.randomRange(-6, 6),
          0,
          this.homePosition.z + MathUtils.randomRange(-6, 6)
        );
      }

      const dx = this.patrolTarget.x - this.body.position.x;
      const dz = this.patrolTarget.z - this.body.position.z;
      const dist = Math.sqrt(dx * dx + dz * dz);

      if (dist > 0.5) {
        const speed = GAME_CONSTANTS.STALKER_PATROL_SPEED;
        this.body.velocity.x = (dx / dist) * speed;
        this.body.velocity.z = (dz / dist) * speed;

        const targetRot = Math.atan2(dx, dz);
        this.mesh.rotation.y = MathUtils.damp(this.mesh.rotation.y, targetRot, 6, dt);
      }
    } else {
      // ASLEEP
      this.eyesLight.intensity = 0.2;
      this.body.velocity.x = 0;
      this.body.velocity.z = 0;
    }

    // Sync mesh position
    this.mesh.position.copy(this.body.position);
  }

  private attack(playerPos: THREE.Vector3): void {
    this.attackCooldown = GAME_CONSTANTS.STALKER_ATTACK_COOLDOWN;
    this.eventBus.emit("player:hurt", {
      damage: GAME_CONSTANTS.STALKER_DAMAGE,
      source: "stalker"
    });
  }

  public stun(duration: number = 2.5): void {
    this.state = "STUNNED";
    this.stunTimer = duration;
  }
}
