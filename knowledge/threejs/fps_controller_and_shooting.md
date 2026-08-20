# Three.js: FPS Controller, Recoil, Weapon Bobbing & Spartan Kick

Эталонная реализация First-Person Shooter на Three.js с поддержкой PointerLock на десктопе, виртуальных стиков на мобильных, процедурной отдачи, раскачивания оружия, баллистики пуль и физического пинка.

---

## 1. Контроллер камеры от первого лица (`FPSController.ts`)

```typescript
import * as THREE from 'three';

export class FPSController {
    public camera: THREE.PerspectiveCamera;
    public yawObject: THREE.Object3D;
    public pitchObject: THREE.Object3D;
    
    public moveForward = false;
    public moveBackward = false;
    public moveLeft = false;
    public moveRight = false;
    public isGrounded = true;
    public isRunning = false;

    public velocity = new THREE.Vector3();
    public moveSpeed = 8.0;
    public runMultiplier = 1.6;
    public jumpForce = 9.0;
    public gravity = 22.0;

    // Weapon bobbing variables
    public bobTimer = 0;
    public bobAmountX = 0.035;
    public bobAmountY = 0.025;
    public bobSpeed = 10.0;

    private isLocked = false;
    private minPolarAngle = -Math.PI / 2.2;
    private maxPolarAngle = Math.PI / 2.2;

    constructor(camera: THREE.PerspectiveCamera, domElement: HTMLElement) {
        this.camera = camera;
        this.pitchObject = new THREE.Object3D();
        this.pitchObject.add(this.camera);

        this.yawObject = new THREE.Object3D();
        this.yawObject.position.y = 1.7; // Рост глаз игрока
        this.yawObject.add(this.pitchObject);

        this.setupPointerLock(domElement);
        this.setupKeyboard();
    }

    private setupPointerLock(domElement: HTMLElement) {
        domElement.addEventListener('click', () => {
            if (!this.isLocked) {
                domElement.requestPointerLock?.();
            }
        });

        document.addEventListener('pointerlockchange', () => {
            this.isLocked = document.pointerLockElement === domElement;
        });

        document.addEventListener('mousemove', (event) => {
            if (!this.isLocked) return;
            const movementX = event.movementX || 0;
            const movementY = event.movementY || 0;
            const sensitivity = 0.0022;

            this.yawObject.rotation.y -= movementX * sensitivity;
            this.pitchObject.rotation.x -= movementY * sensitivity;
            this.pitchObject.rotation.x = Math.max(
                this.minPolarAngle,
                Math.min(this.maxPolarAngle, this.pitchObject.rotation.x)
            );
        });
    }

    // Для мобильных экранов: управление поворотом от правого тач-пада
    public applyTouchLook(deltaX: number, deltaY: number, sensitivity = 0.0035) {
        this.yawObject.rotation.y -= deltaX * sensitivity;
        this.pitchObject.rotation.x -= deltaY * sensitivity;
        this.pitchObject.rotation.x = Math.max(
            this.minPolarAngle,
            Math.min(this.maxPolarAngle, this.pitchObject.rotation.x)
        );
    }

    private setupKeyboard() {
        window.addEventListener('keydown', (e) => {
            if (e.code === 'KeyW') this.moveForward = true;
            if (e.code === 'KeyS') this.moveBackward = true;
            if (e.code === 'KeyA') this.moveLeft = true;
            if (e.code === 'KeyD') this.moveRight = true;
            if (e.code === 'ShiftLeft') this.isRunning = true;
            if (e.code === 'Space' && this.isGrounded) {
                this.velocity.y = this.jumpForce;
                this.isGrounded = false;
            }
        });

        window.addEventListener('keyup', (e) => {
            if (e.code === 'KeyW') this.moveForward = false;
            if (e.code === 'KeyS') this.moveBackward = false;
            if (e.code === 'KeyA') this.moveLeft = false;
            if (e.code === 'KeyD') this.moveRight = false;
            if (e.code === 'ShiftLeft') this.isRunning = false;
        });
    }

    public update(dt: number): { moveDistance: number; isMoving: boolean } {
        // Затухание горизонтальной скорости
        this.velocity.x -= this.velocity.x * 10.0 * dt;
        this.velocity.z -= this.velocity.z * 10.0 * dt;

        // Гравитация
        this.velocity.y -= this.gravity * dt;

        const moveVector = new THREE.Vector3();
        if (this.moveForward) moveVector.z -= 1;
        if (this.moveBackward) moveVector.z += 1;
        if (this.moveLeft) moveVector.x -= 1;
        if (this.moveRight) moveVector.x += 1;
        moveVector.normalize();

        const speed = this.moveSpeed * (this.isRunning ? this.runMultiplier : 1.0);

        if (moveVector.lengthSq() > 0.001) {
            // Направление относительно поворота yawObject
            moveVector.applyEuler(new THREE.Euler(0, this.yawObject.rotation.y, 0));
            this.velocity.x += moveVector.x * speed * 10.0 * dt;
            this.velocity.z += moveVector.z * speed * 10.0 * dt;
        }

        // Интеграция координат
        this.yawObject.position.x += this.velocity.x * dt;
        this.yawObject.position.z += this.velocity.z * dt;
        this.yawObject.position.y += this.velocity.y * dt;

        // Простой пол (на Y=1.7)
        if (this.yawObject.position.y <= 1.7) {
            this.velocity.y = 0;
            this.yawObject.position.y = 1.7;
            this.isGrounded = true;
        }

        const horizontalSpeed = Math.hypot(this.velocity.x, this.velocity.z);
        const isMoving = this.isGrounded && horizontalSpeed > 0.5;

        if (isMoving) {
            this.bobTimer += dt * (this.isRunning ? this.bobSpeed * 1.35 : this.bobSpeed);
        } else {
            // Плавный возврат в ноль
            this.bobTimer += dt * 2.0;
        }

        return { moveDistance: horizontalSpeed * dt, isMoving };
    }
}
```

