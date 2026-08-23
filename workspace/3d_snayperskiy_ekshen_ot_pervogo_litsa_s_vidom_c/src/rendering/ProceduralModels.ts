import * as THREE from 'three'

export interface WorldGeometry {
  root: THREE.Group
  aimTargets: THREE.Object3D[]
  glacierHitMesh: THREE.Mesh
  glacierGroup: THREE.Group
  coreMesh: THREE.Mesh
  crackLines: THREE.Mesh[]
  flags: Array<{ cloth: THREE.Mesh; baseX: number }>
  rockMaterial: THREE.MeshStandardMaterial
}

/* Ключевые координаты сцены (экспортируются для игровых систем). */
export const WORLD = {
  eyeHeight: 43.4,
  ledgeY: 41.6,
  ledgeMinX: -9,
  ledgeMaxX: 9,
  playerZ: -118,
  titanPathZ: -470,
  outpostLineX: 64,
  titanStartX: -170,
  killzoneCenterX: -50,
  killzoneHalfLength: 16,
  chunkSpreadHalfX: 38,
} as const

const ROCK = 0x22334a
const ROCK_DARK = 0x141f30
const SNOW = 0xe8f1fa
const ICE = 0xa9d2ef
const ICE_GLOW = 0x3a86ff

/** Процедурная геометрия без внешних GLTF: переиспользуемые буферы,
 * metalness ≤ 0.4 — металл не чернеет без окружения. */
function displacedPlane(w: number, h: number, sx: number, sy: number, amp: number, seed: number): THREE.PlaneGeometry {
  const geo = new THREE.PlaneGeometry(w, h, sx, sy)
  const pos = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const n = Math.sin(x * 0.045 + seed) * Math.cos(y * 0.06 + seed * 1.7)
      + 0.5 * Math.sin(x * 0.11 - y * 0.07 + seed * 2.3)
    pos.setZ(i, n * amp)
  }
  geo.computeVertexNormals()
  return geo
}

function jitterBox(sx: number, sy: number, sz: number, seed: number): THREE.BoxGeometry {
  const geo = new THREE.BoxGeometry(sx, sy, sz, 4, 4, 4)
  const pos = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const k = 1 + Math.sin(i * 12.9898 + seed * 78.233) * 0.09
    pos.setXYZ(i, pos.getX(i) * k, pos.getY(i) * k, pos.getZ(i) * k)
  }
  geo.computeVertexNormals()
  return geo
}

