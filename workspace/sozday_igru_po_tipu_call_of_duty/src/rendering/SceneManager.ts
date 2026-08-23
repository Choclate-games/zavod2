import * as THREE from 'three'
import { ThermalShaderPass } from './ThermalShaderPass'
import { ThermalPalette } from '../types'
import { BALANCE } from '../game/balanceConfig'

export class SceneManager {
  private static instance: SceneManager
  private renderer: THREE.WebGLRenderer
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private thermalPass: ThermalShaderPass
  private sceneRenderTarget: THREE.WebGLRenderTarget

  // Camera Orbit and Aim
  private orbitAngle = 0
  private orbitSpeed = BALANCE.orbit.orbitSpeed
  private aimTarget = new THREE.Vector3(0, 0, 0)
  private cameraShakeIntensity = 0

  // Procedural environment meshes
  private environmentGroup = new THREE.Group()
  private hangarGroup = new THREE.Group()
  private propsGroup = new THREE.Group()

  // Particle systems
  private tracerMesh: THREE.InstancedMesh | null = null
  private explosionGroup = new THREE.Group()

  public static getInstance(canvas?: HTMLCanvasElement): SceneManager {
    if (!SceneManager.instance) {
      if (!canvas) throw new Error('SceneManager requires canvas on initial call')
      SceneManager.instance = new SceneManager(canvas)
    }
    return SceneManager.instance
  }

