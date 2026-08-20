import * as THREE from 'three';
import { VEHICLES } from '../core/Constants';

export interface VehicleMeshResult {
  root: THREE.Group;
  chassis: THREE.Group;
  /** Подвеска: колёса живут здесь, а не в кузове, чтобы не наклоняться вместе с ним. */
  wheelRoot: THREE.Group;
  frontLeftWheel: THREE.Group;
  frontRightWheel: THREE.Group;
  rearLeftWheel: THREE.Group;
  rearRightWheel: THREE.Group;
  allWheels: THREE.Group[];
  /** Внутренние группы вращения колёс — только их крутит анимация качения. */
  allWheelSpins: THREE.Group[];
  exhaustPoints: THREE.Vector3[];
  weaponMountRoof: THREE.Group;
  weaponMountLeft: THREE.Group;
  weaponMountRight: THREE.Group;
  bumperMesh: THREE.Mesh;

  // Динамическое освещение машины
  headlightSpot: THREE.SpotLight;
  headlightBeams: THREE.Mesh[];
  headlightMeshes: THREE.Mesh[];
  taillightMeshes: THREE.Mesh[];
  taillightMat: THREE.MeshStandardMaterial;
  brakeLight: THREE.PointLight;
  nitroLight: THREE.PointLight;
}

