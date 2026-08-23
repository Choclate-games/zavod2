import * as THREE from 'three'
import { PERFORMANCE } from '../core/balance'

export type QualityTier = 'high' | 'medium' | 'low'

const SKY_TOP = 0x2a3a55
const SKY_BOTTOM = 0xff8f3c

/**
 * Сцена «золотого часа»: низкое солнце, тёплый туман, силуэт города на горизонте.
 * Один направленный свет с тенями, заполняющий — hemisphere; статичное окружение
 * слито в одну геометрию.
 */
export class SceneManager {
  readonly renderer: THREE.WebGLRenderer
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  private sun: THREE.DirectionalLight
  private quality: QualityTier = 'high'
  private isMobileTier = false
  private frameDrawEstimate = 0

  constructor(canvas: HTMLCanvasElement, isMobile: boolean) {
    this.isMobileTier = isMobile
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isMobile,
      powerPreference: 'high-performance',
    })
    const pixelCap = isMobile ? PERFORMANCE.MOBILE_PIXEL_RATIO_CAP : Math.min(window.devicePixelRatio, 2)
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, pixelCap))
    this.renderer.shadowMap.enabled = true
    this.renderer.shadowMap.type = THREE.PCFShadowMap

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(SKY_TOP)
    this.scene.fog = new THREE.Fog(0xd98a4f, 220, 620)

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.5, 1200)

    this.sun = new THREE.DirectionalLight(0xffa726, 2.4)
    this.sun.position.set(-90, 70, -40)
    this.sun.castShadow = true
    this.sun.shadow.mapSize.set(
      isMobile ? PERFORMANCE.SHADOW_MAP_SIZE_MOBILE : 2048,
      isMobile ? PERFORMANCE.SHADOW_MAP_SIZE_MOBILE : 2048,
    )
    this.sun.shadow.camera.near = 10
    this.sun.shadow.camera.far = 400
    this.sun.shadow.camera.left = -140
    this.sun.shadow.camera.right = 140
    this.sun.shadow.camera.top = 140
    this.sun.shadow.camera.bottom = -140
    this.scene.add(this.sun)
    this.scene.add(this.sun.target)
    this.scene.add(new THREE.HemisphereLight(0x4dd0e1, 0x263238, 0.85))

    this.buildSky()
    this.buildGround()
    this.buildSkyline()
    this.resize()
  }

  private buildSky(): void {
    const geometry = new THREE.SphereGeometry(900, 16, 10)
    const material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(SKY_TOP) },
        bottomColor: { value: new THREE.Color(SKY_BOTTOM) },
      },
      vertexShader: 'varying float vH; void main(){ vH = normalize(position).y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 topColor; uniform vec3 bottomColor; varying float vH; void main(){ float k = clamp(vH*1.4+0.35,0.0,1.0); gl_FragColor = vec4(mix(bottomColor, topColor, k),1.0); }',
    })
    this.scene.add(new THREE.Mesh(geometry, material))
  }

  private buildGround(): void {
    const geometry = new THREE.PlaneGeometry(1400, 1400, 1, 1)
    geometry.rotateX(-Math.PI / 2)
    const material = new THREE.MeshStandardMaterial({ color: 0x39404d, roughness: 0.95, metalness: 0 })
    const ground = new THREE.Mesh(geometry, material)
    ground.receiveShadow = true
    ground.position.y = 0
    this.scene.add(ground)
  }

  /** Дальние силуэты: один InstancedMesh вместо сотни мешей. */
  private buildSkyline(): void {
    const count = 60
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshStandardMaterial({ color: 0x2b3345, roughness: 0.9, metalness: 0.1 })
    const mesh = new THREE.InstancedMesh(geometry, material, count)
    const matrix = new THREE.Matrix4()
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2
      const radius = 330 + (i % 5) * 42
      const h = 30 + ((i * 37) % 90)
      matrix.makeScale(24 + (i % 4) * 9, h, 24 + ((i + 2) % 3) * 11)
      matrix.setPosition(Math.cos(angle) * radius, h / 2, Math.sin(angle) * radius)
      mesh.setMatrixAt(i, matrix)
    }
    mesh.instanceMatrix.needsUpdate = true
    this.scene.add(mesh)
  }

  resize(): void {
    const width = window.innerWidth
    const height = window.visualViewport?.height ?? window.innerHeight
    this.renderer.setSize(width, height, false)
    const aspect = width / Math.max(1, height)
    this.camera.aspect = aspect
    // В портрете расширяем вертикальный FOV, чтобы горизонтальный охват сохранялся.
    if (aspect < 1) {
      this.camera.fov = Math.min(72, Math.atan(Math.tan((45 * Math.PI) / 360) / aspect) * 2 * (180 / Math.PI))
    } else {
      this.camera.fov = 45
    }
    this.camera.updateProjectionMatrix()
  }

  setQuality(tier: QualityTier): void {
    if (tier === this.quality) return
    this.quality = tier
    this.renderer.shadowMap.enabled = tier !== 'low'
    this.sun.castShadow = tier !== 'low'
    this.scene.fog = tier === 'low' ? null : new THREE.Fog(0xd98a4f, 220, 620)
    this.frameDrawEstimate = 0
  }

  get currentQuality(): QualityTier {
    return this.quality
  }

  get mobile(): boolean {
    return this.isMobileTier
  }

  render(): void {
    this.renderer.render(this.scene, this.camera)
    this.frameDrawEstimate = this.renderer.info.render.calls
    this.renderer.info.autoReset = true
  }

  get drawCalls(): number {
    return this.frameDrawEstimate
  }
}
