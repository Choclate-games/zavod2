import * as THREE from 'three';
export class CargoManager {
    physics;
    scene;
    total = 8;
    remaining = this.total;
    items = [];
    constructor(physics, scene, _events) {
        this.physics = physics;
        this.scene = scene;
    }
    build() {
        this.reset();
    }
    reset() {
        this.items.length = 0;
        this.remaining = this.total;
        this.scene.clearGroup(this.scene.cargoGroup);
        for (let i = 0; i < this.total; i += 1) {
            const isLog = i < 6;
            const mesh = isLog
                ? new THREE.Mesh(this.logGeometry(), this.scene.materials.log)
                : new THREE.Mesh(new THREE.BoxGeometry(.95, .95, .95), this.scene.materials.crate);
            mesh.castShadow = true;
            const x = (i % 2 === 0 ? -.7 : .7) + (i % 3 === 0 ? .2 : 0);
            const z = 3.2 + (i % 4) * .85;
            const y = isLog ? 3.2 + Math.floor(i / 3) * .7 : 3.5;
            mesh.position.set(x, y, z);
            this.scene.cargoGroup.add(mesh);
            const body = isLog
                ? this.physics.createDynamicCylinder(mesh, new THREE.Vector3(x, y, z), .38, 1.15, 1.5)
                : this.physics.createDynamic(mesh, new THREE.Vector3(x, y, z), new THREE.Vector3(.48, .48, .48), 1.2);
            this.items.push({ body, mesh, active: true });
        }
    }
    fixedUpdate(truckZ, events) {
        for (const item of this.items) {
            if (!item.active)
                continue;
            const p = item.body.translation();
            const outsideBed = Math.abs(p.x) > 2.8 || p.z < truckZ - 3.6 || p.z > truckZ + 5.2;
            const onGround = p.y < 0.5;
            if ((outsideBed && onGround) || p.y < -4) {
                item.active = false;
                item.mesh.visible = false;
                this.physics.removeBody(item.body);
                this.remaining = Math.max(0, this.remaining - 1);
                events.emit('cargo:lost', { remaining: this.remaining, total: this.total });
            }
        }
    }
    render(_alpha) {
        for (const item of this.items)
            item.mesh.visible = item.active;
    }
    logGeometry() {
        const geometry = new THREE.CylinderGeometry(.38, .38, 2.3, 12);
        geometry.rotateX(Math.PI / 2);
        return geometry;
    }
}
