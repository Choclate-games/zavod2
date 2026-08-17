# Three.js & Physics Engine Integration (Rapier3D / Cannon-es)

## Choosing Rapier3D vs Cannon-es
- **Rapier3D (@dimforge/rapier3d-compat)**: WebAssembly-powered, deterministic, exceptionally fast with thousands of active rigidbodies, ideal for swarm collisions, ragdolls, and raycasting.
- **Cannon-es**: Pure JavaScript, lightweight, easier setup for simple arcade collisions and vehicle raycasts.

## Synchronization Loop Architecture
```typescript
class PhysicsSyncSystem {
    private world: RAPIER.World;
    private entities: Map<number, { body: RAPIER.RigidBody, mesh: THREE.Object3D }> = new Map();
    private accumulator = 0;
    private readonly fixedTimeStep = 1 / 60;

    update(delta: number) {
        this.accumulator += Math.min(delta, 0.1);
        while (this.accumulator >= this.fixedTimeStep) {
            this.world.step();
            this.accumulator -= this.fixedTimeStep;
        }

        // Sync transforms to Three.js meshes
        for (const { body, mesh } of this.entities.values()) {
            const translation = body.translation();
            const rotation = body.rotation();
            mesh.position.set(translation.x, translation.y, translation.z);
            mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
        }
    }
}
```

## Ragdoll Implementation Notes
- Use spherical and revolute joints with damping (`joint.setLimits(-Math.PI / 4, Math.PI / 4)`).
- Apply angular damping (0.5) and linear damping (0.2) to prevent jitter.
- Interpolate visual meshes using previous and current physics steps for butter-smooth 120Hz display refresh rates.