export function buildWorld(): WorldGeometry {
  const root = new THREE.Group()
  const rockMat = new THREE.MeshStandardMaterial({ color: ROCK, roughness: 0.95, metalness: 0, flatShading: true })
  const rockDarkMat = new THREE.MeshStandardMaterial({ color: ROCK_DARK, roughness: 1, metalness: 0, flatShading: true })
  const snowMat = new THREE.MeshStandardMaterial({ color: SNOW, roughness: 0.92, metalness: 0 })

  // дно каньона вдоль X, от южной стены (z=-130) до северной (z=-512)
  const floorGeo = displacedPlane(430, 392, 52, 44, 1.8, 3.1)
  const floor = new THREE.Mesh(floorGeo, snowMat)
  floor.rotation.x = -Math.PI / 2
  floor.position.set(-60, 0, -321)
  floor.receiveShadow = true
  root.add(floor)

  // южная стена за спиной стрелка и северная с ледником
  const southWall = new THREE.Mesh(displacedPlane(440, 150, 40, 14, 8, 5.7), rockMat)
  southWall.rotation.y = Math.PI
  southWall.position.set(-60, 62, -126)
  root.add(southWall)

  const northWall = new THREE.Mesh(displacedPlane(440, 170, 44, 16, 9, 9.2), rockDarkMat)
  northWall.rotation.y = 0
  northWall.position.set(-60, 68, -516)
  northWall.receiveShadow = true
  root.add(northWall)

  // карниз стрелка на южной стене
  const ledge = new THREE.Mesh(jitterBox(26, 2.4, 9, 2.2), rockMat)
  ledge.position.set(0, WORLD.ledgeY - 1.2, WORLD.playerZ + 4)
  ledge.castShadow = true
  root.add(ledge)
  const ledgeSnow = new THREE.Mesh(new THREE.BoxGeometry(25, 0.5, 8), snowMat)
  ledgeSnow.position.set(0, WORLD.ledgeY - 0.15, WORLD.playerZ + 4.4)
  root.add(ledgeSnow)
  for (let i = 0; i < 5; i++) {
    const sack = new THREE.Mesh(jitterBox(3.2, 2.2, 2.4, i * 3.3), snowMat)
    sack.position.set(-8 + i * 4, WORLD.ledgeY + 0.9, WORLD.playerZ + 7.6)
    sack.rotation.y = (i % 2 - 0.5) * 0.3
    root.add(sack)
  }

  // ── ледник на северной стене ────────────────────────────────────────────
  const glacierGroup = new THREE.Group()
  const iceMat = new THREE.MeshStandardMaterial({
    color: ICE,
    roughness: 0.32,
    metalness: 0.08,
    flatShading: true,
    emissive: new THREE.Color(0x16324e),
    emissiveIntensity: 0.5,
  })
  const slab = new THREE.Mesh(jitterBox(84, 30, 15, 6.6), iceMat)
  slab.castShadow = true
  slab.receiveShadow = true
  glacierGroup.add(slab)
  const tongue = new THREE.Mesh(jitterBox(40, 10, 13, 8.8), iceMat)
  tongue.position.set(-14, -18, 6)
  tongue.rotation.z = 0.12
  tongue.castShadow = true
  glacierGroup.add(tongue)

  const coreMat = new THREE.MeshStandardMaterial({
    color: ICE_GLOW,
    emissive: new THREE.Color(ICE_GLOW),
    emissiveIntensity: 2.6,
    roughness: 0.3,
    metalness: 0,
  })
  const coreMesh = new THREE.Mesh(new THREE.SphereGeometry(1.5, 16, 12), coreMat)
  coreMesh.position.set(0, 1, 7.6)
  glacierGroup.add(coreMesh)

  const crackMat = new THREE.MeshBasicMaterial({ color: 0x7db4ff })
  const crackLines: THREE.Mesh[] = []
  const crackSpecs: Array<[number, number, number, number]> = [
    [-16, 6, 24, 0.5], [14, -4, 28, 0.45], [0, -12, 30, 0.4], [-30, -8, 18, 0.5], [28, 8, 20, 0.45],
  ]
  for (const [cx, cy, len, thick] of crackSpecs) {
    const line = new THREE.Mesh(new THREE.BoxGeometry(len, thick, 0.4), crackMat)
    line.position.set(cx, cy + 1, 7.5)
    line.rotation.z = Math.sin(cx * 3.7) * 0.5
    glacierGroup.add(line)
    crackLines.push(line)
  }
  const glacierHitMesh = new THREE.Mesh(
    new THREE.BoxGeometry(96, 44, 18),
    new THREE.MeshBasicMaterial({ visible: false }),
  )
  glacierHitMesh.position.set(0, 0, 2)
  glacierGroup.add(glacierHitMesh)

  glacierGroup.position.set(WORLD.killzoneCenterX, 24, -502)
  root.add(glacierGroup)

  // ── флажки-ветроуказатели ──────────────────────────────────────────────
  const flags: Array<{ cloth: THREE.Mesh; baseX: number }> = []
  const flagPoleMat = new THREE.MeshStandardMaterial({ color: 0x8899aa, roughness: 0.6, metalness: 0.35 })
  const flagClothMat = new THREE.MeshStandardMaterial({ color: 0xffaa55, roughness: 0.8, metalness: 0, side: THREE.DoubleSide })
  const poleGeo = new THREE.CylinderGeometry(0.18, 0.22, 7, 6)
  const clothGeo = new THREE.PlaneGeometry(4.2, 1.6, 4, 1)
  const flagSpots: Array<[number, number, number]> = [
    [-130, 58, -300], [40, 66, -280], [-10, 54, -360], [95, 62, -452], [-175, 72, -430], [10, 48, -190],
  ]
  for (const [fx, fy, fz] of flagSpots) {
    const pole = new THREE.Mesh(poleGeo, flagPoleMat)
    pole.position.set(fx, fy, fz)
    root.add(pole)
    const cloth = new THREE.Mesh(clothGeo, flagClothMat)
    cloth.position.set(fx, fy + 2.6, fz)
    root.add(cloth)
    flags.push({ cloth, baseX: fx })
  }

  // ── застава на рубеже ──────────────────────────────────────────────────
  const outpostMat = new THREE.MeshStandardMaterial({ color: 0x4b3621, roughness: 0.85, metalness: 0.05, flatShading: true })
  const towerGeo = new THREE.CylinderGeometry(1.6, 2.2, 14, 7)
  for (const tz of [WORLD.titanPathZ - 14, WORLD.titanPathZ + 14]) {
    const tower = new THREE.Mesh(towerGeo, outpostMat)
    tower.position.set(WORLD.outpostLineX + 4, 7, tz)
    tower.castShadow = true
    root.add(tower)
    const roof = new THREE.Mesh(new THREE.ConeGeometry(2.6, 3, 7), outpostMat)
    roof.position.set(WORLD.outpostLineX + 4, 15.5, tz)
    root.add(roof)
  }
  const crossbar = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.2, 29), outpostMat)
  crossbar.position.set(WORLD.outpostLineX + 4, 12.5, WORLD.titanPathZ)
  root.add(crossbar)
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 8), new THREE.MeshStandardMaterial({ color: 0xffaa55, side: THREE.DoubleSide, roughness: 0.9 }))
  banner.position.set(WORLD.outpostLineX + 4, 10.6, WORLD.titanPathZ)
  banner.rotation.y = Math.PI / 2
  root.add(banner)

  // монолиты у дна для рикошетов
  const aimTargets: THREE.Object3D[] = [glacierHitMesh, floor, northWall, southWall]
  const monolithSpecs: Array<[number, number, number]> = [
    [-110, -420, 9], [10, -440, 12], [120, -400, 8], [-195, -380, 11], [-40, -250, 7], [80, -230, 9],
  ]
  for (const [bx, bz, s] of monolithSpecs) {
    const monolith = new THREE.Mesh(jitterBox(s, s * 1.6, s, bx * 0.37), rockMat)
    monolith.position.set(bx, s * 0.8, bz)
    monolith.castShadow = true
    aimTargets.push(monolith)
    root.add(monolith)
  }

  return {
    root,
    aimTargets,
    glacierHitMesh,
    glacierGroup,
    coreMesh,
    crackLines,
    flags,
    rockMaterial: rockMat,
  }
}