export class VehicleBuilder {
  public static buildVehicle(vehicleId: string): VehicleMeshResult {
    const config = VEHICLES[vehicleId] || VEHICLES.iron_fang;

    const root = new THREE.Group();
    const chassis = new THREE.Group();
    root.add(chassis);

    const wheelRoot = new THREE.Group();
    root.add(wheelRoot);

    const allWheels: THREE.Group[] = [];
    const allWheelSpins: THREE.Group[] = [];
    const exhaustPoints: THREE.Vector3[] = [];
    const headlightMeshes: THREE.Mesh[] = [];
    const taillightMeshes: THREE.Mesh[] = [];
    const headlightBeams: THREE.Mesh[] = [];

    // Materials
    const bodyMat = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.32,
      metalness: 0.78,
    });

    const accentMat = new THREE.MeshStandardMaterial({
      color: config.accentColor,
      roughness: 0.22,
      metalness: 0.88,
    });

    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x181818,
      roughness: 0.45,
      metalness: 0.85,
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xeeeeee,
      roughness: 0.08,
      metalness: 0.96,
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x14202c,
      roughness: 0.1,
      metalness: 0.9,
    });

    // Pure Neutral White Headlight Materials (No artificial yellow or color tint)
    const headlightLensMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 2.8,
      roughness: 0.1,
    });

    const taillightMat = new THREE.MeshStandardMaterial({
      color: 0xcc0000,
      emissive: 0xaa0000,
      emissiveIntensity: 1.0,
      roughness: 0.2,
    });

    const redGlowMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
    const tireMat = new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.9, metalness: 0.1 });

    // Volumetric Beam Material (Neutral White Headlight Beams)
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.055,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const createWheel = (radius = 0.45, width = 0.35, side: -1 | 1 = 1, isSpiked = true) => {
      const wheelGroup = new THREE.Group();
      const spinGroup = new THREE.Group();
      wheelGroup.add(spinGroup);

      const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 20), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      spinGroup.add(tire);

      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.62, radius * 0.62, width * 0.96, 12),
        accentMat
      );
      rim.rotation.z = Math.PI / 2;
      spinGroup.add(rim);

      for (let i = 0; i < 4; i++) {
        const spoke = new THREE.Mesh(
          new THREE.BoxGeometry(width * 0.5, radius * 1.15, 0.05),
          darkMetalMat
        );
        spoke.rotation.x = (i * Math.PI) / 4;
        spinGroup.add(spoke);
      }

      if (isSpiked) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.25, 6), chromeMat);
        spike.position.set(side * (width * 0.5 + 0.1), 0, 0);
        spike.rotation.z = -side * (Math.PI / 2);
        spinGroup.add(spike);
      }

      allWheelSpins.push(spinGroup);
      return wheelGroup;
    };

    // Forward SpotLight (Pure white dynamic road illumination)
    const headlightSpot = new THREE.SpotLight(0xffffff, 2.4, 34, Math.PI / 4.2, 0.6, 1.2);
    headlightSpot.position.set(0, 0.6, 1.5);
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, 0.2, 18);
    chassis.add(headlightSpot);
    chassis.add(spotTarget);
    headlightSpot.target = spotTarget;

    // Brake / Reverse Point Light
    const brakeLight = new THREE.PointLight(0xff1122, 0.1, 8.0, 1.5);
    brakeLight.position.set(0, 0.6, -1.8);
    chassis.add(brakeLight);

    // Nitro Exhaust Glow Light
    const nitroLight = new THREE.PointLight(0x00f0ff, 0.0, 10.0, 1.6);
    nitroLight.position.set(0, 0.4, -1.6);
    chassis.add(nitroLight);

    // Helper: Build volumetric headlight beams
    const addHeadlightBeams = (spreadX: number, heightY: number, frontZ: number) => {
      const beamLength = 16.0;
      [-spreadX, spreadX].forEach((x) => {
        const beamGeo = new THREE.ConeGeometry(1.6, beamLength, 12, 1, true);
        beamGeo.translate(0, -beamLength / 2, 0);
        // -Math.PI / 2 поворачивает основание конуса вдоль оси +Z (вперед перед машиной)
        beamGeo.rotateX(-Math.PI / 2);

        const beam = new THREE.Mesh(beamGeo, beamMat);
        beam.position.set(x, heightY, frontZ);
        chassis.add(beam);
        headlightBeams.push(beam);
      });
    };

    // Weapon mount placeholders
    const weaponMountRoof = new THREE.Group();
    weaponMountRoof.position.set(0, 1.25, -0.2);
    chassis.add(weaponMountRoof);

    const weaponMountLeft = new THREE.Group();
    weaponMountLeft.position.set(-1.1, 0.4, 0);
    chassis.add(weaponMountLeft);

    const weaponMountRight = new THREE.Group();
    weaponMountRight.position.set(1.1, 0.4, 0);
    chassis.add(weaponMountRight);

    let frontLeftWheel: THREE.Group;
    let frontRightWheel: THREE.Group;
    let rearLeftWheel: THREE.Group;
    let rearRightWheel: THREE.Group;
    let bumperMesh: THREE.Mesh;

    if (vehicleId === 'dune_reaper') {
      // DUNE REAPER (Buggy)
      const mainBodyGeo = new THREE.BoxGeometry(1.4, 0.4, 2.8);
      const mainBody = new THREE.Mesh(mainBodyGeo, bodyMat);
      mainBody.position.set(0, 0.45, 0);
      mainBody.castShadow = true;
      chassis.add(mainBody);

      const rollCageGeo = new THREE.BoxGeometry(1.3, 0.7, 1.8);
      const rollCage = new THREE.Mesh(rollCageGeo, accentMat);
      rollCage.position.set(0, 0.85, -0.1);
      rollCage.castShadow = true;
      chassis.add(rollCage);

      // Bull Bar
      const bGeo = new THREE.BoxGeometry(1.6, 0.4, 0.3);
      bumperMesh = new THREE.Mesh(bGeo, darkMetalMat);
      bumperMesh.position.set(0, 0.35, 1.5);
      bumperMesh.castShadow = true;
      chassis.add(bumperMesh);

      for (let s = -0.6; s <= 0.6; s += 0.4) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.4, 6), chromeMat);
        spike.position.set(s, 0.35, 1.7);
        spike.rotation.x = Math.PI / 2;
        chassis.add(spike);
      }

      // Headlights & Beams
      const hlGeo = new THREE.BoxGeometry(0.24, 0.2, 0.08);
      const hlL = new THREE.Mesh(hlGeo, headlightLensMat);
      hlL.position.set(-0.45, 0.55, 1.45);
      const hlR = new THREE.Mesh(hlGeo, headlightLensMat);
      hlR.position.set(0.45, 0.55, 1.45);
      chassis.add(hlL, hlR);
      headlightMeshes.push(hlL, hlR);
      addHeadlightBeams(0.45, 0.55, 1.48);

      // Taillights
      const tlGeo = new THREE.BoxGeometry(0.2, 0.15, 0.06);
      const tlL = new THREE.Mesh(tlGeo, taillightMat);
      tlL.position.set(-0.45, 0.6, -1.45);
      const tlR = new THREE.Mesh(tlGeo, taillightMat);
      tlR.position.set(0.45, 0.6, -1.45);
      chassis.add(tlL, tlR);
      taillightMeshes.push(tlL, tlR);

      // Wheels
      const wRad = 0.5;
      const wWid = 0.4;
      frontLeftWheel = createWheel(wRad, wWid, -1);
      frontRightWheel = createWheel(wRad, wWid, 1);
      rearLeftWheel = createWheel(wRad, wWid, -1);
      rearRightWheel = createWheel(wRad, wWid, 1);

      const track = 0.86;
      frontLeftWheel.position.set(-track, wRad, 1.1);
      frontRightWheel.position.set(track, wRad, 1.1);
      rearLeftWheel.position.set(-track, wRad, -1.1);
      rearRightWheel.position.set(track, wRad, -1.1);

      exhaustPoints.push(new THREE.Vector3(-0.4, 0.6, -1.45));
      exhaustPoints.push(new THREE.Vector3(0.4, 0.6, -1.45));
    } else if (vehicleId === 'war_titan') {
      // WAR TITAN (Heavy 6-Wheeler Truck)
      const truckBodyGeo = new THREE.BoxGeometry(1.9, 0.8, 3.8);
      const truckBody = new THREE.Mesh(truckBodyGeo, bodyMat);
      truckBody.position.set(0, 0.7, 0);
      truckBody.castShadow = true;
      chassis.add(truckBody);

      const cabinGeo = new THREE.BoxGeometry(1.8, 0.8, 1.6);
      const cabin = new THREE.Mesh(cabinGeo, accentMat);
      cabin.position.set(0, 1.3, 0.5);
      cabin.castShadow = true;
      chassis.add(cabin);

      const plowGeo = new THREE.ConeGeometry(1.2, 0.9, 4);
      bumperMesh = new THREE.Mesh(plowGeo, darkMetalMat);
      bumperMesh.position.set(0, 0.5, 2.2);
      bumperMesh.rotation.x = -Math.PI / 2;
      bumperMesh.rotation.y = Math.PI / 4;
      bumperMesh.castShadow = true;
      chassis.add(bumperMesh);

      // Headlights & Beams
      const hlGeo = new THREE.BoxGeometry(0.35, 0.22, 0.08);
      const hlL = new THREE.Mesh(hlGeo, headlightLensMat);
      hlL.position.set(-0.7, 0.85, 1.92);
      const hlR = new THREE.Mesh(hlGeo, headlightLensMat);
      hlR.position.set(0.7, 0.85, 1.92);
      chassis.add(hlL, hlR);
      headlightMeshes.push(hlL, hlR);
      addHeadlightBeams(0.7, 0.85, 1.95);

      // Taillights
      const tlGeo = new THREE.BoxGeometry(0.3, 0.18, 0.06);
      const tlL = new THREE.Mesh(tlGeo, taillightMat);
      tlL.position.set(-0.75, 0.7, -1.92);
      const tlR = new THREE.Mesh(tlGeo, taillightMat);
      tlR.position.set(0.75, 0.7, -1.92);
      chassis.add(tlL, tlR);
      taillightMeshes.push(tlL, tlR);

      // Wheels (6 wheels)
      const wRad = 0.55;
      const wWid = 0.45;
      frontLeftWheel = createWheel(wRad, wWid, -1);
      frontRightWheel = createWheel(wRad, wWid, 1);
      rearLeftWheel = createWheel(wRad, wWid, -1);
      rearRightWheel = createWheel(wRad, wWid, 1);

      const midLeftWheel = createWheel(wRad, wWid, -1);
      const midRightWheel = createWheel(wRad, wWid, 1);

      const track = 1.05;
      frontLeftWheel.position.set(-track, wRad, 1.3);
      frontRightWheel.position.set(track, wRad, 1.3);
      midLeftWheel.position.set(-track, wRad, -0.4);
      midRightWheel.position.set(track, wRad, -0.4);
      rearLeftWheel.position.set(-track, wRad, -1.4);
      rearRightWheel.position.set(track, wRad, -1.4);

      wheelRoot.add(midLeftWheel);
      wheelRoot.add(midRightWheel);
      allWheels.push(midLeftWheel, midRightWheel);

      exhaustPoints.push(new THREE.Vector3(-0.9, 1.8, -0.8));
      exhaustPoints.push(new THREE.Vector3(0.9, 1.8, -0.8));
    } else {
      // IRON FANG (Armored Muscle Car)
      const lowerBodyGeo = new THREE.BoxGeometry(1.7, 0.5, 3.4);
      const lowerBody = new THREE.Mesh(lowerBodyGeo, bodyMat);
      lowerBody.position.set(0, 0.45, 0);
      lowerBody.castShadow = true;
      chassis.add(lowerBody);

      const cabinGeo = new THREE.BoxGeometry(1.4, 0.5, 1.6);
      const cabin = new THREE.Mesh(cabinGeo, accentMat);
      cabin.position.set(0, 0.85, -0.2);
      cabin.castShadow = true;
      chassis.add(cabin);

      const winGeo = new THREE.BoxGeometry(1.3, 0.4, 1.7);
      const win = new THREE.Mesh(winGeo, glassMat);
      win.position.set(0, 0.85, -0.2);
      chassis.add(win);

      // Blower
      const blowerGeo = new THREE.BoxGeometry(0.6, 0.35, 0.7);
      const blower = new THREE.Mesh(blowerGeo, chromeMat);
      blower.position.set(0, 0.8, 0.9);
      blower.castShadow = true;
      chassis.add(blower);

      for (let bi = -0.15; bi <= 0.15; bi += 0.15) {
        const intake = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.1, 8), redGlowMat);
        intake.position.set(bi, 0.95, 1.15);
        intake.rotation.x = Math.PI / 2;
        chassis.add(intake);
      }

      // Bull-Bar
      const bGeo = new THREE.BoxGeometry(1.8, 0.5, 0.4);
      bumperMesh = new THREE.Mesh(bGeo, darkMetalMat);
      bumperMesh.position.set(0, 0.4, 1.8);
      bumperMesh.castShadow = true;
      chassis.add(bumperMesh);

      for (let si = -0.7; si <= 0.7; si += 0.35) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.5, 6), chromeMat);
        spike.position.set(si, 0.4, 2.05);
        spike.rotation.x = Math.PI / 2;
        chassis.add(spike);
      }

      // Spoiler
      const spoilerWingGeo = new THREE.BoxGeometry(1.7, 0.08, 0.4);
      const spoilerWing = new THREE.Mesh(spoilerWingGeo, accentMat);
      spoilerWing.position.set(0, 1.05, -1.6);
      chassis.add(spoilerWing);

      const spoilerPostGeo = new THREE.BoxGeometry(0.08, 0.35, 0.1);
      const postL = new THREE.Mesh(spoilerPostGeo, darkMetalMat);
      postL.position.set(-0.65, 0.88, -1.6);
      const postR = new THREE.Mesh(spoilerPostGeo, darkMetalMat);
      postR.position.set(0.65, 0.88, -1.6);
      chassis.add(postL, postR);

      // Headlights & Beams
      const hlGeo = new THREE.BoxGeometry(0.3, 0.15, 0.06);
      const hlL = new THREE.Mesh(hlGeo, headlightLensMat);
      hlL.position.set(-0.6, 0.5, 1.72);
      const hlR = new THREE.Mesh(hlGeo, headlightLensMat);
      hlR.position.set(0.6, 0.5, 1.72);
      chassis.add(hlL, hlR);
      headlightMeshes.push(hlL, hlR);
      addHeadlightBeams(0.6, 0.5, 1.74);

      // Taillights
      const tlL = new THREE.Mesh(hlGeo, taillightMat);
      tlL.position.set(-0.6, 0.5, -1.72);
      const tlR = new THREE.Mesh(hlGeo, taillightMat);
      tlR.position.set(0.6, 0.5, -1.72);
      chassis.add(tlL, tlR);
      taillightMeshes.push(tlL, tlR);

      // Wheels
      const wRad = 0.45;
      const wWid = 0.35;
      frontLeftWheel = createWheel(wRad, wWid, -1);
      frontRightWheel = createWheel(wRad, wWid, 1);
      rearLeftWheel = createWheel(wRad, wWid, -1);
      rearRightWheel = createWheel(wRad, wWid, 1);

      const track = 0.82;
      frontLeftWheel.position.set(-track, wRad, 1.1);
      frontRightWheel.position.set(track, wRad, 1.1);
      rearLeftWheel.position.set(-track, wRad, -1.1);
      rearRightWheel.position.set(track, wRad, -1.1);

      exhaustPoints.push(new THREE.Vector3(-0.55, 0.35, -1.75));
      exhaustPoints.push(new THREE.Vector3(0.55, 0.35, -1.75));
    }

    wheelRoot.add(frontLeftWheel);
    wheelRoot.add(frontRightWheel);
    wheelRoot.add(rearLeftWheel);
    wheelRoot.add(rearRightWheel);

    allWheels.push(frontLeftWheel, frontRightWheel, rearLeftWheel, rearRightWheel);

    return {
      root,
      chassis,
      wheelRoot,
      frontLeftWheel,
      frontRightWheel,
      rearLeftWheel,
      rearRightWheel,
      allWheels,
      allWheelSpins,
      exhaustPoints,
      weaponMountRoof,
      weaponMountLeft,
      weaponMountRight,
      bumperMesh,
      headlightSpot,
      headlightBeams,
      headlightMeshes,
      taillightMeshes,
      taillightMat,
      brakeLight,
      nitroLight,
    };
  }
}
