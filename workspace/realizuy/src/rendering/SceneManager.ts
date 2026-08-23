import * as THREE from 'three'
import { eventBus } from '../core/EventBus'

export class SceneManager {
  private static instance: SceneManager
  public scene: THREE.Scene
  public camera: THREE.PerspectiveCamera
  public renderer: THREE.WebGLRenderer
  public canvas: HTMLCanvasElement

  private isMenuMode = true
  private orbitAngle = 0
  private targetPosition = new THREE.Vector3(0, 1.0, 0)
  private currentCameraPos = new THREE.Vector3(0, 3.5, 7.5)
  private cameraLookTarget = new THREE.Vector3(0, 1.2, 0)

  // Camera Shake Trauma system
  private trauma = 0
  private traumaDecay = 2.5
  private shakeOffset = new THREE.Vector3()

  // Dynamic FOV kick zoom
  private baseFov = 55
  private targetFov = 55

  public static getInstance(): SceneManager {
    if (!SceneManager.instance) {
      SceneManager.instance = new SceneManager()
    }
    return SceneManager.instance
  }

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement
    if (!this.canvas) {
      this.canvas = document.createElement('canvas')
      this.canvas.id = 'game-canvas'
      document.body.appendChild(this.canvas)
    }

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(0x0d0f14)
    this.scene.fog = new THREE.FogExp2(0x0d0f14, 0.025)

    const aspect = window.innerWidth / Math.max(1, window.innerHeight)
    this.camera = new THREE.PerspectiveCamera(this.baseFov, aspect, 0.1, 150)
    this.camera.position.set(0, 4, 8)

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap

    this.setupLighting()
    this.setupListeners()
    this.handleResize()
  }

  private setupLighting(): void {
    // Ambient fill
    const ambient = new THREE.AmbientLight(0x161b24, 0.8)
    this.scene.add(ambient)

    // Key Light: Upper Cyan Spotlight
    const keyLight = new THREE.DirectionalLight(0x00f0ff, 2.2)
    keyLight.position.set(6, 12, 5)
    keyLight.castShadow = true
    keyLight.shadow.mapSize.width = 1024
    keyLight.shadow.mapSize.height = 1024
    keyLight.shadow.camera.near = 0.5
    keyLight.shadow.camera.far = 30
    keyLight.shadow.camera.left = -15
    keyLight.shadow.camera.right = 15
    keyLight.shadow.camera.top = 15
    keyLight.shadow.camera.bottom = -15
    this.scene.add(keyLight)

    // Fill Light: Lower Warm Orange Light
    const fillLight = new THREE.DirectionalLight(0xff6b00, 1.1)
    fillLight.position.set(-6, -2, -5)
    this.scene.add(fillLight)

    // Rim Light: Vivid Purple Backlight
    const rimLight = new THREE.PointLight(0xd946ef, 2.0, 30)
    rimLight.position.set(0, 6, -10)
    this.scene.add(rimLight)

    // Secondary Rim
    const rimLight2 = new THREE.PointLight(0x00f0ff, 1.5, 25)
    rimLight2.position.set(10, 4, -8)
    this.scene.add(rimLight2)
  }

  private setupListeners(): void {
    window.addEventListener('resize', () => this.handleResize())
    window.addEventListener('orientationchange', () => setTimeout(() => this.handleResize(), 100))

    eventBus.on('SCREEN_SHAKE', (intensity: number) => {
      this.addTrauma(intensity)
    })

    eventBus.on('HITSTOP_TRIGGERED', (duration: number) => {
      this.triggerKickZoom(duration)
    })
  }

  public handleResize(): void {
    const width = window.innerWidth
    const height = window.innerHeight
    const aspect = width / Math.max(1, height)

    // Adjust vertical FOV for portrait/mobile
    if (aspect < 1.0) {
      this.baseFov = 65
    } else {
      this.baseFov = 55
    }
    this.targetFov = this.baseFov

    this.camera.aspect = aspect
    this.camera.fov = this.baseFov
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
  }

  public setMenuMode(isMenu: boolean): void {
    this.isMenuMode = isMenu
  }

  public addTrauma(amount: number): void {
    this.trauma = Math.min(1.0, this.trauma + amount)
  }

  public triggerKickZoom(_duration: number): void {
    this.targetFov = this.baseFov - 6
    setTimeout(() => {
      this.targetFov = this.baseFov
    }, 120)
  }

  public updateCamera(dt: number, playerPos?: THREE.Vector3, playerHeading = 0): void {
    // FOV lerp
    this.camera.fov += (this.targetFov - this.camera.fov) * Math.min(1, dt * 15)
    this.camera.updateProjectionMatrix()

    // Trauma decay & shake
    if (this.trauma > 0) {
      this.trauma = Math.max(0, this.trauma - dt * this.traumaDecay)
      const shakePower = this.trauma * this.trauma
      const time = performance.now() * 0.05
      this.shakeOffset.set(
        Math.sin(time * 1.3) * 0.35 * shakePower,
        Math.cos(time * 1.7) * 0.35 * shakePower,
        Math.sin(time * 1.1) * 0.25 * shakePower,
      )
    } else {
      this.shakeOffset.set(0, 0, 0)
    }

    if (this.isMenuMode || !playerPos) {
      // Orbit around center
      this.orbitAngle += dt * 0.25
      const orbitDist = 8.5
      const height = 3.2
      this.currentCameraPos.set(
        Math.sin(this.orbitAngle) * orbitDist,
        height,
        Math.cos(this.orbitAngle) * orbitDist,
      )
      this.cameraLookTarget.set(0, 1.2, 0)
    } else {
      // 3rd Person Follow behind player
      this.targetPosition.copy(playerPos)

      const followDist = 5.5
      const followHeight = 2.8
      const angle = playerHeading

      const desiredCamPos = new THREE.Vector3(
        playerPos.x - Math.sin(angle) * followDist,
        playerPos.y + followHeight,
        playerPos.z - Math.cos(angle) * followDist,
      )

      this.currentCameraPos.lerp(desiredCamPos, Math.min(1, dt * 8))
      const desiredLook = new THREE.Vector3(playerPos.x, playerPos.y + 1.2, playerPos.z)
      this.cameraLookTarget.lerp(desiredLook, Math.min(1, dt * 10))
    }

    this.camera.position.copy(this.currentCameraPos).add(this.shakeOffset)
    this.camera.lookAt(this.cameraLookTarget)
  }

  public render(): void {
    this.renderer.render(this.scene, this.camera)
  }
}

export const sceneManager = SceneManager.getInstance()