/** Винтовка от первого лица: собрана вдоль оси взгляда камеры (-Z), сошки
 * появляются при упоре, дульная вспышка — точечный свет у среза ствола. */
export function buildRifleViewmodel(): { group: THREE.Group; bipod: THREE.Group; muzzleFlash: THREE.PointLight } {
  const group = new THREE.Group()
  const metalMat = new THREE.MeshStandardMaterial({ color: 0x39424e, roughness: 0.55, metalness: 0.35 })
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a3626, roughness: 0.8, metalness: 0.05 })
  const stock = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.13, 0.85), woodMat)
  stock.position.set(0.17, -0.19, 0.22)
  stock.rotation.y = -0.06
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.024, 1.15, 8), metalMat)
  barrel.rotation.x = Math.PI / 2
  barrel.position.set(0.04, -0.12, -0.75)
  const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.34, 10), metalMat)
  scope.rotation.x = Math.PI / 2
  scope.position.set(0.04, -0.03, -0.35)
  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.09), woodMat)
  grip.position.set(0.17, -0.3, 0.36)
  grip.rotation.x = 0.35

  const bipod = new THREE.Group()
  const legGeo = new THREE.CylinderGeometry(0.008, 0.008, 0.5, 5)
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, metalMat)
    leg.position.set(0.04 + side * 0.07, -0.34, -0.98)
    leg.rotation.z = side * 0.42
    bipod.add(leg)
  }
  bipod.visible = false

  const muzzleFlash = new THREE.PointLight(0xffcc88, 0, 14)
  muzzleFlash.position.set(0.04, -0.12, -1.42)

  group.add(stock, barrel, scope, grip, bipod, muzzleFlash)
  return { group, bipod, muzzleFlash }
}
