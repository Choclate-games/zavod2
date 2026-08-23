// Р’Р»Р°РґРµР»РµС† Three.js: СЂРµРЅРґРµСЂРµСЂ, СЃС†РµРЅР°, РєР°РјРµСЂР°, СЃРІРµС‚, РЅРµР±Рѕ СЃ РјРѕР»РЅРёСЏРјРё, РґРѕР¶РґСЊ,
// Р±РµСЃРєРѕРЅРµС‡РЅР°СЏ СЌСЃС‚Р°РєР°РґР° Рё Р°РґР°РїС‚РёРІРЅРѕРµ РєР°С‡РµСЃС‚РІРѕ. РљР°РґСЂ СЂРёСЃСѓРµС‚ С‚РѕР»СЊРєРѕ СЌС‚РѕС‚ РєР»Р°СЃСЃ.

import * as THREE from 'three'
import { RULES } from '../config/rules'
import {
  PALETTE,
  buildPylonGeometry,
  buildRockGeometry,
  buildTrackChunkGeometry,
  makeStandard,
} from './ProceduralModels'

const CHUNK_LENGTH = 30
const CHUNK_COUNT = 14
const PYLON_EVERY = 2
const RAIN_COUNT = 700
const QUALITY_WINDOW_S = 2

export class SceneManager {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  private readonly renderer: THREE.WebGLRenderer
  private readonly canvas: HTMLCanvasElement

  private readonly skyMaterial: THREE.ShaderMaterial
  private readonly lightning: THREE.DirectionalLight
  private readonly ambient: THREE.HemisphereLight
  private readonly boltLine: THREE.Line
  private readonly boltPositions: Float32Array
  private boltVisibleS = 0

  private readonly rainGeometry: THREE.BufferGeometry
  private readonly rainPositions: Float32Array

  private readonly chunks: THREE.InstancedMesh
  private readonly pylons: THREE.InstancedMesh
  private readonly rocksLeft: THREE.InstancedMesh
  private readonly rocksRight: THREE.InstancedMesh
  private readonly dummy = new THREE.Object3D()

  private scrollSpeedMs = 0
  private windX = 0
  private nextFlashInS = 4
  private flashLevel = 0

  // РђРґР°РїС‚РёРІРЅРѕРµ РєР°С‡РµСЃС‚РІРѕ: СЃС…РѕРґРёС‚СЃСЏ Рє СЃС‚СѓРїРµРЅРё Рё Р±Р»РѕРєРёСЂСѓРµС‚СЃСЏ, Р° РЅРµ СЃРєР°С‡РµС‚.
  private readonly basePixelRatio: number
  private qualityScale = 1
  private qualityLocked = false
  private qualityTimer = 0
  private qualityFrames = 0
  private goodWindows = 0
  private qualityChanges = 0

