# Three.js: Juice, Instanced Particle VFX & Toon Shading

Рецепт оптимизированной системы частиц (`InstancedMesh` на 1000+ частиц за 1 Draw Call), шейка камеры и Toon (Cel) шейдинга.

---

## 1. Пул частиц на 1000+ элементов без аллокаций (`InstancedParticlePool.ts`)

```typescript
import * as THREE from 'three';

interface Particle {
    active: boolean;
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    scale: number;
    life: number;
    maxLife: number;
    color: THREE.Color;
}

export class InstancedParticlePool {
    private maxParticles = 1000;
    private particles: Particle[] = [];
    private instancedMesh: THREE.InstancedMesh;
    private dummy = new THREE.Object3D();

    constructor(scene: THREE.Scene) {
        const geo = new THREE.BoxGeometry(0.12, 0.12, 0.12);
        const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });

        this.instancedMesh = new THREE.InstancedMesh(geo, mat, this.maxParticles);
        this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(this.instancedMesh);

        for (let i = 0; i < this.maxParticles; i++) {
            this.particles.push({
                active: false,
                position: new THREE.Vector3(),
                velocity: new THREE.Vector3(),
                scale: 1.0,
                life: 0,
                maxLife: 1.0,
                color: new THREE.Color()
            });
            this.dummy.position.set(0, -999, 0);
            this.dummy.updateMatrix();
            this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
        }
        this.instancedMesh.instanceMatrix.needsUpdate = true;
    }

    /** Выброс фонтана искр или дыма */
    public emitBurst(pos: THREE.Vector3, count = 25, colorHex = 0xffaa00, speed = 6.0) {
        let spawned = 0;
        for (const p of this.particles) {
            if (!p.active) {
                p.active = true;
                p.position.copy(pos);
                p.velocity.set(
                    (Math.random() - 0.5) * speed,
                    Math.random() * speed * 0.8 + 2.0,
                    (Math.random() - 0.5) * speed
                );
                p.life = 0;
                p.maxLife = 0.4 + Math.random() * 0.4;
                p.scale = 0.8 + Math.random() * 0.5;
                p.color.setHex(colorHex);

                spawned++;
                if (spawned >= count) break;
            }
        }
    }

    public update(dt: number) {
        let activeCount = 0;
        for (let i = 0; i < this.maxParticles; i++) {
            const p = this.particles[i];
            if (p.active) {
                p.life += dt;
                if (p.life >= p.maxLife) {
                    p.active = false;
                    this.dummy.position.set(0, -999, 0);
                    this.dummy.updateMatrix();
                    this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
                    continue;
                }

                // Гравитация и сопротивление
                p.velocity.y -= 9.8 * dt;
                p.position.addScaledVector(p.velocity, dt);

                const progress = p.life / p.maxLife;
                const scale = (1.0 - progress) * p.scale;

                this.dummy.position.copy(p.position);
                this.dummy.scale.set(scale, scale, scale);
                this.dummy.updateMatrix();

                this.instancedMesh.setMatrixAt(i, this.dummy.matrix);
                this.instancedMesh.setColorAt(i, p.color);
                activeCount++;
            }
        }

        if (activeCount > 0) {
            this.instancedMesh.instanceMatrix.needsUpdate = true;
            if (this.instancedMesh.instanceColor) {
                this.instancedMesh.instanceColor.needsUpdate = true;
            }
        }
    }
}
```

---

## 2. Шейк камеры (`CameraShake.ts`)

```typescript
import * as THREE from 'three';

export class CameraShake {
    private trauma = 0;
    private maxAngle = 0.08;
    private maxOffset = 0.35;

    public addTrauma(amount = 0.5) {
        this.trauma = Math.min(1.0, this.trauma + amount);
    }

    public update(dt: number, camera: THREE.Camera) {
        if (this.trauma <= 0.001) return;

        // Нелинейный спад (травма в квадрате дает более сочный отклик)
        const shake = this.trauma * this.trauma;

        const yaw = (Math.random() * 2 - 1) * this.maxAngle * shake;
        const pitch = (Math.random() * 2 - 1) * this.maxAngle * shake;
        const offsetX = (Math.random() * 2 - 1) * this.maxOffset * shake;
        const offsetY = (Math.random() * 2 - 1) * this.maxOffset * shake;

        camera.rotation.y += yaw;
        camera.rotation.x += pitch;
        camera.position.x += offsetX;
        camera.position.y += offsetY;

        this.trauma = Math.max(0, this.trauma - dt * 2.2);
    }
}
```
