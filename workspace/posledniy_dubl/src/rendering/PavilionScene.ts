import * as THREE from 'three'

/**
 * Пакетная раскладка павильона: статичная геометрия собирается один раз
 * в InstancedMesh по материалам, чтобы держать бюджет отрисовки.
 */

export interface BoxSpec {
  x: number
  y: number
  z: number
  hx: number
  hy: number
  hz: number
  rotY?: number
}

interface MaterialSlot {
  material: THREE.MeshStandardMaterial
  boxes: BoxSpec[]
}

export class BoxBatcher {
  private readonly slots = new Map<string, MaterialSlot>()

  add(key: string, material: THREE.MeshStandardMaterial, box: BoxSpec): void {
    let slot = this.slots.get(key)
    if (!slot) {
      slot = { material, boxes: [] }
      this.slots.set(key, slot)
    }
    slot.boxes.push(box)
  }

  /** Строит InstancedMesh'и и добавляет их в сцену. Возвращает суммарное число треугольников. */
  build(parent: THREE.Object3D): number {
    const matrix = new THREE.Matrix4()
    const quat = new THREE.Quaternion()
    const euler = new THREE.Euler()
    const scale = new THREE.Vector3()
    const pos = new THREE.Vector3()
    let triangles = 0
    for (const slot of this.slots.values()) {
      const geometry = new THREE.BoxGeometry(2, 2, 2)
      const mesh = new THREE.InstancedMesh(geometry, slot.material, slot.boxes.length)
      mesh.frustumCulled = false
      for (let i = 0; i < slot.boxes.length; i++) {
        const b = slot.boxes[i]
        euler.set(0, b.rotY ?? 0, 0)
        quat.setFromEuler(euler)
        scale.set(b.hx, b.hy, b.hz)
        pos.set(b.x, b.y, b.z)
        matrix.compose(pos, quat, scale)
        mesh.setMatrixAt(i, matrix)
      }
      mesh.instanceMatrix.needsUpdate = true
      parent.add(mesh)
      triangles += 12 * slot.boxes.length
    }
    return triangles
  }
}

/** Цвета сцены повторяют палитру DESIGN.md. */
export const SCENE_COLORS = {
  floor: 0x23262e,
  wall: 0x30343f,
  backdropPainted: 0x3c465a,
  prop: 0x4a3d2b,
  crate: 0x54492f,
  truss: 0x1c1f26,
  facade: 0x8a5a3c,
  facadePanel: 0xa06a45,
  metalDark: 0x22252c,
  amberNode: 0xffb454,
  blueLamp: 0x4da3ff,
  redLamp: 0xff4d3d,
  pyroStation: 0x6b2f28,
} as const

const CORRIDOR_HALF_WIDTH = 7
const CHAMBER_LEN = 24

export interface PavilionLayout {
  chamberCentersZ: number[]
  gatePositionsZ: number[]
  directorMarkZ: number
  spawnDoors: { x: number; z: number }[]
  pyroStations: { x: number; z: number }[]
}

