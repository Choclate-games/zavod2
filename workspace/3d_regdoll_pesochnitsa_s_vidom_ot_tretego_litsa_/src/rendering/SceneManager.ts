import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'

/**
 * Сцена, свет и камера. FOV пересчитывается под аспект: в портрете
 * горизонтальный обзор не должен схлопываться в трубу.
 */
export class SceneManager {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer

  private readonly baseFov = 55
  private targetFov = 55
  private menuAngle = 0
  private mode: 'menu' | 'chase' | 'focus' = 'menu'
  private readonly focusPoint = new THREE.Vector3(0, 6, -12)
  private readonly chasePos = new THREE.Vector3(12, 7, 8)
  private readonly chaseLook = new THREE.Vector3(0, 3, -10)
  private readonly scratchA = new THREE.Vector3()
  private readonly scratchB = new THREE.Vector3()

  constructor(canvasContainer: HTMLElement) {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color('#1C1C24')
    this.scene.fog = new THREE.Fog('#1C1C24', 30, 90)

    this.camera = new THREE.PerspectiveCamera(this.baseFov, window.innerWidth / window.innerHeight, 0.1, 200)
    this.camera.position.set(12, 7, 8)
    this.camera.lookAt(0, 3, -10)

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    // Программный рендер (SwiftShader/llvmpipe) не переваривает depth-шейдеры
    // теней: там тени отключаются целиком.
    const gl = this.renderer.getContext()
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info')
    const gpuName = debugInfo ? String(gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL)) : ''
    const softwareRendered = /swiftshader|llvmpipe|software/i.test(gpuName)
    this.renderer.shadowMap.enabled = !softwareRendered
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap
    canvasContainer.appendChild(this.renderer.domElement)

    // Окружение для металла и хрусталя: без него металл рендерится чёрным.
    const pmrem = new THREE.PMREMGenerator(this.renderer)
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture

    const ambient = new THREE.AmbientLight('#F7E7CE', 0.5)
    this.scene.add(ambient)

    const sun = new THREE.DirectionalLight('#FFD98A', 1.4)
    sun.position.set(14, 18, 6)
    sun.castShadow = !softwareRendered
    sun.shadow.mapSize.set(1024, 1024)
    sun.shadow.camera.left = -25
    sun.shadow.camera.right = 25
    sun.shadow.camera.top = 25
    sun.shadow.camera.bottom = -25
    this.scene.add(sun)

    // Тёплые точки внутри люстр и канделябров.
    for (const spot of [
      { x: 0, z: -12 },
      { x: -5, z: -4 },
      { x: 5, z: -4 },
      { x: 0, z: -18 },
    ]) {
      const light = new THREE.PointLight('#FFC96B', 18, 14, 2)
      light.position.set(spot.x, 8, spot.z)
      this.scene.add(light)
    }

    window.addEventListener('resize', () => this.onResize())
  }

  private onResize(): void {
    this.camera.aspect = window.innerWidth / window.innerHeight
    // Портрет: держим горизонтальный обзор, поднимая вертикальный FOV.
    const aspectBoost = Math.max(1, 1.6 / Math.max(this.camera.aspect, 0.01))
    const effectiveBase = this.baseFov * aspectBoost
    this.camera.fov = Math.min(effectiveBase * (this.targetFov / this.baseFov), 110)
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
  }

  setMode(mode: 'menu' | 'chase' | 'focus'): void {
    if (this.mode === mode) return
    this.mode = mode
  }

  setFocus(x: number, y: number, z: number): void {
    this.focusPoint.set(x, y, z)
  }

  requestZoom(fov: number): void {
    this.targetFov = fov
  }

  /** Медленный облёт зала в меню. */
  private updateMenu(dt: number): void {
    this.menuAngle += dt * 0.08
    const r = 17
    const cx = Math.sin(this.menuAngle) * r
    const cz = -8 + Math.cos(this.menuAngle) * r
    this.scratchA.set(cx, 7.5, cz)
    this.chasePos.lerp(this.scratchA, 0.02)
    this.scratchB.set(0, 4, -10)
    this.chaseLook.lerp(this.scratchB, 0.05)
    this.camera.position.copy(this.chasePos)
    this.camera.lookAt(this.chaseLook)
  }

  updateChase(targetX: number, targetY: number, targetZ: number, velZ: number): void {
    this.scratchA.set(targetX, targetY + 2.4, targetZ + (velZ >= 0 ? 7 : -7))
    this.chasePos.lerp(this.scratchA, 0.08)
    this.scratchB.set(targetX, targetY, targetZ)
    this.chaseLook.lerp(this.scratchB, 0.2)
    this.camera.position.copy(this.chasePos)
    this.camera.lookAt(this.chaseLook)
  }

  private updateFocus(dtReal: number): void {
    this.scratchA.set(this.focusPoint.x + 6, this.focusPoint.y + 2, this.focusPoint.z + 7)
    this.chasePos.lerp(this.scratchA, Math.min(dtReal * 3, 0.2))
    this.chaseLook.lerp(this.focusPoint, 0.15)
    this.camera.position.copy(this.chasePos)
    this.camera.lookAt(this.chaseLook)
  }

  tick(dtReal: number): void {
    if (this.mode === 'menu') this.updateMenu(dtReal)
    else if (this.mode === 'focus') this.updateFocus(dtReal)
    // chase управляется снаружи через updateChase.
    const fovDelta = this.targetFov - this.camera.fov
    if (Math.abs(fovDelta) > 0.1) {
      this.camera.fov += fovDelta * Math.min(dtReal * 4, 0.2)
      this.camera.updateProjectionMatrix()
    }
    this.renderer.render(this.scene, this.camera)
  }
}
