import * as THREE from 'three'

export class ProceduralModels {
  // Shared materials for zero redundant allocation
  private static matFloor: THREE.MeshStandardMaterial
  private static matMetalWall: THREE.MeshStandardMaterial
  private static matNeonCyan: THREE.MeshBasicMaterial
  private static matNeonOrange: THREE.MeshBasicMaterial
  private static matPlayerBody: THREE.MeshStandardMaterial
  private static matPlayerJacket: THREE.MeshStandardMaterial
  private static matEnemyBody: THREE.MeshStandardMaterial
  private static matHeavyBody: THREE.MeshStandardMaterial
  private static matBossBody: THREE.MeshStandardMaterial
  private static matCrate: THREE.MeshStandardMaterial
  private static matBarrel: THREE.MeshStandardMaterial
  private static matWeaponMetal: THREE.MeshStandardMaterial

  public static initMaterials(): void {
    if (this.matFloor) return

    this.matFloor = new THREE.MeshStandardMaterial({
      color: 0x161b24,
      roughness: 0.7,
      metalness: 0.3,
    })

    this.matMetalWall = new THREE.MeshStandardMaterial({
      color: 0x222a38,
      roughness: 0.5,
      metalness: 0.4,
    })

    this.matNeonCyan = new THREE.MeshBasicMaterial({
      color: 0x00f0ff,
    })

    this.matNeonOrange = new THREE.MeshBasicMaterial({
      color: 0xff6b00,
    })

    this.matPlayerBody = new THREE.MeshStandardMaterial({
      color: 0xe0a98b,
      roughness: 0.6,
      metalness: 0.1,
    })

    this.matPlayerJacket = new THREE.MeshStandardMaterial({
      color: 0x1c2430,
      roughness: 0.4,
      metalness: 0.3,
    })

    this.matEnemyBody = new THREE.MeshStandardMaterial({
      color: 0xb54032,
      roughness: 0.6,
      metalness: 0.2,
    })

    this.matHeavyBody = new THREE.MeshStandardMaterial({
      color: 0x4a5568,
      roughness: 0.4,
      metalness: 0.4,
    })

    this.matBossBody = new THREE.MeshStandardMaterial({
      color: 0x822727,
      roughness: 0.3,
      metalness: 0.4,
    })

    this.matCrate = new THREE.MeshStandardMaterial({
      color: 0x9c6b3f,
      roughness: 0.8,
      metalness: 0.1,
    })

    this.matBarrel = new THREE.MeshStandardMaterial({
      color: 0xd9381e,
      roughness: 0.5,
      metalness: 0.3,
    })

    this.matWeaponMetal = new THREE.MeshStandardMaterial({
      color: 0xa0aec0,
      roughness: 0.3,
      metalness: 0.4,
    })
  }

  public static createArenaMesh(): THREE.Group {
    this.initMaterials()
    const group = new THREE.Group()

    // 1. Octagonal Floor
    const radius = 12
    const floorGeo = new THREE.CylinderGeometry(radius, radius, 0.4, 8)
    const floorMesh = new THREE.Mesh(floorGeo, this.matFloor)
    floorMesh.position.y = -0.2
    floorMesh.receiveShadow = true
    group.add(floorMesh)

    // Neon octagonal border ring
    const ringGeo = new THREE.RingGeometry(radius - 0.25, radius + 0.05, 8)
    const ringMesh = new THREE.Mesh(ringGeo, this.matNeonCyan)
    ringMesh.rotation.x = -Math.PI / 2
    ringMesh.position.y = 0.02
    group.add(ringMesh)

    // Center combat circle
    const centerRingGeo = new THREE.RingGeometry(3.8, 4.0, 32)
    const centerRingMesh = new THREE.Mesh(centerRingGeo, this.matNeonOrange)
    centerRingMesh.rotation.x = -Math.PI / 2
    centerRingMesh.position.y = 0.02
    group.add(centerRingMesh)

    // 2. Octagonal Posts & Chain Barriers
    const sides = 8
    const postHeight = 3.5
    const postGeo = new THREE.BoxGeometry(0.4, postHeight, 0.4)

    for (let i = 0; i < sides; i++) {
      const angle = (i / sides) * Math.PI * 2
      const px = Math.cos(angle) * radius
      const pz = Math.sin(angle) * radius

      const postMesh = new THREE.Mesh(postGeo, this.matMetalWall)
      postMesh.position.set(px, postHeight / 2, pz)
      postMesh.castShadow = true
      postMesh.receiveShadow = true
      group.add(postMesh)

      // Neon post beacon
      const beaconGeo = new THREE.BoxGeometry(0.2, 0.3, 0.2)
      const beaconMesh = new THREE.Mesh(beaconGeo, this.matNeonCyan)
      beaconMesh.position.set(px, postHeight + 0.15, pz)
      group.add(beaconMesh)
    }

    // 3. Electrical Hazard Box on Wall
    const boxGeo = new THREE.BoxGeometry(0.8, 1.2, 0.4)
    const boxMesh = new THREE.Mesh(boxGeo, this.matMetalWall)
    boxMesh.position.set(radius - 0.5, 1.5, 0)
    group.add(boxMesh)

    const sparkLightGeo = new THREE.BoxGeometry(0.4, 0.2, 0.1)
    const sparkLightMesh = new THREE.Mesh(sparkLightGeo, this.matNeonOrange)
    sparkLightMesh.position.set(radius - 0.7, 1.7, 0)
    group.add(sparkLightMesh)

    return group
  }