  constructor(canvas: HTMLCanvasElement, isMobile: boolean) {
    this.canvas = canvas
    this.basePixelRatio = Math.min(window.devicePixelRatio || 1, isMobile ? RULES.pixelRatioCapMobile : 2)

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !isMobile,
      powerPreference: 'high-performance',
    })
    this.renderer.setPixelRatio(this.basePixelRatio * this.qualityScale)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping

    this.scene = new THREE.Scene()
    this.scene.fog = new THREE.Fog(PALETTE.nightBottom, 45, 420)

    this.camera = new THREE.PerspectiveCamera(RULES.fovDeg, 1, 0.08, 700)
    this.scene.add(this.camera)

    this.ambient = new THREE.HemisphereLight(0x35507a, PALETTE.nightTop, 0.85)
    this.scene.add(this.ambient)

    this.lightning = new THREE.DirectionalLight(0xcfe8ff, 0)
    this.lightning.position.set(-40, 90, -80)
    this.scene.add(this.lightning)

    const fillLight = new THREE.DirectionalLight(PALETTE.visorCyan, 0.12)
    fillLight.position.set(20, 30, 40)
    this.scene.add(fillLight)

    // РќРµР±Рѕ: РіСЂР°РґРёРµРЅС‚РЅС‹Р№ РєСѓРїРѕР» СЃРѕ РІСЃРїС‹С€РєРѕР№ РјРѕР»РЅРёР№
    this.skyMaterial = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(PALETTE.nightTop) },
        bottomColor: { value: new THREE.Color(PALETTE.nightBottom) },
        flash: { value: 0 },
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = normalize(position);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        uniform float flash;
        varying vec3 vDir;
        void main() {
          float h = clamp(vDir.y * 0.6 + 0.42, 0.0, 1.0);
          vec3 col = mix(bottomColor, topColor, h);
          col += vec3(0.85, 0.92, 1.0) * flash * (0.25 + 0.75 * h);
          gl_FragColor = vec4(col, 1.0);
        }`,
    })
    const sky = new THREE.Mesh(new THREE.SphereGeometry(520, 16, 12), this.skyMaterial)
    sky.frustumCulled = false
    this.scene.add(sky)

    // Р’РµС‚РІСЏС‰Р°СЏСЃСЏ РјРѕР»РЅРёСЏ РІ РЅРµР±Рµ: Р»РёРЅРёСЏ РёР· Р»РѕРјР°РЅС‹С… СЃРµРіРјРµРЅС‚РѕРІ
    this.boltPositions = new Float32Array(24 * 3)
    const boltGeo = new THREE.BufferGeometry()
    boltGeo.setAttribute('position', new THREE.BufferAttribute(this.boltPositions, 3))
    this.boltLine = new THREE.Line(
      boltGeo,
      new THREE.LineBasicMaterial({ color: 0xdfefff, transparent: true, blending: THREE.AdditiveBlending }),
    )
    this.boltLine.frustumCulled = false
    this.boltLine.visible = false
    this.scene.add(this.boltLine)

    // Р”РѕР¶РґСЊ
    this.rainPositions = new Float32Array(RAIN_COUNT * 3)
    this.rainGeometry = new THREE.BufferGeometry()
    for (let i = 0; i < RAIN_COUNT; i++) {
      this.rainPositions[i * 3] = (Math.random() - 0.5) * 70
      this.rainPositions[i * 3 + 1] = Math.random() * 36 - 4
      this.rainPositions[i * 3 + 2] = (Math.random() - 0.5) * 80
    }
    this.rainGeometry.setAttribute('position', new THREE.BufferAttribute(this.rainPositions, 3))
    const rain = new THREE.Points(
      this.rainGeometry,
      new THREE.PointsMaterial({ color: 0x8fb4d9, size: 0.09, transparent: true, opacity: 0.65, depthWrite: false }),
    )
    rain.frustumCulled = false
    this.scene.add(rain)

    // Р­СЃС‚Р°РєР°РґР°: С‡Р°РЅРєРё РїРѕР»РѕС‚РЅР°, РѕРїРѕСЂС‹, СЃРєР°Р»С‹ РєР°РЅСЊРѕРЅР° вЂ” РІСЃС‘ РёРЅСЃС‚Р°РЅСЃРёРЅРіРѕРј
    this.chunks = new THREE.InstancedMesh(
      buildTrackChunkGeometry(CHUNK_LENGTH),
      makeStandard(PALETTE.armorDark, 0.85, 0.25),
      CHUNK_COUNT,
    )
    this.chunks.frustumCulled = false
    for (let i = 0; i < CHUNK_COUNT; i++) {
      this.dummy.position.set(0, 0, 40 - i * CHUNK_LENGTH)
      this.dummy.updateMatrix()
      this.chunks.setMatrixAt(i, this.dummy.matrix)
    }
    this.scene.add(this.chunks)

    const pylonCount = Math.floor(CHUNK_COUNT / PYLON_EVERY)
    this.pylons = new THREE.InstancedMesh(
      buildPylonGeometry(),
      makeStandard(PALETTE.ironFrame, 0.8, 0.3),
      pylonCount,
    )
    this.pylons.frustumCulled = false
    for (let i = 0; i < pylonCount; i++) {
      this.dummy.position.set(0, 0, 40 - i * CHUNK_LENGTH * PYLON_EVERY)
      this.dummy.updateMatrix()
      this.pylons.setMatrixAt(i, this.dummy.matrix)
    }
    this.scene.add(this.pylons)

    const rockGeo = buildRockGeometry(26, 70, 22)
    const rockMat = makeStandard(0x101a2b, 0.95, 0.05)
    this.rocksLeft = new THREE.InstancedMesh(rockGeo, rockMat, 10)
    this.rocksRight = new THREE.InstancedMesh(rockGeo, rockMat, 10)
    this.rocksLeft.frustumCulled = false
    this.rocksRight.frustumCulled = false
    for (let i = 0; i < 10; i++) {
      const z = 40 - i * 34
      this.dummy.position.set(-46, 0, z)
      this.dummy.updateMatrix()
      this.rocksLeft.setMatrixAt(i, this.dummy.matrix)
      this.dummy.position.set(48, 0, z - 17)
      this.dummy.updateMatrix()
      this.rocksRight.setMatrixAt(i, this.dummy.matrix)
    }
    this.scene.add(this.rocksLeft)
    this.scene.add(this.rocksRight)

    // Р”РЅРѕ РєР°РЅСЊРѕРЅР°
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(600, 900), makeStandard(0x070c15, 1, 0))
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -62
    this.scene.add(floor)

    window.addEventListener('resize', () => this.resize())
    this.resize()
  }

  private resize(): void {
    const width = this.canvas.clientWidth || window.innerWidth
    const height = this.canvas.clientHeight || window.innerHeight
    this.renderer.setSize(width, height, false)
    this.camera.aspect = width / Math.max(1, height)
    // РІРµСЂС‚РёРєР°Р»СЊРЅС‹Р№ FOV РїРµСЂРµСЃС‡РёС‚С‹РІР°РµС‚СЃСЏ РїРѕРґ Р°СЃРїРµРєС‚: СѓР·РєРёР№ СЌРєСЂР°РЅ РЅРµ СЂРµР¶РµС‚ РѕР±Р·РѕСЂ
    this.camera.fov = this.camera.aspect < 1 ? Math.min(100, RULES.fovDeg / Math.max(0.55, this.camera.aspect) * 0.72) : RULES.fovDeg
    this.camera.updateProjectionMatrix()
  }

  /** Р’С‹СЃРѕС‚Р° РІРёРґРёРјРѕР№ РѕР±Р»Р°СЃС‚Рё РґР»СЏ UI-РїРµСЂРµРјРµРЅРЅС‹С… (РЅРµ 100vh). */
  writeViewportCssVars(root: HTMLElement): void {
    root.style.setProperty('--vp-h', `${window.innerHeight}px`)
    root.style.setProperty('--vp-w', `${window.innerWidth}px`)
  }

  setEnvironment(speedMs: number, windX: number): void {
    this.scrollSpeedMs = speedMs
    this.windX = windX
  }

  update(dt: number): void {
    // РїРѕСЂСЏРґРѕРє РєР°РґСЂР°: СЃСЂРµРґР° -> РјРѕР»РЅРёРё -> РєР°С‡РµСЃС‚РІРѕ
    const dz = this.scrollSpeedMs * dt
    for (let i = 0; i < CHUNK_COUNT; i++) {
      this.chunks.getMatrixAt(i, this.dummy.matrix)
      this.dummy.matrix.decompose(this.dummy.position, this.dummy.quaternion, this.dummy.scale)
      this.dummy.position.z += dz
      if (this.dummy.position.z > 40 + CHUNK_LENGTH / 2) this.dummy.position.z -= CHUNK_COUNT * CHUNK_LENGTH
      this.dummy.updateMatrix()
      this.chunks.setMatrixAt(i, this.dummy.matrix)
    }
    const pylonCount = this.pylons.count
    for (let i = 0; i < pylonCount; i++) {
      this.pylons.getMatrixAt(i, this.dummy.matrix)
      this.dummy.matrix.decompose(this.dummy.position, this.dummy.quaternion, this.dummy.scale)
      this.dummy.position.z += dz
      if (this.dummy.position.z > 40 + CHUNK_LENGTH / 2) this.dummy.position.z -= CHUNK_COUNT * CHUNK_LENGTH * PYLON_EVERY
      this.dummy.updateMatrix()
      this.pylons.setMatrixAt(i, this.dummy.matrix)
    }
    for (let side = 0; side < 2; side++) {
      const mesh = side === 0 ? this.rocksLeft : this.rocksRight
      for (let i = 0; i < mesh.count; i++) {
        mesh.getMatrixAt(i, this.dummy.matrix)
        this.dummy.matrix.decompose(this.dummy.position, this.dummy.quaternion, this.dummy.scale)
        this.dummy.position.z += dz
        if (this.dummy.position.z > 60) this.dummy.position.z -= 340
        this.dummy.updateMatrix()
        mesh.setMatrixAt(i, this.dummy.matrix)
      }
    }
    ;(this.chunks.instanceMatrix as THREE.BufferAttribute).needsUpdate = true
    ;(this.pylons.instanceMatrix as THREE.BufferAttribute).needsUpdate = true
    ;(this.rocksLeft.instanceMatrix as THREE.BufferAttribute).needsUpdate = true
    ;(this.rocksRight.instanceMatrix as THREE.BufferAttribute).needsUpdate = true

    // Р”РѕР¶РґСЊ РѕС‚РЅРѕСЃРёС‚РµР»СЊРЅРѕ РјС‡Р°С‰РµРіРѕСЃСЏ СЃРѕСЃС‚Р°РІР°
    const rainAttr = this.rainGeometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i < RAIN_COUNT; i++) {
      let x = rainAttr.getX(i) + this.windX * dt * 0.9
      let y = rainAttr.getY(i) - 26 * dt
      let z = rainAttr.getZ(i) + dz + this.scrollSpeedMs * 0.12 * dt
      if (y < -6) y += 36
      if (x > 35) x -= 70
      if (x < -35) x += 70
      if (z > 46) z -= 84
      if (z < -38) z += 84
      rainAttr.setXYZ(i, x, y, z)
    }
    rainAttr.needsUpdate = true

    this.updateLightning(dt)
    this.updateQuality(dt)
  }

  private updateLightning(dt: number): void {
    this.nextFlashInS -= dt
    if (this.flashLevel > 0) {
      this.flashLevel = Math.max(0, this.flashLevel - dt * 3.2)
    }
    if (this.boltVisibleS > 0) {
      this.boltVisibleS -= dt
      if (this.boltVisibleS <= 0) this.boltLine.visible = false
    }
    if (this.nextFlashInS <= 0) {
      this.nextFlashInS = 2.5 + Math.random() * 5
      this.flashLevel = 0.9 + Math.random() * 0.6
      this.rebuildBolt()
      this.boltVisibleS = 0.14 + Math.random() * 0.1
      this.boltLine.visible = true
    }
    const flicker = this.flashLevel > 0 ? this.flashLevel * (0.75 + Math.random() * 0.25) : 0
    this.lightning.intensity = flicker * 2.4
    this.skyMaterial.uniforms.flash.value = flicker
  }

  private rebuildBolt(): void {
    let x = (Math.random() - 0.5) * 160
    let y = 150 + Math.random() * 60
    let z = -220 - Math.random() * 120
    for (let i = 0; i < 24; i++) {
      this.boltPositions[i * 3] = x
      this.boltPositions[i * 3 + 1] = y
      this.boltPositions[i * 3 + 2] = z
      x += (Math.random() - 0.5) * 26
      y -= 12 + Math.random() * 8
      z += (Math.random() - 0.5) * 18
    }
    ;(this.boltLine.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate = true
  }

  private updateQuality(dt: number): void {
    if (this.qualityLocked) return
    this.qualityFrames++
    this.qualityTimer += dt
    if (this.qualityTimer < QUALITY_WINDOW_S) return
    const fps = this.qualityFrames / this.qualityTimer
    this.qualityFrames = 0
    this.qualityTimer = 0
    if (fps < 45 && this.qualityScale > 0.7) {
      this.qualityScale = Math.max(0.7, this.qualityScale - 0.15)
      this.renderer.setPixelRatio(this.basePixelRatio * this.qualityScale)
      this.goodWindows = 0
      this.qualityChanges++
    } else if (fps > 57 && this.qualityScale < 1) {
      this.goodWindows++
      if (this.goodWindows >= 2) {
        this.qualityScale = Math.min(1, this.qualityScale + 0.15)
        this.renderer.setPixelRatio(this.basePixelRatio * this.qualityScale)
        this.goodWindows = 0
        this.qualityChanges++
      }
    } else {
      this.goodWindows = 0
    }
    if (this.qualityChanges >= 4) this.qualityLocked = true
  }

  render(): void {
    this.renderer.render(this.scene, this.camera)
  }

  get drawCalls(): number {
    return this.renderer.info.render.calls
  }

  get triangles(): number {
    return this.renderer.info.render.triangles
  }

  dispose(): void {
    window.removeEventListener('resize', () => this.resize())
    this.renderer.dispose()
  }
}

