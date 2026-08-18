// src/rendering/ProceduralModels.ts
import * as THREE from 'three';

export interface ChickenRig {
  root: THREE.Group;
  body: THREE.Mesh;
  comb: THREE.Mesh;
  leftWing: THREE.Mesh;
  rightWing: THREE.Mesh;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  tail: THREE.Mesh;
  boxMesh: THREE.Group;
}

export interface DogRig {
  root: THREE.Group;
  body: THREE.Mesh;
  head: THREE.Group;
  snout: THREE.Mesh;
  leftEar: THREE.Mesh;
  rightEar: THREE.Mesh;
  frontLeftLeg: THREE.Group;
  frontRightLeg: THREE.Group;
  backLeftLeg: THREE.Group;
  backRightLeg: THREE.Group;
  tail: THREE.Mesh;
  alertBillboard: THREE.Group;
  alertIcon: THREE.Mesh;
  suspiciousIcon: THREE.Mesh;
}

export class ProceduralModels {
  // --- CHICKEN AGENT ---
  public static createChicken(skinId: string = 'classic', boxSkinId: string = 'cardboard'): ChickenRig {
    const root = new THREE.Group();
    root.name = 'Chicken';

    // Body Colors per skin
    let bodyColor = 0xffffff;
    let combColor = 0xe74c3c;
    let beakColor = 0xf39c12;
    let isMetallic = false;

    if (skinId === 'ninja') {
      bodyColor = 0x1e272e;
      combColor = 0xc0392b;
    } else if (skinId === 'agent007') {
      bodyColor = 0x2d3436;
      combColor = 0xd63031;
    } else if (skinId === 'cyberpunk') {
      bodyColor = 0x7f8c8d;
      combColor = 0x00d2d3;
      isMetallic = true;
    } else if (skinId === 'golden') {
      bodyColor = 0xf1c40f;
      combColor = 0xf39c12;
      isMetallic = true;
    }

    const bodyMat = new THREE.MeshStandardMaterial({
      color: bodyColor,
      roughness: isMetallic ? 0.3 : 0.8,
      metalness: isMetallic ? 0.8 : 0.1
    });

    const combMat = new THREE.MeshStandardMaterial({
      color: combColor,
      roughness: 0.5
    });

    const beakMat = new THREE.MeshStandardMaterial({
      color: beakColor,
      roughness: 0.6
    });

    const eyeWhiteMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const eyePupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

    // Main Body Sphere
    const bodyGeom = new THREE.SphereGeometry(0.38, 14, 12);
    bodyGeom.scale(1.0, 1.15, 1.05);
    const body = new THREE.Mesh(bodyGeom, bodyMat);
    body.position.y = 0.45;
    body.castShadow = true;
    root.add(body);

    // Head / Chest details
    if (skinId === 'agent007') {
      // White shirt triangle
      const shirtGeom = new THREE.ConeGeometry(0.16, 0.28, 4);
      const shirtMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const shirt = new THREE.Mesh(shirtGeom, shirtMat);
      shirt.position.set(0, 0.02, 0.32);
      shirt.rotation.x = 0.3;
      body.add(shirt);

      // Red bow tie
      const bowGeom = new THREE.BoxGeometry(0.12, 0.05, 0.04);
      const bow = new THREE.Mesh(bowGeom, combMat);
      bow.position.set(0, 0.12, 0.35);
      body.add(bow);

      // Sunglasses
      const glassesGeom = new THREE.BoxGeometry(0.26, 0.08, 0.06);
      const glassesMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
      const glasses = new THREE.Mesh(glassesGeom, glassesMat);
      glasses.position.set(0, 0.22, 0.34);
      body.add(glasses);
    } else if (skinId === 'ninja') {
      // Red headband
      const bandGeom = new THREE.CylinderGeometry(0.34, 0.34, 0.07, 12);
      const bandMat = new THREE.MeshBasicMaterial({ color: 0xc0392b });
      const band = new THREE.Mesh(bandGeom, bandMat);
      band.position.set(0, 0.25, 0);
      body.add(band);

      // Headband knot ribbons at the back
      const ribbonGeom = new THREE.BoxGeometry(0.06, 0.18, 0.02);
      const ribbon1 = new THREE.Mesh(ribbonGeom, bandMat);
      ribbon1.position.set(0.04, 0.18, -0.36);
      ribbon1.rotation.z = -0.3;
      body.add(ribbon1);
    } else if (skinId === 'cyberpunk') {
      // Neon Cyan Visor
      const visorGeom = new THREE.CylinderGeometry(0.32, 0.32, 0.09, 12, 1, false, -Math.PI / 3, (2 * Math.PI) / 3);
      const visorMat = new THREE.MeshBasicMaterial({ color: 0x00f7ff });
      const visor = new THREE.Mesh(visorGeom, visorMat);
      visor.position.set(0, 0.22, 0.1);
      body.add(visor);
    }

    // Beak
    const beakGeom = new THREE.ConeGeometry(0.09, 0.2, 5);
    beakGeom.rotateX(Math.PI / 2);
    const beak = new THREE.Mesh(beakGeom, beakMat);
    beak.position.set(0, 0.14, 0.42);
    body.add(beak);

    // Wattle
    const wattleGeom = new THREE.SphereGeometry(0.05, 6, 6);
    const wattle = new THREE.Mesh(wattleGeom, combMat);
    wattle.position.set(0, 0.06, 0.36);
    body.add(wattle);

    // Eyes
    if (skinId !== 'agent007' && skinId !== 'cyberpunk') {
      const eyeGeom = new THREE.SphereGeometry(0.06, 8, 8);
      const pupilGeom = new THREE.SphereGeometry(0.035, 6, 6);

      const leftEye = new THREE.Mesh(eyeGeom, eyeWhiteMat);
      leftEye.position.set(0.12, 0.22, 0.3);
      const leftPupil = new THREE.Mesh(pupilGeom, eyePupilMat);
      leftPupil.position.set(0, 0, 0.04);
      leftEye.add(leftPupil);
      body.add(leftEye);

      const rightEye = new THREE.Mesh(eyeGeom, eyeWhiteMat);
      rightEye.position.set(-0.12, 0.22, 0.3);
      const rightPupil = new THREE.Mesh(pupilGeom, eyePupilMat);
      rightPupil.position.set(0, 0, 0.04);
      rightEye.add(rightPupil);
      body.add(rightEye);
    }

    // Red Comb
    const combGeom = new THREE.BoxGeometry(0.07, 0.18, 0.34);
    const comb = new THREE.Mesh(combGeom, combMat);
    comb.position.set(0, 0.48, 0.05);
    body.add(comb);

    // Wings
    const wingGeom = new THREE.BoxGeometry(0.08, 0.22, 0.28);
    wingGeom.translate(0, -0.05, 0);

    const leftWing = new THREE.Mesh(wingGeom, bodyMat);
    leftWing.position.set(0.36, 0.05, 0.02);
    leftWing.rotation.z = -0.15;
    body.add(leftWing);

    const rightWing = new THREE.Mesh(wingGeom, bodyMat);
    rightWing.position.set(-0.36, 0.05, 0.02);
    rightWing.rotation.z = 0.15;
    body.add(rightWing);

    // Tail Feathers
    const tailGeom = new THREE.ConeGeometry(0.12, 0.28, 4);
    tailGeom.rotateX(-Math.PI / 3);
    const tail = new THREE.Mesh(tailGeom, bodyMat);
    tail.position.set(0, 0.15, -0.38);
    body.add(tail);

    // Legs & Feet (Groups for pivot rotation)
    const legMat = new THREE.MeshStandardMaterial({ color: 0xe67e22, roughness: 0.6 });
    const legGeom = new THREE.CylinderGeometry(0.03, 0.03, 0.22, 5);
    legGeom.translate(0, -0.11, 0);

    const footGeom = new THREE.BoxGeometry(0.12, 0.03, 0.16);
    footGeom.translate(0, -0.21, 0.04);

    const leftLeg = new THREE.Group();
    leftLeg.position.set(0.14, 0.22, 0);
    const leftLegMesh = new THREE.Mesh(legGeom, legMat);
    const leftFootMesh = new THREE.Mesh(footGeom, legMat);
    leftLeg.add(leftLegMesh);
    leftLeg.add(leftFootMesh);
    root.add(leftLeg);

    const rightLeg = new THREE.Group();
    rightLeg.position.set(-0.14, 0.22, 0);
    const rightLegMesh = new THREE.Mesh(legGeom, legMat);
    const rightFootMesh = new THREE.Mesh(footGeom, legMat);
    rightLeg.add(rightLegMesh);
    rightLeg.add(rightFootMesh);
    root.add(rightLeg);

    // Disguise Box (Attached to Chicken root, hidden by default)
    const boxMesh = ProceduralModels.createDisguiseBox(boxSkinId);
    boxMesh.position.y = 0.42;
    boxMesh.visible = false;
    root.add(boxMesh);

    return {
      root,
      body,
      comb,
      leftWing,
      rightWing,
      leftLeg,
      rightLeg,
      tail,
      boxMesh
    };
  }