  public static createCharacterRig(type: 'player' | 'hooligan' | 'heavy' | 'boss'): THREE.Group {
    this.initMaterials()
    const rig = new THREE.Group()

    let bodyMat = this.matEnemyBody
    let jacketMat = this.matMetalWall
    let scale = 1.0

    if (type === 'player') {
      bodyMat = this.matPlayerBody
      jacketMat = this.matPlayerJacket
      scale = 1.0
    } else if (type === 'hooligan') {
      bodyMat = this.matEnemyBody
      jacketMat = this.matMetalWall
      scale = 0.95
    } else if (type === 'heavy') {
      bodyMat = this.matHeavyBody
      jacketMat = this.matMetalWall
      scale = 1.25
    } else if (type === 'boss') {
      bodyMat = this.matBossBody
      jacketMat = this.matMetalWall
      scale = 1.6
    }

    // Pelvis & Torso
    const pelvis = new THREE.Mesh(new THREE.BoxGeometry(0.38 * scale, 0.25 * scale, 0.28 * scale), jacketMat)
    pelvis.position.y = 0.9 * scale
    pelvis.castShadow = true
    rig.add(pelvis)

    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.5 * scale, 0.45 * scale, 0.32 * scale), jacketMat)
    chest.position.y = 1.25 * scale
    chest.castShadow = true
    rig.add(chest)

    // Head
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.28 * scale, 0.3 * scale, 0.28 * scale), bodyMat)
    head.position.y = 1.68 * scale
    head.castShadow = true
    rig.add(head)

    // Shoulders & Arms
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.16 * scale, 0.55 * scale, 0.16 * scale), bodyMat)
    leftArm.position.set(-0.35 * scale, 1.2 * scale, 0)
    leftArm.castShadow = true
    leftArm.name = 'leftArm'
    rig.add(leftArm)

    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.16 * scale, 0.55 * scale, 0.16 * scale), bodyMat)
    rightArm.position.set(0.35 * scale, 1.2 * scale, 0)
    rightArm.castShadow = true
    rightArm.name = 'rightArm'
    rig.add(rightArm)

    // Legs & Heavy Boots
    const leftLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18 * scale, 0.65 * scale, 0.18 * scale), jacketMat)
    leftLeg.position.set(-0.16 * scale, 0.45 * scale, 0)
    leftLeg.castShadow = true
    leftLeg.name = 'leftLeg'
    rig.add(leftLeg)

    const rightLeg = new THREE.Mesh(new THREE.BoxGeometry(0.18 * scale, 0.65 * scale, 0.18 * scale), jacketMat)
    rightLeg.position.set(0.16 * scale, 0.45 * scale, 0)
    rightLeg.castShadow = true
    rightLeg.name = 'rightLeg'
    rig.add(rightLeg)

    rig.userData.type = type
    rig.userData.scale = scale
    return rig
  }

  public static createCrateMesh(): THREE.Mesh {
    this.initMaterials()
    const geo = new THREE.BoxGeometry(1.0, 1.0, 1.0)
    const mesh = new THREE.Mesh(geo, this.matCrate)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  public static createBarrelMesh(): THREE.Mesh {
    this.initMaterials()
    const geo = new THREE.CylinderGeometry(0.45, 0.45, 1.2, 12)
    const mesh = new THREE.Mesh(geo, this.matBarrel)
    mesh.castShadow = true
    mesh.receiveShadow = true
    return mesh
  }

  public static createWeaponMesh(kind: 'bat' | 'hammer' | 'pipe'): THREE.Group {
    this.initMaterials()
    const weapon = new THREE.Group()

    if (kind === 'bat') {
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.35), this.matWeaponMetal)
      const top = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.04, 0.65), this.matCrate)
      top.position.y = 0.45
      weapon.add(handle, top)
    } else if (kind === 'hammer') {
      const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.9), this.matWeaponMetal)
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.25, 0.25), this.matWeaponMetal)
      head.position.y = 0.45
      weapon.add(handle, head)
    } else {
      // pipe
      const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.1), this.matWeaponMetal)
      weapon.add(pipe)
    }

    return weapon
  }
}
