import * as THREE from 'three'

/**
 * Procedural 3D Mesh Generator for Victorian Rooftops, Props, Courier Rig & Background.
 * Zero external GLTF asset dependencies.
 */
export class ProceduralModels {
  // Shared materials to minimize draw calls
  public static terracottaMat = new THREE.MeshStandardMaterial({
    color: 0xba5432,
    roughness: 0.75,
    metalness: 0.1,
  })

  public static slateMat = new THREE.MeshStandardMaterial({
    color: 0x3d4b63,
    roughness: 0.55,
    metalness: 0.25,
  })

  public static brickMat = new THREE.MeshStandardMaterial({
    color: 0x7a3f31,
    roughness: 0.85,
    metalness: 0.05,
  })

  public static copperPatinaMat = new THREE.MeshStandardMaterial({
    color: 0x48a9a6,
    roughness: 0.45,
    metalness: 0.35,
  })

  public static ironMat = new THREE.MeshStandardMaterial({
    color: 0x2b292e,
    roughness: 0.6,
    metalness: 0.4,
  })

  public static goldBrassMat = new THREE.MeshStandardMaterial({
    color: 0xd4af37,
    roughness: 0.3,
    metalness: 0.4,
  })

  public static woodTrimMat = new THREE.MeshStandardMaterial({
    color: 0x5a3d28,
    roughness: 0.8,
  })

  public static glowingAetherMat = new THREE.MeshStandardMaterial({
    color: 0x00f5d4,
    emissive: 0x00f5d4,
    emissiveIntensity: 1.4,
    roughness: 0.1,
    transparent: true,
    opacity: 0.85,
  })

