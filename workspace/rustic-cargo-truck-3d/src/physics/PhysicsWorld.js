import RAPIER from '@dimforge/rapier3d-compat';
export class PhysicsWorld {
    world = null;
    bindings = [];
    async initialize() {
        await RAPIER.init();
        this.world = new RAPIER.World({ x: 0, y: -18, z: 0 });
        this.world.timestep = 1 / 60;
    }
    createDynamic(mesh, position, halfExtents, mass = 1) {
        const world = this.requireWorld();
        const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(position.x, position.y, position.z).setLinearDamping(0.15).setAngularDamping(0.3));
        world.createCollider(RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z).setMass(mass).setFriction(0.9), body);
        this.bindings.push({ body, mesh });
        return body;
    }
    createDynamicCylinder(mesh, position, radius, halfHeight, mass = 1) {
        const world = this.requireWorld();
        const body = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(position.x, position.y, position.z).setLinearDamping(0.2).setAngularDamping(0.38));
        world.createCollider(RAPIER.ColliderDesc.cylinder(halfHeight, radius).setMass(mass).setFriction(0.8).setRotation({ x: Math.sin(Math.PI / 4), y: 0, z: 0, w: Math.cos(Math.PI / 4) }), body);
        this.bindings.push({ body, mesh });
        return body;
    }
    createRoadCollider(position, halfExtents, rotationX) {
        const world = this.requireWorld();
        const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z).setRotation({ x: Math.sin(rotationX / 2), y: 0, z: 0, w: Math.cos(rotationX / 2) }));
        world.createCollider(RAPIER.ColliderDesc.cuboid(halfExtents.x, halfExtents.y, halfExtents.z).setFriction(1.1), body);
    }
    step() {
        this.requireWorld().step();
        for (const binding of this.bindings) {
            const p = binding.body.translation();
            const r = binding.body.rotation();
            binding.mesh.position.set(p.x, p.y, p.z);
            binding.mesh.quaternion.set(r.x, r.y, r.z, r.w);
        }
    }
    resetDynamic() {
        for (const binding of this.bindings) {
            this.requireWorld().removeRigidBody(binding.body);
        }
        this.bindings.length = 0;
    }
    removeBody(body) {
        const index = this.bindings.findIndex((binding) => binding.body === body);
        if (index >= 0)
            this.bindings.splice(index, 1);
        this.requireWorld().removeRigidBody(body);
    }
    requireWorld() {
        if (!this.world)
            throw new Error('Physics world is not initialized');
        return this.world;
    }
}