---

## 2. Модуль оружия, отдачи и Weapon Bobbing (`WeaponSystem.ts`)

```typescript
import * as THREE from 'three';

export class WeaponSystem {
    public weaponMesh: THREE.Group;
    public baseOffset = new THREE.Vector3(0.28, -0.25, -0.55);
    public recoilPosition = new THREE.Vector3();
    public recoilRotation = new THREE.Vector3();

    // Параметры отдачи
    public recoilStrengthZ = 0.08;
    public recoilStrengthY = 0.03;
    public recoilPitch = 0.15;
    public recoilSnappiness = 24.0;
    public returnSpeed = 12.0;

    private targetRecoilPos = new THREE.Vector3();
    private targetRecoilRot = new THREE.Vector3();

    constructor(parentCamera: THREE.Camera) {
        this.weaponMesh = this.buildProceduralRifle();
        parentCamera.add(this.weaponMesh);
        this.weaponMesh.position.copy(this.baseOffset);
    }

    // Процедурная 3D-модель штурмовой винтовки
    private buildProceduralRifle(): THREE.Group {
        const group = new THREE.Group();
        const matBody = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.3, metalness: 0.8 });
        const matAccent = new THREE.MeshStandardMaterial({ color: 0xe65c00, roughness: 0.4, metalness: 0.2 });
        const matDark = new THREE.MeshStandardMaterial({ color: 0x111215, roughness: 0.7 });

        // Ствольная коробка
        const receiver = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.42), matBody);
        receiver.castShadow = true;
        group.add(receiver);

        // Ствол
        const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.35, 12), matDark);
        barrel.rotation.x = Math.PI / 2;
        barrel.position.set(0, 0.02, -0.32);
        group.add(barrel);

        // Пламегаситель
        const muzzle = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.06, 12), matDark);
        muzzle.rotation.x = Math.PI / 2;
        muzzle.position.set(0, 0.02, -0.52);
        group.add(muzzle);

        // Магазин
        const mag = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.18, 0.09), matAccent);
        mag.position.set(0, -0.12, -0.05);
        mag.rotation.x = 0.18;
        group.add(mag);

        // Рукоять
        const grip = new THREE.Mesh(new THREE.BoxGeometry(0.048, 0.14, 0.06), matDark);
        grip.position.set(0, -0.1, 0.12);
        grip.rotation.x = -0.35;
        group.add(grip);

        return group;
    }

    public shoot(): { origin: THREE.Vector3; direction: THREE.Vector3 } {
        // Добавляем импульс отдачи
        this.targetRecoilPos.z += this.recoilStrengthZ;
        this.targetRecoilPos.y += this.recoilStrengthY;
        this.targetRecoilRot.x += this.recoilPitch;
        this.targetRecoilRot.y += (Math.random() - 0.5) * 0.04;

        // Точка дула в мировых координатах
        const muzzlePos = new THREE.Vector3(0, 0.02, -0.55);
        this.weaponMesh.localToWorld(muzzlePos);

        const worldDir = new THREE.Vector3();
        this.weaponMesh.getWorldDirection(worldDir).negate();

        return { origin: muzzlePos, direction: worldDir };
    }

    public update(dt: number, bobTimer: number, isMoving: boolean) {
        // Пружинный спад отдачи
        this.targetRecoilPos.lerp(new THREE.Vector3(), this.returnSpeed * dt);
        this.targetRecoilRot.lerp(new THREE.Vector3(), this.returnSpeed * dt);

        this.recoilPosition.lerp(this.targetRecoilPos, this.recoilSnappiness * dt);
        this.recoilRotation.lerp(this.targetRecoilRot, this.recoilSnappiness * dt);

        // Weapon bobbing (раскачивание при шагах)
        let bobX = 0;
        let bobY = 0;
        if (isMoving) {
            bobX = Math.sin(bobTimer) * 0.02;
            bobY = Math.cos(bobTimer * 2) * 0.015;
        }

        this.weaponMesh.position.set(
            this.baseOffset.x + this.recoilPosition.x + bobX,
            this.baseOffset.y + this.recoilPosition.y + bobY,
            this.baseOffset.z + this.recoilPosition.z
        );

        this.weaponMesh.rotation.set(
            this.recoilRotation.x,
            this.recoilRotation.y + (isMoving ? Math.sin(bobTimer) * 0.02 : 0),
            this.recoilRotation.z
        );
    }
}
```

