import * as THREE from 'three'

/**
 * Уровень «Каскадный прорыв»: три платформы-эшелона, соединённые мостами,
 * декорации инстансингом, ящики-укрытия (блокируют обзор), тень под навесами
 * (подозрение копится медленнее), пьедестал тотема и контрольная точка переулка.
 */

export interface Obstacle {
  x: number
  z: number
  hw: number
  hd: number
}

export interface WalkRect {
  minX: number
  maxX: number
  minZ: number
  maxZ: number
}

export interface ShadeZone {
  x: number
  z: number
  r: number
}

export interface WorldData {
  root: THREE.Group
  obstacles: Obstacle[]
  walkable: WalkRect[]
  shades: ShadeZone[]
  totemPos: THREE.Vector3
  totemMesh: THREE.Group
  exitPos: THREE.Vector3
  spawnPos: THREE.Vector3
}

const PLATFORM_COLOR = 0x8a5a33
const TRIM_COLOR = 0xe8b23a

function slab(w: number, d: number, x: number, z: number, y: number): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, 1, d)
  const mat = new THREE.MeshLambertMaterial({ color: PLATFORM_COLOR })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(x, y - 0.5, z)
  return mesh
}

function trim(w: number, d: number, x: number, z: number, y: number): THREE.Mesh {
  const geo = new THREE.BoxGeometry(w, 0.18, d)
  const mat = new THREE.MeshLambertMaterial({ color: TRIM_COLOR })
  const mesh = new THREE.Mesh(geo, mat)
  mesh.position.set(x, y + 0.02, z)
  return mesh
}

function crateMesh(): THREE.InstancedMesh {
  const geo = new THREE.BoxGeometry(1.6, 1.6, 1.6)
  const mat = new THREE.MeshLambertMaterial({ color: 0xa4763f })
  return new THREE.InstancedMesh(geo, mat, 16)
}

function buildLanterns(): { group: THREE.Group; posts: THREE.InstancedMesh; bulbs: THREE.InstancedMesh } {
  const postGeo = new THREE.CylinderGeometry(0.09, 0.09, 3.4, 6)
  const bulbGeo = new THREE.SphereGeometry(0.34, 8, 6)
  const posts = new THREE.InstancedMesh(postGeo, new THREE.MeshLambertMaterial({ color: 0x3c3050 }), 12)
  const bulbs = new THREE.InstancedMesh(bulbGeo, new THREE.MeshBasicMaterial({ color: 0xffd97a }), 12)
  const group = new THREE.Group()
  group.name = 'lanterns'
  group.add(posts, bulbs)
  return { group, posts, bulbs }
}

