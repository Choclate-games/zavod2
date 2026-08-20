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

    // Enhanced PBR Materials
    const bodyMat = new THREE.MeshStandardMaterial({
      color: config.color,
      roughness: 0.28,
      metalness: 0.82,
    });

    const accentMat = new THREE.MeshStandardMaterial({
      color: config.accentColor,
      roughness: 0.2,
      metalness: 0.9,
    });

    const darkMetalMat = new THREE.MeshStandardMaterial({
      color: 0x181818,
      roughness: 0.42,
      metalness: 0.88,
    });

    const steelPlateMat = new THREE.MeshStandardMaterial({
      color: 0x2b2d42,
      roughness: 0.35,
      metalness: 0.8,
    });

    const chromeMat = new THREE.MeshStandardMaterial({
      color: 0xf0f0f0,
      roughness: 0.06,
      metalness: 0.98,
    });

    const goldMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      roughness: 0.25,
      metalness: 0.9,
    });

    const glassMat = new THREE.MeshStandardMaterial({
      color: 0x0f1923,
      roughness: 0.08,
      metalness: 0.92,
    });

    const brakeCaliperMat = new THREE.MeshStandardMaterial({
      color: 0xd90429,
      roughness: 0.3,
      metalness: 0.6,
    });

    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x141414,
      roughness: 0.92,
      metalness: 0.08,
    });

    const redGlowMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
    const amberGlowMat = new THREE.MeshBasicMaterial({ color: 0xff9f1c });

    // Pure Neutral White Headlight Materials
    const headlightLensMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: 0xffffff,
      emissiveIntensity: 2.8,
      roughness: 0.08,
    });

    const taillightMat = new THREE.MeshStandardMaterial({
      color: 0xd90429,
      emissive: 0xbb0022,
      emissiveIntensity: 1.2,
      roughness: 0.15,
    });

    // Volumetric Beam Material
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.055,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    // Advanced Wheel Builder with brake rotors, calipers, deep-dish rims and beadlocks
    const createWheel = (radius = 0.45, width = 0.36, side: -1 | 1 = 1, isSpiked = true, rimColor = accentMat) => {
      const wheelGroup = new THREE.Group();
      const spinGroup = new THREE.Group();
      wheelGroup.add(spinGroup);

      // 1. Tire Rubber with tread profile
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 24), tireMat);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      spinGroup.add(tire);

      // Tread blocks around tire circumference
      const treadCount = 12;
      for (let t = 0; t < treadCount; t++) {
        const angle = (t / treadCount) * Math.PI * 2;
        const treadBlock = new THREE.Mesh(
          new THREE.BoxGeometry(width * 0.9, 0.04, radius * 0.28),
          darkMetalMat
        );
        treadBlock.position.set(0, Math.cos(angle) * (radius + 0.01), Math.sin(angle) * (radius + 0.01));
        treadBlock.rotation.x = angle;
        spinGroup.add(treadBlock);
      }

      // 2. Deep-dish Rim Ring
      const rim = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.65, radius * 0.65, width * 0.98, 16),
        rimColor
      );
      rim.rotation.z = Math.PI / 2;
      spinGroup.add(rim);

      // 3. Brake Rotor & Red Caliper (Inside Wheel)
      const rotor = new THREE.Mesh(
        new THREE.CylinderGeometry(radius * 0.48, radius * 0.48, 0.04, 16),
        chromeMat
      );
      rotor.rotation.z = Math.PI / 2;
      rotor.position.set(-side * 0.05, 0, 0);
      spinGroup.add(rotor);

      const caliper = new THREE.Mesh(new THREE.BoxGeometry(0.08, radius * 0.35, 0.12), brakeCaliperMat);
      caliper.position.set(-side * 0.05, radius * 0.3, 0);
      wheelGroup.add(caliper);

      // 4. Rim Spokes (6-spoke turbine design)
      for (let i = 0; i < 6; i++) {
        const spoke = new THREE.Mesh(
          new THREE.BoxGeometry(width * 0.6, radius * 1.18, 0.06),
          darkMetalMat
        );
        spoke.position.set(side * 0.02, 0, 0);
        spoke.rotation.x = (i * Math.PI) / 6;
        spinGroup.add(spoke);
      }

      // 5. Beadlock Ring Bolts
      for (let b = 0; b < 8; b++) {
        const boltAngle = (b / 8) * Math.PI * 2;
        const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.03, 6), goldMat);
        bolt.rotation.z = Math.PI / 2;
        bolt.position.set(
          side * (width * 0.5 + 0.01),
          Math.cos(boltAngle) * (radius * 0.58),
          Math.sin(boltAngle) * (radius * 0.58)
        );
        spinGroup.add(bolt);
      }

      // 6. Chrome Axle Hub Spike
      if (isSpiked) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.28, 8), chromeMat);
        spike.position.set(side * (width * 0.5 + 0.14), 0, 0);
        spike.rotation.z = -side * (Math.PI / 2);
        spinGroup.add(spike);
      }

      allWheelSpins.push(spinGroup);
      return wheelGroup;
    };

    // Forward SpotLight (Pure white dynamic road illumination)
    const headlightSpot = new THREE.SpotLight(0xffffff, 2.5, 36, Math.PI / 4.0, 0.6, 1.2);
    headlightSpot.position.set(0, 0.6, 1.6);
    const spotTarget = new THREE.Object3D();
    spotTarget.position.set(0, 0.2, 20);
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
    weaponMountLeft.position.set(-1.15, 0.45, 0);
    chassis.add(weaponMountLeft);

    const weaponMountRight = new THREE.Group();
    weaponMountRight.position.set(1.15, 0.45, 0);
    chassis.add(weaponMountRight);

    let frontLeftWheel: THREE.Group;
    let frontRightWheel: THREE.Group;
    let rearLeftWheel: THREE.Group;
    let rearRightWheel: THREE.Group;
    let bumperMesh: THREE.Mesh;

    if (vehicleId === 'dune_reaper') {
      // ═════════════════════════════════════════════════════════════════════════
      // DUNE REAPER (High-Speed Baja Drift Buggy)
      // ═════════════════════════════════════════════════════════════════════════
      // 1. Lower Tapered Tubular Chassis
      const mainBodyGeo = new THREE.BoxGeometry(1.35, 0.38, 2.9);
      const mainBody = new THREE.Mesh(mainBodyGeo, bodyMat);
      mainBody.position.set(0, 0.48, 0);
      mainBody.castShadow = true;
      chassis.add(mainBody);

      // Aluminum Skid Plate underneath
      const skidPlate = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 2.8), chromeMat);
      skidPlate.position.set(0, 0.28, 0);
      chassis.add(skidPlate);

      // 2. Tubular Exo-Cage (Upper Buggy Frame)
      const rollCageGeo = new THREE.BoxGeometry(1.25, 0.68, 1.7);
      const rollCage = new THREE.Mesh(rollCageGeo, accentMat);
      rollCage.position.set(0, 0.95, -0.15);
      rollCage.castShadow = true;
      chassis.add(rollCage);

      // Cross-Brace Tubular Struts
      const tubeMat = darkMetalMat;
      const strutL = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8), tubeMat);
      strutL.position.set(-0.6, 0.95, -0.15);
      strutL.rotation.z = 0.2;
      const strutR = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 8), tubeMat);
      strutR.position.set(0.6, 0.95, -0.15);
      strutR.rotation.z = -0.2;
      chassis.add(strutL, strutR);

      // 3. Roof-Mounted Quad Rally Fog Lights Pod
      for (let fl = -0.42; fl <= 0.42; fl += 0.28) {
        const fogLightHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.12, 10), darkMetalMat);
        fogLightHousing.rotation.x = Math.PI / 2;
        fogLightHousing.position.set(fl, 1.34, 0.4);
        const fogLightLens = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 10), headlightLensMat);
        fogLightLens.rotation.x = Math.PI / 2;
        fogLightLens.position.set(fl, 1.34, 0.47);
        chassis.add(fogLightHousing, fogLightLens);
      }

      // 4. Exposed Rear Engine Bay with Turbocharger & Conical Filter
      const engineBlock = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.7), darkMetalMat);
      engineBlock.position.set(0, 0.65, -1.1);
      chassis.add(engineBlock);

      const turboHousing = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.06, 8, 12), chromeMat);
      turboHousing.position.set(0.25, 0.85, -1.25);
      const airFilter = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.3, 8), redGlowMat);
      airFilter.rotation.z = Math.PI / 2;
      airFilter.position.set(-0.25, 0.85, -1.25);
      chassis.add(turboHousing, airFilter);

      // Spare Tire mounted on rear cage with X-Strap
      const spareTire = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.25, 16), tireMat);
      spareTire.rotation.x = 0.6;
      spareTire.position.set(0, 0.95, -1.3);
      const strap1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.9), goldMat);
      strap1.rotation.x = 0.6;
      strap1.position.set(0, 1.08, -1.3);
      chassis.add(spareTire, strap1);

      // 5. Heavy Tubular Front Bumper with Razor Stinger
      const bGeo = new THREE.BoxGeometry(1.65, 0.38, 0.35);
      bumperMesh = new THREE.Mesh(bGeo, darkMetalMat);
      bumperMesh.position.set(0, 0.38, 1.55);
      bumperMesh.castShadow = true;
      chassis.add(bumperMesh);

      // Front Razor Stinger & Spikes
      for (let s = -0.65; s <= 0.65; s += 0.325) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.45, 6), chromeMat);
        spike.position.set(s, 0.38, 1.78);
        spike.rotation.x = Math.PI / 2;
        chassis.add(spike);
      }

      // Side Nerf Bars / Rock Sliders
      const nerfL = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8), darkMetalMat);
      nerfL.rotation.x = Math.PI / 2;
      nerfL.position.set(-0.85, 0.38, 0);
      const nerfR = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 8), darkMetalMat);
      nerfR.rotation.x = Math.PI / 2;
      nerfR.position.set(0.85, 0.38, 0);
      chassis.add(nerfL, nerfR);

      // Headlights & Beams
      const hlGeo = new THREE.BoxGeometry(0.24, 0.2, 0.08);
      const hlL = new THREE.Mesh(hlGeo, headlightLensMat);
      hlL.position.set(-0.48, 0.58, 1.52);
      const hlR = new THREE.Mesh(hlGeo, headlightLensMat);
      hlR.position.set(0.48, 0.58, 1.52);
      chassis.add(hlL, hlR);
      headlightMeshes.push(hlL, hlR);
      addHeadlightBeams(0.48, 0.58, 1.55);

      // Taillights
      const tlGeo = new THREE.BoxGeometry(0.22, 0.16, 0.06);
      const tlL = new THREE.Mesh(tlGeo, taillightMat);
      tlL.position.set(-0.48, 0.65, -1.5);
      const tlR = new THREE.Mesh(tlGeo, taillightMat);
      tlR.position.set(0.48, 0.65, -1.5);
      chassis.add(tlL, tlR);
      taillightMeshes.push(tlL, tlR);

      // Wheels
      const wRad = 0.52;
      const wWid = 0.42;
      frontLeftWheel = createWheel(wRad, wWid, -1, true, accentMat);
      frontRightWheel = createWheel(wRad, wWid, 1, true, accentMat);
      rearLeftWheel = createWheel(wRad, wWid, -1, true, accentMat);
      rearRightWheel = createWheel(wRad, wWid, 1, true, accentMat);

      const track = 0.92;
      frontLeftWheel.position.set(-track, wRad, 1.15);
      frontRightWheel.position.set(track, wRad, 1.15);
      rearLeftWheel.position.set(-track, wRad, -1.15);
      rearRightWheel.position.set(track, wRad, -1.15);

      // Dual High-Mount Angled Exhaust Stingers
      const stingerL = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 8), darkMetalMat);
      stingerL.position.set(-0.35, 0.85, -1.5);
      stingerL.rotation.x = -0.4;
      const stingerR = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.7, 8), darkMetalMat);
      stingerR.position.set(0.35, 0.85, -1.5);
      stingerR.rotation.x = -0.4;
      chassis.add(stingerL, stingerR);

      exhaustPoints.push(new THREE.Vector3(-0.35, 0.95, -1.75));
      exhaustPoints.push(new THREE.Vector3(0.35, 0.95, -1.75));
    } else if (vehicleId === 'war_titan') {
      // ═════════════════════════════════════════════════════════════════════════
      // WAR TITAN (Heavy 6-Wheeler Post-Apocalyptic Battle Fortress)
      // ═════════════════════════════════════════════════════════════════════════
      // 1. Armored Heavy Frame & Diamond-Plate Flatbed
      const truckBodyGeo = new THREE.BoxGeometry(2.0, 0.85, 4.2);
      const truckBody = new THREE.Mesh(truckBodyGeo, bodyMat);
      truckBody.position.set(0, 0.78, 0);
      truckBody.castShadow = true;
      chassis.add(truckBody);

      // Armored Flatbed Cargo Side Walls
      const bedWallL = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 2.2), steelPlateMat);
      bedWallL.position.set(-0.95, 1.2, -0.9);
      const bedWallR = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.6, 2.2), steelPlateMat);
      bedWallR.position.set(0.95, 1.2, -0.9);
      const bedBack = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 0.12), steelPlateMat);
      bedBack.position.set(0, 1.2, -1.95);
      chassis.add(bedWallL, bedWallR, bedBack);

      // 2. Fortified Cab with Armored Vision Slits
      const cabinGeo = new THREE.BoxGeometry(1.9, 0.95, 1.7);
      const cabin = new THREE.Mesh(cabinGeo, accentMat);
      cabin.position.set(0, 1.45, 0.65);
      cabin.castShadow = true;
      chassis.add(cabin);

      // Vision Slit Armor Visor
      const visorGeo = new THREE.BoxGeometry(1.7, 0.25, 0.15);
      const visor = new THREE.Mesh(visorGeo, darkMetalMat);
      visor.position.set(0, 1.6, 1.52);
      const slitGlass = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 0.05), glassMat);
      slitGlass.position.set(0, 1.58, 1.58);
      chassis.add(visor, slitGlass);

      // Heavy Roof Turret Ring Armor
      const turretRing = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.7, 0.2, 16), darkMetalMat);
      turretRing.position.set(0, 1.95, 0.5);
      chassis.add(turretRing);

      // 3. Colossal Wedge Cowcatcher Ramming Plow
      const plowGeo = new THREE.ConeGeometry(1.35, 1.1, 4);
      bumperMesh = new THREE.Mesh(plowGeo, darkMetalMat);
      bumperMesh.position.set(0, 0.55, 2.4);
      bumperMesh.rotation.x = -Math.PI / 2;
      bumperMesh.rotation.y = Math.PI / 4;
      bumperMesh.castShadow = true;
      chassis.add(bumperMesh);

      // Heavy Plow Cutting Blades & Spikes
      for (let pz = -0.8; pz <= 0.8; pz += 0.4) {
        const bladeSpike = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.35, 0.6), chromeMat);
        bladeSpike.position.set(pz, 0.5, 2.6);
        chassis.add(bladeSpike);
      }

      // 4. Dual Vertical Exhaust Stacks behind Cab with Rain Flappers
      const stackGeo = new THREE.CylinderGeometry(0.1, 0.1, 1.4, 10);
      const stackL = new THREE.Mesh(stackGeo, chromeMat);
      stackL.position.set(-0.95, 2.0, -0.25);
      const stackR = new THREE.Mesh(stackGeo, chromeMat);
      stackR.position.set(0.95, 2.0, -0.25);
      const capL = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.16), darkMetalMat);
      capL.position.set(-0.95, 2.72, -0.25);
      capL.rotation.z = 0.25;
      const capR = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.04, 0.16), darkMetalMat);
      capR.position.set(0.95, 2.72, -0.25);
      capR.rotation.z = -0.25;
      chassis.add(stackL, stackR, capL, capR);

      // 5. Side Diesel Fuel Tanks with Steel Cages
      const tankGeo = new THREE.CylinderGeometry(0.28, 0.28, 1.4, 12);
      const tankL = new THREE.Mesh(tankGeo, darkMetalMat);
      tankL.rotation.x = Math.PI / 2;
      tankL.position.set(-1.08, 0.65, 0.4);
      const tankR = new THREE.Mesh(tankGeo, darkMetalMat);
      tankR.rotation.x = Math.PI / 2;
      tankR.position.set(1.08, 0.65, 0.4);
      chassis.add(tankL, tankR);

      // Headlights & Beams
      const hlGeo = new THREE.BoxGeometry(0.38, 0.25, 0.08);
      const hlL = new THREE.Mesh(hlGeo, headlightLensMat);
      hlL.position.set(-0.75, 0.92, 2.12);
      const hlR = new THREE.Mesh(hlGeo, headlightLensMat);
      hlR.position.set(0.75, 0.92, 2.12);
      chassis.add(hlL, hlR);
      headlightMeshes.push(hlL, hlR);
      addHeadlightBeams(0.75, 0.92, 2.15);

      // Taillights
      const tlGeo = new THREE.BoxGeometry(0.32, 0.2, 0.06);
      const tlL = new THREE.Mesh(tlGeo, taillightMat);
      tlL.position.set(-0.85, 0.8, -2.12);
      const tlR = new THREE.Mesh(tlGeo, taillightMat);
      tlR.position.set(0.85, 0.8, -2.12);
      chassis.add(tlL, tlR);
      taillightMeshes.push(tlL, tlR);

      // 6 Wheels (Heavy Dual Rear Axles)
      const wRad = 0.58;
      const wWid = 0.48;
      frontLeftWheel = createWheel(wRad, wWid, -1, true, goldMat);
      frontRightWheel = createWheel(wRad, wWid, 1, true, goldMat);
      rearLeftWheel = createWheel(wRad, wWid, -1, true, goldMat);
      rearRightWheel = createWheel(wRad, wWid, 1, true, goldMat);

      const midLeftWheel = createWheel(wRad, wWid, -1, true, goldMat);
      const midRightWheel = createWheel(wRad, wWid, 1, true, goldMat);

      const track = 1.15;
      frontLeftWheel.position.set(-track, wRad, 1.45);
      frontRightWheel.position.set(track, wRad, 1.45);
      midLeftWheel.position.set(-track, wRad, -0.45);
      midRightWheel.position.set(track, wRad, -0.45);
      rearLeftWheel.position.set(-track, wRad, -1.55);
      rearRightWheel.position.set(track, wRad, -1.55);

      wheelRoot.add(midLeftWheel);
      wheelRoot.add(midRightWheel);
      allWheels.push(midLeftWheel, midRightWheel);

      exhaustPoints.push(new THREE.Vector3(-0.95, 2.75, -0.25));
      exhaustPoints.push(new THREE.Vector3(0.95, 2.75, -0.25));
    } else {
      // ═════════════════════════════════════════════════════════════════════════
      // IRON FANG (Armored V8 Supercharged Muscle Car)
      // ═════════════════════════════════════════════════════════════════════════
      // 1. Aggressive Sculpted Wide-body Chassis
      const lowerBodyGeo = new THREE.BoxGeometry(1.8, 0.52, 3.6);
      const lowerBody = new THREE.Mesh(lowerBodyGeo, bodyMat);
      lowerBody.position.set(0, 0.48, 0);
      lowerBody.castShadow = true;
      chassis.add(lowerBody);

      // Flared Wide-Body Wheel Arches
      const archFrontL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.45, 1.1), accentMat);
      archFrontL.position.set(-0.95, 0.52, 1.1);
      const archFrontR = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.45, 1.1), accentMat);
      archFrontR.position.set(0.95, 0.52, 1.1);
      const archRearL = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.48, 1.2), accentMat);
      archRearL.position.set(-0.96, 0.55, -1.1);
      const archRearR = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.48, 1.2), accentMat);
      archRearR.position.set(0.96, 0.55, -1.1);
      chassis.add(archFrontL, archFrontR, archRearL, archRearR);

      // 2. Fastback Cabin with Armored Slit Windows
      const cabinGeo = new THREE.BoxGeometry(1.45, 0.55, 1.7);
      const cabin = new THREE.Mesh(cabinGeo, accentMat);
      cabin.position.set(0, 0.92, -0.2);
      cabin.castShadow = true;
      chassis.add(cabin);

      const winGeo = new THREE.BoxGeometry(1.36, 0.45, 1.76);
      const win = new THREE.Mesh(winGeo, glassMat);
      win.position.set(0, 0.92, -0.2);
      chassis.add(win);

      // Steel Armored Window Louvers / Slits on Rear Window
      for (let lv = -0.5; lv <= 0.3; lv += 0.2) {
        const louver = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.14), darkMetalMat);
        louver.rotation.x = -0.5;
        louver.position.set(0, 0.98 + lv * 0.4, -0.85 + lv * 0.4);
        chassis.add(louver);
      }

      // 3. Massive Exposed V8 Engine Blower with Red Butterfly Valves
      const blowerGeo = new THREE.BoxGeometry(0.65, 0.38, 0.8);
      const blower = new THREE.Mesh(blowerGeo, chromeMat);
      blower.position.set(0, 0.88, 0.95);
      blower.castShadow = true;
      chassis.add(blower);

      // Supercharger Pulley belt on front of engine
      const pulley = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.08, 12), darkMetalMat);
      pulley.rotation.x = Math.PI / 2;
      pulley.position.set(0, 0.88, 1.38);
      chassis.add(pulley);

      for (let bi = -0.16; bi <= 0.16; bi += 0.16) {
        const intake = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.12, 10), redGlowMat);
        intake.position.set(bi, 1.05, 1.25);
        intake.rotation.x = Math.PI / 2;
        chassis.add(intake);
      }

      // 4. Heavy Heavy-Duty Bull-Bar Ram with Steel Teeth
      const bGeo = new THREE.BoxGeometry(1.9, 0.52, 0.45);
      bumperMesh = new THREE.Mesh(bGeo, darkMetalMat);
      bumperMesh.position.set(0, 0.42, 1.9);
      bumperMesh.castShadow = true;
      chassis.add(bumperMesh);

      // Aggressive Jagged Chrome Spikes
      for (let si = -0.75; si <= 0.75; si += 0.375) {
        const spike = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.55, 8), chromeMat);
        spike.position.set(si, 0.42, 2.18);
        spike.rotation.x = Math.PI / 2;
        chassis.add(spike);
      }

      // 5. Heavy Racing Ducktail Spoiler with Steel Struts
      const spoilerWingGeo = new THREE.BoxGeometry(1.85, 0.1, 0.45);
      const spoilerWing = new THREE.Mesh(spoilerWingGeo, accentMat);
      spoilerWing.position.set(0, 1.15, -1.7);
      chassis.add(spoilerWing);

      const spoilerPostGeo = new THREE.BoxGeometry(0.08, 0.42, 0.12);
      const postL = new THREE.Mesh(spoilerPostGeo, darkMetalMat);
      postL.position.set(-0.7, 0.95, -1.7);
      const postR = new THREE.Mesh(spoilerPostGeo, darkMetalMat);
      postR.position.set(0.7, 0.95, -1.7);
      chassis.add(postL, postR);

      // Rear Diffuser with vertical fins
      for (let f = -0.5; f <= 0.5; f += 0.25) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.2, 0.5), darkMetalMat);
        fin.position.set(f, 0.32, -1.75);
        chassis.add(fin);
      }

      // Headlights & Beams
      const hlGeo = new THREE.BoxGeometry(0.32, 0.16, 0.06);
      const hlL = new THREE.Mesh(hlGeo, headlightLensMat);
      hlL.position.set(-0.65, 0.55, 1.82);
      const hlR = new THREE.Mesh(hlGeo, headlightLensMat);
      hlR.position.set(0.65, 0.55, 1.82);
      chassis.add(hlL, hlR);
      headlightMeshes.push(hlL, hlR);
      addHeadlightBeams(0.65, 0.55, 1.85);

      // Taillights
      const tlL = new THREE.Mesh(hlGeo, taillightMat);
      tlL.position.set(-0.65, 0.55, -1.82);
      const tlR = new THREE.Mesh(hlGeo, taillightMat);
      tlR.position.set(0.65, 0.55, -1.82);
      chassis.add(tlL, tlR);
      taillightMeshes.push(tlL, tlR);

      // Wheels
      const wRad = 0.48;
      const wWid = 0.38;
      frontLeftWheel = createWheel(wRad, wWid, -1, true, chromeMat);
      frontRightWheel = createWheel(wRad, wWid, 1, true, chromeMat);
      rearLeftWheel = createWheel(wRad, wWid, -1, true, chromeMat);
      rearRightWheel = createWheel(wRad, wWid, 1, true, chromeMat);

      const track = 0.88;
      frontLeftWheel.position.set(-track, wRad, 1.15);
      frontRightWheel.position.set(track, wRad, 1.15);
      rearLeftWheel.position.set(-track, wRad, -1.15);
      rearRightWheel.position.set(track, wRad, -1.15);

      // Dual Twin Side-Exit Chrome Exhaust Tips
      const exTip1 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 10), chromeMat);
      exTip1.rotation.z = Math.PI / 2;
      exTip1.position.set(-0.95, 0.35, -0.4);
      const exTip2 = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 10), chromeMat);
      exTip2.rotation.z = -Math.PI / 2;
      exTip2.position.set(0.95, 0.35, -0.4);
      chassis.add(exTip1, exTip2);

      exhaustPoints.push(new THREE.Vector3(-0.6, 0.35, -1.85));
      exhaustPoints.push(new THREE.Vector3(0.6, 0.35, -1.85));
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
