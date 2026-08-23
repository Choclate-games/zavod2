import * as THREE from 'three';
import { NEON_COLORS } from '../core/Constants';

export interface VehicleVisuals {
  group: THREE.Group;
  chassisMesh: THREE.Group;
  wheelMeshes: THREE.Mesh[];
  headlights: THREE.SpotLight[];
  taillights: THREE.Mesh[];
  underglowLight: THREE.PointLight;
  exhaustPositions: THREE.Vector3[];
  setUnderglowColor: (neonIndex: number) => void;
  setBraking: (isBraking: boolean) => void;
}

export class VehicleBuilder {
  static buildCar(
    primaryColor: number = 0x0055ff,
    neonColorIndex: number = 0,
    isPlayer: boolean = true
  ): VehicleVisuals {
    const root = new THREE.Group();
    const chassis = new THREE.Group();
    root.add(chassis);

    // 1. Paint & Material definitions
    const bodyMat = new THREE.MeshStandardMaterial({
      color: primaryColor,
      metalness: 0.35,
      roughness: 0.22,
    });

    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x181a20,
      metalness: 0.2,
      roughness: 0.4,
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0a101d,
      metalness: 0.8,
      roughness: 0.1,
      transparent: true,
      opacity: 0.85,
    });

    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xd0d8e0,
      metalness: 0.4,
      roughness: 0.3,
    });

    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1e,
      roughness: 0.85,
      metalness: 0.05,
    });

    const neonDef = NEON_COLORS[neonColorIndex % NEON_COLORS.length] || NEON_COLORS[0];
    const neonMat = new THREE.MeshBasicMaterial({
      color: neonDef.threeHex,
    });

    const headlightMat = new THREE.MeshBasicMaterial({
      color: 0xeef5ff,
    });

    const taillightOffMat = new THREE.MeshStandardMaterial({
      color: 0x550000,
      roughness: 0.5,
    });

    const taillightOnMat = new THREE.MeshBasicMaterial({
      color: 0xff0022,
    });

    // 2. Chassis Main Body
    const lowerBodyGeo = new THREE.BoxGeometry(1.82, 0.42, 4.2);
    const lowerBody = new THREE.Mesh(lowerBodyGeo, bodyMat);
    lowerBody.position.set(0, 0.38, 0);
    lowerBody.castShadow = true;
    lowerBody.receiveShadow = true;
    chassis.add(lowerBody);

    // Front Bumper / Splitter
    const splitterGeo = new THREE.BoxGeometry(1.86, 0.1, 0.6);
    const splitter = new THREE.Mesh(splitterGeo, carbonMat);
    splitter.position.set(0, 0.18, 2.1);
    chassis.add(splitter);

    // Rear Diffuser
    const diffuserGeo = new THREE.BoxGeometry(1.84, 0.16, 0.5);
    const diffuser = new THREE.Mesh(diffuserGeo, carbonMat);
    diffuser.position.set(0, 0.22, -2.1);
    chassis.add(diffuser);

    // Cabin / Roof
    const cabinGeo = new THREE.BoxGeometry(1.46, 0.48, 2.1);
    const cabin = new THREE.Mesh(cabinGeo, bodyMat);
    cabin.position.set(0, 0.78, -0.2);
    chassis.add(cabin);

    // Windshield (Front Glass)
    const frontGlassGeo = new THREE.PlaneGeometry(1.42, 0.54);
    const frontGlass = new THREE.Mesh(frontGlassGeo, glassMat);
    frontGlass.position.set(0, 0.76, 0.88);
    frontGlass.rotation.x = -Math.PI / 4;
    chassis.add(frontGlass);

    // Rear Glass
    const rearGlassGeo = new THREE.PlaneGeometry(1.42, 0.48);
    const rearGlass = new THREE.Mesh(rearGlassGeo, glassMat);
    rearGlass.position.set(0, 0.76, -1.28);
    rearGlass.rotation.x = Math.PI / 4;
    rearGlass.rotation.y = Math.PI;
    chassis.add(rearGlass);

    // Side Windows
    const sideGlassL = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.36), glassMat);
    sideGlassL.position.set(-0.74, 0.78, -0.2);
    sideGlassL.rotation.y = -Math.PI / 2;
    chassis.add(sideGlassL);

    const sideGlassR = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.36), glassMat);
    sideGlassR.position.set(0.74, 0.78, -0.2);
    sideGlassR.rotation.y = Math.PI / 2;
    chassis.add(sideGlassR);

    // Carbon Hood Scoop
    const hoodGeo = new THREE.BoxGeometry(1.0, 0.08, 1.4);
    const hood = new THREE.Mesh(hoodGeo, carbonMat);
    hood.position.set(0, 0.59, 1.0);
    chassis.add(hood);

    // Rear GT Wing (Spoiler)
    const wingBoardGeo = new THREE.BoxGeometry(1.72, 0.06, 0.38);
    const wingBoard = new THREE.Mesh(wingBoardGeo, carbonMat);
    wingBoard.position.set(0, 1.08, -1.95);
    chassis.add(wingBoard);

    const wingPillarL = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.12), carbonMat);
    wingPillarL.position.set(-0.55, 0.88, -1.95);
    chassis.add(wingPillarL);

    const wingPillarR = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.35, 0.12), carbonMat);
    wingPillarR.position.set(0.55, 0.88, -1.95);
    chassis.add(wingPillarR);

    // Headlights
    const hlMeshL = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.08), headlightMat);
    hlMeshL.position.set(-0.62, 0.44, 2.11);
    chassis.add(hlMeshL);

    const hlMeshR = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.12, 0.08), headlightMat);
    hlMeshR.position.set(0.62, 0.44, 2.11);
    chassis.add(hlMeshR);

    const headlights: THREE.SpotLight[] = [];
    if (isPlayer) {
      const spotL = new THREE.SpotLight(0xddeeff, 2.5, 60, Math.PI / 6, 0.3, 1.2);
      spotL.position.set(-0.62, 0.44, 2.11);
      spotL.target.position.set(-0.62, 0.1, 20);
      chassis.add(spotL);
      chassis.add(spotL.target);
      headlights.push(spotL);

      const spotR = new THREE.SpotLight(0xddeeff, 2.5, 60, Math.PI / 6, 0.3, 1.2);
      spotR.position.set(0.62, 0.44, 2.11);
      spotR.target.position.set(0.62, 0.1, 20);
      chassis.add(spotR);
      chassis.add(spotR.target);
      headlights.push(spotR);
    }

    // Taillights
    const tlMeshL = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.08), taillightOffMat);
    tlMeshL.position.set(-0.62, 0.46, -2.11);
    chassis.add(tlMeshL);

    const tlMeshR = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.12, 0.08), taillightOffMat);
    tlMeshR.position.set(0.62, 0.46, -2.11);
    chassis.add(tlMeshR);
    const taillights = [tlMeshL, tlMeshR];

    // Underglow Neon Tube & Point Light
    const underglowTubeGeo = new THREE.BoxGeometry(1.6, 0.04, 3.2);
    const underglowTube = new THREE.Mesh(underglowTubeGeo, neonMat);
    underglowTube.position.set(0, 0.12, 0);
    chassis.add(underglowTube);

    const underglowLight = new THREE.PointLight(neonDef.threeHex, 3.0, 5.0, 1.8);
    underglowLight.position.set(0, 0.08, 0);
    chassis.add(underglowLight);

    // Exhaust Pipes
    const exhaustGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.2, 12);
    exhaustGeo.rotateX(Math.PI / 2);
    const pipeL = new THREE.Mesh(exhaustGeo, carbonMat);
    pipeL.position.set(-0.35, 0.22, -2.12);
    chassis.add(pipeL);

    const pipeR = new THREE.Mesh(exhaustGeo, carbonMat);
    pipeR.position.set(0.35, 0.22, -2.12);
    chassis.add(pipeR);

    const exhaustPositions = [
      new THREE.Vector3(-0.35, 0.22, -2.25),
      new THREE.Vector3(0.35, 0.22, -2.25),
    ];

    // 3. Wheels (4 units)
    const wheelMeshes: THREE.Mesh[] = [];
    const wheelOffsets = [
      new THREE.Vector3(-0.92, 0.32, 1.35),  // Front Left
      new THREE.Vector3(0.92, 0.32, 1.35),   // Front Right
      new THREE.Vector3(-0.92, 0.32, -1.35), // Rear Left
      new THREE.Vector3(0.92, 0.32, -1.35),  // Rear Right
    ];

    const wheelGeo = new THREE.CylinderGeometry(0.34, 0.34, 0.26, 16);
    wheelGeo.rotateZ(Math.PI / 2);

    wheelOffsets.forEach((offset, idx) => {
      const wheelGroup = new THREE.Group();
      wheelGroup.position.copy(offset);

      const tire = new THREE.Mesh(wheelGeo, tireMat);
      tire.castShadow = true;
      wheelGroup.add(tire);

      const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.27, 12);
      rimGeo.rotateZ(Math.PI / 2);
      const rim = new THREE.Mesh(rimGeo, rimMat);
      wheelGroup.add(rim);

      root.add(wheelGroup);
      wheelMeshes.push(tire);
    });

    const setUnderglowColor = (colorIdx: number) => {
      const c = NEON_COLORS[colorIdx % NEON_COLORS.length] || NEON_COLORS[0];
      neonMat.color.setHex(c.threeHex);
      underglowLight.color.setHex(c.threeHex);
    };

    const setBraking = (isBraking: boolean) => {
      taillights.forEach((tl) => {
        (tl as any).material = isBraking ? taillightOnMat : taillightOffMat;
      });
    };

    return {
      group: root,
      chassisMesh: chassis,
      wheelMeshes,
      headlights,
      taillights,
      underglowLight,
      exhaustPositions,
      setUnderglowColor,
      setBraking,
    };
  }
}