  public static glassFlaskMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.45,
    roughness: 0.05,
    transmission: 0.9,
    ior: 1.5,
  })

  /**
   * Builds the stylized 3D procedural Courier Character.
   */
  public static buildCourierRig(): {
    root: THREE.Group
    pelvis: THREE.Group
    spine: THREE.Group
    head: THREE.Group
    leftArm: THREE.Group
    rightArm: THREE.Group
    leftLeg: THREE.Group
    rightLeg: THREE.Group
    cape: THREE.Mesh
    flaskFluid: THREE.Mesh
  } {
    const root = new THREE.Group()

    const tweedCoatMat = new THREE.MeshStandardMaterial({
      color: 0x42382f,
      roughness: 0.8,
    })
    const pantsMat = new THREE.MeshStandardMaterial({
      color: 0x262322,
      roughness: 0.85,
    })
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xe0a982,
      roughness: 0.6,
    })

    // Pelvis & Lower Body
    const pelvis = new THREE.Group()
    pelvis.position.set(0, 0.85, 0)
    root.add(pelvis)

    const pelvisMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.38, 0.22, 0.26),
      pantsMat
    )
    pelvisMesh.castShadow = true
    pelvis.add(pelvisMesh)

    // Spine & Torso
    const spine = new THREE.Group()
    spine.position.set(0, 0.18, 0)
    pelvis.add(spine)

    const torsoMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.44, 0.46, 0.3),
      tweedCoatMat
    )
    torsoMesh.position.set(0, 0.23, 0)
    torsoMesh.castShadow = true
    spine.add(torsoMesh)

    // Leather Harness & Belts
    const harnessMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.46, 0.1, 0.32),
      ProceduralModels.woodTrimMat
    )
    harnessMesh.position.set(0, 0.16, 0)
    spine.add(harnessMesh)

    // Glowing Flask (Parcel Integrity) on courier's back
    const flaskGroup = new THREE.Group()
    flaskGroup.position.set(0, 0.25, -0.22)
    spine.add(flaskGroup)

    const flaskGlass = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.36, 12),
      ProceduralModels.glassFlaskMat
    )
    flaskGroup.add(flaskGlass)

    const flaskFluid = new THREE.Mesh(
      new THREE.CylinderGeometry(0.08, 0.08, 0.3, 10),
      ProceduralModels.glowingAetherMat
    )
    flaskGroup.add(flaskFluid)

    const flaskCap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.06, 0.06, 0.08, 8),
      ProceduralModels.goldBrassMat
    )
    flaskCap.position.set(0, 0.2, 0)
    flaskGroup.add(flaskCap)

    // Head, Cap & Goggles
    const head = new THREE.Group()
    head.position.set(0, 0.52, 0)
    spine.add(head)

    const headMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.24, 0.26, 0.24),
      skinMat
    )
    headMesh.position.set(0, 0.13, 0)
    headMesh.castShadow = true
    head.add(headMesh)

    // Cap
    const capMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.28, 0.1, 0.32),
      tweedCoatMat
    )
    capMesh.position.set(0, 0.26, 0.03)
    head.add(capMesh)

    // Goggles
    const gogglesMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.08, 0.06),
      ProceduralModels.goldBrassMat
    )
    gogglesMesh.position.set(0, 0.18, 0.13)
    head.add(gogglesMesh)

    // Arms
    const leftArm = new THREE.Group()
    leftArm.position.set(-0.28, 0.4, 0)
    spine.add(leftArm)

    const leftArmMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.5, 0.16),
      tweedCoatMat
    )
    leftArmMesh.position.set(0, -0.2, 0)
    leftArmMesh.castShadow = true
    leftArm.add(leftArmMesh)

    const rightArm = new THREE.Group()
    rightArm.position.set(0.28, 0.4, 0)
    spine.add(rightArm)

    const rightArmMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.14, 0.5, 0.16),
      tweedCoatMat
    )
    rightArmMesh.position.set(0, -0.2, 0)
    rightArmMesh.castShadow = true
    rightArm.add(rightArmMesh)

    // Legs with Lead-Brass Roofer Treads
    const leftLeg = new THREE.Group()
    leftLeg.position.set(-0.13, 0, 0)
    pelvis.add(leftLeg)

    const leftLegMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.52, 0.18),
      pantsMat
    )
    leftLegMesh.position.set(0, -0.24, 0)
    leftLegMesh.castShadow = true
    leftLeg.add(leftLegMesh)

    const leftBootMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.18, 0.28),
      ProceduralModels.goldBrassMat
    )
    leftBootMesh.position.set(0, -0.5, 0.04)
    leftBootMesh.castShadow = true
    leftLeg.add(leftBootMesh)

    const rightLeg = new THREE.Group()
    rightLeg.position.set(0.13, 0, 0)
    pelvis.add(rightLeg)

    const rightLegMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.16, 0.52, 0.18),
      pantsMat
    )
    rightLegMesh.position.set(0, -0.24, 0)
    rightLegMesh.castShadow = true
    rightLeg.add(rightLegMesh)

    const rightBootMesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.18, 0.28),
      ProceduralModels.goldBrassMat
    )
    rightBootMesh.position.set(0, -0.5, 0.04)
    rightBootMesh.castShadow = true
    rightLeg.add(rightBootMesh)

    // Flowing Cape / Tweed Cloak
    const capeGeo = new THREE.PlaneGeometry(0.46, 0.75, 2, 4)
    const capeMat = new THREE.MeshStandardMaterial({
      color: 0x6e261f,
      roughness: 0.7,
      side: THREE.DoubleSide,
    })
    const cape = new THREE.Mesh(capeGeo, capeMat)
    cape.position.set(0, 0.35, -0.18)
    cape.rotation.x = 0.2
    spine.add(cape)

    return {
      root,
      pelvis,
      spine,
      head,
      leftArm,
      rightArm,
      leftLeg,
      rightLeg,
      cape,
      flaskFluid,
    }
  }

  /**
   * Creates a Victorian House / Rooftop Chunk with slope, copper gutters, and chimneys.
   */
  public static createRooftopChunk(
    type: 'flat' | 'sloped_forward' | 'sloped_double' | 'cable_gap',
    length: number,
    width = 7.0,
    slopeAngleDeg = 20
  ): {
    group: THREE.Group
    walkableBoxes: { x: number; y: number; z: number; halfW: number; halfH: number; halfD: number; slopeDeg: number; type: 'tile' | 'slate' | 'cable' }[]
    obstacles: { x: number; y: number; z: number; width: number; height: number; depth: number; type: 'pipe' | 'chimney' }[]
    ledgeZ: number | null
  } {
    const group = new THREE.Group()
    const walkableBoxes: { x: number; y: number; z: number; halfW: number; halfH: number; halfD: number; slopeDeg: number; type: 'tile' | 'slate' | 'cable' }[] = []
    const obstacles: { x: number; y: number; z: number; width: number; height: number; depth: number; type: 'pipe' | 'chimney' }[] = []
    let ledgeZ: number | null = null

    const buildingHeight = 12.0

    // Main Brick Building Base
    const buildingBase = new THREE.Mesh(
      new THREE.BoxGeometry(width, buildingHeight, length),
      ProceduralModels.brickMat
    )
    buildingBase.position.set(0, -buildingHeight / 2, length / 2)
    buildingBase.receiveShadow = true
    buildingBase.castShadow = true
    group.add(buildingBase)

    // Wood Trim / Cornice below roof
    const trim = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.4, 0.4, length + 0.4),
      ProceduralModels.woodTrimMat
    )
    trim.position.set(0, 0.1, length / 2)
    group.add(trim)

    // Copper Edge / Ledge at entry and exit
    const entryGutter = new THREE.Mesh(
      new THREE.BoxGeometry(width + 0.6, 0.25, 0.4),
      ProceduralModels.copperPatinaMat
    )
    entryGutter.position.set(0, 0.3, 0.1)
    group.add(entryGutter)
    ledgeZ = 0.1

    if (type === 'flat') {
      // Flat Terrace / Mansard
      const roofMesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.4, length),
        ProceduralModels.slateMat
      )
      roofMesh.position.set(0, 0.2, length / 2)
      roofMesh.receiveShadow = true
      group.add(roofMesh)

      walkableBoxes.push({
        x: 0,
        y: 0.2,
        z: length / 2,
        halfW: width / 2,
        halfH: 0.2,
        halfD: length / 2,
        slopeDeg: 0,
        type: 'slate',
      })

      // Add low chimney or steam pipe obstacle in middle
      if (length > 15) {
        const pipeH = 1.1
        const pipeMesh = new THREE.Mesh(
          new THREE.CylinderGeometry(0.3, 0.3, width, 12),
          ProceduralModels.ironMat
        )
        pipeMesh.rotation.z = Math.PI / 2
        pipeMesh.position.set(0, pipeH, length * 0.5)
        pipeMesh.castShadow = true
        group.add(pipeMesh)

        // Brass support pillars
        const pillarLeft = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.12, pipeH, 8),
          ProceduralModels.goldBrassMat
        )
        pillarLeft.position.set(-width / 2 + 0.5, pipeH / 2, length * 0.5)
        group.add(pillarLeft)

        const pillarRight = new THREE.Mesh(
          new THREE.CylinderGeometry(0.12, 0.12, pipeH, 8),
          ProceduralModels.goldBrassMat
        )
        pillarRight.position.set(width / 2 - 0.5, pipeH / 2, length * 0.5)
        group.add(pillarRight)

        obstacles.push({
          x: 0,
          y: pipeH,
          z: length * 0.5,
          width,
          height: 0.6,
          depth: 0.6,
          type: 'pipe',
        })
      }
    } else if (type === 'sloped_forward') {
      // Sloped Terracotta Roof (downward acceleration)
      const rad = (slopeAngleDeg * Math.PI) / 180
      const roofLen = length / Math.cos(rad)
      const roofMesh = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.4, roofLen),
        ProceduralModels.terracottaMat
      )
      roofMesh.position.set(0, (length * Math.sin(rad)) / 2, length / 2)
      roofMesh.rotation.x = rad
      roofMesh.receiveShadow = true
      roofMesh.castShadow = true
      group.add(roofMesh)

      walkableBoxes.push({
        x: 0,
        y: (length * Math.sin(rad)) / 2,
        z: length / 2,
        halfW: width / 2,
        halfH: 0.2,
        halfD: length / 2,
        slopeDeg: slopeAngleDeg,
        type: 'tile',
      })

      // Add Brick Chimney on the side
      const chimney = new THREE.Mesh(
        new THREE.BoxGeometry(1.2, 2.2, 1.2),
        ProceduralModels.brickMat
      )
      chimney.position.set(width / 2 - 1.2, 1.4, length * 0.6)
      chimney.castShadow = true
      group.add(chimney)

      const chimneyCap = new THREE.Mesh(
        new THREE.CylinderGeometry(0.25, 0.25, 0.5, 8),
        ProceduralModels.ironMat
      )
      chimneyCap.position.set(width / 2 - 1.2, 2.6, length * 0.6)
      group.add(chimneyCap)
    } else if (type === 'sloped_double') {
      // Gable Peak Roof (up then down)
      const halfLen = length / 2
      const rad = (slopeAngleDeg * Math.PI) / 180

      const leftSlope = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.4, halfLen),
        ProceduralModels.terracottaMat
      )
      leftSlope.position.set(0, (halfLen * Math.sin(rad)) / 2, halfLen / 2)
      leftSlope.rotation.x = -rad
      leftSlope.receiveShadow = true
      group.add(leftSlope)

      const rightSlope = new THREE.Mesh(
        new THREE.BoxGeometry(width, 0.4, halfLen),
        ProceduralModels.terracottaMat
      )
      rightSlope.position.set(0, (halfLen * Math.sin(rad)) / 2, halfLen + halfLen / 2)
      rightSlope.rotation.x = rad
      rightSlope.receiveShadow = true
      group.add(rightSlope)

      walkableBoxes.push({
        x: 0,
        y: 0.4,
        z: length / 2,
        halfW: width / 2,
        halfH: 0.4,
        halfD: length / 2,
        slopeDeg: slopeAngleDeg * 0.5,
        type: 'tile',
      })
    } else if (type === 'cable_gap') {
      // High Aerial Skyline Tightrope Cable Sprint
      const cableRadius = 0.08
      const cableMesh = new THREE.Mesh(
        new THREE.CylinderGeometry(cableRadius, cableRadius, length, 8),
        ProceduralModels.ironMat
      )
      cableMesh.rotation.x = Math.PI / 2
      cableMesh.position.set(0, 0.3, length / 2)
      group.add(cableMesh)

      // Hanging Laundry flags along cable
      for (let z = 3; z < length - 3; z += 3.5) {
        const cloth = new THREE.Mesh(
          new THREE.PlaneGeometry(1.2, 1.0),
          new THREE.MeshStandardMaterial({
            color: Math.random() > 0.5 ? 0xf0e6d2 : 0x48698a,
            side: THREE.DoubleSide,
          })
        )
        cloth.position.set((Math.random() - 0.5) * 0.4, -0.3, z)
        cloth.rotation.y = (Math.random() - 0.5) * 0.3
        group.add(cloth)
      }

      walkableBoxes.push({
        x: 0,
        y: 0.3,
        z: length / 2,
        halfW: 0.6,
        halfH: 0.1,
        halfD: length / 2,
        slopeDeg: 0,
        type: 'cable',
      })
    }

    return { group, walkableBoxes, obstacles, ledgeZ }
  }

  /**
   * Background Steam Airship
   */
  public static createBackgroundAirship(): THREE.Group {
    const airship = new THREE.Group()

    // Main Zeppelin Gas Envelope
    const envelope = new THREE.Mesh(
      new THREE.SphereGeometry(6.0, 16, 12),
      new THREE.MeshStandardMaterial({
        color: 0x3d352e,
        roughness: 0.7,
        metalness: 0.2,
      })
    )
    envelope.scale.set(1.0, 1.0, 3.2)
    airship.add(envelope)

    // Gondola / Cabin below
    const gondola = new THREE.Mesh(
      new THREE.BoxGeometry(2.0, 1.4, 6.0),
      ProceduralModels.goldBrassMat
    )
    gondola.position.set(0, -6.5, 0)
    airship.add(gondola)

    // Propellers
    const prop1 = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 2.4, 0.1),
      ProceduralModels.ironMat
    )
    prop1.position.set(-1.8, -6.5, -3.2)
    airship.add(prop1)

    const prop2 = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 2.4, 0.1),
      ProceduralModels.ironMat
    )
    prop2.position.set(1.8, -6.5, -3.2)
    airship.add(prop2)

    airship.position.set(45, 35, 120)
    return airship
  }
}