export function buildWorld(scene: THREE.Scene): WorldData {
  const root = new THREE.Group()
  scene.add(root)

  // Полумрак под всем уровнем.
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(320, 320),
    new THREE.MeshLambertMaterial({ color: 0x1d1740 }),
  )
  ground.rotation.x = -Math.PI / 2
  ground.position.y = -1.6
  root.add(ground)

  // Эшелоны: стартовый, средний, главный.
  const slabs: Array<[number, number, number, number]> = [
    [26, 38, 0, 27],
    [13, 6.5 * 2, 0, 5.5],
    [30, 36, 0, -15],
    [13, 6.5 * 2, 0, -36],
    [32, 36, 0, -57],
  ]
  for (const [w, d, x, z] of slabs) {
    root.add(slab(w, d, x, z, 0))
    root.add(trim(w, d, x, z, 0))
  }

  // Пьедестал тотема на главном эшелоне.
  const pedestal = new THREE.Mesh(
    new THREE.CylinderGeometry(1.1, 1.4, 1.1, 10),
    new THREE.MeshLambertMaterial({ color: 0x54406e }),
  )
  pedestal.position.set(0, 0.55, -57)
  root.add(pedestal)

  // Золотой тотем — тяжёлая реликвия фестиваля.
  const totem = new THREE.Group()
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0xf5c542, emissive: 0x6b4d00 })
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 2.1, 8), bodyMat)
  body.position.y = 1.05
  const mask = new THREE.Mesh(new THREE.ConeGeometry(0.55, 0.9, 4), bodyMat)
  mask.position.y = 2.55
  mask.rotation.y = Math.PI / 4
  totem.add(body, mask)
  totem.position.set(0, 1.1, -57)
  root.add(totem)

  // Ящики и лавки: укрытия, блокирующие линию взгляда.
  const crateSpots: Obstacle[] = [
    { x: -7, z: 20, hw: 0.8, hd: 0.8 },
    { x: 7.5, z: 31, hw: 0.8, hd: 0.8 },
    { x: -9, z: -8, hw: 1.6, hd: 0.8 },
    { x: 8.5, z: -19, hw: 0.8, hd: 1.6 },
    { x: -11.5, z: -24, hw: 0.8, hd: 0.8 },
    { x: 10, z: -50, hw: 1.6, hd: 0.8 },
    { x: -9.5, z: -63, hw: 0.8, hd: 1.6 },
    { x: 12.5, z: -68, hw: 0.8, hd: 0.8 },
  ]
  const crates = crateMesh()
  const dummy = new THREE.Object3D()
  let ci = 0
  for (const spot of crateSpots) {
    dummy.position.set(spot.x, 0.8, spot.z)
    dummy.rotation.set(0, (ci % 3) * 0.35, 0)
    dummy.scale.set(Math.max(1, spot.hw / 0.8), 1, Math.max(1, spot.hd / 0.8))
    dummy.updateMatrix()
    crates.setMatrixAt(ci++, dummy.matrix)
  }
  while (ci < 16) {
    dummy.position.set(-100, -50, -100)
    dummy.scale.set(1, 1, 1)
    dummy.rotation.set(0, 0, 0)
    dummy.updateMatrix()
    crates.setMatrixAt(ci++, dummy.matrix)
  }
  crates.instanceMatrix.needsUpdate = true
  root.add(crates)
  void dummy

  // Фонари по кромкам эшелонов.
  const { group: lanterns, posts, bulbs } = buildLanterns()
  root.add(lanterns)
  const lampSpots: Array<[number, number]> = []
  for (let i = 0; i < 4; i++) {
    lampSpots.push([-12.2, 12 + i * 9])
    lampSpots.push([12.2, 16 + i * 8])
    lampSpots.push([-14.8, -22 - i * 9])
    lampSpots.push([14.8, -46 - i * 8])
  }
  let li = 0
  for (; li < 12; li++) {
    const [lx, lz] = lampSpots[li]
    dummy.position.set(lx, 1.7, lz)
    dummy.rotation.set(0, 0, 0)
    dummy.scale.set(1, 1, 1)
    dummy.updateMatrix()
    posts.setMatrixAt(li, dummy.matrix)
    dummy.position.y = 3.4
    dummy.updateMatrix()
    bulbs.setMatrixAt(li, dummy.matrix)
  }
  posts.instanceMatrix.needsUpdate = true
  bulbs.instanceMatrix.needsUpdate = true

  // Тенистые навесы: в них подозрение растёт заметно медленнее.
  const awningGeo = new THREE.BoxGeometry(7, 0.25, 6)
  const awningMat = new THREE.MeshLambertMaterial({ color: 0x7d2f63 })
  const shadeSpots: ShadeZone[] = [
    { x: -8, z: 34, r: 4 },
    { x: 9, z: -12, r: 4 },
    { x: -10, z: -66, r: 4 },
  ]
  for (const s of shadeSpots) {
    const awning = new THREE.Mesh(awningGeo, awningMat)
    awning.position.set(s.x, 3, s.z)
    root.add(awning)
  }

  // Контрольная точка переулка за главным эшелоном.
  const exitRing = new THREE.Mesh(
    new THREE.TorusGeometry(2.4, 0.28, 8, 24),
    new THREE.MeshBasicMaterial({ color: 0x5ad7e8 }),
  )
  exitRing.rotation.x = -Math.PI / 2
  exitRing.position.set(17.5, 0.15, -70)
  root.add(exitRing)

  const walkable: WalkRect[] = [
    { minX: -13, maxX: 13, minZ: 8, maxZ: 46 },
    { minX: -6.5, maxX: 6.5, minZ: 2.2, maxZ: 8 },
    { minX: -15, maxX: 15, minZ: -33, maxZ: 2.2 },
    { minX: -6.5, maxX: 6.5, minZ: -39, maxZ: -33 },
    { minX: -16, maxX: 16, minZ: -75, maxZ: -39 },
    { minX: 13, maxX: 22, minZ: -76, maxZ: -64 },
  ]

  return {
    root,
    obstacles: crateSpots,
    walkable,
    shades: shadeSpots,
    totemPos: new THREE.Vector3(0, 0, -57),
    totemMesh: totem,
    exitPos: new THREE.Vector3(17.5, 0, -70),
    spawnPos: new THREE.Vector3(0, 0, 40),
  }
}

