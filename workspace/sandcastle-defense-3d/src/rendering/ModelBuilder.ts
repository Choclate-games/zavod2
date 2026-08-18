import * as THREE from 'three';

export class ModelBuilder {
  // Shared materials for performance & draw-call reduction
  private static sandMat = new THREE.MeshLambertMaterial({ color: 0xF7D070 });
  private static wetSandMat = new THREE.MeshLambertMaterial({ color: 0xD8A752 });
  private static coralMat = new THREE.MeshLambertMaterial({ color: 0xFF4B4B });
  private static hermitShellMat = new THREE.MeshLambertMaterial({ color: 0x8E7CC3 });
  private static starfishMat = new THREE.MeshLambertMaterial({ color: 0xFF8826 });
  private static seagullMat = new THREE.MeshLambertMaterial({ color: 0xF0F4F8 });
  private static beakMat = new THREE.MeshLambertMaterial({ color: 0xFFA502 });
  private static woodMat = new THREE.MeshLambertMaterial({ color: 0x8B5A2B });
  private static leafMat = new THREE.MeshLambertMaterial({ color: 0x2ED573 });
  private static waterMat = new THREE.MeshLambertMaterial({ color: 0x29C5B5 });
  private static eyeMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  private static whiteMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
  private static goldMat = new THREE.MeshLambertMaterial({ color: 0xFFD700 });
  private static flagMat = new THREE.MeshLambertMaterial({ color: 0xFF4757 });

  // HP Bar Materials
  private static hpBgMat = new THREE.MeshBasicMaterial({ color: 0x222222 });
  private static hpFgMat = new THREE.MeshBasicMaterial({ color: 0x2ED573 });