  private constructor(canvas: HTMLCanvasElement) {
    const width = window.innerWidth
    const height = window.innerHeight

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance'
    })
    this.renderer.setSize(width, height)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.toneMapping = THREE.NoToneMapping

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x1a1d20)

    // Perspective Camera at 1000m altitude
    this.camera = new THREE.PerspectiveCamera(45, width / height, 10, 3000)
    this.camera.position.set(0, BALANCE.orbit.altitude, BALANCE.orbit.orbitRadius)
    this.camera.lookAt(0, 0, 0)

    this.sceneRenderTarget = new THREE.WebGLRenderTarget(width, height, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      format: THREE.RGBAFormat
    })

    this.thermalPass = new ThermalShaderPass(width, height)

    this.setupLighting()
    this.buildCombatMap()
    this.buildHangarScene()
    this.setupTracers()

    this.scene.add(this.environmentGroup)
    this.scene.add(this.propsGroup)
    this.scene.add(this.explosionGroup)

    window.addEventListener('resize', () => this.onWindowResize())
  }

  private setupLighting(): void {
    const ambientLight = new THREE.AmbientLight(0x222a33, 0.4)
    this.scene.add(ambientLight)

    const moonLight = new THREE.DirectionalLight(0xaaccff, 0.8)
    moonLight.position.set(200, 500, 100)
    this.scene.add(moonLight)
  }

  private buildCombatMap(): void {
    // Ground plane
    const groundGeo = new THREE.PlaneGeometry(1200, 1200, 32, 32)
    groundGeo.rotateX(-Math.PI / 2)
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0x1a1d20,
      roughness: 0.9,
      metalness: 0.1
    })
    const ground = new THREE.Mesh(groundGeo, groundMat)
    this.environmentGroup.add(ground)

    // Main Road Crossroad
    const roadGeo = new THREE.PlaneGeometry(28, 600)
    roadGeo.rotateX(-Math.PI / 2)
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x121517,
      roughness: 0.8
    })
    const road1 = new THREE.Mesh(roadGeo, roadMat)
    road1.position.y = 0.05
    this.environmentGroup.add(road1)

    const road2 = new THREE.Mesh(roadGeo, roadMat)
    road2.rotation.y = Math.PI / 2
    road2.position.y = 0.05
    this.environmentGroup.add(road2)

    // Procedural Buildings and Warehouses
    const buildingMat = new THREE.MeshStandardMaterial({
      color: 0x252a30,
      roughness: 0.85
    })
    const roofMat = new THREE.MeshStandardMaterial({
      color: 0x181c20,
      roughness: 0.95
    })

    const buildingCoords = [
      { x: -70, z: -60, w: 40, h: 14, d: 35 },
      { x: 65, z: -55, w: 35, h: 18, d: 45 },
      { x: -80, z: 75, w: 50, h: 12, d: 30 },
      { x: 75, z: 80, w: 45, h: 16, d: 40 },
      { x: -140, z: -20, w: 60, h: 10, d: 40 },
      { x: 135, z: 30, w: 55, h: 12, d: 35 },
      { x: -30, z: -160, w: 40, h: 15, d: 30 },
      { x: 40, z: 170, w: 45, h: 14, d: 35 }
    ]

    for (const b of buildingCoords) {
      const geo = new THREE.BoxGeometry(b.w, b.h, b.d)
      const mesh = new THREE.Mesh(geo, buildingMat)
      mesh.position.set(b.x, b.h / 2, b.z)
      this.environmentGroup.add(mesh)

      // Flat roof border
      const roofBorderGeo = new THREE.BoxGeometry(b.w + 1, 1, b.d + 1)
      const roofMesh = new THREE.Mesh(roofBorderGeo, roofMat)
      roofMesh.position.set(b.x, b.h + 0.5, b.z)
      this.environmentGroup.add(roofMesh)
    }

    // Concrete blast walls and barricades
    const wallGeo = new THREE.BoxGeometry(3, 4, 30)
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x202428, roughness: 0.9 })
    const wallPositions = [
      { x: -22, z: -25, ry: 0 },
      { x: 22, z: -25, ry: 0 },
      { x: -22, z: 45, ry: 0 },
      { x: 22, z: 45, ry: 0 },
      { x: 0, z: -90, ry: Math.PI / 2 }
    ]
    for (const wp of wallPositions) {
      const wall = new THREE.Mesh(wallGeo, wallMat)
      wall.position.set(wp.x, 2, wp.z)
      wall.rotation.y = wp.ry
      this.environmentGroup.add(wall)
    }
  }

  private buildHangarScene(): void {
    // AC-130 Gunship model for Main Menu background
    const plane = new THREE.Group()

    // Fuselage
    const fuseGeo = new THREE.CylinderGeometry(4, 4, 48, 16)
    fuseGeo.rotateZ(Math.PI / 2)
    const fuseMat = new THREE.MeshStandardMaterial({ color: 0x2b3036, roughness: 0.6, metalness: 0.3 })
    const fuselage = new THREE.Mesh(fuseGeo, fuseMat)
    plane.add(fuselage)

    // Wings
    const wingGeo = new THREE.BoxGeometry(60, 0.8, 8)
    const wings = new THREE.Mesh(wingGeo, fuseMat)
    wings.position.set(0, 1.5, 0)
    plane.add(wings)

    // Cockpit with glowing green instruments
    const cockpitGeo = new THREE.BoxGeometry(6, 3, 5)
    const cockpitMat = new THREE.MeshStandardMaterial({
      color: 0x111518,
      emissive: 0x4af626,
      emissiveIntensity: 0.6
    })
    const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat)
    cockpit.position.set(18, 1.8, 0)
    plane.add(cockpit)

    // AC-130 Guns on left side (GAU-12 25mm, Bofors 40mm, Howitzer 105mm)
    const gunMat = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.8 })
    const gun105 = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 7), gunMat)
    gun105.rotateX(Math.PI / 2)
    gun105.position.set(-6, -1, 5)
    plane.add(gun105)

    const gun40 = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 6), gunMat)
    gun40.rotateX(Math.PI / 2)
    gun40.position.set(-1, -1, 4.5)
    plane.add(gun40)

    const gun25 = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 5), gunMat)
    gun25.rotateX(Math.PI / 2)
    gun25.position.set(4, -1, 4.2)
    plane.add(gun25)

    plane.position.set(0, 5, 0)
    this.hangarGroup.add(plane)
    this.hangarGroup.visible = false
    this.scene.add(this.hangarGroup)
  }

  private setupTracers(): void {
    const tracerGeo = new THREE.CylinderGeometry(0.3, 0.3, 14, 6)
    tracerGeo.rotateX(Math.PI / 2)
    const tracerMat = new THREE.MeshBasicMaterial({
      color: 0xffffff
    })
    this.tracerMesh = new THREE.InstancedMesh(tracerGeo, tracerMat, 100)
    this.tracerMesh.count = 0
    this.scene.add(this.tracerMesh)
  }

  public setHangarMode(active: boolean): void {
    this.hangarGroup.visible = active
    this.environmentGroup.visible = !active
    this.propsGroup.visible = !active
  }

  public setThermalPalette(palette: ThermalPalette): void {
    this.thermalPass.setPalette(palette)
  }

  public setZoom(zoom: number): void {
    this.thermalPass.setZoom(zoom)
    this.camera.fov = 45 / zoom
    this.camera.updateProjectionMatrix()
  }

  public applyCameraShake(intensity: number): void {
    this.cameraShakeIntensity = Math.min(1.0, this.cameraShakeIntensity + intensity)
  }

  public setAimOffset(dx: number, dz: number): void {
    this.aimTarget.x = Math.max(-250, Math.min(250, this.aimTarget.x + dx))
    this.aimTarget.z = Math.max(-250, Math.min(250, this.aimTarget.z + dz))
  }

  public getAimPosition(): THREE.Vector3 {
    return this.aimTarget.clone()
  }

  public getCameraPosition(): THREE.Vector3 {
    return this.camera.position.clone()
  }

  public update(dt: number, time: number): void {
    // Orbit AC-130 around battlefield
    this.orbitAngle += this.orbitSpeed * dt
    const orbitX = Math.cos(this.orbitAngle) * BALANCE.orbit.orbitRadius
    const orbitZ = Math.sin(this.orbitAngle) * BALANCE.orbit.orbitRadius

    // Camera shake decay
    let shakeX = 0
    let shakeY = 0
    let shakeZ = 0
    if (this.cameraShakeIntensity > 0.001) {
      const s = this.cameraShakeIntensity * 6.0
      shakeX = (Math.random() - 0.5) * s
      shakeY = (Math.random() - 0.5) * s
      shakeZ = (Math.random() - 0.5) * s
      this.cameraShakeIntensity = Math.max(0, this.cameraShakeIntensity - dt * 2.2)
    }

    if (this.hangarGroup.visible) {
      // Menu showcase camera orbiting the gunship
      this.camera.position.set(
        Math.cos(time * 0.25) * 45,
        14 + Math.sin(time * 0.3) * 3,
        Math.sin(time * 0.25) * 45
      )
      this.camera.lookAt(0, 5, 0)
    } else {
      // Tactical gunship orbital camera at 1000m altitude
      this.camera.position.set(
        orbitX + this.aimTarget.x * 0.3 + shakeX,
        BALANCE.orbit.altitude + shakeY,
        orbitZ + this.aimTarget.z * 0.3 + shakeZ
      )
      this.camera.lookAt(
        this.aimTarget.x + shakeX * 0.2,
        0,
        this.aimTarget.z + shakeZ * 0.2
      )
    }
  }

  public render(time: number): void {
    // 1. Render main 3D scene to intermediate texture
    this.renderer.setRenderTarget(this.sceneRenderTarget)
    this.renderer.render(this.scene, this.camera)

    // 2. Apply FLIR thermal postprocessing shader pass to screen canvas
    this.thermalPass.render(this.renderer, this.sceneRenderTarget.texture, time)
  }

  public addPropMesh(mesh: THREE.Object3D): void {
    this.propsGroup.add(mesh)
  }

  public removePropMesh(mesh: THREE.Object3D): void {
    this.propsGroup.remove(mesh)
  }

  public getPropsGroup(): THREE.Group {
    return this.propsGroup
  }

  private onWindowResize(): void {
    const width = window.innerWidth
    const height = window.innerHeight
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
    this.sceneRenderTarget.setSize(width, height)
    this.thermalPass.setSize(width, height)
  }
}
