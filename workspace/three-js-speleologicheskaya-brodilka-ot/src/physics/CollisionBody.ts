import * as THREE from "three";

export type CollisionLayer = "ENVIRONMENT" | "PLAYER" | "ENEMY" | "CRYSTAL" | "DECOY" | "TRIGGER" | "CHASM";

export interface BoxCollider {
  type: "box";
  min: THREE.Vector3;
  max: THREE.Vector3;
}

export interface SphereCollider {
  type: "sphere";
  center: THREE.Vector3;
  radius: number;
}

export type ColliderShape = BoxCollider | SphereCollider;

export class CollisionBody {
  public id: string;
  public position: THREE.Vector3;
  public velocity: THREE.Vector3 = new THREE.Vector3();
  public layer: CollisionLayer;
  public isStatic: boolean;
  public isTrigger: boolean;
  public shape: ColliderShape;
  public radius: number;
  public height: number;
  public isGrounded: boolean = false;
  public enabled: boolean = true;
  public tag: string = "";
  public userData: any = null;

  constructor(
    id: string,
    position: THREE.Vector3,
    layer: CollisionLayer,
    isStatic: boolean = false,
    radius: number = 0.5,
    height: number = 1.8,
    isTrigger: boolean = false
  ) {
    this.id = id;
    this.position = position.clone();
    this.layer = layer;
    this.isStatic = isStatic;
    this.radius = radius;
    this.height = height;
    this.isTrigger = isTrigger;

    this.shape = {
      type: "sphere",
      center: this.position,
      radius: this.radius
    };
  }

  public getAABB(): THREE.Box3 {
    return new THREE.Box3(
      new THREE.Vector3(this.position.x - this.radius, this.position.y, this.position.z - this.radius),
      new THREE.Vector3(this.position.x + this.radius, this.position.y + this.height, this.position.z + this.radius)
    );
  }
}
