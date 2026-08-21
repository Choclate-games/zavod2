import * as THREE from 'three';
import { TrafficCarType } from '../types';

export class ProceduralModels {
  private readonly tireMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    roughness: 0.90,
    metalness: 0.10,
  });

  private readonly rimMat = new THREE.MeshStandardMaterial({
    color: 0xdddddd,
    roughness: 0.20,
    metalness: 0.90,
  });

  private readonly glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x101015,
    roughness: 0.05,
    transmission: 0.85,
    ior: 1.50,
    transparent: true,
    opacity: 0.85,
  });

  private readonly carbonMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a1a,
    roughness: 0.50,
    metalness: 0.30,
  });

  private readonly headlightMat = new THREE.MeshBasicMaterial({
    color: 0xffffee,
  });

  private readonly taillightMat = new THREE.MeshBasicMaterial({
    color: 0xff0033,
  });

  createWheel(): THREE.Group {
    const wg = new THREE.Group();

    // Nested rim group for spin rotation
    const spinGroup = new THREE.Group();

    // Tire rubber
    const tireGeo = new THREE.CylinderGeometry(0.36, 0.36, 0.28, 16, 1);
    const tireMesh = new THREE.Mesh(tireGeo, this.tireMat);
    tireMesh.rotation.z = Math.PI / 2;
    spinGroup.add(tireMesh);

    // Rim metal
    const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.29, 12, 1);
    const rimMesh = new THREE.Mesh(rimGeo, this.rimMat);
    rimMesh.rotation.z = Math.PI / 2;
    spinGroup.add(rimMesh);

    // Central cap
    const capGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.3, 8);
    const capMesh = new THREE.Mesh(capGeo, this.carbonMat);
    capMesh.rotation.z = Math.PI / 2;
    spinGroup.add(capMesh);

    wg.add(spinGroup);
    return wg;
  }

  createPlayerCarBody(type: 'hatch' | 'coupe' | 'muscle' | 'super' | 'gtr' | 'hyper', bodyColor: string, neonColor: string): THREE.Group {
    const carGroup = new THREE.Group();

    const paintMat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(bodyColor),
      roughness: 0.20,
      metalness: 0.85,
    });

    let mainMesh: THREE.Mesh;
    let roofMesh: THREE.Mesh;

    switch (type) {
      case 'hatch': {
        const baseGeo = new THREE.BoxGeometry(1.7, 0.45, 3.8);
        mainMesh = new THREE.Mesh(baseGeo, paintMat);
        mainMesh.position.y = 0.35;

        const roofGeo = new THREE.BoxGeometry(1.45, 0.40, 2.2);
        roofMesh = new THREE.Mesh(roofGeo, this.glassMat);
        roofMesh.position.set(0, 0.75, -0.2);

        const wingGeo = new THREE.BoxGeometry(1.5, 0.05, 0.35);
        const wing = new THREE.Mesh(wingGeo, this.carbonMat);
        wing.position.set(0, 0.98, -1.3);
        carGroup.add(wing);
        break;
      }

      case 'coupe': {
        const baseGeo = new THREE.BoxGeometry(1.75, 0.40, 4.1);
        mainMesh = new THREE.Mesh(baseGeo, paintMat);
        mainMesh.position.y = 0.33;

        const roofGeo = new THREE.BoxGeometry(1.40, 0.38, 1.9);
        roofMesh = new THREE.Mesh(roofGeo, this.glassMat);
        roofMesh.position.set(0, 0.70, -0.1);

        const wingGeo = new THREE.BoxGeometry(1.65, 0.05, 0.35);
        const wing = new THREE.Mesh(wingGeo, this.carbonMat);
        wing.position.set(0, 0.85, -1.85);
        carGroup.add(wing);
        break;
      }

      case 'muscle': {
        const baseGeo = new THREE.BoxGeometry(1.83, 0.48, 4.3);
        mainMesh = new THREE.Mesh(baseGeo, paintMat);
        mainMesh.position.y = 0.38;

        const roofGeo = new THREE.BoxGeometry(1.50, 0.42, 2.0);
        roofMesh = new THREE.Mesh(roofGeo, this.glassMat);
        roofMesh.position.set(0, 0.80, -0.1);

        const scoopGeo = new THREE.BoxGeometry(0.55, 0.15, 0.7);
        const scoop = new THREE.Mesh(scoopGeo, this.carbonMat);
        scoop.position.set(0, 0.65, 1.2);
        carGroup.add(scoop);
        break;
      }

      case 'super': {
        const baseGeo = new THREE.BoxGeometry(1.85, 0.35, 4.2);
        mainMesh = new THREE.Mesh(baseGeo, paintMat);
        mainMesh.position.y = 0.30;

        const roofGeo = new THREE.BoxGeometry(1.40, 0.30, 1.8);
        roofMesh = new THREE.Mesh(roofGeo, this.glassMat);
        roofMesh.position.set(0, 0.60, -0.2);
        break;
      }

      case 'gtr': {
        const baseGeo = new THREE.BoxGeometry(1.88, 0.42, 4.25);
        mainMesh = new THREE.Mesh(baseGeo, paintMat);
        mainMesh.position.y = 0.35;

        const roofGeo = new THREE.BoxGeometry(1.45, 0.36, 2.0);
        roofMesh = new THREE.Mesh(roofGeo, this.glassMat);
        roofMesh.position.set(0, 0.70, -0.1);

        const wingGeo = new THREE.BoxGeometry(1.75, 0.05, 0.40);
        const wing = new THREE.Mesh(wingGeo, this.carbonMat);
        wing.position.set(0, 0.92, -1.90);
        carGroup.add(wing);
        break;
      }

      case 'hyper':
      default: {
        const baseGeo = new THREE.BoxGeometry(1.90, 0.30, 4.4);
        mainMesh = new THREE.Mesh(baseGeo, paintMat);
        mainMesh.position.y = 0.28;

        const roofGeo = new THREE.BoxGeometry(1.35, 0.30, 2.0);
        roofMesh = new THREE.Mesh(roofGeo, this.glassMat);
        roofMesh.position.set(0, 0.55, -0.1);

        const finGeo = new THREE.BoxGeometry(0.04, 0.35, 1.2);
        const fin = new THREE.Mesh(finGeo, this.carbonMat);
        fin.position.set(0, 0.75, -0.9);
        carGroup.add(fin);
        break;
      }
    }

    carGroup.add(mainMesh);
    carGroup.add(roofMesh);

    const hlMeshL = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.10, 0.05), this.headlightMat);
    hlMeshL.position.set(-0.65, 0.35, 2.05);
    carGroup.add(hlMeshL);

    const hlMeshR = new THREE.Mesh(new THREE.BoxGeometry(0.30, 0.10, 0.05), this.headlightMat);
    hlMeshR.position.set(0.65, 0.35, 2.05);
    carGroup.add(hlMeshR);

    const tlMesh = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.08, 0.05), this.taillightMat);
    tlMesh.position.set(0, 0.45, -2.05);
    carGroup.add(tlMesh);

    const neonMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(neonColor) });
    const neonBottom = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.6), neonMat);
    neonBottom.rotation.x = Math.PI / 2;
    neonBottom.position.y = 0.05;
    carGroup.add(neonBottom);

    return carGroup;
  }

  createTrafficVehicle(type: TrafficCarType): THREE.Group {
    const vehicleGroup = new THREE.Group();

    if (type === 'truck') {
      const cabMat = new THREE.MeshStandardMaterial({ color: 0x1a3a7a, roughness: 0.30, metalness: 0.70 });
      const trailerMat = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, roughness: 0.40, metalness: 0.50 });

      const cabGeo = new THREE.BoxGeometry(2.4, 2.2, 3.0);
      const cabMesh = new THREE.Mesh(cabGeo, cabMat);
      cabMesh.position.set(0, 1.3, 3.0);
      vehicleGroup.add(cabMesh);

      const windshieldGeo = new THREE.BoxGeometry(2.1, 0.7, 0.1);
      const wsMesh = new THREE.Mesh(windshieldGeo, this.glassMat);
      wsMesh.position.set(0, 1.8, 4.51);
      vehicleGroup.add(wsMesh);

      const trailerGeo = new THREE.BoxGeometry(2.6, 3.0, 9.5);
      const trailerMesh = new THREE.Mesh(trailerGeo, trailerMat);
      trailerMesh.position.set(0, 1.9, -3.2);
      vehicleGroup.add(trailerMesh);

      const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.1), this.headlightMat);
      hlL.position.set(-0.9, 0.6, 4.52);
      vehicleGroup.add(hlL);

      const hlR = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, 0.1), this.headlightMat);
      hlR.position.set(0.9, 0.6, 4.52);
      vehicleGroup.add(hlR);

      const tl = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.25, 0.1), this.taillightMat);
      tl.position.set(0, 0.7, -7.96);
      vehicleGroup.add(tl);

      for (const z of [-6.5, -5.5, 2.8, 4.2]) {
        for (const x of [-1.2, 1.2]) {
          const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.30, 8), this.tireMat);
          w.rotation.z = Math.PI / 2;
          w.position.set(x, 0.45, z);
          vehicleGroup.add(w);
        }
      }
    } else {
      let color = 0x3a5a8a;
      if (type === 'taxi') color = 0xffaa00;
      if (type === 'muscle') color = 0x8a0a0a;
      if (type === 'sedan') color = 0x2a2a2a;

      const bodyMat = new THREE.MeshStandardMaterial({ color, roughness: 0.25, metalness: 0.75 });
      const baseGeo = new THREE.BoxGeometry(1.75, 0.45, 4.0);
      const baseMesh = new THREE.Mesh(baseGeo, bodyMat);
      baseMesh.position.y = 0.35;
      vehicleGroup.add(baseMesh);

      const cabinGeo = new THREE.BoxGeometry(1.45, 0.40, 2.0);
      const cabinMesh = new THREE.Mesh(cabinGeo, this.glassMat);
      cabinMesh.position.set(0, 0.75, -0.1);
      vehicleGroup.add(cabinMesh);

      if (type === 'taxi') {
        const taxiSignGeo = new THREE.BoxGeometry(0.5, 0.15, 0.3);
        const taxiSign = new THREE.Mesh(taxiSignGeo, this.headlightMat);
        taxiSign.position.set(0, 1.02, -0.1);
        vehicleGroup.add(taxiSign);
      }

      const hlL = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.1), this.headlightMat);
      hlL.position.set(-0.65, 0.35, 2.01);
      vehicleGroup.add(hlL);

      const hlR = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.12, 0.1), this.headlightMat);
      hlR.position.set(0.65, 0.35, 2.01);
      vehicleGroup.add(hlR);

      const tlL = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.1), this.taillightMat);
      tlL.position.set(-0.65, 0.40, -2.01);
      vehicleGroup.add(tlL);

      const tlR = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.12, 0.1), this.taillightMat);
      tlR.position.set(0.65, 0.40, -2.01);
      vehicleGroup.add(tlR);

      for (const z of [-1.3, 1.3]) {
        for (const x of [-0.85, 0.85]) {
          const w = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.22, 8), this.tireMat);
          w.rotation.z = Math.PI / 2;
          w.position.set(x, 0.34, z);
          vehicleGroup.add(w);
        }
      }
    }

    return vehicleGroup;
  }

  createCheckpointArch(label = 'CHECKPOINT'): THREE.Group {
    const archGroup = new THREE.Group();

    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x1a1a1a,
      roughness: 0.50,
      metalness: 0.75,
    });

    const neonMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
    });

    const pillarL = new THREE.Mesh(new THREE.BoxGeometry(1.0, 9.0, 1.0), pillarMat);
    pillarL.position.set(-8.5, 4.5, 0);
    archGroup.add(pillarL);

    const pillarR = new THREE.Mesh(new THREE.BoxGeometry(1.0, 9.0, 1.0), pillarMat);
    pillarR.position.set(8.5, 4.5, 0);
    archGroup.add(pillarR);

    const beam = new THREE.Mesh(new THREE.BoxGeometry(18.0, 1.5, 1.2), pillarMat);
    beam.position.set(0, 8.5, 0);
    archGroup.add(beam);

    const neonBanner = new THREE.Mesh(new THREE.PlaneGeometry(16.0, 1.0), neonMat);
    neonBanner.position.set(0, 8.5, 0.61);
    archGroup.add(neonBanner);

    const laserMat = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
      transparent: true,
      opacity: 0.35,
    });
    const laserGate = new THREE.Mesh(new THREE.PlaneGeometry(16.0, 8.0), laserMat);
    laserGate.position.set(0, 4.0, 0);
    archGroup.add(laserGate);

    return archGroup;
  }
}

export const proceduralModels = new ProceduralModels();
