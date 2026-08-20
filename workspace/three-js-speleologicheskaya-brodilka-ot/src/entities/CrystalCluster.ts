import * as THREE from "three";
import { CollisionBody } from "../physics/CollisionBody";
import { EventBus } from "../core/EventBus";
import { MathUtils } from "../utils/MathUtils";

export class CrystalCluster {
  public id: string;
  public mesh: THREE.Group;
  public body: CollisionBody;
  public isHarvested: boolean = false;
  public value: number;
  private light: THREE.PointLight;
  private eventBus: EventBus;

  constructor(id: string, position: THREE.Vector3, baseValue: number, floorIndex: number, eventBus: EventBus) {
    this.id = id;
    this.eventBus = eventBus;

    // Exact specification formula:
    // crystals_yield = base_crystal_value * (1.0 + resonance_frequency_match * 0.5) * (1.0 + 0.25 * floor_index)
    this.value = Math.round(baseValue * (1.0 + 0.25 * floorIndex));

    // 1. Build 3D Crystal Cluster
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);

    const crystalMat = new THREE.MeshStandardMaterial({
      color: 0xbf55ec,
      emissive: 0x8a2be2,
      emissiveIntensity: 0.8,
      roughness: 0.1,
      metalness: 0.9
    });

    for (let i = 0; i < 5; i++) {
      const h = MathUtils.randomRange(0.8, 1.8);
      const r = MathUtils.randomRange(0.12, 0.22);
      const geo = new THREE.ConeGeometry(r, h, 6);
      const spike = new THREE.Mesh(geo, crystalMat);

      const angle = (i / 5) * Math.PI * 2;
      const dist = MathUtils.randomRange(0.1, 0.35);
      spike.position.set(Math.cos(angle) * dist, h * 0.5, Math.sin(angle) * dist);
      spike.rotation.z = Math.cos(angle) * 0.25;
      spike.rotation.x = Math.sin(angle) * 0.25;

      this.mesh.add(spike);
    }

    this.light = new THREE.PointLight(0xbf55ec, 1.4, 6, 2.0);
    this.light.position.set(0, 0.8, 0);
    this.mesh.add(this.light);

    // 2. Physics Trigger Body
    this.body = new CollisionBody(
      `crystal_${id}`,
      position,
      "CRYSTAL",
      true,
      0.8,
      1.5,
      true
    );
  }

  public shatter(playerResonance: number = 0): number {
    if (this.isHarvested) return 0;
    this.isHarvested = true;

    const finalYield = Math.round(this.value * (1.0 + playerResonance * 0.5));
    this.mesh.visible = false;
    this.body.enabled = false;

    this.eventBus.emit("crystal:shattered", {
      position: { x: this.body.position.x, y: this.body.position.y, z: this.body.position.z },
      value: finalYield
    });

    return finalYield;
  }
}
