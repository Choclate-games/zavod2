import * as THREE from 'three';

export interface ScrapItem {
  mesh: THREE.Group;
  position: THREE.Vector3;
  type: 'SCRAP' | 'HEALTH';
  value: number;
  bobOffset: number;
}

export class ScrapManager {
  public group = new THREE.Group();
  public items: ScrapItem[] = [];

  private scrapGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.15, 6);
  private scrapMat = new THREE.MeshStandardMaterial({
    color: 0xffd166,
    metalness: 0.9,
    roughness: 0.15,
    emissive: 0xffa500,
    emissiveIntensity: 1.6,
  });

  private healthGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
  private healthMat = new THREE.MeshStandardMaterial({
    color: 0x06d6a0,
    metalness: 0.2,
    roughness: 0.3,
    emissive: 0x00f5d4,
    emissiveIntensity: 2.0,
  });

  public spawnScrap(pos: THREE.Vector3, count = 1): void {
    for (let i = 0; i < count; i++) {
      const itemGroup = new THREE.Group();
      const mesh = new THREE.Mesh(this.scrapGeo, this.scrapMat);
      mesh.rotation.x = Math.PI / 2;
      mesh.castShadow = true;
      itemGroup.add(mesh);

      const offset = new THREE.Vector3(
        (Math.random() - 0.5) * 1.5,
        0.4,
        (Math.random() - 0.5) * 1.5
      );
      itemGroup.position.copy(pos).add(offset);
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

    // Red cross marker
    const crossGeo = new THREE.BoxGeometry(0.55, 0.15, 0.15);
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const cross1 = new THREE.Mesh(crossGeo, crossMat);
    const cross2 = new THREE.Mesh(crossGeo, crossMat);
    cross2.rotation.y = Math.PI / 2;
    itemGroup.add(cross1, cross2);

    itemGroup.position.copy(pos);
    itemGroup.position.y = 0.5;
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

    // Subtle pulsing on global scrap & health materials
    this.scrapMat.emissiveIntensity = 1.4 + 0.6 * Math.sin(time * 4);
    this.healthMat.emissiveIntensity = 1.8 + 0.8 * Math.sin(time * 5);

    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];

      // Idle spin and bob
      item.mesh.rotation.y += 2.5 * dt;
      item.mesh.position.y = 0.4 + Math.sin(time * 3 + item.bobOffset) * 0.12;

      // Magnetic Attraction to player
      const dist = item.position.distanceTo(playerPos);
      if (dist < magnetRadius) {
        const pullDir = playerPos.clone().sub(item.position).normalize();
        const pullSpeed = Math.max(12, (magnetRadius - dist) * 6 + 10);
        item.position.addScaledVector(pullDir, pullSpeed * dt);
        item.mesh.position.copy(item.position);
      }

      // Collect Check
      if (dist < 1.6) {
        onPickup(item);
        this.group.remove(item.mesh);
        this.items.splice(i, 1);
      }
    }
  }

  public clear(): void {
    for (const item of this.items) {
      this.group.remove(item.mesh);
    }
    this.items = [];
  }
}
