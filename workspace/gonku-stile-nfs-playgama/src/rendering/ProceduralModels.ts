import * as THREE from 'three';

export interface VehicleVisualRig {
  root: THREE.Group;
  chassis: THREE.Group;
  wheelFlSteer: THREE.Group;
  wheelFrSteer: THREE.Group;
  wheelFlSpin: THREE.Mesh;
  wheelFrSpin: THREE.Mesh;
  wheelRlSpin: THREE.Mesh;
  wheelRrSpin: THREE.Mesh;
  exhaustPipes: THREE.Vector3[];
  lights?: THREE.Mesh[];
  sirenLights?: { mesh: THREE.Mesh; red: boolean }[];
  underglow?: THREE.Mesh;
}

export class ProceduralModels {
  // Shared materials for optimal draw calls and batched memory
  private static tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8, metalness: 0.1 });
  private static rimMat = new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.9, roughness: 0.2 });
  private static glassMat = new THREE.MeshStandardMaterial({ color: 0x112233, roughness: 0.1, metalness: 0.8, opacity: 0.85, transparent: true });
  private static metalBlack = new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, roughness: 0.3 });
  private static policeWhite = new THREE.MeshStandardMaterial({ color: 0xeeeeee, roughness: 0.4, metalness: 0.2 });
  private static policeBlack = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.3 });
  private static chromeMat = new THREE.MeshStandardMaterial({ color: 0xffffff, metalness: 1.0, roughness: 0.05 });
  private static brakeRed = new THREE.MeshBasicMaterial({ color: 0xff0033 });
  private static sirenRed = new THREE.MeshBasicMaterial({ color: 0xff0044 });
  private static sirenBlue = new THREE.MeshBasicMaterial({ color: 0x0066ff });

  /** Create reusable wheel assembly with nested steering & spinning groups */
  private static createWheel(radius = 0.35, width = 0.25): { rig: THREE.Group; spinMesh: THREE.Mesh } {
    const rig = new THREE.Group();
    const wheelGeo = new THREE.CylinderGeometry(radius, radius, width, 16);
    wheelGeo.rotateZ(Math.PI / 2);

    const spinMesh = new THREE.Mesh(wheelGeo, this.tireMat);
    spinMesh.castShadow = true;

    // Hub rim
    const rimGeo = new THREE.CylinderGeometry(radius * 0.65, radius * 0.65, width * 1.02, 10);
    rimGeo.rotateZ(Math.PI / 2);
    const rimMesh = new THREE.Mesh(rimGeo, this.rimMat);
    spinMesh.add(rimMesh);

    rig.add(spinMesh);
    return { rig, spinMesh };
  }

  // --- 1. PLAYER CAR 0: V8 JUGGERNAUT MUSCLE CAR ---
  static createMuscleCar(neonColor = 0x00f0ff): VehicleVisualRig {
    const root = new THREE.Group();
    const chassis = new THREE.Group();
    root.add(chassis);

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1a1a24, roughness: 0.3, metalness: 0.7 });
    const accentMat = new THREE.MeshStandardMaterial({ color: 0xff4400, roughness: 0.3, metalness: 0.5 });

    // Main Body
    const bodyGeo = new THREE.BoxGeometry(1.85, 0.55, 4.2);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.45;
    bodyMesh.castShadow = true;
    chassis.add(bodyMesh);

    // Cabin / Roof
    const cabinGeo = new THREE.BoxGeometry(1.5, 0.45, 2.0);
    const cabinMesh = new THREE.Mesh(cabinGeo, bodyMat);
    cabinMesh.position.set(0, 0.9, -0.2);
    cabinMesh.castShadow = true;
    chassis.add(cabinMesh);

    // Windshield & Windows
    const glassGeo = new THREE.BoxGeometry(1.52, 0.4, 1.85);
    const glassMesh = new THREE.Mesh(glassGeo, this.glassMat);
    glassMesh.position.set(0, 0.9, -0.2);
    chassis.add(glassMesh);

    // Hood Blower Supercharger
    const blowerGeo = new THREE.BoxGeometry(0.5, 0.3, 0.7);
    const blowerMesh = new THREE.Mesh(blowerGeo, this.chromeMat);
    blowerMesh.position.set(0, 0.8, 1.1);
    chassis.add(blowerMesh);

    // Armored Front Ram Bumper & Spikes
    const ramGeo = new THREE.BoxGeometry(2.0, 0.4, 0.35);
    const ramMesh = new THREE.Mesh(ramGeo, this.metalBlack);
    ramMesh.position.set(0, 0.4, 2.15);
    ramMesh.castShadow = true;
    chassis.add(ramMesh);

    // Rear Spoiler
    const spoilerWing = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.35), accentMat);
    spoilerWing.position.set(0, 1.05, -1.9);
    const postL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.1), this.metalBlack);
    postL.position.set(-0.65, 0.88, -1.9);
    const postR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.1), this.metalBlack);
    postR.position.set(0.65, 0.88, -1.9);
    chassis.add(spoilerWing, postL, postR);

    // Headlights & Taillights
    const headL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.15, 0.1), new THREE.MeshBasicMaterial({ color: 0xffffdd }));
    headL.position.set(-0.65, 0.5, 2.12);
    const headR = headL.clone();
    headR.position.x = 0.65;
    const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.15, 0.1), this.brakeRed);
    tailL.position.set(-0.6, 0.55, -2.12);
    const tailR = tailL.clone();
    tailR.position.x = 0.6;
    chassis.add(headL, headR, tailL, tailR);

    // Underglow Neon
    const underglowGeo = new THREE.PlaneGeometry(1.7, 3.8);
    underglowGeo.rotateX(-Math.PI / 2);
    const underglowMat = new THREE.MeshBasicMaterial({
      color: neonColor,
      transparent: true,
      opacity: 0.65,
      depthWrite: false
    });
    const underglow = new THREE.Mesh(underglowGeo, underglowMat);
    underglow.position.y = 0.08;
    chassis.add(underglow);

    // Wheels Rig
    const wFL = this.createWheel(0.36, 0.28);
    wFL.rig.position.set(-0.95, 0.36, 1.25);
    const wFR = this.createWheel(0.36, 0.28);
    wFR.rig.position.set(0.95, 0.36, 1.25);
    const wRL = this.createWheel(0.38, 0.32);
    wRL.rig.position.set(-0.95, 0.38, -1.25);
    const wRR = this.createWheel(0.38, 0.32);
    wRR.rig.position.set(0.95, 0.38, -1.25);

    chassis.add(wFL.rig, wFR.rig, wRL.rig, wRR.rig);

    return {
      root,
      chassis,
      wheelFlSteer: wFL.rig,
      wheelFrSteer: wFR.rig,
      wheelFlSpin: wFL.spinMesh,
      wheelFrSpin: wFR.spinMesh,
      wheelRlSpin: wRL.spinMesh,
      wheelRrSpin: wRR.spinMesh,
      exhaustPipes: [new THREE.Vector3(-0.55, 0.3, -2.1), new THREE.Vector3(0.55, 0.3, -2.1)],
      underglow,
    };
  }

  // --- 2. PLAYER CAR 1: SAKURA R34 DRIFT COUPE ---
  static createDriftCoupe(neonColor = 0xff00bb): VehicleVisualRig {
    const root = new THREE.Group();
    const chassis = new THREE.Group();
    root.add(chassis);

    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x0f2b48, roughness: 0.25, metalness: 0.8 });
    const wideMat = new THREE.MeshStandardMaterial({ color: 0x051322, roughness: 0.3, metalness: 0.6 });

    // Sleek Coupe Body
    const bodyGeo = new THREE.BoxGeometry(1.75, 0.48, 4.1);
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    bodyMesh.position.y = 0.4;
    bodyMesh.castShadow = true;
    chassis.add(bodyMesh);

    // Widebody Fenders
    const fenderGeo = new THREE.BoxGeometry(1.92, 0.35, 1.1);
    const fenderFront = new THREE.Mesh(fenderGeo, wideMat);
    fenderFront.position.set(0, 0.38, 1.25);
    const fenderRear = new THREE.Mesh(fenderGeo, wideMat);
    fenderRear.position.set(0, 0.4, -1.25);
    chassis.add(fenderFront, fenderRear);

    // Cabin
    const cabinMesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.42, 1.9), bodyMat);
    cabinMesh.position.set(0, 0.8, -0.2);
    const glassMesh = new THREE.Mesh(new THREE.BoxGeometry(1.42, 0.38, 1.75), this.glassMat);
    glassMesh.position.set(0, 0.8, -0.2);
    chassis.add(cabinMesh, glassMesh);

    // Big GT Wing
    const wingMesh = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.06, 0.4), this.metalBlack);
    wingMesh.position.set(0, 1.12, -1.85);
    chassis.add(wingMesh);

    // Underglow
    const underglow = new THREE.Mesh(
      new THREE.PlaneGeometry(1.7, 3.8).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: neonColor, transparent: true, opacity: 0.65, depthWrite: false })
    );
    underglow.position.y = 0.08;
    chassis.add(underglow);

    // Wheels
    const wFL = this.createWheel(0.34, 0.28);
    wFL.rig.position.set(-0.95, 0.34, 1.25);
    const wFR = this.createWheel(0.34, 0.28);
    wFR.rig.position.set(0.95, 0.34, 1.25);
    const wRL = this.createWheel(0.35, 0.3);
    wRL.rig.position.set(-0.95, 0.35, -1.25);
    const wRR = this.createWheel(0.35, 0.3);
    wRR.rig.position.set(0.95, 0.35, -1.25);
    chassis.add(wFL.rig, wFR.rig, wRL.rig, wRR.rig);

    return {
      root,
      chassis,
      wheelFlSteer: wFL.rig,
      wheelFrSteer: wFR.rig,
      wheelFlSpin: wFL.spinMesh,
      wheelFrSpin: wFR.spinMesh,
      wheelRlSpin: wRL.spinMesh,
      wheelRrSpin: wRR.spinMesh,
      exhaustPipes: [new THREE.Vector3(-0.6, 0.28, -2.05)],
      underglow,
    };
  }

  // --- 3. PLAYER CAR 2: APOCALYPSE RAID TRUCK ---
  static createRaidTruck(neonColor = 0xff6600): VehicleVisualRig {
    const root = new THREE.Group();
    const chassis = new THREE.Group();
    root.add(chassis);

    const armorMat = new THREE.MeshStandardMaterial({ color: 0x3d352e, roughness: 0.8, metalness: 0.4 });

    // Heavy Truck Body
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 4.4), armorMat);
    bodyMesh.position.y = 0.65;
    bodyMesh.castShadow = true;
    chassis.add(bodyMesh);

    // High Cabin
    const cabinMesh = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.65, 2.0), armorMat);
    cabinMesh.position.set(0, 1.25, 0.2);
    cabinMesh.castShadow = true;
    chassis.add(cabinMesh);

    // Massive Wedge Ram
    const wedgeGeo = new THREE.ConeGeometry(1.4, 1.0, 4);
    wedgeGeo.rotateY(Math.PI / 4);
    wedgeGeo.rotateX(Math.PI / 2);
    const wedgeMesh = new THREE.Mesh(wedgeGeo, this.metalBlack);
    wedgeMesh.position.set(0, 0.55, 2.4);
    chassis.add(wedgeMesh);

    // Big Offroad Wheels
    const wFL = this.createWheel(0.45, 0.36);
    wFL.rig.position.set(-1.1, 0.45, 1.35);
    const wFR = this.createWheel(0.45, 0.36);
    wFR.rig.position.set(1.1, 0.45, 1.35);
    const wRL = this.createWheel(0.45, 0.36);
    wRL.rig.position.set(-1.1, 0.45, -1.35);
    const wRR = this.createWheel(0.45, 0.36);
    wRR.rig.position.set(1.1, 0.45, -1.35);
    chassis.add(wFL.rig, wFR.rig, wRL.rig, wRR.rig);

    const underglow = new THREE.Mesh(
      new THREE.PlaneGeometry(2.0, 4.2).rotateX(-Math.PI / 2),
      new THREE.MeshBasicMaterial({ color: neonColor, transparent: true, opacity: 0.65, depthWrite: false })
    );
    underglow.position.y = 0.08;
    chassis.add(underglow);

    return {
      root,
      chassis,
      wheelFlSteer: wFL.rig,
      wheelFrSteer: wFR.rig,
      wheelFlSpin: wFL.spinMesh,
      wheelFrSpin: wFR.spinMesh,
      wheelRlSpin: wRL.spinMesh,
      wheelRrSpin: wRR.spinMesh,
      exhaustPipes: [new THREE.Vector3(-0.9, 1.6, -1.2), new THREE.Vector3(0.9, 1.6, -1.2)],
      underglow,
    };
  }

  // --- 4. POLICE CRUISER SEDAN ---
  static createPoliceCruiser(): VehicleVisualRig {
    const root = new THREE.Group();
    const chassis = new THREE.Group();
    root.add(chassis);

    // Black & White Body
    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.5, 4.0), this.policeBlack);
    bodyMesh.position.y = 0.42;
    bodyMesh.castShadow = true;
    chassis.add(bodyMesh);

    // White Doors Section
    const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(1.82, 0.46, 1.6), this.policeWhite);
    doorMesh.position.set(0, 0.42, 0);
    chassis.add(doorMesh);

    // Cabin
    const cabinMesh = new THREE.Mesh(new THREE.BoxGeometry(1.45, 0.45, 1.9), this.policeWhite);
    cabinMesh.position.set(0, 0.85, -0.15);
    const glassMesh = new THREE.Mesh(new THREE.BoxGeometry(1.47, 0.4, 1.75), this.glassMat);
    glassMesh.position.set(0, 0.85, -0.15);
    chassis.add(cabinMesh, glassMesh);

    // Push Bar
    const pushBar = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 0.2), this.metalBlack);
    pushBar.position.set(0, 0.45, 2.05);
    chassis.add(pushBar);

    // Siren Lightbar
    const sirenBar = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.1, 0.2), this.metalBlack);
    sirenBar.position.set(0, 1.15, -0.15);
    const sirenRedMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.18), this.sirenRed);
    sirenRedMesh.position.set(-0.25, 1.16, -0.15);
    const sirenBlueMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.12, 0.18), this.sirenBlue);
    sirenBlueMesh.position.set(0.25, 1.16, -0.15);
    chassis.add(sirenBar, sirenRedMesh, sirenBlueMesh);

    // Wheels
    const wFL = this.createWheel(0.34, 0.24);
    wFL.rig.position.set(-0.92, 0.34, 1.2);
    const wFR = this.createWheel(0.34, 0.24);
    wFR.rig.position.set(0.92, 0.34, 1.2);
    const wRL = this.createWheel(0.34, 0.24);
    wRL.rig.position.set(-0.92, 0.34, -1.2);
    const wRR = this.createWheel(0.34, 0.24);
    wRR.rig.position.set(0.92, 0.34, -1.2);
    chassis.add(wFL.rig, wFR.rig, wRL.rig, wRR.rig);

    return {
      root,
      chassis,
      wheelFlSteer: wFL.rig,
      wheelFrSteer: wFR.rig,
      wheelFlSpin: wFL.spinMesh,
      wheelFrSpin: wFR.spinMesh,
      wheelRlSpin: wRL.spinMesh,
      wheelRrSpin: wRR.spinMesh,
      exhaustPipes: [new THREE.Vector3(0.5, 0.25, -2.0)],
      sirenLights: [
        { mesh: sirenRedMesh, red: true },
        { mesh: sirenBlueMesh, red: false }
      ],
    };
  }

  // --- 5. POLICE INTERCEPTOR SPORTS CAR ---
  static createPoliceInterceptor(): VehicleVisualRig {
    const root = new THREE.Group();
    const chassis = new THREE.Group();
    root.add(chassis);

    const intMat = new THREE.MeshStandardMaterial({ color: 0x050810, roughness: 0.2, metalness: 0.8 });

    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(1.85, 0.44, 4.2), intMat);
    bodyMesh.position.y = 0.38;
    bodyMesh.castShadow = true;
    chassis.add(bodyMesh);

    const cabinMesh = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.38, 1.8), intMat);
    cabinMesh.position.set(0, 0.75, -0.2);
    chassis.add(cabinMesh);

    // Slim Siren Lightbar
    const sRed = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.12), this.sirenRed);
    sRed.position.set(-0.25, 0.98, -0.2);
    const sBlue = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.08, 0.12), this.sirenBlue);
    sBlue.position.set(0.25, 0.98, -0.2);
    chassis.add(sRed, sBlue);

    // Wheels
    const wFL = this.createWheel(0.34, 0.26);
    wFL.rig.position.set(-0.95, 0.34, 1.25);
    const wFR = this.createWheel(0.34, 0.26);
    wFR.rig.position.set(0.95, 0.34, 1.25);
    const wRL = this.createWheel(0.34, 0.26);
    wRL.rig.position.set(-0.95, 0.34, -1.25);
    const wRR = this.createWheel(0.34, 0.26);
    wRR.rig.position.set(0.95, 0.34, -1.25);
    chassis.add(wFL.rig, wFR.rig, wRL.rig, wRR.rig);

    return {
      root,
      chassis,
      wheelFlSteer: wFL.rig,
      wheelFrSteer: wFR.rig,
      wheelFlSpin: wFL.spinMesh,
      wheelFrSpin: wFR.spinMesh,
      wheelRlSpin: wRL.spinMesh,
      wheelRrSpin: wRR.spinMesh,
      exhaustPipes: [new THREE.Vector3(-0.6, 0.25, -2.1), new THREE.Vector3(0.6, 0.25, -2.1)],
      sirenLights: [{ mesh: sRed, red: true }, { mesh: sBlue, red: false }]
    };
  }

  // --- 6. POLICE RHINO HEAVY SUV ---
  static createPoliceRhino(): VehicleVisualRig {
    const root = new THREE.Group();
    const chassis = new THREE.Group();
    root.add(chassis);

    const rhinoMat = new THREE.MeshStandardMaterial({ color: 0x1f242c, roughness: 0.6, metalness: 0.5 });

    const bodyMesh = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.9, 4.6), rhinoMat);
    bodyMesh.position.y = 0.75;
    bodyMesh.castShadow = true;
    chassis.add(bodyMesh);

    // Heavy Grille Ram Guard
    const ramBar = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.8, 0.4), this.metalBlack);
    ramBar.position.set(0, 0.65, 2.4);
    chassis.add(ramBar);

    // Siren
    const sRed = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.25), this.sirenRed);
    sRed.position.set(-0.4, 1.3, 0);
    const sBlue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.15, 0.25), this.sirenBlue);
    sBlue.position.set(0.4, 1.3, 0);
    chassis.add(sRed, sBlue);

    // Big Wheels
    const wFL = this.createWheel(0.48, 0.38);
    wFL.rig.position.set(-1.2, 0.48, 1.4);
    const wFR = this.createWheel(0.48, 0.38);
    wFR.rig.position.set(1.2, 0.48, 1.4);
    const wRL = this.createWheel(0.48, 0.38);
    wRL.rig.position.set(-1.2, 0.48, -1.4);
    const wRR = this.createWheel(0.48, 0.38);
    wRR.rig.position.set(1.2, 0.48, -1.4);
    chassis.add(wFL.rig, wFR.rig, wRL.rig, wRR.rig);

    return {
      root,
      chassis,
      wheelFlSteer: wFL.rig,
      wheelFrSteer: wFR.rig,
      wheelFlSpin: wFL.spinMesh,
      wheelFrSpin: wFR.spinMesh,
      wheelRlSpin: wRL.spinMesh,
      wheelRrSpin: wRR.spinMesh,
      exhaustPipes: [new THREE.Vector3(-0.8, 0.4, -2.3), new THREE.Vector3(0.8, 0.4, -2.3)],
      sirenLights: [{ mesh: sRed, red: true }, { mesh: sBlue, red: false }]
    };
  }

  // --- 7. POLICE HELICOPTER ---
  static createHelicopter(): { root: THREE.Group; mainRotor: THREE.Mesh; tailRotor: THREE.Mesh; spotlight: THREE.SpotLight } {
    const root = new THREE.Group();
    const heliMat = new THREE.MeshStandardMaterial({ color: 0x111622, roughness: 0.4, metalness: 0.6 });

    // Fuselage
    const fuseMesh = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.6, 4.2), heliMat);
    fuseMesh.castShadow = true;
    root.add(fuseMesh);

    // Cockpit Glass
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 1.4), this.glassMat);
    glass.position.set(0, 0.1, 1.6);
    root.add(glass);

    // Tail Boom
    const tailMesh = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 3.8), heliMat);
    tailMesh.position.set(0, 0.3, -3.2);
    root.add(tailMesh);

    // Main Rotor Blades
    const rotorGeo = new THREE.BoxGeometry(6.4, 0.05, 0.3);
    const mainRotor = new THREE.Mesh(rotorGeo, this.metalBlack);
    mainRotor.position.set(0, 1.0, 0.2);
    root.add(mainRotor);

    // Tail Rotor
    const tailRotorGeo = new THREE.BoxGeometry(0.05, 1.2, 0.15);
    const tailRotor = new THREE.Mesh(tailRotorGeo, this.metalBlack);
    tailRotor.position.set(0.3, 0.4, -5.0);
    root.add(tailRotor);

    // Searchlight
    const spotlight = new THREE.SpotLight(0x00f0ff, 80, 50, Math.PI / 6, 0.4, 1.0);
    spotlight.position.set(0, -0.8, 1.2);
    spotlight.target.position.set(0, -20, 0);
    root.add(spotlight);
    root.add(spotlight.target);

    return { root, mainRotor, tailRotor, spotlight };
  }

  // --- 8. PURSUIT BREAKER 1: GIANT NEON BILLBOARD ---
  static createBillboardBreaker(): { root: THREE.Group; trusses: THREE.Mesh[]; board: THREE.Mesh } {
    const root = new THREE.Group();
    const trussMat = new THREE.MeshStandardMaterial({ color: 0x888888, metalness: 0.8, roughness: 0.3 });

    // 2 Support Trusses
    const truss1 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7.5, 0.4), trussMat);
    truss1.position.set(-3.5, 3.75, 0);
    truss1.castShadow = true;

    const truss2 = new THREE.Mesh(new THREE.BoxGeometry(0.4, 7.5, 0.4), trussMat);
    truss2.position.set(3.5, 3.75, 0);
    truss2.castShadow = true;

    root.add(truss1, truss2);

    // Huge Neon Billboard Top
    const boardMat = new THREE.MeshStandardMaterial({
      color: 0x111111,
      emissive: 0xff0055,
      emissiveIntensity: 0.7,
      roughness: 0.2
    });
    const board = new THREE.Mesh(new THREE.BoxGeometry(10.0, 3.5, 0.5), boardMat);
    board.position.set(0, 7.5, 0);
    board.castShadow = true;
    root.add(board);

    return { root, trusses: [truss1, truss2], board };
  }

  // --- 9. PURSUIT BREAKER 2: GAS STATION CANOPY ---
  static createGasStationBreaker(): { root: THREE.Group; pillars: THREE.Mesh[]; canopy: THREE.Mesh } {
    const root = new THREE.Group();
    const pillarMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.5, roughness: 0.4 });
    const canopyMat = new THREE.MeshStandardMaterial({ color: 0xff6600, emissive: 0xff4400, emissiveIntensity: 0.4, roughness: 0.3 });

    const pillars: THREE.Mesh[] = [];
    const coords = [
      [-4, -3], [4, -3],
      [-4, 3], [4, 3]
    ];

    coords.forEach(([x, z]) => {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6.0, 0.5), pillarMat);
      p.position.set(x, 3.0, z);
      p.castShadow = true;
      root.add(p);
      pillars.push(p);
    });

    const canopy = new THREE.Mesh(new THREE.BoxGeometry(11.0, 0.8, 9.0), canopyMat);
    canopy.position.set(0, 6.4, 0);
    canopy.castShadow = true;
    root.add(canopy);

    return { root, pillars, canopy };
  }

  // --- 10. PURSUIT BREAKER 3: WATER TOWER ---
  static createWaterTowerBreaker(): { root: THREE.Group; legs: THREE.Mesh[]; tank: THREE.Mesh } {
    const root = new THREE.Group();
    const legMat = new THREE.MeshStandardMaterial({ color: 0x5a4d41, roughness: 0.9 });
    const tankMat = new THREE.MeshStandardMaterial({ color: 0x334455, metalness: 0.7, roughness: 0.4 });

    const legs: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
      const angle = (i / 4) * Math.PI * 2 + Math.PI / 4;
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 8.0), legMat);
      leg.position.set(Math.cos(angle) * 2.8, 4.0, Math.sin(angle) * 2.8);
      leg.castShadow = true;
      root.add(leg);
      legs.push(leg);
    }

    const tank = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.2, 4.0, 16), tankMat);
    tank.position.set(0, 9.5, 0);
    tank.castShadow = true;
    root.add(tank);

    return { root, legs, tank };
  }
}
