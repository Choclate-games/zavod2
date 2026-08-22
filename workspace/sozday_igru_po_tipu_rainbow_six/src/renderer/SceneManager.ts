import * as THREE from "three";
import type { RoomId } from "../core/Types";

export class SceneManager {
  public scene: THREE.Scene;
  public dirLight: THREE.DirectionalLight;
  public hemiLight: THREE.HemisphereLight;
  private roomPropsGroup: THREE.Group;

  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0d1117);
    this.scene.fog = new THREE.FogExp2(0x0d1117, 0.035);

    // Directional Sun/Tactical Light with Shadows
    this.dirLight = new THREE.DirectionalLight(0xfff4e6, 1.4);
    this.dirLight.position.set(5, 12, 6);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 0.5;
    this.dirLight.shadow.camera.far = 30;
    this.dirLight.shadow.camera.left = -12;
    this.dirLight.shadow.camera.right = 12;
    this.dirLight.shadow.camera.top = 12;
    this.dirLight.shadow.camera.bottom = -12;
    this.dirLight.shadow.bias = -0.0005;
    this.scene.add(this.dirLight);

    // Hemisphere fill light
    this.hemiLight = new THREE.HemisphereLight(0x4deeea, 0x1a1e24, 0.6);
    this.scene.add(this.hemiLight);

    // Ambient light
    const ambient = new THREE.AmbientLight(0xffffff, 0.25);
    this.scene.add(ambient);

    // Group for static room props
    this.roomPropsGroup = new THREE.Group();
    this.roomPropsGroup.name = "RoomPropsGroup";
    this.scene.add(this.roomPropsGroup);
  }

  buildRoomEnvironment(roomId: RoomId): void {
    this.clearRoomEnvironment();

    const matFloor = new THREE.MeshStandardMaterial({ color: 0x2e3440, roughness: 0.8, metalness: 0.2 });
    const matCeiling = new THREE.MeshStandardMaterial({ color: 0x1f2429, roughness: 0.9, metalness: 0.1 });
    const matWall = new THREE.MeshStandardMaterial({ color: 0x4c566a, roughness: 0.85, metalness: 0.1 });
    const matDesk = new THREE.MeshStandardMaterial({ color: 0x3b4252, roughness: 0.6, metalness: 0.3 });
    const matServer = new THREE.MeshStandardMaterial({ color: 0x1a1e24, roughness: 0.4, metalness: 0.7 });

    // 1. Room Floor (20m x 20m)
    const floorGeo = new THREE.PlaneGeometry(24, 24);
    const floor = new THREE.Mesh(floorGeo, matFloor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.roomPropsGroup.add(floor);

    // 2. Ceiling
    const ceiling = new THREE.Mesh(floorGeo, matCeiling);
    ceiling.position.y = 3.5;
    ceiling.rotation.x = Math.PI / 2;
    this.roomPropsGroup.add(ceiling);

    // 3. Perimeter Boundary Walls (Indestructible back & side walls)
    const backWall = new THREE.Mesh(new THREE.BoxGeometry(24, 3.5, 0.5), matWall);
    backWall.position.set(0, 1.75, 12);
    backWall.receiveShadow = true;
    this.roomPropsGroup.add(backWall);

    const leftWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.5, 24), matWall);
    leftWall.position.set(-12, 1.75, 0);
    leftWall.receiveShadow = true;
    this.roomPropsGroup.add(leftWall);

    const rightWall = new THREE.Mesh(new THREE.BoxGeometry(0.5, 3.5, 24), matWall);
    rightWall.position.set(12, 1.75, 0);
    rightWall.receiveShadow = true;
    this.roomPropsGroup.add(rightWall);

    // Room-Specific Interior Props
    if (roomId === 1) {
      // Room 1: Perimeter Security Foyer
      // Security Reception Desk
      const desk = new THREE.Mesh(new THREE.BoxGeometry(3.5, 1.1, 1.2), matDesk);
      desk.position.set(0, 0.55, 3.5);
      desk.castShadow = true;
      desk.receiveShadow = true;
      this.roomPropsGroup.add(desk);

      // Computer Monitor
      const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.4, 0.1), matServer);
      monitor.position.set(0.5, 1.3, 3.5);
      monitor.castShadow = true;
      this.roomPropsGroup.add(monitor);

      // Concrete Pillars
      [-4, 4].forEach((px) => {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.5, 0.8), matWall);
        pillar.position.set(px, 1.75, 5);
        pillar.castShadow = true;
        pillar.receiveShadow = true;
        this.roomPropsGroup.add(pillar);
      });
    } else if (roomId === 2) {
      // Room 2: Office Hall
      // Office Desks & Cubicles
      const deskPositions = [
        { x: -3.5, z: 4 },
        { x: 3.5, z: 4 },
        { x: -2.5, z: 7.5 },
        { x: 2.5, z: 7.5 },
      ];

      deskPositions.forEach((pos) => {
        const desk = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.9, 1.2), matDesk);
        desk.position.set(pos.x, 0.45, pos.z);
        desk.castShadow = true;
        desk.receiveShadow = true;
        this.roomPropsGroup.add(desk);

        // Partition Divider
        const part = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.4, 0.1), matWall);
        part.position.set(pos.x, 0.7, pos.z + 0.6);
        part.castShadow = true;
        this.roomPropsGroup.add(part);
      });

      // Ceiling Fluorescent Light Strip
      const lightMesh = new THREE.Mesh(
        new THREE.BoxGeometry(8, 0.1, 0.3),
        new THREE.MeshBasicMaterial({ color: 0xe0f7fa })
      );
      lightMesh.position.set(0, 3.45, 5);
      this.roomPropsGroup.add(lightMesh);
    } else if (roomId === 3) {
      // Room 3: Server Vault
      // Server Racks Rows
      [-4.5, -1.8, 1.8, 4.5].forEach((rx) => {
        [3.5, 6.5].forEach((rz) => {
          const rack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.8, 0.9), matServer);
          rack.position.set(rx, 1.4, rz);
          rack.castShadow = true;
          rack.receiveShadow = true;
          this.roomPropsGroup.add(rack);

          // Green / Cyan Blinking LED Strip
          const ledStrip = new THREE.Mesh(
            new THREE.BoxGeometry(0.8, 0.05, 0.02),
            new THREE.MeshBasicMaterial({ color: 0x00ff66 })
          );
          ledStrip.position.set(rx, 2.0, rz - 0.46);
          this.roomPropsGroup.add(ledStrip);
        });
      });

      // Central Bomb Terminal Pedestal
      const pedestal = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 1.4), matDesk);
      pedestal.position.set(0, 0.25, 5.0);
      pedestal.castShadow = true;
      pedestal.receiveShadow = true;
      this.roomPropsGroup.add(pedestal);
    }
  }

  clearRoomEnvironment(): void {
    while (this.roomPropsGroup.children.length > 0) {
      const child = this.roomPropsGroup.children[0] as THREE.Mesh;
      this.roomPropsGroup.remove(child);
      if (child.geometry) child.geometry.dispose();
    }
  }
}
