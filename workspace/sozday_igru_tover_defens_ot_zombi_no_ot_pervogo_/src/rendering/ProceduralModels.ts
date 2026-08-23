import * as THREE from 'three';

export class ProceduralModels {
  public static createTurretMesh(): THREE.Group {
    const group = new THREE.Group();

    // Основание / Тумба
    const baseGeo = new THREE.CylinderGeometry(0.7, 0.9, 0.5, 8);
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x222b35,
      metalness: 0.4,
      roughness: 0.6,
    });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 0.25;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // Поворотная турель
    const swivel = new THREE.Group();
    swivel.name = 'swivel';
    swivel.position.y = 0.5;

    // Ствольная коробка
    const bodyGeo = new THREE.BoxGeometry(0.6, 0.5, 0.9);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x334150,
      metalness: 0.4,
      roughness: 0.5,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 0.35, 0);
    body.castShadow = true;
    swivel.add(body);

    // Стволы (3 ствола) с настраиваемым материалом нагрева
    const barrelsGroup = new THREE.Group();
    barrelsGroup.name = 'barrels';
    barrelsGroup.position.set(0, 0.35, -0.6);

    const barrelGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6);
    barrelGeo.rotateX(Math.PI / 2);

    const heatMat = new THREE.MeshStandardMaterial({
      color: 0x111822,
      emissive: 0x000000,
      metalness: 0.4,
      roughness: 0.4,
    });
    heatMat.name = 'heatMaterial';

    for (let i = 0; i < 3; i++) {
      const angle = (i * Math.PI * 2) / 3;
      const b = new THREE.Mesh(barrelGeo, heatMat);
      b.position.set(Math.cos(angle) * 0.12, Math.sin(angle) * 0.12, -0.2);
      b.castShadow = true;
      barrelsGroup.add(b);
    }
    swivel.add(barrelsGroup);

    // Слот для Overcharge ячейки (бирюзовый индикатор)
    const slotGeo = new THREE.BoxGeometry(0.2, 0.2, 0.3);
    const slotMat = new THREE.MeshStandardMaterial({
      color: 0x00bcd4,
      emissive: 0x003344,
      roughness: 0.3,
    });
    const slot = new THREE.Mesh(slotGeo, slotMat);
    slot.name = 'overchargeSlot';
    slot.position.set(0.35, 0.4, 0);
    swivel.add(slot);

    // Радиатор охлаждения (сзади)
    const radiatorGeo = new THREE.BoxGeometry(0.4, 0.3, 0.2);
    const radiatorMat = new THREE.MeshStandardMaterial({
      color: 0x1a2634,
      roughness: 0.8,
    });
    const radiator = new THREE.Mesh(radiatorGeo, radiatorMat);
    radiator.position.set(0, 0.4, 0.45);
    swivel.add(radiator);

    group.add(swivel);
    return group;
  }

  public static createBarrelMesh(type: 'cryo' | 'diesel'): THREE.Group {
    const group = new THREE.Group();

    const geo = new THREE.CylinderGeometry(0.4, 0.4, 1.1, 10);
    const color = type === 'cryo' ? 0x3498db : 0xe67e22;
    const emissive = type === 'cryo' ? 0x002244 : 0x441100;

    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive,
      metalness: 0.4,
      roughness: 0.5,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.y = 0.55;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);

    // Обручи бочки
    const ringGeo = new THREE.TorusGeometry(0.42, 0.03, 6, 12);
    ringGeo.rotateX(Math.PI / 2);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x11161d, roughness: 0.7 });

    const ring1 = new THREE.Mesh(ringGeo, ringMat);
    ring1.position.y = 0.3;
    const ring2 = new THREE.Mesh(ringGeo, ringMat);
    ring2.position.y = 0.8;
    group.add(ring1, ring2);

    return group;
  }

  public static createOverchargeCellMesh(): THREE.Group {
    const group = new THREE.Group();

    const bodyGeo = new THREE.BoxGeometry(0.25, 0.4, 0.25);
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x222a35,
      metalness: 0.4,
      roughness: 0.4,
    });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.2;
    body.castShadow = true;
    group.add(body);

    const coreGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.35, 8);
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0xf1c40f,
      emissive: 0x886600,
      roughness: 0.2,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    core.position.y = 0.2;
    group.add(core);

    return group;
  }

  public static createArenaMesh(): THREE.Group {
    const arena = new THREE.Group();

    // 1. Пол платформы бастиона (металл с заклепками)
    const floorGeo = new THREE.BoxGeometry(24, 0.4, 16);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x1e2732,
      metalness: 0.4,
      roughness: 0.7,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.set(0, -0.2, 0);
    floor.receiveShadow = true;
    arena.add(floor);

    // 2. Бруствер / передовая линия с амбразурами
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x2b3947,
      metalness: 0.3,
      roughness: 0.8,
    });

    const wallLeftGeo = new THREE.BoxGeometry(7, 1.3, 0.6);
    const wallLeft = new THREE.Mesh(wallLeftGeo, wallMat);
    wallLeft.position.set(-6.5, 0.65, -6);
    wallLeft.castShadow = true;
    wallLeft.receiveShadow = true;
    arena.add(wallLeft);

    const wallCenterGeo = new THREE.BoxGeometry(5, 1.3, 0.6);
    const wallCenter = new THREE.Mesh(wallCenterGeo, wallMat);
    wallCenter.position.set(0, 0.65, -6);
    wallCenter.castShadow = true;
    wallCenter.receiveShadow = true;
    arena.add(wallCenter);

    const wallRightGeo = new THREE.BoxGeometry(7, 1.3, 0.6);
    const wallRight = new THREE.Mesh(wallRightGeo, wallMat);
    wallRight.position.set(6.5, 0.65, -6);
    wallRight.castShadow = true;
    wallRight.receiveShadow = true;
    arena.add(wallRight);

    // 3. Заснеженная пустошь за бруствером
    const snowGeo = new THREE.PlaneGeometry(60, 40);
    snowGeo.rotateX(-Math.PI / 2);
    const snowMat = new THREE.MeshStandardMaterial({
      color: 0xd8e4ee,
      roughness: 0.9,
    });
    const snow = new THREE.Mesh(snowGeo, snowMat);
    snow.position.set(0, -0.4, -24);
    snow.receiveShadow = true;
    arena.add(snow);

    // 4. Задняя стена бункера и ворота реактора
    const bunkerWallGeo = new THREE.BoxGeometry(24, 6, 1);
    const bunkerWall = new THREE.Mesh(bunkerWallGeo, wallMat);
    bunkerWall.position.set(0, 3, 7.5);
    bunkerWall.castShadow = true;
    bunkerWall.receiveShadow = true;
    arena.add(bunkerWall);

    // Ядро реактора (пульсирующий зеленый кристалл / цилиндр)
    const reactorGeo = new THREE.CylinderGeometry(1.2, 1.2, 3.5, 8);
    const reactorMat = new THREE.MeshStandardMaterial({
      color: 0x2ecc71,
      emissive: 0x0a441e,
      roughness: 0.3,
    });
    const reactor = new THREE.Mesh(reactorGeo, reactorMat);
    reactor.name = 'reactorCore';
    reactor.position.set(0, 1.75, 6.2);
    reactor.castShadow = true;
    arena.add(reactor);

    // Прожекторные мачты
    for (const x of [-10, 10]) {
      const poleGeo = new THREE.CylinderGeometry(0.12, 0.15, 5, 6);
      const pole = new THREE.Mesh(poleGeo, floorMat);
      pole.position.set(x, 2.5, -5.5);
      pole.castShadow = true;
      arena.add(pole);

      const lampGeo = new THREE.BoxGeometry(0.6, 0.4, 0.6);
      const lampMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xeeeeee });
      const lamp = new THREE.Mesh(lampGeo, lampMat);
      lamp.position.set(x, 4.8, -5.3);
      arena.add(lamp);
    }

    return arena;
  }

  public static createViewmodel(): THREE.Group {
    const viewmodel = new THREE.Group();

    // Правая рука инженера в рукавице
    const armGeo = new THREE.CylinderGeometry(0.08, 0.1, 0.5, 6);
    armGeo.rotateX(Math.PI / 2.5);
    const armMat = new THREE.MeshStandardMaterial({
      color: 0x3a4856,
      metalness: 0.3,
      roughness: 0.7,
    });
    const arm = new THREE.Mesh(armGeo, armMat);
    arm.position.set(0.35, -0.3, -0.4);
    viewmodel.add(arm);

    // Сопло крио-ранца / мультитул
    const toolGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.4, 6);
    toolGeo.rotateX(Math.PI / 2);
    const toolMat = new THREE.MeshStandardMaterial({
      color: 0x3498db,
      metalness: 0.4,
      roughness: 0.4,
    });
    const tool = new THREE.Mesh(toolGeo, toolMat);
    tool.position.set(0.3, -0.22, -0.65);
    viewmodel.add(tool);

    return viewmodel;
  }
}