/** Держит игрока внутри проходимых прямоугольников уровня. */
export function clampToWalkable(rects: WalkRect[], pos: THREE.Vector3, margin: number): void {
  if (inAnyRect(rects, pos.x, pos.z, margin)) return
  let bestX = pos.x
  let bestZ = pos.z
  let bestDist = Infinity
  for (const r of rects) {
    const cx = Math.min(r.maxX - margin, Math.max(r.minX + margin, pos.x))
    const cz = Math.min(r.maxZ - margin, Math.max(r.minZ + margin, pos.z))
    const dx = pos.x - cx
    const dz = pos.z - cz
    const dist = dx * dx + dz * dz
    if (dist < bestDist) {
      bestDist = dist
      bestX = cx
      bestZ = cz
    }
  }
  pos.x = bestX
  pos.z = bestZ
}

export function inAnyRect(rects: WalkRect[], x: number, z: number, margin: number): boolean {
  for (const r of rects) {
    if (x >= r.minX + margin && x <= r.maxX - margin && z >= r.minZ + margin && z <= r.maxZ - margin) {
      return true
    }
  }
  return false
}

/** Выталкивание круга из препятствий (ящики, пьедестал). */
export function pushOutOfObstacles(obstacles: readonly Obstacle[], pos: THREE.Vector3, radius: number): void {
  for (const o of obstacles) {
    const closestX = Math.max(o.x - o.hw, Math.min(o.x + o.hw, pos.x))
    const closestZ = Math.max(o.z - o.hd, Math.min(o.z + o.hd, pos.z))
    let dx = pos.x - closestX
    let dz = pos.z - closestZ
    const distSq = dx * dx + dz * dz
    if (distSq >= radius * radius) continue
    if (distSq < 1e-6) {
      dx = pos.x - o.x
      dz = pos.z - o.z
      const len = Math.hypot(dx, dz) || 1
      dx /= len
      dz /= len
      pos.x = closestX + dx * radius
      pos.z = closestZ + dz * radius
      continue
    }
    const dist = Math.sqrt(distSq)
    pos.x = closestX + (dx / dist) * radius
    pos.z = closestZ + (dz / dist) * radius
  }
}

/**
 * Двухступенчатая проверка прямой видимости: сегмент против прямоугольников.
 * Преграды полностью блокируют взгляд стражи.
 */
export function lineBlockedBy(obstacles: readonly Obstacle[], ax: number, az: number, bx: number, bz: number): boolean {
  const dx = bx - ax
  const dz = bz - az
  for (const o of obstacles) {
    let tmin = 0
    let tmax = 1
    if (Math.abs(dx) > 1e-8) {
      let t1 = (o.x - o.hw - ax) / dx
      let t2 = (o.x + o.hw - ax) / dx
      if (t1 > t2) [t1, t2] = [t2, t1]
      tmin = Math.max(tmin, t1)
      tmax = Math.min(tmax, t2)
      if (tmin > tmax) continue
    } else if (ax < o.x - o.hw || ax > o.x + o.hw) {
      continue
    }
    if (Math.abs(dz) > 1e-8) {
      let t1 = (o.z - o.hd - az) / dz
      let t2 = (o.z + o.hd - az) / dz
      if (t1 > t2) [t1, t2] = [t2, t1]
      tmin = Math.max(tmin, t1)
      tmax = Math.min(tmax, t2)
      if (tmin > tmax) continue
    } else if (az < o.z - o.hd || az > o.z + o.hd) {
      continue
    }
    return true
  }
  return false
}
