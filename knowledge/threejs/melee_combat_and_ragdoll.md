# Three.js: Melee Combat, Combo State Machine, Hit-Stop & Parry

Эталонная реализация боевой системы ближнего боя на Three.js: связки ударов (комбо), точное окно парирования, микро-заморозка кадра (Hit-Stop), импульсы камеры и отклик врагов.

---

## 1. Менеджер комбо-атак (`MeleeCombatSystem.ts`)

```typescript
import * as THREE from 'three';

export interface AttackStep {
    name: string;
    windupTime: number;   // Подготовка к удару (с)
    activeTime: number;   // Время активности хитбокса (с)
    recoveryTime: number; // Восстановление (с)
    damage: number;
    knockback: number;
    hitStopMs: number;
}

export class MeleeCombatSystem {
    public comboIndex = 0;
    public state: 'IDLE' | 'WINDUP' | 'ACTIVE' | 'RECOVERY' | 'PARRYING' = 'IDLE';
    public stateTimer = 0;
    public isParryWindow = false;

    // 3-ударная комбо-цепочка
    public comboChain: AttackStep[] = [
        { name: 'Slash Right', windupTime: 0.08, activeTime: 0.12, recoveryTime: 0.18, damage: 25, knockback: 6.0, hitStopMs: 40 },
        { name: 'Slash Left',  windupTime: 0.06, activeTime: 0.12, recoveryTime: 0.20, damage: 35, knockback: 8.0, hitStopMs: 50 },
        { name: 'Heavy Slam',  windupTime: 0.18, activeTime: 0.16, recoveryTime: 0.35, damage: 70, knockback: 18.0, hitStopMs: 80 }
    ];

    public weaponMesh: THREE.Group;
    public hitboxCenter = new THREE.Vector3();
    public hitboxRadius = 1.6;

    constructor(parentEntity: THREE.Object3D) {
        this.weaponMesh = this.buildProceduralSword();
        parentEntity.add(this.weaponMesh);
        this.weaponMesh.position.set(0.4, 0.9, 0.4);
    }

    private buildProceduralSword(): THREE.Group {
        const sword = new THREE.Group();
        const matBlade = new THREE.MeshStandardMaterial({ color: 0xecf0f1, metalness: 0.9, roughness: 0.15 });
        const matGold = new THREE.MeshStandardMaterial({ color: 0xf39c12, metalness: 0.8, roughness: 0.3 });
        const matGrip = new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.8 });

        // Лезвие
        const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.95, 0.02), matBlade);
        blade.position.y = 0.55;
        blade.castShadow = true;
        sword.add(blade);

        // Гарда
        const guard = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.04, 0.06), matGold);
        guard.position.y = 0.08;
        sword.add(guard);

        // Рукоять
        const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.22, 8), matGrip);
        grip.position.y = -0.05;
        sword.add(grip);

        return sword;
    }

    public requestAttack(): boolean {
        if (this.state === 'IDLE' || this.state === 'RECOVERY') {
            if (this.state === 'RECOVERY') {
                this.comboIndex = (this.comboIndex + 1) % this.comboChain.length;
            } else {
                this.comboIndex = 0;
            }
            this.state = 'WINDUP';
            this.stateTimer = this.comboChain[this.comboIndex].windupTime;
            return true;
        }
        return false;
    }

    public requestParry(): boolean {
        if (this.state === 'IDLE') {
            this.state = 'PARRYING';
            this.stateTimer = 0.25;
            this.isParryWindow = true;
            return true;
        }
        return false;
    }

    public update(dt: number, onHit: (step: AttackStep, center: THREE.Vector3) => void) {
        if (this.state === 'IDLE') return;

        this.stateTimer -= dt;
        const currentStep = this.comboChain[this.comboIndex];

        switch (this.state) {
            case 'WINDUP':
                // Отвод меча назад
                this.weaponMesh.rotation.z = THREE.MathUtils.lerp(this.weaponMesh.rotation.z, 1.2, 20.0 * dt);
                if (this.stateTimer <= 0) {
                    this.state = 'ACTIVE';
                    this.stateTimer = currentStep.activeTime;
                }
                break;

            case 'ACTIVE':
                // Взмах меча вперед
                this.weaponMesh.rotation.z = THREE.MathUtils.lerp(this.weaponMesh.rotation.z, -1.6, 30.0 * dt);
                this.weaponMesh.getWorldPosition(this.hitboxCenter);
                onHit(currentStep, this.hitboxCenter);

                if (this.stateTimer <= 0) {
                    this.state = 'RECOVERY';
                    this.stateTimer = currentStep.recoveryTime;
                }
                break;

            case 'RECOVERY':
                this.weaponMesh.rotation.z = THREE.MathUtils.lerp(this.weaponMesh.rotation.z, 0, 10.0 * dt);
                if (this.stateTimer <= 0) {
                    this.state = 'IDLE';
                    this.comboIndex = 0;
                }
                break;

            case 'PARRYING':
                this.weaponMesh.rotation.x = Math.PI / 2;
                if (this.stateTimer <= 0.1) {
                    this.isParryWindow = false; // Окно идеального парирования закрылось
                }
                if (this.stateTimer <= 0) {
                    this.weaponMesh.rotation.x = 0;
                    this.state = 'IDLE';
                }
                break;
        }
    }
}
```

---

## 2. Менеджер Hit-Stop (Микро-заморозка времени) (`HitStopManager.ts`)

```typescript
export class HitStopManager {
    private static isFrozen = false;

    /**
     * Замораживает игровой цикл на несколько миллисекунд (эффект сочного удара)
     */
    public static trigger(durationMs = 45, onComplete?: () => void) {
        if (this.isFrozen) return;
        this.isFrozen = true;

        setTimeout(() => {
            this.isFrozen = false;
            onComplete?.();
        }, durationMs);
    }

    public static shouldSkipFrame(): boolean {
        return this.isFrozen;
    }
}
```
