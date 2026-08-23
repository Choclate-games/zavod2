import * as THREE from 'three'

export class SceneManager {
  public scene: THREE.Scene
  public camera: THREE.PerspectiveCamera
  public renderer: THREE.WebGLRenderer

  private dirLight: THREE.DirectionalLight
  private ambientLight: THREE.HemisphereLight
  private parcelPointLight: THREE.PointLight

  // Camera settings
  private baseFov = 55
  private targetFov = 55
  private targetPosition = new THREE.Vector3()
  private targetLookAt = new THREE.Vector3()
  private currentLookAt = new THREE.Vector3()
  private cameraOffset = new THREE.Vector3(0.6, 2.2, -3.8) // Right shoulder chase cam

  // Camera Shake Trauma
  private trauma = 0
  private maxShakeOffset = 0.25
  private maxShakeAngle = 0.05

  // Menu Orbit Mode
  private isMenuMode = true
  private menuTime = 0

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x18121e)
    this.scene.fog = new THREE.FogExp2(0x18121e, 0.009)

    // Perspective Camera
    this.camera = new THREE.PerspectiveCamera(
      this.baseFov,
      window.innerWidth / window.innerHeight,
      0.1,
      350
    )
    this.camera.position.set(0, 4, -8)

    // Renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: 'high-performance',
    })
    const pr = Math.min(window.devicePixelRatio || 1, 1.5)
    this.renderer.setPixelRatio(pr)
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.toneMappingExposure = 1.1

    // Lighting (Golden Hour Steampunk Realism Lite)
    // Low directional sun (#FFA447)
    this.dirLight = new THREE.DirectionalLight(0xffa447, 2.2)
    this.dirLight.position.set(25, 30, -35)
    this.dirLight.castShadow = true
    this.dirLight.shadow.mapSize.width = 1024
    this.dirLight.shadow.mapSize.height = 1024
    this.dirLight.shadow.camera.near = 0.5
    this.dirLight.shadow.camera.far = 120
    this.dirLight.shadow.camera.left = -20
    this.dirLight.shadow.camera.right = 20
    this.dirLight.shadow.camera.top = 20
    this.dirLight.shadow.camera.bottom = -20
    this.dirLight.shadow.bias = -0.0005
    this.scene.add(this.dirLight)

    // Cold ambient sky (#394867) + warm roof bounce (#231b2a)
    this.ambientLight = new THREE.HemisphereLight(0xffb077, 0x394867, 0.9)
    this.scene.add(this.ambientLight)

    // Parcel glow point light (#00F5D4)
    this.parcelPointLight = new THREE.PointLight(0x00f5d4, 1.8, 8)
    this.parcelPointLight.position.set(0, 1.2, 0)
    this.scene.add(this.parcelPointLight)

    this.onResize = this.onResize.bind(this)
    window.addEventListener('resize', this.onResize)
  }

  public setMenuMode(isMenu: boolean): void {
    this.isMenuMode = isMenu
    if (isMenu) {
      this.targetFov = 50
    } else {
      this.targetFov = this.baseFov
    }
  }

  public addTrauma(amount: number): void {
    this.trauma = Math.min(1.0, this.trauma + amount)
  }

  public setTargetFov(fov: number): void {
    this.targetFov = fov
  }

  public updateParcelLightPosition(x: number, y: number, z: number): void {
    this.parcelPointLight.position.set(x, y + 1.1, z)
  }

  public update(dt: number, playerPos: THREE.Vector3, playerVelocityZ: number, rollAngle = 0): void {
    // Dynamic FOV interpolation
    this.camera.fov += (this.targetFov - this.camera.fov) * Math.min(dt * 6.0, 1.0)
    this.camera.updateProjectionMatrix()

    if (this.isMenuMode) {
      this.menuTime += dt * 0.4
      // Slow cinematic camera drift above roofs
      const orbitDist = 7.0
      this.camera.position.set(
        playerPos.x + Math.sin(this.menuTime) * orbitDist * 0.7 + 2.5,
        playerPos.y + 2.8 + Math.sin(this.menuTime * 0.5) * 0.4,
        playerPos.z - Math.cos(this.menuTime) * orbitDist
      )
      this.currentLookAt.set(playerPos.x, playerPos.y + 1.2, playerPos.z + 1.5)
      this.camera.lookAt(this.currentLookAt)
    } else {
      // Dynamic camera chase behind player
      // When moving fast (e.g. 22 m/s), pull back slightly for speed sensation
      const speedFactor = Math.max(0, Math.min(1, (playerVelocityZ - 10) / 14))
      const dynamicOffsetZ = this.cameraOffset.z - speedFactor * 1.4
      const dynamicOffsetY = this.cameraOffset.y + speedFactor * 0.3

      this.targetPosition.set(
        playerPos.x + this.cameraOffset.x,
        playerPos.y + dynamicOffsetY,
        playerPos.z + dynamicOffsetZ
      )

      // Smooth camera lerp
      const lerpFactor = Math.min(dt * 9.0, 1.0)
      this.camera.position.lerp(this.targetPosition, lerpFactor)

      this.targetLookAt.set(
        playerPos.x + 0.2,
        playerPos.y + 1.3,
        playerPos.z + 8.0
      )
      this.currentLookAt.lerp(this.targetLookAt, Math.min(dt * 12.0, 1.0))
      this.camera.lookAt(this.currentLookAt)

      // Apply roll tilt (for cable balancing / banking)
      if (rollAngle !== 0) {
        this.camera.rotation.z = THREE.MathUtils.lerp(this.camera.rotation.z, -rollAngle * 0.4, dt * 8)
      } else {
        this.camera.rotation.z = THREE.MathUtils.lerp(this.camera.rotation.z, 0, dt * 8)
      }

      // Camera Trauma Shake
      if (this.trauma > 0) {
        const shake = this.trauma * this.trauma
        const shakeX = (Math.random() * 2 - 1) * this.maxShakeOffset * shake
        const shakeY = (Math.random() * 2 - 1) * this.maxShakeOffset * shake
        const shakeRot = (Math.random() * 2 - 1) * this.maxShakeAngle * shake

        this.camera.position.x += shakeX
        this.camera.position.y += shakeY
        this.camera.rotation.z += shakeRot

        this.trauma = Math.max(0, this.trauma - dt * 2.0)
      }

      // Move directional light with player
      this.dirLight.position.set(playerPos.x + 25, playerPos.y + 30, playerPos.z - 35)
      this.dirLight.target.position.set(playerPos.x, playerPos.y, playerPos.z + 10)
      this.dirLight.target.updateMatrixWorld()
    }
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera)
  }

  public onResize(): void {
    const width = window.innerWidth
    const height = window.innerHeight
    this.camera.aspect = width / height

    // Adjust vertical FOV for portrait mode to keep horizontal view wide
    if (width < height) {
      this.baseFov = 64
    } else {
      this.baseFov = 55
    }
    if (!this.isMenuMode) {
      this.targetFov = this.baseFov
    }
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }
}