  public static createSandcastle(): THREE.Group {
    const group = new THREE.Group();

    // Central keep
    const keepGeo = new THREE.BoxGeometry(1.6, 1.2, 1.6);
    const keep = new THREE.Mesh(keepGeo, this.sandMat);
    keep.position.y = 0.6;
    keep.castShadow = true;
    keep.receiveShadow = true;
    group.add(keep);

    // Crenellations
    for (let x = -0.7; x <= 0.7; x += 0.45) {
      for (let z = -0.7; z <= 0.7; z += 0.45) {
        if (Math.abs(x) > 0.6 || Math.abs(z) > 0.6) {
          const battlement = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, 0.18), this.sandMat);
          battlement.position.set(x, 1.3, z);
          battlement.castShadow = true;
          group.add(battlement);
        }
      }
    }

    // 4 Corner round turrets
    const turretOffsets = [
      [-0.8, -0.8], [0.8, -0.8], [-0.8, 0.8], [0.8, 0.8]
    ];

    turretOffsets.forEach(([tx, tz]) => {
      const turretGeo = new THREE.CylinderGeometry(0.3, 0.35, 1.5, 8);
      const turret = new THREE.Mesh(turretGeo, this.sandMat);
      turret.position.set(tx, 0.75, tz);
      turret.castShadow = true;
      group.add(turret);

      const roofGeo = new THREE.ConeGeometry(0.4, 0.5, 8);
      const roof = new THREE.Mesh(roofGeo, this.wetSandMat);
      roof.position.set(tx, 1.75, tz);
      roof.castShadow = true;
      group.add(roof);
    });

    // Central Flagpole & Flag
    const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.0, 4);
    const pole = new THREE.Mesh(poleGeo, this.woodMat);
    pole.position.set(0, 1.6, 0);
    pole.castShadow = true;
    group.add(pole);

    const flagGeo = new THREE.BoxGeometry(0.4, 0.25, 0.02);
    const flag = new THREE.Mesh(flagGeo, this.flagMat);
    flag.position.set(0.2, 1.9, 0);
    group.add(flag);

    // Gate
    const gateGeo = new THREE.BoxGeometry(0.4, 0.6, 0.05);
    const gate = new THREE.Mesh(gateGeo, this.woodMat);
    gate.position.set(0, 0.3, 0.81);
    group.add(gate);

    return group;
  }

  public static createConchCannon(): { group: THREE.Group; pivot: THREE.Group } {
    const group = new THREE.Group();

    // Base pedestal
    const baseGeo = new THREE.CylinderGeometry(0.48, 0.55, 0.35, 6);
    const base = new THREE.Mesh(baseGeo, this.sandMat);
    base.position.y = 0.175;
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    // Yaw Pivot
    const pivot = new THREE.Group();
    pivot.position.y = 0.35;
    group.add(pivot);

    // Conch Shell barrel (multi-tier cones for spiral look)
    const shellBase = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.15, 0.6, 8), this.coralMat);
    shellBase.rotation.x = Math.PI / 2;
    shellBase.position.set(0, 0.2, 0.1);
    shellBase.castShadow = true;
    pivot.add(shellBase);

    const shellMuzzle = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 6, 12), this.goldMat);
    shellMuzzle.position.set(0, 0.2, 0.4);
    pivot.add(shellMuzzle);

    const shellSpiral = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.35, 6), this.coralMat);
    shellSpiral.rotation.x = -Math.PI / 2;
    shellSpiral.position.set(0, 0.2, -0.25);
    pivot.add(shellSpiral);

    return { group, pivot };
  }

  public static createWaterSplasher(): { group: THREE.Group; pivot: THREE.Group } {
    const group = new THREE.Group();

    // Base cistern
    const baseGeo = new THREE.CylinderGeometry(0.5, 0.55, 0.4, 8);
    const base = new THREE.Mesh(baseGeo, this.wetSandMat);
    base.position.y = 0.2;
    base.castShadow = true;
    group.add(base);

    // Water reservoir dome
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 6, 0, Math.PI * 2, 0, Math.PI / 2), this.waterMat);
    dome.position.y = 0.4;
    group.add(dome);

    // Rotating Sprinkler Head Pivot
    const pivot = new THREE.Group();
    pivot.position.y = 0.45;
    group.add(pivot);

    // 4 sprinkler arms
    const armGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.35, 4);
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Mesh(armGeo, this.waterMat);
      arm.rotation.z = Math.PI / 2;
      arm.rotation.y = (i * Math.PI) / 2;
      arm.position.set(
        Math.cos((i * Math.PI) / 2) * 0.18,
        0.1,
        Math.sin((i * Math.PI) / 2) * 0.18
      );
      pivot.add(arm);

      // Brass nozzle tip
      const nozzle = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.08), this.goldMat);
      nozzle.position.set(
        Math.cos((i * Math.PI) / 2) * 0.35,
        0.14,
        Math.sin((i * Math.PI) / 2) * 0.35
      );
      pivot.add(nozzle);
    }

    return { group, pivot };
  }

  public static createSandWall(): THREE.Group {
    const group = new THREE.Group();

    // Molded Sand Brick
    const wallGeo = new THREE.BoxGeometry(0.9, 0.7, 0.9);
    const wall = new THREE.Mesh(wallGeo, this.sandMat);
    wall.position.y = 0.35;
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);

    // Decorative embossed starfish on side
    const star = new THREE.Mesh(new THREE.DodecahedronGeometry(0.12, 0), this.starfishMat);
    star.position.set(0, 0.35, 0.46);
    group.add(star);

    return group;
  }

  public static createCrab(scale: number = 1.0, isBoss: boolean = false): {
    group: THREE.Group;
    leftClaw: THREE.Object3D;
    rightClaw: THREE.Object3D;
    hpBar: THREE.Mesh;
  } {
    const group = new THREE.Group();
    group.scale.set(scale, scale, scale);

    const bodyMat = isBoss ? new THREE.MeshLambertMaterial({ color: 0x9B51E0 }) : this.coralMat;

    // Main Carapace
    const bodyGeo = new THREE.SphereGeometry(0.35, 8, 6);
    bodyGeo.scale(1.2, 0.6, 1.0);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.y = 0.22;
    body.castShadow = true;
    group.add(body);

    // Cute Eyestalks
    const eyeStalkGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.2, 4);
    [-0.14, 0.14].forEach((ex) => {
      const stalk = new THREE.Mesh(eyeStalkGeo, bodyMat);
      stalk.position.set(ex, 0.4, 0.2);
      stalk.rotation.x = -0.3;
      group.add(stalk);

      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), this.whiteMat);
      eye.position.set(ex, 0.5, 0.25);
      group.add(eye);

      const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), this.eyeMat);
      pupil.position.set(ex, 0.52, 0.3);
      group.add(pupil);
    });

    // 4 Walking legs
    const legGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.3, 4);
    const legOffsets = [
      [-0.35, -0.15], [-0.35, 0.15], [0.35, -0.15], [0.35, 0.15]
    ];
    legOffsets.forEach(([lx, lz], idx) => {
      const leg = new THREE.Mesh(legGeo, bodyMat);
      leg.position.set(lx, 0.12, lz);
      leg.rotation.z = (idx < 2 ? 1 : -1) * 0.8;
      group.add(leg);
    });

    // Left Claw
    const leftClaw = new THREE.Group();
    leftClaw.position.set(-0.35, 0.22, 0.25);
    const clawGeo = new THREE.SphereGeometry(0.15, 6, 4);
    clawGeo.scale(1.4, 0.8, 1.0);
    const leftPincer = new THREE.Mesh(clawGeo, bodyMat);
    leftPincer.castShadow = true;
    leftClaw.add(leftPincer);
    group.add(leftClaw);

    // Right Claw
    const rightClaw = new THREE.Group();
    rightClaw.position.set(0.35, 0.22, 0.25);
    const rightPincer = new THREE.Mesh(clawGeo, bodyMat);
    rightPincer.castShadow = true;
    rightClaw.add(rightPincer);
    group.add(rightClaw);

    // Boss Crown
    if (isBoss) {
      const crownGeo = new THREE.ConeGeometry(0.2, 0.25, 5);
      const crown = new THREE.Mesh(crownGeo, this.goldMat);
      crown.position.set(0, 0.5, 0);
      group.add(crown);
    }

    // Health Bar container
    const hpBar = this.createHpBar(group, 0.65);

    return { group, leftClaw, rightClaw, hpBar };
  }

  public static createHermitCrab(): {
    group: THREE.Group;
    leftClaw: THREE.Object3D;
    rightClaw: THREE.Object3D;
    hpBar: THREE.Mesh;
  } {
    const { group, leftClaw, rightClaw, hpBar } = this.createCrab(1.15, false);

    // Giant spiral shell backpack
    const shellGeo = new THREE.ConeGeometry(0.45, 0.8, 8);
    const shell = new THREE.Mesh(shellGeo, this.hermitShellMat);
    shell.rotation.x = -Math.PI / 2.5;
    shell.position.set(0, 0.45, -0.3);
    shell.castShadow = true;
    group.add(shell);

    return { group, leftClaw, rightClaw, hpBar };
  }

  public static createStarfish(scale: number = 0.9): {
    group: THREE.Group;
    leftClaw: THREE.Object3D;
    rightClaw: THREE.Object3D;
    hpBar: THREE.Mesh;
  } {
    const group = new THREE.Group();
    group.scale.set(scale, scale, scale);

    // 5-pointed star body
    const starGeo = new THREE.DodecahedronGeometry(0.4, 0);
    starGeo.scale(1.2, 0.4, 1.2);
    const body = new THREE.Mesh(starGeo, this.starfishMat);
    body.position.y = 0.15;
    body.castShadow = true;
    group.add(body);

    // Cute face
    [-0.1, 0.1].forEach((ex) => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), this.eyeMat);
      eye.position.set(ex, 0.25, 0.18);
      group.add(eye);
    });

    const leftClaw = new THREE.Group();
    const rightClaw = new THREE.Group();
    group.add(leftClaw);
    group.add(rightClaw);

    const hpBar = this.createHpBar(group, 0.5);

    return { group, leftClaw, rightClaw, hpBar };
  }

  public static createSeagull(): {
    group: THREE.Group;
    leftWing: THREE.Object3D;
    rightWing: THREE.Object3D;
    hpBar: THREE.Mesh;
  } {
    const group = new THREE.Group();

    // Body
    const bodyGeo = new THREE.ConeGeometry(0.2, 0.6, 6);
    bodyGeo.rotateX(Math.PI / 2);
    const body = new THREE.Mesh(bodyGeo, this.seagullMat);
    body.castShadow = true;
    group.add(body);

    // Beak
    const beak = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.25, 4), this.beakMat);
    beak.rotation.x = Math.PI / 2;
    beak.position.set(0, 0, 0.4);
    group.add(beak);

    // Left Wing
    const leftWing = new THREE.Group();
    leftWing.position.set(-0.15, 0.05, 0);
    const wingGeo = new THREE.BoxGeometry(0.5, 0.03, 0.25);
    const lMesh = new THREE.Mesh(wingGeo, this.seagullMat);
    lMesh.position.x = -0.25;
    leftWing.add(lMesh);
    group.add(leftWing);

    // Right Wing
    const rightWing = new THREE.Group();
    rightWing.position.set(0.15, 0.05, 0);
    const rMesh = new THREE.Mesh(wingGeo, this.seagullMat);
    rMesh.position.x = 0.25;
    rightWing.add(rMesh);
    group.add(rightWing);

    const hpBar = this.createHpBar(group, 0.5);

    return { group, leftWing, rightWing, hpBar };
  }

  public static createPalmTree(): THREE.Group {
    const group = new THREE.Group();

    // Trunk (segmented curve)
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, 2.5, 6);
    const trunk = new THREE.Mesh(trunkGeo, this.woodMat);
    trunk.position.y = 1.25;
    trunk.rotation.z = 0.1;
    trunk.castShadow = true;
    group.add(trunk);

    // Fronds
    const frondGeo = new THREE.ConeGeometry(0.6, 1.6, 4);
    frondGeo.scale(1.0, 0.15, 1.0);
    for (let i = 0; i < 5; i++) {
      const frond = new THREE.Mesh(frondGeo, this.leafMat);
      frond.rotation.y = (i * Math.PI * 2) / 5;
      frond.rotation.x = 0.7;
      frond.position.set(0, 2.4, 0);
      frond.castShadow = true;
      group.add(frond);
    }

    return group;
  }

  public static createBeachUmbrella(): THREE.Group {
    const group = new THREE.Group();

    // Pole
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.0, 4), this.woodMat);
    pole.position.y = 1.0;
    pole.castShadow = true;
    group.add(pole);

    // Canopy
    const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.0, 0.5, 8), this.flagMat);
    canopy.position.y = 1.8;
    canopy.castShadow = true;
    group.add(canopy);

    return group;
  }

  private static createHpBar(parent: THREE.Group, heightY: number): THREE.Mesh {
    const barHolder = new THREE.Group();
    barHolder.position.y = heightY;
    parent.add(barHolder);

    const bgGeo = new THREE.PlaneGeometry(0.6, 0.08);
    const bg = new THREE.Mesh(bgGeo, this.hpBgMat);
    bg.rotation.x = -Math.PI / 4;
    barHolder.add(bg);

    const fgGeo = new THREE.PlaneGeometry(0.6, 0.08);
    const fg = new THREE.Mesh(fgGeo, this.hpFgMat);
    fg.position.z = 0.01;
    bg.add(fg);

    return fg;
  }
}
