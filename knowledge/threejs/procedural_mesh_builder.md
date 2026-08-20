# Three.js: Procedural 3D Mesh Builder (Без внешних GLTF-файлов)

Коллекция чистых процедурных генераторов стилизованной Low-Poly 3D графики на Three.js. Позволяет создавать выразительных персонажей, машины, здания, ящики, деревья и кристаллы прямо в коде, не требуя загрузки `.gltf` или `.fbx` файлов.

---

## 1. Фабрика процедурных моделей (`ProceduralMeshFactory.ts`)

```typescript
import * as THREE from 'three';

export class ProceduralMeshFactory {
    // Общая библиотека базовых стилизованных материалов
    public static materials = {
        carRed: new THREE.MeshStandardMaterial({ color: 0xd63031, roughness: 0.25, metalness: 0.6 }),
        carBlue: new THREE.MeshStandardMaterial({ color: 0x0984e3, roughness: 0.25, metalness: 0.6 }),
        glass: new THREE.MeshStandardMaterial({ color: 0x111625, roughness: 0.1, metalness: 0.9 }),
        rubber: new THREE.MeshStandardMaterial({ color: 0x2d3436, roughness: 0.8 }),
        skin: new THREE.MeshStandardMaterial({ color: 0xffcaa6, roughness: 0.6 }),
        clothesGreen: new THREE.MeshStandardMaterial({ color: 0x27ae60, roughness: 0.7 }),
        metalDark: new THREE.MeshStandardMaterial({ color: 0x2c3e50, roughness: 0.4, metalness: 0.8 }),
        wood: new THREE.MeshStandardMaterial({ color: 0x795548, roughness: 0.85 }),
        leaves: new THREE.MeshStandardMaterial({ color: 0x2ecc71, roughness: 0.6, flatShading: true }),
        gold: new THREE.MeshStandardMaterial({ color: 0xf1c40f, roughness: 0.2, metalness: 0.9 }),
        crystal: new THREE.MeshStandardMaterial({ color: 0x9b59b6, roughness: 0.1, metalness: 0.3, transparent: true, opacity: 0.85 })
    };

    /** Стилизованный низкополигональный автомобиль */
    public static createCar(colorMaterial = ProceduralMeshFactory.materials.carRed): THREE.Group {
        const car = new THREE.Group();

        // Кузов
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.45, 3.4), colorMaterial);
        body.position.y = 0.4;
        body.castShadow = true;
        car.add(body);

        // Салон / Крыша
        const roof = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.45, 1.6), ProceduralMeshFactory.materials.glass);
        roof.position.set(0, 0.78, -0.15);
        roof.castShadow = true;
        car.add(roof);

        // Фары передние
        const lightMat = new THREE.MeshBasicMaterial({ color: 0xfffa65 });
        const lightL = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.12, 0.05), lightMat);
        lightL.position.set(-0.55, 0.45, -1.72);
        const lightR = lightL.clone();
        lightR.position.x = 0.55;
        car.add(lightL, lightR);

        // Колёса (цилиндры с дисками)
        const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.2, 14);
        wheelGeo.rotateZ(Math.PI / 2);

        const offsets = [
            [-0.85, 0.32, -1.05],
            [0.85, 0.32, -1.05],
            [-0.85, 0.32, 1.05],
            [0.85, 0.32, 1.05]
        ];

        offsets.forEach(([x, y, z]) => {
            const wheel = new THREE.Mesh(wheelGeo, ProceduralMeshFactory.materials.rubber);
            wheel.position.set(x, y, z);
            wheel.castShadow = true;
            car.add(wheel);
        });

        return car;
    }

    /** Стилизованный персонаж с отдельными конечностями (для анимации походки) */
    public static createCharacter(clothesMat = ProceduralMeshFactory.materials.clothesGreen): {
        root: THREE.Group;
        leftLeg: THREE.Mesh;
        rightLeg: THREE.Mesh;
        leftArm: THREE.Mesh;
        rightArm: THREE.Mesh;
    } {
        const root = new THREE.Group();

        // Тело (торс)
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.65, 0.32), clothesMat);
        torso.position.y = 1.05;
        torso.castShadow = true;
        root.add(torso);

        // Голова
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), ProceduralMeshFactory.materials.skin);
        head.position.set(0, 1.55, 0);
        head.castShadow = true;
        root.add(head);

        // Ноги
        const legGeo = new THREE.BoxGeometry(0.18, 0.55, 0.2);
        legGeo.translate(0, -0.275, 0); // Пивот вверху сустава

        const leftLeg = new THREE.Mesh(legGeo, ProceduralMeshFactory.materials.metalDark);
        leftLeg.position.set(-0.16, 0.72, 0);
        leftLeg.castShadow = true;
        root.add(leftLeg);

        const rightLeg = new THREE.Mesh(legGeo, ProceduralMeshFactory.materials.metalDark);
        rightLeg.position.set(0.16, 0.72, 0);
        rightLeg.castShadow = true;
        root.add(rightLeg);

        // Руки
        const armGeo = new THREE.BoxGeometry(0.14, 0.55, 0.16);
        armGeo.translate(0, -0.275, 0);

        const leftArm = new THREE.Mesh(armGeo, clothesMat);
        leftArm.position.set(-0.36, 1.32, 0);
        leftArm.castShadow = true;
        root.add(leftArm);

        const rightArm = new THREE.Mesh(armGeo, clothesMat);
        rightArm.position.set(0.36, 1.32, 0);
        rightArm.castShadow = true;
        root.add(rightArm);

        return { root, leftLeg, rightLeg, leftArm, rightArm };
    }

    /** Стилизованное Low-Poly дерево */
    public static createTree(): THREE.Group {
        const tree = new THREE.Group();

        // Ствол
        const trunk = new THREE.Mesh(
            new THREE.CylinderGeometry(0.2, 0.3, 1.8, 6),
            ProceduralMeshFactory.materials.wood
        );
        trunk.position.y = 0.9;
        trunk.castShadow = true;
        tree.add(trunk);

        // Крона (3 яруса икосаэдров / конусов)
        const crownGeo1 = new THREE.IcosahedronGeometry(1.2, 0);
        const crown1 = new THREE.Mesh(crownGeo1, ProceduralMeshFactory.materials.leaves);
        crown1.position.y = 2.4;
        crown1.castShadow = true;

        const crown2 = crown1.clone();
        crown2.scale.set(0.85, 0.85, 0.85);
        crown2.position.y = 3.2;

        tree.add(crown1, crown2);
        return tree;
    }

    /** Деревянный ящик с металлическими уголками */
    public static createCrate(size = 1.0): THREE.Group {
        const crate = new THREE.Group();
        const body = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), ProceduralMeshFactory.materials.wood);
        body.position.y = size / 2;
        body.castShadow = true;
        crate.add(body);

        // Окантовка
        const frame = new THREE.Mesh(
            new THREE.BoxGeometry(size * 1.02, size * 0.1, size * 1.02),
            ProceduralMeshFactory.materials.metalDark
        );
        frame.position.y = size / 2;
        crate.add(frame);

        return crate;
    }

    /** Золотая монета с фаской */
    public static createCoin(radius = 0.4): THREE.Mesh {
        const geo = new THREE.CylinderGeometry(radius, radius, 0.08, 16);
        geo.rotateX(Math.PI / 2);
        const coin = new THREE.Mesh(geo, ProceduralMeshFactory.materials.gold);
        coin.castShadow = true;
        return coin;
    }
}
```

---

## 2. Аниматор процедурного персонажа (`CharacterAnimator.ts`)

```typescript
export class CharacterAnimator {
    public static updateWalk(
        parts: { leftLeg: any; rightLeg: any; leftArm: any; rightArm: any },
        walkTime: number,
        isMoving: boolean
    ) {
        if (isMoving) {
            const swing = Math.sin(walkTime * 10.0) * 0.7;
            parts.leftLeg.rotation.x = swing;
            parts.rightLeg.rotation.x = -swing;
            parts.leftArm.rotation.x = -swing * 0.8;
            parts.rightArm.rotation.x = swing * 0.8;
        } else {
            // Плавный возврат в стойку покоя
            parts.leftLeg.rotation.x *= 0.85;
            parts.rightLeg.rotation.x *= 0.85;
            parts.leftArm.rotation.x *= 0.85;
            parts.rightArm.rotation.x *= 0.85;
        }
    }
}
```