  // --- DISGUISE BOXES ---
  public static createDisguiseBox(skinId: string = 'cardboard'): THREE.Group {
    const boxGroup = new THREE.Group();
    boxGroup.name = 'DisguiseBox';

    let boxColor = 0xc89666; // Craft cardboard
    let isMetallic = false;

    if (skinId === 'parcel') {
      boxColor = 0xdeb887;
    } else if (skinId === 'safe') {
      boxColor = 0x34495e;
      isMetallic = true;
    } else if (skinId === 'watermelon') {
      boxColor = 0x27ae60;
    } else if (skinId === 'crate') {
      boxColor = 0x8b5a2b;
    }

    const boxMat = new THREE.MeshStandardMaterial({
      color: boxColor,
      roughness: isMetallic ? 0.4 : 0.8,
      metalness: isMetallic ? 0.7 : 0.0
    });

    if (skinId === 'watermelon') {
      // Rounded watermelon disguise
      const sphereGeom = new THREE.SphereGeometry(0.48, 14, 12);
      sphereGeom.scale(1.0, 0.9, 1.15);
      const melon = new THREE.Mesh(sphereGeom, boxMat);
      melon.castShadow = true;
      boxGroup.add(melon);

      // Dark green stripes
      const stripeMat = new THREE.MeshBasicMaterial({ color: 0x145a32 });
      for (let i = 0; i < 4; i++) {
        const stripe = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.025, 4, 16), stripeMat);
        stripe.rotation.x = Math.PI / 2;
        stripe.rotation.y = (i * Math.PI) / 4;
        boxGroup.add(stripe);
      }
    } else {
      // Standard Box
      const boxGeom = new THREE.BoxGeometry(0.85, 0.8, 0.85);
      const box = new THREE.Mesh(boxGeom, boxMat);
      box.castShadow = true;
      boxGroup.add(box);

      // Box Flap tape / detail
      if (skinId === 'cardboard' || skinId === 'parcel') {
        const tapeMat = new THREE.MeshBasicMaterial({ color: 0xa07850 });
        const tape = new THREE.Mesh(new THREE.BoxGeometry(0.87, 0.04, 0.16), tapeMat);
        tape.position.set(0, 0.405, 0);
        boxGroup.add(tape);

        // "FRAGILE / !" Stamp
        const stampMat = new THREE.MeshBasicMaterial({ color: 0xc0392b });
        const stamp = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.12, 0.01), stampMat);
        stamp.position.set(0.22, 0.1, 0.43);
        boxGroup.add(stamp);
      } else if (skinId === 'safe') {
        // Chrome dial
        const dialMat = new THREE.MeshStandardMaterial({ color: 0xbdc3c7, metalness: 0.9, roughness: 0.2 });
        const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.04, 12), dialMat);
        dial.rotation.x = Math.PI / 2;
        dial.position.set(0, 0.05, 0.44);
        boxGroup.add(dial);
      } else if (skinId === 'crate') {
        // Wood slats
        const ironMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, metalness: 0.5, roughness: 0.5 });
        const corner1 = new THREE.Mesh(new THREE.BoxGeometry(0.87, 0.06, 0.87), ironMat);
        corner1.position.y = 0.38;
        boxGroup.add(corner1);
        const corner2 = new THREE.Mesh(new THREE.BoxGeometry(0.87, 0.06, 0.87), ironMat);
        corner2.position.y = -0.38;
        boxGroup.add(corner2);
      }
    }

    // Spy Eye Slits (Cutout where chicken eyes peek out comically!)
    const slitMat = new THREE.MeshBasicMaterial({ color: 0x050505 });
    const slitGeom = new THREE.BoxGeometry(0.38, 0.08, 0.02);
    const slit = new THREE.Mesh(slitGeom, slitMat);
    slit.position.set(0, 0.08, 0.435);
    boxGroup.add(slit);

    // Glowing cartoon eyes inside the slit
    const peekEyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const peekPupilMat = new THREE.MeshBasicMaterial({ color: 0x111111 });

    const leftPeek = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), peekEyeMat);
    leftPeek.position.set(0.08, 0.08, 0.43);
    const leftPup = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), peekPupilMat);
    leftPup.position.set(0, 0, 0.02);
    leftPeek.add(leftPup);
    boxGroup.add(leftPeek);

    const rightPeek = new THREE.Mesh(new THREE.SphereGeometry(0.035, 6, 6), peekEyeMat);
    rightPeek.position.set(-0.08, 0.08, 0.43);
    const rightPup = new THREE.Mesh(new THREE.SphereGeometry(0.02, 6, 6), peekPupilMat);
    rightPup.position.set(0, 0, 0.02);
    rightPeek.add(rightPup);
    boxGroup.add(rightPeek);

    return boxGroup;
  }

  // --- GUARD DOG / BULLDOG ---
  public static createDog(isFastHound: boolean = false): DogRig {
    const root = new THREE.Group();
    root.name = 'GuardDog';

    const furColor = isFastHound ? 0x8d6e63 : 0x5d4037; // Hound or Bulldog
    const furMat = new THREE.MeshStandardMaterial({ color: furColor, roughness: 0.8 });
    const bellyMat = new THREE.MeshStandardMaterial({ color: 0xd7ccc8, roughness: 0.8 });
    const collarMat = new THREE.MeshStandardMaterial({ color: 0xc0392b, roughness: 0.5 });
    const spikeMat = new THREE.MeshStandardMaterial({ color: 0xbdc3c7, metalness: 0.8, roughness: 0.2 });

    // Main Body
    const bodyGeom = new THREE.BoxGeometry(0.55, 0.5, 0.8);
    const body = new THREE.Mesh(bodyGeom, furMat);
    body.position.y = 0.45;
    body.castShadow = true;
    root.add(body);

    // Head Group
    const head = new THREE.Group();
    head.position.set(0, 0.25, 0.42);
    body.add(head);

    const headGeom = new THREE.BoxGeometry(0.48, 0.44, 0.48);
    const headMesh = new THREE.Mesh(headGeom, furMat);
    head.add(headMesh);

    // Snout
    const snoutGeom = new THREE.BoxGeometry(0.34, 0.22, 0.28);
    const snout = new THREE.Mesh(snoutGeom, bellyMat);
    snout.position.set(0, -0.08, 0.28);
    head.add(snout);

    // Black Nose
    const noseGeom = new THREE.BoxGeometry(0.12, 0.08, 0.06);
    const noseMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
    const nose = new THREE.Mesh(noseGeom, noseMat);
    nose.position.set(0, 0.04, 0.15);
    snout.add(nose);

    // Cute Droopy Ears
    const earGeom = new THREE.BoxGeometry(0.12, 0.28, 0.16);
    earGeom.translate(0, -0.1, 0);

    const leftEar = new THREE.Mesh(earGeom, furMat);
    leftEar.position.set(0.26, 0.18, 0);
    leftEar.rotation.z = -0.3;
    head.add(leftEar);

    const rightEar = new THREE.Mesh(earGeom, furMat);
    rightEar.position.set(-0.26, 0.18, 0);
    rightEar.rotation.z = 0.3;
    head.add(rightEar);

    // Spiked Collar
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.32, 0.1, 10), collarMat);
    collar.position.set(0, -0.15, -0.05);
    collar.rotation.x = Math.PI / 2;
    head.add(collar);

    for (let i = 0; i < 6; i++) {
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.1, 4), spikeMat);
      const angle = (i * Math.PI * 2) / 6;
      spike.position.set(Math.cos(angle) * 0.33, 0, Math.sin(angle) * 0.33);
      spike.rotation.y = -angle + Math.PI / 2;
      collar.add(spike);
    }

    // 4 Legs
    const legGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.32, 6);
    legGeom.translate(0, -0.16, 0);

    const createLeg = (x: number, z: number) => {
      const g = new THREE.Group();
      g.position.set(x, 0.32, z);
      const m = new THREE.Mesh(legGeom, furMat);
      m.castShadow = true;
      g.add(m);
      root.add(g);
      return g;
    };

    const frontLeftLeg = createLeg(0.22, 0.25);
    const frontRightLeg = createLeg(-0.22, 0.25);
    const backLeftLeg = createLeg(0.22, -0.25);
    const backRightLeg = createLeg(-0.22, -0.25);

    // Tail
    const tailGeom = new THREE.CylinderGeometry(0.05, 0.03, 0.26, 5);
    tailGeom.translate(0, 0.12, 0);
    const tail = new THREE.Mesh(tailGeom, furMat);
    tail.position.set(0, 0.15, -0.42);
    tail.rotation.x = -0.6;
    body.add(tail);

    // Alert / Question Mark Billboard over Dog Head
    const alertBillboard = new THREE.Group();
    alertBillboard.position.set(0, 1.25, 0);
    alertBillboard.visible = false;
    root.add(alertBillboard);

    // Exclamation Mark '!'
    const alertIconGroup = new THREE.Group();
    const exBar = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.38, 0.06),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    exBar.position.y = 0.12;
    const exDot = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.12, 0.06),
      new THREE.MeshBasicMaterial({ color: 0xff0000 })
    );
    exDot.position.y = -0.16;
    alertIconGroup.add(exBar);
    alertIconGroup.add(exDot);
    alertBillboard.add(alertIconGroup);

    // Question Mark '?'
    const suspiciousIconGroup = new THREE.Group();
    const qMesh = new THREE.Mesh(
      new THREE.TorusGeometry(0.14, 0.05, 4, 12, Math.PI * 1.3),
      new THREE.MeshBasicMaterial({ color: 0xf39c12 })
    );
    qMesh.position.y = 0.14;
    const qDot = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.05),
      new THREE.MeshBasicMaterial({ color: 0xf39c12 })
    );
    qDot.position.y = -0.16;
    suspiciousIconGroup.add(qMesh);
    suspiciousIconGroup.add(qDot);
    suspiciousIconGroup.visible = false;
    alertBillboard.add(suspiciousIconGroup);

    return {
      root,
      body,
      head,
      snout,
      leftEar,
      rightEar,
      frontLeftLeg,
      frontRightLeg,
      backLeftLeg,
      backRightLeg,
      tail,
      alertBillboard,
      alertIcon: alertIconGroup as unknown as THREE.Mesh,
      suspiciousIcon: suspiciousIconGroup as unknown as THREE.Mesh
    };
  }

  // --- GOLDEN CORN GRAIN ---
  public static createGrain(): THREE.Group {
    const grain = new THREE.Group();
    grain.name = 'GoldenGrain';

    const grainMat = new THREE.MeshStandardMaterial({
      color: 0xffd700,
      emissive: 0xffa500,
      emissiveIntensity: 0.35,
      roughness: 0.2,
      metalness: 0.8
    });

    const kernelGeom = new THREE.OctahedronGeometry(0.24, 0);
    kernelGeom.scale(0.8, 1.2, 0.8);
    const kernel = new THREE.Mesh(kernelGeom, grainMat);
    kernel.position.y = 0.35;
    grain.add(kernel);

    // Soft glowing halo ring
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0xffec3d,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide
    });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.38, 12), ringMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    grain.add(ring);

    return grain;
  }

  // --- FARM EXIT GATES ---
  public static createFarmGate(): { root: THREE.Group; leftDoor: THREE.Mesh; rightDoor: THREE.Mesh; beacon: THREE.Mesh; padlock: THREE.Mesh } {
    const root = new THREE.Group();
    root.name = 'FarmExitGate';

    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8d5b36, roughness: 0.9 });
    const postMat = new THREE.MeshStandardMaterial({ color: 0x5c3a21, roughness: 0.9 });
    const ironMat = new THREE.MeshStandardMaterial({ color: 0x2c3e50, metalness: 0.7, roughness: 0.3 });
    const goldMat = new THREE.MeshStandardMaterial({ color: 0xf1c40f, metalness: 0.8, roughness: 0.2 });

    // Left & Right Pillars
    const pillarGeom = new THREE.BoxGeometry(0.4, 2.4, 0.4);
    const leftPillar = new THREE.Mesh(pillarGeom, postMat);
    leftPillar.position.set(-1.4, 1.2, 0);
    leftPillar.castShadow = true;
    root.add(leftPillar);

    const rightPillar = new THREE.Mesh(pillarGeom, postMat);
    rightPillar.position.set(1.4, 1.2, 0);
    rightPillar.castShadow = true;
    root.add(rightPillar);

    // Overhead Archway Beam
    const beamGeom = new THREE.BoxGeometry(3.2, 0.35, 0.35);
    const beam = new THREE.Mesh(beamGeom, postMat);
    beam.position.set(0, 2.4, 0);
    root.add(beam);

    // Lantern on the beam
    const lantern = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.4, 0.3), ironMat);
    lantern.position.set(0, 2.1, 0);
    root.add(lantern);

    // Left Gate Door
    const doorGeom = new THREE.BoxGeometry(1.2, 1.6, 0.12);
    doorGeom.translate(0.6, 0, 0); // Pivot at pillar hinge

    const leftDoor = new THREE.Mesh(doorGeom, woodMat);
    leftDoor.position.set(-1.3, 0.9, 0);
    leftDoor.castShadow = true;
    root.add(leftDoor);

    // Right Gate Door
    const rightDoorGeom = new THREE.BoxGeometry(1.2, 1.6, 0.12);
    rightDoorGeom.translate(-0.6, 0, 0); // Pivot at pillar hinge

    const rightDoor = new THREE.Mesh(rightDoorGeom, woodMat);
    rightDoor.position.set(1.3, 0.9, 0);
    rightDoor.castShadow = true;
    root.add(rightDoor);

    // Heavy Brass Padlock
    const padlock = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.35, 0.2), goldMat);
    padlock.position.set(0, 0.9, 0.1);
    root.add(padlock);

    // Escape Beacon Light Beam (Skyward beam, transparent cyan/gold)
    const beaconGeom = new THREE.CylinderGeometry(1.2, 1.2, 12, 16, 1, true);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0x2ecc71,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false
    });
    const beacon = new THREE.Mesh(beaconGeom, beaconMat);
    beacon.position.set(0, 6, 0);
    beacon.visible = false;
    root.add(beacon);

    return { root, leftDoor, rightDoor, beacon, padlock };
  }

  // --- RED BARN ---
  public static createBarn(width: number = 4, length: number = 5, height: number = 3.2): THREE.Group {
    const barn = new THREE.Group();
    barn.name = 'RedBarn';

    const redMat = new THREE.MeshStandardMaterial({ color: 0xb71515, roughness: 0.8 });
    const whiteTrimMat = new THREE.MeshBasicMaterial({ color: 0xf5f6fa });
    const roofMat = new THREE.MeshStandardMaterial({ color: 0x4a2311, roughness: 0.9 });

    // Main Barn Walls
    const wallGeom = new THREE.BoxGeometry(width, height, length);
    const walls = new THREE.Mesh(wallGeom, redMat);
    walls.position.y = height / 2;
    walls.castShadow = true;
    walls.receiveShadow = true;
    barn.add(walls);

    // Gambrel Roof
    const roofGeom = new THREE.ConeGeometry(Math.max(width, length) * 0.75, 1.4, 4);
    roofGeom.rotateY(Math.PI / 4);
    const roof = new THREE.Mesh(roofGeom, roofMat);
    roof.position.y = height + 0.65;
    roof.scale.set(width / 3.5, 1, length / 3.5);
    barn.add(roof);

    // White Cross Trims on front
    const trim1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, height * 0.7, 0.05), whiteTrimMat);
    trim1.position.set(0, height * 0.45, length / 2 + 0.02);
    barn.add(trim1);

    const trim2 = new THREE.Mesh(new THREE.BoxGeometry(width * 0.6, 0.1, 0.05), whiteTrimMat);
    trim2.position.set(0, height * 0.45, length / 2 + 0.02);
    barn.add(trim2);

    return barn;
  }

  // --- WOODEN FENCE ---
  public static createFence(length: number = 2.0): THREE.Group {
    const fence = new THREE.Group();
    const woodMat = new THREE.MeshStandardMaterial({ color: 0x8d5b36, roughness: 0.85 });

    // Posts at both ends
    const postGeom = new THREE.BoxGeometry(0.2, 1.1, 0.2);
    const p1 = new THREE.Mesh(postGeom, woodMat);
    p1.position.set(-length / 2, 0.55, 0);
    p1.castShadow = true;
    fence.add(p1);

    const p2 = new THREE.Mesh(postGeom, woodMat);
    p2.position.set(length / 2, 0.55, 0);
    p2.castShadow = true;
    fence.add(p2);

    // Horizontal Rails
    const railGeom = new THREE.BoxGeometry(length, 0.12, 0.08);
    const rail1 = new THREE.Mesh(railGeom, woodMat);
    rail1.position.set(0, 0.75, 0);
    rail1.castShadow = true;
    fence.add(rail1);

    const rail2 = new THREE.Mesh(railGeom, woodMat);
    rail2.position.set(0, 0.35, 0);
    rail2.castShadow = true;
    fence.add(rail2);

    return fence;
  }

  // --- HAY BALE ---
  public static createHayBale(isRound: boolean = false): THREE.Group {
    const bale = new THREE.Group();
    const hayMat = new THREE.MeshStandardMaterial({ color: 0xf4d03f, roughness: 0.95 });
    const twineMat = new THREE.MeshBasicMaterial({ color: 0x7f6000 });

    if (isRound) {
      const geom = new THREE.CylinderGeometry(0.65, 0.65, 1.1, 12);
      geom.rotateZ(Math.PI / 2);
      const mesh = new THREE.Mesh(geom, hayMat);
      mesh.position.y = 0.65;
      mesh.castShadow = true;
      bale.add(mesh);
    } else {
      const geom = new THREE.BoxGeometry(1.2, 0.8, 0.8);
      const mesh = new THREE.Mesh(geom, hayMat);
      mesh.position.y = 0.4;
      mesh.castShadow = true;
      bale.add(mesh);

      // Twine cords
      const twine1 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.82, 0.82), twineMat);
      twine1.position.set(0.3, 0.4, 0);
      bale.add(twine1);

      const twine2 = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.82, 0.82), twineMat);
      twine2.position.set(-0.3, 0.4, 0);
      bale.add(twine2);
    }

    return bale;
  }

  // --- TOON TREE ---
  public static createTree(): THREE.Group {
    const tree = new THREE.Group();
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x6e4726, roughness: 0.9 });
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x48bb78, roughness: 0.7 });

    const trunkGeom = new THREE.CylinderGeometry(0.2, 0.32, 1.4, 6);
    const trunk = new THREE.Mesh(trunkGeom, trunkMat);
    trunk.position.y = 0.7;
    trunk.castShadow = true;
    tree.add(trunk);

    const f1 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.85, 0), leavesMat);
    f1.position.y = 1.8;
    f1.castShadow = true;
    tree.add(f1);

    const f2 = new THREE.Mesh(new THREE.DodecahedronGeometry(0.65, 0), leavesMat);
    f2.position.set(0.3, 2.3, 0.1);
    f2.castShadow = true;
    tree.add(f2);

    return tree;
  }

  // --- CARROT PATCH ---
  public static createCarrotPatch(): THREE.Group {
    const patch = new THREE.Group();
    const soilMat = new THREE.MeshStandardMaterial({ color: 0x4e3629 });
    const carrotMat = new THREE.MeshStandardMaterial({ color: 0xff7a00 });
    const leavesMat = new THREE.MeshStandardMaterial({ color: 0x2ecc71 });

    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.12, 1.2), soilMat);
    bed.position.y = 0.06;
    patch.add(bed);

    for (let x = -0.5; x <= 0.5; x += 0.5) {
      for (let z = -0.3; z <= 0.3; z += 0.6) {
        const carrot = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 4), carrotMat);
        carrot.rotation.x = Math.PI;
        carrot.position.set(x, 0.15, z);
        patch.add(carrot);

        const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.15, 3), leavesMat);
        leaf.position.set(x, 0.22, z);
        patch.add(leaf);
      }
    }

    return patch;
  }
}
