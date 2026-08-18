import * as THREE from 'three';
export class RoadGenerator {
    startZ = 0;
    length = 318;
    finishZ = 300;
    segmentLength = 6;
    segmentCount = 53;
    heightAt(z) {
        return 0.25 * Math.sin(z * 0.15) + 0.48 * Math.sin(z * 0.047 + 1.1) + 0.18 * Math.sin(z * 0.41);
    }
    slopeAt(z) {
        const a = this.heightAt(z - 0.4);
        const b = this.heightAt(z + 0.4);
        return Math.atan2(b - a, 0.8);
    }
    build(scene, physics) {
        scene.clearGroup(scene.roadGroup);
        scene.clearGroup(scene.decorationGroup);
        const roadGeometry = new THREE.BoxGeometry(12, 0.55, this.segmentLength + 0.14);
        const edgeGeometry = new THREE.BoxGeometry(14.5, 0.18, this.segmentLength + 0.08);
        for (let i = 0; i < this.segmentCount; i += 1) {
            const z = i * this.segmentLength + this.segmentLength / 2;
            const y = this.heightAt(z);
            const slope = this.slopeAt(z);
            const road = new THREE.Mesh(roadGeometry, scene.materials.road);
            road.position.set(0, y - 0.2, z);
            road.rotation.x = slope;
            road.receiveShadow = true;
            scene.roadGroup.add(road);
            const edge = new THREE.Mesh(edgeGeometry, scene.materials.grass);
            edge.position.set(0, y - 0.5, z);
            edge.rotation.x = slope;
            edge.receiveShadow = true;
            scene.roadGroup.add(edge);
            physics.createRoadCollider(new THREE.Vector3(0, y - 0.25, z), new THREE.Vector3(6, 0.275, this.segmentLength / 2), slope);
        }
        this.buildTrees(scene);
        this.buildVillage(scene);
        this.buildSawmill(scene);
    }
    resetRun(scene, physics) {
        physics.resetDynamic();
        scene.clearGroup(scene.truckGroup);
        scene.clearGroup(scene.cargoGroup);
    }
    buildTrees(scene) {
        const trunk = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.16, 0.25, 2.8, 6), scene.materials.trunk, 50);
        const crown = new THREE.InstancedMesh(new THREE.ConeGeometry(1.35, 3.8, 7), scene.materials.pine, 50);
        const matrix = new THREE.Matrix4();
        for (let i = 0; i < 50; i += 1) {
            const z = 12 + i * 5.6;
            const side = i % 2 === 0 ? -1 : 1;
            const x = side * (9.5 + (i % 4) * 2.2);
            const y = this.heightAt(z) + 1.25;
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
    buildVillage(scene) {
        const house = new THREE.Mesh(new THREE.BoxGeometry(5.5, 3, 5), scene.materials.house);
        house.position.set(-12, this.heightAt(10) + 1.5, 10);
        house.castShadow = true;
        const roof = new THREE.Mesh(new THREE.ConeGeometry(4.3, 2.2, 4), scene.materials.roof);
        roof.rotation.y = Math.PI / 4;
        roof.position.set(-12, this.heightAt(10) + 4, 10);
        roof.castShadow = true;
        scene.decorationGroup.add(house, roof);
    }
    buildSawmill(scene) {
        const building = new THREE.Mesh(new THREE.BoxGeometry(11, 5, 9), scene.materials.house);
        building.position.set(0, this.heightAt(296) + 2.5, 296);
        building.castShadow = true;
        const roof = new THREE.Mesh(new THREE.ConeGeometry(8, 3.5, 4), scene.materials.roof);
        roof.rotation.y = Math.PI / 4;
        roof.position.set(0, this.heightAt(296) + 6.6, 296);
        roof.castShadow = true;
        const chimney = new THREE.Mesh(new THREE.CylinderGeometry(.45, .55, 5, 8), scene.materials.trunk);
        chimney.position.set(3, this.heightAt(296) + 7, 296);
        scene.decorationGroup.add(building, roof, chimney);
    }
}
