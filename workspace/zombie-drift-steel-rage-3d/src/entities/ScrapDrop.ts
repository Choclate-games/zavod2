import * as THREE from 'three';

export interface ScrapItem {
  mesh: THREE.Group;
  position: THREE.Vector3;
  type: 'SCRAP' | 'HEALTH';
  value: number;
  bobOffset: number;
}

const _scratchPull = new THREE.Vector3();

export class ScrapManager {
  public group = new THREE.Group();
  public items: ScrapItem[] = [];

  private scrapGeo = new THREE.CylinderGeometry(0.28, 0.28, 0.12, 6);
  private scrapMat = new THREE.MeshStandardMaterial({
    color: 0xffd166,
    metalness: 0.9,
    roughness: 0.15,
    emissive: 0xffa500,
    emissiveIntensity: 1.6,
  });

  private healthGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
  private healthMat = new THREE.MeshStandardMaterial({
    color: 0x06d6a0,
    metalness: 0.2,
    roughness: 0.3,
    emissive: 0x00f5d4,
    emissiveIntensity: 2.0,
  });

  private crossGeo = new THREE.BoxGeometry(0.5, 0.14, 0.14);
  private crossMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

  public spawnScrap(pos: THREE.Vector3, count = 1): void {
    for (let i = 0; i < count; i++) {
      const itemGroup = new THREE.Group();
      const mesh = new THREE.Mesh(this.scrapGeo, this.scrapMat);
      mesh.rotation.x = Math.PI / 2;
      itemGroup.add(mesh);

      itemGroup.position.set(
        pos.x + (Math.random() - 0.5) * 1.5,
        0.35,
        pos.z + (Math.random() - 0.5) * 1.5
      );
      this.group.add(itemGroup);

      this.items.push({
        mesh: itemGroup,
        position: itemGroup.position,
        type: 'SCRAP',
        value: 1,
        bobOffset: Math.random() * Math.PI * 2,
      });
    }
  }

  public spawnHealthPack(pos: THREE.Vector3, healAmount = 40): void {
    const itemGroup = new THREE.Group();
    const mesh = new THREE.Mesh(this.healthGeo, this.healthMat);
    itemGroup.add(mesh);

    const cross1 = new THREE.Mesh(this.crossGeo, this.crossMat);
    const cross2 = new THREE.Mesh(this.crossGeo, this.crossMat);
    cross2.rotation.y = Math.PI / 2;
    itemGroup.add(cross1, cross2);

    itemGroup.position.set(pos.x, 0.45, pos.z);
    this.group.add(itemGroup);

    this.items.push({
      mesh: itemGroup,
      position: itemGroup.position,
      type: 'HEALTH',
      value: healAmount,
      bobOffset: Math.random() * Math.PI * 2,
    });
  }

  public update(
    dt: number,
    playerPos: THREE.Vector3,
    magnetRadius: number,
    onPickup: (item: ScrapItem) => void
  ): void {
    const time = performance.now() * 0.003;
    const magSq = magnetRadius * magnetRadius;

    // Subtle pulsing on global scrap & health materials
    this.scrapMat.emissiveIntensity = 1.4 + 0.6 * Math.sin(time * 4);
    this.healthMat.emissiveIntensity = 1.8 + 0.8 * Math.sin(time * 5);

    const px = playerPos.x;
    const pz = playerPos.z;

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];

      // Idle spin and bob
      item.mesh.rotation.y += 2.5 * dt;
      item.mesh.position.y = 0.35 + Math.sin(time * 3 + item.bobOffset) * 0.1;

      const dx = px - item.position.x;
      const dz = pz - item.position.z;
      const distSq = dx * dx + dz * dz;

      // Magnetic Attraction to player
      if (distSq < magSq) {
        const dist = Math.sqrt(distSq);
        if (dist > 0.001) {
          const pullSpeed = Math.max(14, (magnetRadius - dist) * 7 + 12);
          item.position.x += (dx / dist) * pullSpeed * dt;
          item.position.z += (dz / dist) * pullSpeed * dt;
        }
      }

      // Collect Check
      if (distSq < 2.89) { // 1.7m
        onPickup(item);
        this.group.remove(item.mesh);
        this.items.splice(i, 1);
      }
    }
  }

  public clear(): void {
    for (let i = 0; i < this.items.length; i++) {
      this.group.remove(this.items[i].mesh);
    }
    this.items = [];
  }
}
