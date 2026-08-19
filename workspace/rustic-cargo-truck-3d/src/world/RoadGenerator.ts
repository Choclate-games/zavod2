import * as THREE from 'three';
import { PhysicsWorld } from '../physics/PhysicsWorld';
import { SceneManager } from '../rendering/SceneManager';
import { TERRAIN, buildTerrainGeometry, heightAt, roadHeightAt } from './terrain';

export class RoadGenerator {
  readonly startZ = 0;
  readonly finishZ = 300;
  readonly length = this.finishZ - this.startZ;

  roadHeightAt = roadHeightAt;
  heightAt = heightAt;

  build(scene: SceneManager, physics: PhysicsWorld): void {
    scene.clearGroup(scene.roadGroup);
    scene.clearGroup(scene.decorationGroup);
    const geometry = buildTerrainGeometry();
    const ground = new THREE.Mesh(geometry, scene.materials.terrain);
    ground.receiveShadow = true;
    scene.roadGroup.add(ground);
    physics.createTerrain(
      geometry.getAttribute('position').array as Float32Array,
      new Uint32Array(geometry.getIndex()!.array),
    );
    this.buildTrees(scene);
    this.buildVillage(scene);
    this.buildSawmill(scene);
  }

  private buildTrees(scene: SceneManager): void {
    const count = 64;
    const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.25, 2.8, 6), scene.materials.trunk, count);
    const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(1.35, 3.8, 7), scene.materials.pine, count);
    const matrix = new THREE.Matrix4();
    for (let i = 0; i < count; i += 1) {
      const z = 10 + i * 4.5;
      const side = i % 2 === 0 ? -1 : 1;
      const x = side * (TERRAIN.halfWidth + 1.5 + (i % 4) * 2.4);
      const y = heightAt(x, z) + 1.25;
      const scale = 0.75 + (i % 5) * 0.08;
      matrix.makeScale(scale, scale, scale).setPosition(x, y, z);
      trunk.setMatrixAt(i, matrix);
      matrix.makeScale(scale, scale, scale).setPosition(x, y + 2.3 * scale, z);
      crown.setMatrixAt(i, matrix);
    }
    trunk.castShadow = true;
    crown.castShadow = true;
    scene.decorationGroup.add(trunk, crown);
  }

  private buildVillage(scene: SceneManager): void {
    const base = heightAt(-14, 6);
    const house = new THREE.Mesh(new THREE.BoxGeometry(5.5, 3, 5), scene.materials.house);
    house.position.set(-14, base + 1.5, 6);
    house.castShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(4.3, 2.2, 4), scene.materials.roof);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(-14, base + 4, 6);
    roof.castShadow = true;
    scene.decorationGroup.add(house, roof);
  }

  private buildSawmill(scene: SceneManager): void {
    const base = heightAt(14, 302);
    const building = new THREE.Mesh(new THREE.BoxGeometry(11, 5, 9), scene.materials.house);
    building.position.set(14, base + 2.5, 302);
    building.castShadow = true;
    const roof = new THREE.Mesh(new THREE.ConeGeometry(8, 3.5, 4), scene.materials.roof);
    roof.rotation.y = Math.PI / 4;
    roof.position.set(14, base + 6.6, 302);
    roof.castShadow = true;
    const chimney = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 5, 8), scene.materials.trunk);
    chimney.position.set(17, base + 7, 302);
    scene.decorationGroup.add(building, roof, chimney);

    // Finish gate straddling the road, so the player can see where the run ends.
    const gateY = roadHeightAt(this.finishZ);
    const beam = new THREE.Mesh(new THREE.BoxGeometry(TERRAIN.roadHalfWidth * 2 + 0.7, 0.35, 0.5), scene.materials.logEnd);
    beam.position.set(0, gateY + 3, this.finishZ);
    const postGeometry = new THREE.BoxGeometry(0.35, 3, 0.35);
    for (const side of [-1, 1]) {
      const post = new THREE.Mesh(postGeometry, scene.materials.trunk);
      post.position.set(side * TERRAIN.roadHalfWidth, gateY + 1.5, this.finishZ);
      scene.decorationGroup.add(post);
    }
    scene.decorationGroup.add(beam);
  }
}
