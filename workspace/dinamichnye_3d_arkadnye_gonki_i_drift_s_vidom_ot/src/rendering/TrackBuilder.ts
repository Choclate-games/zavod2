import * as THREE from 'three'
import { RAPIER, IG_GROUND, IG_SENSOR, PhysicsWorld } from '../physics/PhysicsWorld'

/**
 * Процедурный ледяной серпантин: фиксированный авторский спуск точка-в-точку,
 * детерминированный по seed перевала. Три типа полотна (снег, синий лёд в
 * апексах, скальная обочина) и открытый обрыв без невидимых стен.
 */

export const SURFACE_SNOW = 0
export const SURFACE_ICE = 1

export interface TrackData {
  group: THREE.Group
  /** Центральная линия: xyz на точку, шаг SAMPLE_STEP метров. */
  centerX: Float32Array
  centerY: Float32Array
  centerZ: Float32Array
  heading: Float32Array
  halfWidth: number
  surfaces: Uint8Array
  length: number
  checkpointIndices: [number, number, number]
  finishIndex: number
  /** Хэндлы сенсоров: [чп0, чп1, чп2, финиш]. */
  gateHandles: number[]
}

export interface PathLocation {
  index: number
  s: number
  lateral: number
  surface: number
}

const SAMPLE_STEP = 6
const ROAD_WIDTHS = [12, 10.5, 9] as const

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export class TrackBuilder {
  constructor(
    private readonly world: PhysicsWorld,
    private readonly tier: number,
    private readonly seed: number,
  ) {}

  private readonly locateOut: PathLocation = { index: 0, s: 0, lateral: 0, surface: SURFACE_SNOW }

  build(trackIndex: number): TrackData {
    const rng = mulberry32(this.seed)
    const halfWidth = ROAD_WIDTHS[Math.min(2, this.tier)] / 2

    // ── центральная линия ────────────────────────────────────────────────
    const cx: number[] = []
    const cy: number[] = []
    const cz: number[] = []
    const heading: number[] = []
    let x = 0
    let z = 0
    let y = 0
    let angle = 0
    let s = 0
    const hairpinEvery = 5 + Math.floor(rng() * 2)
    let sinceHairpin = 2 + Math.floor(rng() * 3)
    let turnSign = rng() > 0.5 ? 1 : -1

    while (s < 900 + this.tier * 120) {
      let curvature = 0
      if (sinceHairpin >= hairpinEvery) {
        curvature = (110 + rng() * 50) * turnSign
        sinceHairpin = 0
        hairpinEvery > 0 && void 0
      } else {
        curvature = (rng() - 0.5) * 26
        sinceHairpin++
      }
      const arcLen = 26 + rng() * 22 + Math.abs(curvature) * 0.16
      const steps = Math.max(3, Math.round(arcLen / SAMPLE_STEP))
      for (let i = 0; i < steps; i++) {
        angle += ((curvature * Math.PI) / 180) * (1 / steps)
        x += Math.sin(angle) * (arcLen / steps)
        z += Math.cos(angle) * (arcLen / steps)
        y -= (arcLen / steps) * (0.055 + this.tier * 0.012 + rng() * 0.01)
        cx.push(x)
        cy.push(y)
        cz.push(z)
        heading.push(angle)
        s += arcLen / steps
      }
      turnSign = -turnSign
    }

    const n = cx.length
    const surfaces = new Uint8Array(n).fill(SURFACE_SNOW)

    // ── синий лёд в апексах шпилек (со второго тира сложности) ──────────
    if (this.tier >= 1) {
      let runStart = 0
      for (let i = 1; i < n; i++) {
        const dHeading = Math.abs(heading[i] - heading[runStart])
        if (dHeading > Math.PI * 0.55 || i === n - 1) {
          const apex = Math.floor((runStart + i) / 2)
          const span = 4 + Math.floor(rng() * 4)
          for (let k = apex - span; k <= apex + span; k++) {
            if (k > 4 && k < n - 4) surfaces[k] = SURFACE_ICE
          }
          runStart = i
        }
      }
    }

    // ── геометрия полотна ────────────────────────────────────────────────
    const positions = new Float32Array((n * 2 + 4) * 3)
    const colors = new Float32Array((n * 2 + 4) * 3)
    const colSnow = new THREE.Color('#e8f1f8')
    const colIce = new THREE.Color('#59c2f0')
    const colEdge = new THREE.Color('#33465a')
    const tmpColor = new THREE.Color()
    const rightX = new Float32Array(n)
    const rightZ = new Float32Array(n)
    for (let i = 0; i < n; i++) {
      const h = heading[i]
      rightX[i] = Math.cos(h)
      rightZ[i] = -Math.sin(h)
    }
    const setVertex = (slot: number, px: number, py: number, pz: number, color: THREE.Color): void => {
      positions[slot * 3] = px
      positions[slot * 3 + 1] = py
      positions[slot * 3 + 2] = pz
      colors[slot * 3] = color.r
      colors[slot * 3 + 1] = color.g
      colors[slot * 3 + 2] = color.b
    }
    for (let i = 0; i < n; i++) {
      const rx = rightX[i] * halfWidth
      const rz = rightZ[i] * halfWidth
      tmpColor.copy(surfaces[i] === SURFACE_ICE ? colIce : colSnow)
      setVertex(i * 2, cx[i] - rx, cy[i], cz[i] - rz, tmpColor)
      setVertex(i * 2 + 1, cx[i] + rx, cy[i], cz[i] + rz, tmpColor)
    }
    // каменные полосы-обочины за кромкой: визуальный край и ориентир
    const edgeL = n * 2
    const edgeR = n * 2 + 2
    for (let i = 0; i < n; i++) {
      const rx = rightX[i] * (halfWidth + 1.6)
      const rz = rightZ[i] * (halfWidth + 1.6)
      setVertex(edgeL + i, cx[i] - rx, cy[i] - 0.35, cz[i] - rz, colEdge)
      setVertex(edgeR + i, cx[i] + rx, cy[i] - 0.35, cz[i] + rz, colEdge)
    }
    const indices: number[] = []
    for (let i = 0; i < n - 1; i++) {
      const a = i * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      const b = edgeL + i
      indices.push(b, b + 1, b + 2, b + 1, b + 3, b + 2)
      const c = edgeR + i
      indices.push(c, c + 1, c + 2, c + 1, c + 3, c + 2)
    }
    // Индексы секций уже смещены на длину предыдущих массивов вершин:
    // коллайдер строится ровно из тех же буферов, что и меш.

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    const material = new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.35,
      metalness: 0.08,
    })
    const roadMesh = new THREE.Mesh(geometry, material)
    roadMesh.receiveShadow = false

    const group = new THREE.Group()
    group.add(roadMesh)

    // ── коллайдер трассы (trimesh только для статичного тела) ────────────
    const bodyDesc = RAPIER.RigidBodyDesc.fixed()
    const body = this.world.world.createRigidBody(bodyDesc)
    const colliderDesc = RAPIER.ColliderDesc.trimesh(positions, new Uint32Array(indices))
      .setCollisionGroups(IG_GROUND)
      .setFriction(1.0)
    this.world.world.createCollider(colliderDesc, body)

    // ── сенсоры чекпоинтов и финишной весовой рамки ─────────────────────
    const cpFracs: [number, number, number] = [0.25, 0.5, 0.75]
    const checkpointIndices: [number, number, number] = [
      Math.floor(cpFracs[0] * n),
      Math.floor(cpFracs[1] * n),
      Math.floor(cpFracs[2] * n),
    ]
    const finishIndex = n - 3
    const gateIndices = [...checkpointIndices, finishIndex]
    const gateHandles: number[] = []
    for (const gi of gateIndices) {
      const desc = RAPIER.ColliderDesc.cuboid(halfWidth + 3, 4, 1.2)
        .setSensor(true)
        .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS)
        .setCollisionGroups(IG_SENSOR)
      desc.setTranslation(cx[gi], cy[gi] + 3, cz[gi])
      const quat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), heading[gi])
      desc.setRotation({ x: quat.x, y: quat.y, z: quat.z, w: quat.w })
      const sensorCollider = this.world.world.createCollider(desc, body)
      gateHandles.push(sensorCollider.handle)
    }

    // визуальные рамки чекпоинтов и финиша
    const gateMat = new THREE.MeshStandardMaterial({ color: '#00E5FF', emissive: '#00E5FF', emissiveIntensity: 0.7 })
    const finishMat = new THREE.MeshStandardMaterial({ color: '#FFB703', emissive: '#FFB703', emissiveIntensity: 0.9 })
    for (const gi of gateIndices) {
      const isFinish = gi === finishIndex
      const post = new THREE.BoxGeometry(0.4, 8, 0.4)
      const barMat = isFinish ? finishMat : gateMat
      for (const side of [-1, 1]) {
        const pillar = new THREE.Mesh(post, barMat)
        pillar.position.set(cx[gi] + rightX[gi] * (halfWidth + 1) * side, cy[gi] + 4, cz[gi] + rightZ[gi] * (halfWidth + 1) * side)
        group.add(pillar)
      }
      const bar = new THREE.Mesh(new THREE.BoxGeometry(halfWidth * 2 + 2.4, 0.3, 0.3), barMat)
      bar.position.set(cx[gi], cy[gi] + 8, cz[gi])
      bar.rotation.y = heading[gi]
      group.add(bar)
    }

    void trackIndex
    this.locateOut.index = 0
    return {
      group,
      centerX: Float32Array.from(cx),
      centerY: Float32Array.from(cy),
      centerZ: Float32Array.from(cz),
      heading: Float32Array.from(heading),
      halfWidth,
      surfaces,
      length: s,
      checkpointIndices,
      finishIndex,
      gateHandles,
    }
  }

  /**
   * Позиция на трассе по мировым координатам. Локальный поиск от подсказки —
   * переиспользуемый объект, аллокаций в кадре нет.
   */
  locate(track: TrackData, x: number, z: number, hint: number): PathLocation {
    const n = track.centerX.length
    const out = this.locateOut
    let bestIdx = hint
    let bestDist = Infinity
    for (let k = -12; k <= 12; k++) {
      const i = Math.min(n - 1, Math.max(0, hint + k))
      const dx = x - track.centerX[i]
      const dz = z - track.centerZ[i]
      const d = dx * dx + dz * dz
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    out.index = bestIdx
    out.s = bestIdx * SAMPLE_STEP
    const h = track.heading[bestIdx]
    const rx = Math.cos(h)
    const rz = -Math.sin(h)
    out.lateral = (x - track.centerX[bestIdx]) * rx + (z - track.centerZ[bestIdx]) * rz
    out.surface = track.surfaces[bestIdx]
    return out
  }

  poseAt(track: TrackData, index: number): { x: number; y: number; z: number; heading: number } {
    const i = Math.min(track.centerX.length - 1, Math.max(0, index))
    return {
      x: track.centerX[i],
      y: track.centerY[i] + 1.4,
      z: track.centerZ[i],
      heading: track.heading[i],
    }
  }
}
