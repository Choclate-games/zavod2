# Three.js: Stealth, Dynamic Vision Cones & Alarm System

Эталонная реализация процедурного 3D-конуса зрения патрульных врагов, срезания лучами препятствий и системы тревоги.

---

## 1. Процедурный конус зрения (`VisionConeMesh.ts`)

```typescript
import * as THREE from 'three';

export class VisionConeMesh {
    public mesh: THREE.Mesh;
    private geometry: THREE.BufferGeometry;
    private segments = 24;
    private fovAngle = Math.PI / 2.2; // ~82 градуса
    private maxDistance = 12.0;

    constructor(scene: THREE.Scene) {
        this.geometry = new THREE.BufferGeometry();
        const material = new THREE.MeshBasicMaterial({
            color: 0x2ecc71,
            transparent: true,
            opacity: 0.35,
            side: THREE.DoubleSide,
            depthWrite: false
        });

        this.mesh = new THREE.Mesh(this.geometry, material);
        scene.add(this.mesh);
    }

    public setColor(hex: number) {
        (this.mesh.material as THREE.MeshBasicMaterial).color.setHex(hex);
    }

    /**
     * Перестраивает полигональный меш конуса зрения с учётом препятствий
     */
    public update(
        origin: THREE.Vector3,
        forwardAngle: number,
        obstacles: THREE.Object3D[],
        raycaster: THREE.Raycaster
    ) {
        const vertices: number[] = [0, 0, 0]; // Вершина конуса (глаза охранника)
        const halfFov = this.fovAngle / 2;

        for (let i = 0; i <= this.segments; i++) {
            const angle = forwardAngle - halfFov + (i / this.segments) * this.fovAngle;
            const dir = new THREE.Vector3(-Math.sin(angle), 0, -Math.cos(angle));

            raycaster.set(origin, dir);
            raycaster.far = this.maxDistance;
            const hits = raycaster.intersectObjects(obstacles, false);

            let dist = this.maxDistance;
            if (hits.length > 0) {
                dist = hits[0].distance;
            }

            // Точки на полу
            vertices.push(
                origin.x + dir.x * dist,
                origin.y - 0.9, // На уровне пола
                origin.z + dir.z * dist
            );
        }

        const indices: number[] = [];
        for (let i = 1; i <= this.segments; i++) {
            indices.push(0, i, i + 1);
        }

        this.geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        this.geometry.setIndex(indices);
        this.geometry.computeVertexNormals();
    }
}
```

---

## 2. Шкала подозрительности и тревоги (`StealthAlarmSystem.ts`)

```typescript
export type GuardState = 'PATROL' | 'SUSPICIOUS' | 'COMBAT';

export class StealthAlarmSystem {
    public suspicionLevel = 0; // 0..100%
    public state: GuardState = 'PATROL';

    public update(dt: number, isPlayerInSight: boolean): GuardState {
        if (isPlayerInSight) {
            // Накопление тревоги (2.5 сек до тревоги)
            this.suspicionLevel = Math.min(100, this.suspicionLevel + 40 * dt);
        } else {
            // Плавный спад
            this.suspicionLevel = Math.max(0, this.suspicionLevel - 20 * dt);
        }

        if (this.suspicionLevel >= 100) {
            this.state = 'COMBAT';
        } else if (this.suspicionLevel > 15) {
            this.state = 'SUSPICIOUS';
        } else {
            this.state = 'PATROL';
        }

        return this.state;
    }
}
```
