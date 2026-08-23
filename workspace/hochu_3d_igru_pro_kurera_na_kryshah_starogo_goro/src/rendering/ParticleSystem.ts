import * as THREE from 'three'

interface ParticleData {
  active: boolean
  x: number
  y: number
  z: number
  vx: number
  vy: number
  vz: number
  life: number
  maxLife: number
  scale: number
  colorR: number
  colorG: number
  colorB: number
}

export class ParticleSystem {
  private sparksMesh: THREE.InstancedMesh
  private steamMesh: THREE.InstancedMesh
  private maxSparks = 200
  private maxSteam = 150

  private sparksPool: ParticleData[] = []
  private steamPool: ParticleData[] = []

  // Preallocated temp objects to eliminate runtime allocations (Check E4)
  private dummyObj = new THREE.Object3D()
  private tempColor = new THREE.Color()

  constructor(scene: THREE.Scene) {
    // 1. Sparks Instanced Mesh (additive golden & copper sparks)
    const sparkGeo = new THREE.BoxGeometry(0.06, 0.06, 0.12)
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffd166,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    this.sparksMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, this.maxSparks)
    this.sparksMesh.frustumCulled = false
    this.sparksMesh.castShadow = false
    this.sparksMesh.receiveShadow = false
    scene.add(this.sparksMesh)

    // 2. Steam & Smoke Instanced Mesh
    const steamGeo = new THREE.SphereGeometry(0.2, 6, 5)
    const steamMat = new THREE.MeshBasicMaterial({
      color: 0xe0e6ed,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    })
    this.steamMesh = new THREE.InstancedMesh(steamGeo, steamMat, this.maxSteam)
    this.steamMesh.frustumCulled = false
    scene.add(this.steamMesh)

    // Initialize Pools
    for (let i = 0; i < this.maxSparks; i++) {
      this.sparksPool.push({
        active: false,
        x: 0,
        y: -1000,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        scale: 1,
        colorR: 1,
        colorG: 0.8,
        colorB: 0.4,
      })
      this.dummyObj.position.set(0, -1000, 0)
      this.dummyObj.updateMatrix()
      this.sparksMesh.setMatrixAt(i, this.dummyObj.matrix)
    }
    this.sparksMesh.instanceMatrix.needsUpdate = true

    for (let i = 0; i < this.maxSteam; i++) {
      this.steamPool.push({
        active: false,
        x: 0,
        y: -1000,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        life: 0,
        maxLife: 1,
        scale: 1,
        colorR: 0.9,
        colorG: 0.95,
        colorB: 1.0,
      })
      this.dummyObj.position.set(0, -1000, 0)
      this.dummyObj.updateMatrix()
      this.steamMesh.setMatrixAt(i, this.dummyObj.matrix)
    }
    this.steamMesh.instanceMatrix.needsUpdate = true
  }

  public emitSparks(
    x: number,
    y: number,
    z: number,
    count = 10,
    color = 0xffd166,
    speedMultiplier = 1.0
  ): void {
    this.tempColor.setHex(color)
    let spawned = 0
    for (let i = 0; i < this.maxSparks && spawned < count; i++) {
      const p = this.sparksPool[i]
      if (!p.active) {
        p.active = true
        p.x = x + (Math.random() - 0.5) * 0.2
        p.y = y + Math.random() * 0.1
        p.z = z + (Math.random() - 0.5) * 0.2
        p.vx = (Math.random() - 0.5) * 3.5 * speedMultiplier
        p.vy = (Math.random() * 3.0 + 1.5) * speedMultiplier
        p.vz = -(Math.random() * 4.0 + 2.0) * speedMultiplier
        p.life = 0
        p.maxLife = 0.25 + Math.random() * 0.2
        p.scale = 0.5 + Math.random() * 0.8
        p.colorR = this.tempColor.r
        p.colorG = this.tempColor.g
        p.colorB = this.tempColor.b
        spawned++
      }
    }
  }

  public emitSteam(
    x: number,
    y: number,
    z: number,
    count = 4,
    scale = 1.0
  ): void {
    let spawned = 0
    for (let i = 0; i < this.maxSteam && spawned < count; i++) {
      const p = this.steamPool[i]
      if (!p.active) {
        p.active = true
        p.x = x + (Math.random() - 0.5) * 0.3
        p.y = y + (Math.random() - 0.5) * 0.3
        p.z = z + (Math.random() - 0.5) * 0.3
        p.vx = (Math.random() - 0.5) * 1.2
        p.vy = Math.random() * 2.0 + 1.0
        p.vz = (Math.random() - 0.5) * 1.5
        p.life = 0
        p.maxLife = 0.6 + Math.random() * 0.4
        p.scale = scale * (0.8 + Math.random() * 0.5)
        spawned++
      }
    }
  }

  public update(dt: number): void {
    // 1. Update Sparks
    let sparksNeedsUpdate = false
    for (let i = 0; i < this.maxSparks; i++) {
      const p = this.sparksPool[i]
      if (p.active) {
        p.life += dt
        if (p.life >= p.maxLife) {
          p.active = false
          this.dummyObj.position.set(0, -1000, 0)
          this.dummyObj.updateMatrix()
          this.sparksMesh.setMatrixAt(i, this.dummyObj.matrix)
          sparksNeedsUpdate = true
          continue
        }

        p.vy -= 18.0 * dt // Gravity on sparks
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.z += p.vz * dt

        const progress = 1.0 - p.life / p.maxLife
        const curScale = p.scale * progress

        this.dummyObj.position.set(p.x, p.y, p.z)
        this.dummyObj.scale.set(curScale, curScale, curScale * 2.0)
        this.dummyObj.rotation.set(p.vy * 0.1, 0, p.vx * 0.1)
        this.dummyObj.updateMatrix()

        this.sparksMesh.setMatrixAt(i, this.dummyObj.matrix)
        sparksNeedsUpdate = true
      }
    }
    if (sparksNeedsUpdate) {
      this.sparksMesh.instanceMatrix.needsUpdate = true
    }

    // 2. Update Steam
    let steamNeedsUpdate = false
    for (let i = 0; i < this.maxSteam; i++) {
      const p = this.steamPool[i]
      if (p.active) {
        p.life += dt
        if (p.life >= p.maxLife) {
          p.active = false
          this.dummyObj.position.set(0, -1000, 0)
          this.dummyObj.updateMatrix()
          this.steamMesh.setMatrixAt(i, this.dummyObj.matrix)
          steamNeedsUpdate = true
          continue
        }

        p.x += p.vx * dt
        p.y += p.vy * dt
        p.z += p.vz * dt

        const progress = p.life / p.maxLife
        const curScale = p.scale * (1.0 + progress * 2.5)

        this.dummyObj.position.set(p.x, p.y, p.z)
        this.dummyObj.scale.set(curScale, curScale, curScale)
        this.dummyObj.updateMatrix()

        this.steamMesh.setMatrixAt(i, this.dummyObj.matrix)
        steamNeedsUpdate = true
      }
    }
    if (steamNeedsUpdate) {
      this.steamMesh.instanceMatrix.needsUpdate = true
    }
  }
}
