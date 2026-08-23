import * as THREE from 'three'

export type CameraMode = 'menu' | 'gameplay' | 'dawn'

/**
 * Сцена, камера и свет. Камера изометрического типа под углом ~50°,
 * в меню медленно облетает остров, в игре стоит с лёгким штормовым качанием.
 */
export class SceneManager {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly sunLight: THREE.DirectionalLight
  readonly hemisphere: THREE.HemisphereLight

  private mode: CameraMode = 'menu'
  private menuOrbit = 0
  private elapsed = 0
  private shakePower = 0
  private readonly shakeOffset = new THREE.Vector3()
  private readonly basePosition = new THREE.Vector3()
  private portrait = false

  constructor(canvasHost: HTMLElement) {
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
    })
    // Тени выключены: карта теней дублирует проход отрисовки и валит слабые
    // GPU-стеки, а ночная сцена читается контрастом луча, а не тенями.
    this.renderer.shadowMap.enabled = false
    this.renderer.setClearColor(0x10141f, 1)
    canvasHost.appendChild(this.renderer.domElement)

    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.FogExp2(0x0a0e18, 0.0085)

    this.camera = new THREE.PerspectiveCamera(50, 16 / 9, 0.5, 420)
    this.basePosition.set(34, 27, 34)
    this.camera.position.copy(this.basePosition)
    this.camera.lookAt(0, 5, 0)

    this.hemisphere = new THREE.HemisphereLight(0x1a2340, 0x05070c, 0.55)
    this.scene.add(this.hemisphere)

    this.sunLight = new THREE.DirectionalLight(0x8fa7d9, 0.3)
    this.sunLight.position.set(-40, 55, -25)
    this.scene.add(this.sunLight)

    window.addEventListener('resize', () => this.resize())
    this.resize()
  }

  setMode(mode: CameraMode): void {
    this.mode = mode
  }

  addShake(power: number): void {
    this.shakePower = Math.min(1.4, this.shakePower + power)
  }

  resize(): void {
    // Геометрия интерфейса и канваса считается от измеренного вьюпорта.
    const vv: VisualViewport | null = typeof visualViewport !== 'undefined' ? visualViewport : null
    const width = Math.max(320, vv ? vv.width : window.innerWidth)
    const height = Math.max(240, vv ? vv.height : window.innerHeight)
    const mobile = Math.min(width, height) < 720
    const pixelRatio = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2)
    this.renderer.setPixelRatio(pixelRatio)
    this.renderer.setSize(width, height)
    document.documentElement.style.setProperty('--vp-h', `${Math.round(height)}px`)

    const aspect = width / height
    this.portrait = aspect < 1
    // В портрете вертикальный FOV растёт, иначе горизонтальный обзор схлопывается в трубу.
    this.camera.fov = aspect < 1 ? Math.round(50 / Math.min(aspect, 0.72)) : 50
    this.camera.aspect = aspect
    this.camera.updateProjectionMatrix()
  }

  update(dt: number): void {
    this.elapsed += dt
    if (this.mode === 'menu') {
      this.menuOrbit += dt * (Math.PI * 2) / 90
      const orbitRadius = 40
      this.basePosition.set(
        Math.cos(this.menuOrbit) * orbitRadius,
        26 + Math.sin(this.menuOrbit * 0.7) * 3,
        Math.sin(this.menuOrbit) * orbitRadius,
      )
    } else {
      this.basePosition.set(34, 27, 34)
    }

    // Штормовое качание и затухающий шейк камеры.
    const swayX = Math.sin(this.elapsed * 0.9) * 0.35
    const swayY = Math.sin(this.elapsed * 1.3 + 1.7) * 0.25
    this.shakePower *= Math.pow(0.02, dt)
    if (this.shakePower < 0.001) this.shakePower = 0
    const shakeAmp = this.shakePower * 0.9
    this.shakeOffset.set(
      swayX + (Math.random() - 0.5) * shakeAmp,
      swayY + (Math.random() - 0.5) * shakeAmp,
      (Math.random() - 0.5) * shakeAmp,
    )
    this.camera.position.copy(this.basePosition).add(this.shakeOffset)
    this.camera.lookAt(0, this.portrait ? 8 : 5, 0)
  }

  render(): void {
    this.renderer.render(this.scene, this.camera)
  }
}