export function buildPavilion(scene: THREE.Scene): { layout: PavilionLayout; triangles: number } {  const batcher = new BoxBatcher()
  const mFloor = new THREE.MeshStandardMaterial({ color: SCENE_COLORS.floor, roughness: 0.95, metalness: 0 })
  const mWall = new THREE.MeshStandardMaterial({ color: SCENE_COLORS.wall, roughness: 0.9, metalness: 0 })
  const mBackdrop = new THREE.MeshStandardMaterial({ color: SCENE_COLORS.backdropPainted, roughness: 0.85, metalness: 0 })
  const mCrate = new THREE.MeshStandardMaterial({ color: SCENE_COLORS.crate, roughness: 0.8, metalness: 0.05 })
  const mTruss = new THREE.MeshStandardMaterial({ color: SCENE_COLORS.truss, roughness: 0.6, metalness: 0.3 })
  const mPyro = new THREE.MeshStandardMaterial({ color: SCENE_COLORS.pyroStation, roughness: 0.7, metalness: 0.1 })

  // Пол и базовые стены коридора.
  batcher.add('floor', mFloor, { x: 0, y: -0.25, z: -42, hx: CORRIDOR_HALF_WIDTH + 1, hy: 0.25, hz: 52 })
  batcher.add('wall', mWall, { x: -CORRIDOR_HALF_WIDTH - 0.5, y: 4.5, z: -42, hx: 0.5, hy: 4.75, hz: 52 })
  batcher.add('wall', mWall, { x: CORRIDOR_HALF_WIDTH + 0.5, y: 4.5, z: -42, hx: 0.5, hy: 4.75, hz: 52 })
  batcher.add('wall', mWall, { x: 0, y: 4.5, z: 6, hx: CORRIDOR_HALF_WIDTH + 1, hy: 4.75, hz: 0.5 })
  batcher.add('wall', mBackdrop, { x: 0, y: 4.5, z: -90, hx: CORRIDOR_HALF_WIDTH + 1, hy: 4.75, hz: 0.5 })

  const layout: PavilionLayout = {
    chamberCentersZ: [],
    gatePositionsZ: [],
    directorMarkZ: -80,
    spawnDoors: [],
    pyroStations: [],
  }

  for (let i = 0; i < 4; i++) {
    const cz = -i * CHAMBER_LEN
    layout.chamberCentersZ.push(cz)

    // Расписной задник в торце каждой палаты.
    batcher.add('backdrop', mBackdrop, { x: 0, y: 3.4, z: cz - 11.4, hx: 6.5, hy: 3.4, hz: 0.15 })

    // Ферма светового потолка.
    batcher.add('truss', mTruss, { x: 0, y: 8, z: cz, hx: CORRIDOR_HALF_WIDTH, hy: 0.15, hz: 0.15 })

    // Укрытия-ящики у стен (читаемый реквизит, не серые кубы: тёплое дерево + ремни).
    batcher.add('crate', mCrate, { x: -4.6, y: 0.55, z: cz - 4, hx: 0.9, hy: 0.55, hz: 0.9 })
    batcher.add('crate', mCrate, { x: -4.6, y: 1.5, z: cz - 4, hx: 0.7, hy: 0.45, hz: 0.7 })
    batcher.add('crate', mCrate, { x: 4.6, y: 0.55, z: cz + 3.5, hx: 0.9, hy: 0.55, hz: 0.9, rotY: 0.4 })

    // Пиростанция у правой стены.
    layout.pyroStations.push({ x: 5.9, z: cz + 6 })
    batcher.add('pyro', mPyro, { x: 6.2, y: 0.9, z: cz + 6, hx: 0.5, hy: 0.9, hz: 0.7 })

    // Дверь спавна саботажников в левой стене (визуально тёмный проём с рамкой).
    layout.spawnDoors.push({ x: -6.4, z: cz - 2 })
    batcher.add('truss', mTruss, { x: -6.9, y: 2.6, z: cz - 2, hx: 0.12, hy: 1.4, hz: 1.4 })
  }

  // Переходы-фасады между палатами стоят на границах, их звенья ставит DecorChainSystem.
  for (let k = 0; k < 3; k++) {
    layout.gatePositionsZ.push(-(k * CHAMBER_LEN + CHAMBER_LEN / 2))
  }

  // Отметка режиссёра в конце маршрута.
  batcher.add('pyro', mPyro, { x: 0, y: 0.06, z: layout.directorMarkZ, hx: 1.6, hy: 0.06, hz: 1.6 })
  batcher.add('truss', mTruss, { x: 0, y: 1.2, z: layout.directorMarkZ - 0.9, hx: 0.1, hy: 1.2, hz: 0.1 })

  const triangles = batcher.build(scene)
  return { layout, triangles }
}