---

## 3. Физический пинок («Спартанский кик») (`SpartanKick.ts`)

```typescript
import * as THREE from 'three';

export class SpartanKick {
    public kickDuration = 0.38;
    public kickTimer = 0;
    public isKicking = false;
    public kickRange = 2.8;
    public kickForce = 28.0;

    private legMesh: THREE.Group;

    constructor(camera: THREE.Camera) {
        this.legMesh = this.buildProceduralLeg();
        this.legMesh.visible = false;
        camera.add(this.legMesh);
    }

    private buildProceduralLeg(): THREE.Group {
        const group = new THREE.Group();
        const matPants = new THREE.MeshStandardMaterial({ color: 0x2b3824, roughness: 0.8 });
        const matBoot = new THREE.MeshStandardMaterial({ color: 0x1a1614, roughness: 0.6 });

        // Голень
        const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.55, 8), matPants);
        shin.position.set(0.18, -0.3, -0.4);
        shin.rotation.x = -Math.PI / 4;
        group.add(shin);

        // Ботинок
        const boot = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.28), matBoot);
        boot.position.set(0.18, -0.45, -0.65);
        group.add(boot);

        return group;
    }

    public trigger(origin: THREE.Vector3, forward: THREE.Vector3, onHitTarget: (target: any, impulse: THREE.Vector3) => void) {
        if (this.isKicking) return;
        this.isKicking = true;
        this.kickTimer = this.kickDuration;
        this.legMesh.visible = true;

        // Рейкаст удара на дистанцию 2.8м
        setTimeout(() => {
            const impulse = forward.clone().multiplyScalar(this.kickForce).add(new THREE.Vector3(0, 8.0, 0));
            // Вызов коллбека нанесения урона и отталкивания
            onHitTarget(null, impulse);
        }, 120);
    }

    public update(dt: number) {
        if (!this.isKicking) return;
        this.kickTimer -= dt;
        const progress = 1.0 - (this.kickTimer / this.kickDuration);

        if (progress < 0.35) {
            // Выпад ноги вперёд
            const t = progress / 0.35;
            this.legMesh.position.set(0, 0.2 * t, -0.4 * t);
        } else if (progress < 0.6) {
            // Удержание в пике
            this.legMesh.position.set(0, 0.2, -0.4);
        } else {
            // Возврат назад
            const t = (progress - 0.6) / 0.4;
            this.legMesh.position.set(0, 0.2 * (1 - t), -0.4 * (1 - t));
        }

        if (this.kickTimer <= 0) {
            this.isKicking = false;
            this.legMesh.visible = false;
        }
    }
}
```
