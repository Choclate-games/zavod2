import * as THREE from 'three'
import type { TrackData } from './TrackBuilder'

/**
 * Процедурная low-poly геометрия без внешних ассетов: молоковоз с хромовой
 * цистерной и окошками уровня молока, ели, скалы, горное кольцо и замёрзшее
 * озеро. Геометрия тягача собрана вдоль +Z — направления «вперёд».
 */

export interface TruckModel {
  group: THREE.Group
  wheelMeshes: THREE.InstancedMesh
  milkSurface: THREE.Mesh
  brakeLights: THREE.Mesh[]
  exhaustTips: [THREE.Vector3, THREE.Vector3]
}

export function buildTruck(): TruckModel {
  const group = new THREE.Group()

  const steelMat = new THREE.MeshStandardMaterial({ color: '#5b6672', roughness: 0.55, metalness: 0.35 })
  const cabMat = new THREE.MeshStandardMaterial({ color: '#b3402e', roughness: 0.5, metalness: 0.12 })
  const glassMat = new THREE.MeshStandardMaterial({ color: '#9fd8ef', roughness: 0.1, metalness: 0.1, transparent: true, opacity: 0.55 })
  const chromeMat = new THREE.MeshStandardMaterial({ color: '#dfe7ee', roughness: 0.16, metalness: 0.85 })
  const milkMat = new THREE.MeshStandardMaterial({ color: '#fbf4e8', roughness: 0.35, metalness: 0 })
  const windowMat = new THREE.MeshStandardMaterial({
    color: '#bfe9ff', roughness: 0.05, metalness: 0.05,
    transparent: true, opacity: 0.28, depthWrite: false,
  })

  const cab = new THREE.Mesh(new THREE.BoxGeometry(2.3, 1.7, 2.2), cabMat)
  cab.position.set(0, 0.85, 2.4)
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.7, 0.1), glassMat)
  windshield.position.set(0, 1.15, 3.51)
  const roofSpoiler = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.18, 0.7), steelMat)
  roofSpoiler.position.set(0, 1.79, 2.85)

  const frameBeam = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.35, 7.0), steelMat)
  frameBeam.position.set(0, -0.15, -0.6)

  // цистерна: хромированный цилиндр вдоль -Z
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 3.9, 14), chromeMat)
  tank.rotation.x = Math.PI / 2
  tank.position.set(0, 0.62, -1.35)
  const tankCapA = new THREE.Mesh(new THREE.SphereGeometry(0.97, 10, 8), chromeMat)
  tankCapA.position.set(0, 0.62, 0.58)
  tankCapA.scale.z = 0.45
  const tankCapB = tankCapA.clone()
  tankCapB.position.z = -3.28

  // полупрозрачные окошки уровня молока на боку цистерны
  const windowGeo = new THREE.BoxGeometry(0.06, 1.3, 3.2)
  for (const sx of [-0.99, 0.99]) {
    const win = new THREE.Mesh(windowGeo, windowMat)
    win.position.set(sx, 0.62, -1.35)
    group.add(win)
  }

  // поверхность молока внутри цистерны: уровень и наклон волны
  const milkSurface = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.09, 3.6), milkMat)
  milkSurface.position.set(0, 0.62, -1.35)

  const headlightMat = new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffd76a', emissiveIntensity: 1.4 })
  const brakeLightMat = new THREE.MeshStandardMaterial({ color: '#5a0f14', emissive: '#E63946', emissiveIntensity: 1.6 })
  const headlights: THREE.Mesh[] = []
  const brakeLights: THREE.Mesh[] = []
  for (const sx of [-0.8, 0.8]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.22, 0.1), headlightMat)
    hl.position.set(sx, 0.75, 3.56)
    headlights.push(hl)
    group.add(hl)
    const bl = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.1), brakeLightMat)
    bl.position.set(sx, 0.55, -3.36)
    bl.visible = false
    brakeLights.push(bl)
    group.add(bl)
  }

  const pipeGeo = new THREE.CylinderGeometry(0.07, 0.07, 0.7, 8)
  const exhaustTips: THREE.Vector3[] = []
  for (const sx of [-0.55, 0.55]) {
    const pipe = new THREE.Mesh(pipeGeo, chromeMat)
    pipe.position.set(sx, 1.4, -3.1)
    group.add(pipe)
    exhaustTips.push(new THREE.Vector3(sx, 1.78, -3.1))
  }

  const tireGeo = new THREE.CylinderGeometry(0.55, 0.55, 0.42, 12)
  tireGeo.rotateZ(Math.PI / 2)
  const rimGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.44, 8)
  rimGeo.rotateZ(Math.PI / 2)
  const tireMat = new THREE.MeshStandardMaterial({ color: '#20242a', roughness: 0.9, metalness: 0 })
  const rimMat = new THREE.MeshStandardMaterial({ color: '#aab6bf', roughness: 0.4, metalness: 0.5 })
  const wheels = new THREE.InstancedMesh(tireGeo, tireMat, 6)
  wheels.frustumCulled = false

  group.add(cab, windshield, roofSpoiler, frameBeam, tank, tankCapA, tankCapB, milkSurface, wheels)

  return {
    group,
    wheelMeshes: wheels,
    milkSurface,
    brakeLights,
    exhaustTips: [exhaustTips[0], exhaustTips[1]],
  }
}

/** Окружение перевала: ели, валуны, горное кольцо и зеркальное озеро внизу. */
export function buildScenery(scene: THREE.Scene, track: TrackData, seedOffset: number): void {
  let state = seedOffset >>> 0
  const rng = (): number => {
    state = (state * 1664525 + 1013904223) >>> 0
    return state / 4294967296
  }
  const n = track.centerX.length

  // ── ели ────────────────────────────────────────────────────────────────
  const treeCount = Math.min(140, n * 2)
  const treeGeo = new THREE.ConeGeometry(1.6, 5.2, 6)
  treeGeo.translate(0, 2.6, 0)
  const treeMat = new THREE.MeshStandardMaterial({ color: '#1f4034', roughness: 0.9 })
  const snowMat = new THREE.MeshStandardMaterial({ color: '#dfeaf4', roughness: 0.85 })
  const trees = new THREE.InstancedMesh(treeGeo, treeMat, treeCount)
  const caps = new THREE.InstancedMesh(treeGeo, snowMat, treeCount)
  const dummy = new THREE.Object3D()
  let placed = 0
  for (let i = 2; i < n && placed < treeCount; i += 2) {
    for (const side of [-1, 1]) {
      if (placed >= treeCount || rng() > 0.65) continue
      const h = track.heading[i]
      const dist = track.halfWidth + 7 + rng() * 20
      const x = track.centerX[i] + Math.cos(h) * dist * side
      const z = track.centerZ[i] - Math.sin(h) * dist * side
      const scale = 0.7 + rng() * 0.9
      dummy.position.set(x, track.centerY[i] - 0.4, z)
      dummy.scale.setScalar(scale)
      dummy.rotation.y = rng() * Math.PI
      dummy.updateMatrix()
      trees.setMatrixAt(placed, dummy.matrix)
      dummy.scale.setScalar(scale * 0.999)
      dummy.position.y += 0.02
      dummy.updateMatrix()
      caps.setMatrixAt(placed, dummy.matrix)
      placed++
    }
  }
  trees.count = placed
  caps.count = placed
  scene.add(trees, caps)

  // ── валуны у обочин ───────────────────────────────────────────────────
  const rockCount = 70
  const rockGeo = new THREE.DodecahedronGeometry(1.1, 0)
  const rockMat = new THREE.MeshStandardMaterial({ color: '#3c4a58', roughness: 0.95 })
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, rockCount)
  for (let i = 0; i < rockCount; i++) {
    const idx = Math.floor(rng() * n)
    const h = track.heading[idx]
    const side = rng() > 0.5 ? 1 : -1
    const dist = track.halfWidth + 2.5 + rng() * 4
    dummy.position.set(
      track.centerX[idx] + Math.cos(h) * dist * side,
      track.centerY[idx] - 0.6,
      track.centerZ[idx] - Math.sin(h) * dist * side,
    )
    dummy.scale.set(0.5 + rng(), 0.4 + rng() * 0.8, 0.5 + rng())
    dummy.updateMatrix()
    rocks.setMatrixAt(i, dummy.matrix)
  }
  scene.add(rocks)

  // ── горное кольцо на горизонте ────────────────────────────────────────
  const mountainCount = 26
  const mountainGeo = new THREE.ConeGeometry(1, 1, 5)
  const mountainMat = new THREE.MeshStandardMaterial({ color: '#182a3e', roughness: 1 })
  const mountains = new THREE.InstancedMesh(mountainGeo, mountainMat, mountainCount)
  const midIdx = Math.floor(n / 2)
  for (let i = 0; i < mountainCount; i++) {
    const angle = (i / mountainCount) * Math.PI * 2 + rng() * 0.2
    const radius = 520 + rng() * 320
    const height = 140 + rng() * 180
    dummy.position.set(
      track.centerX[midIdx] + Math.cos(angle) * radius,
      track.centerY[midIdx] - 30,
      track.centerZ[midIdx] + Math.sin(angle) * radius,
    )
    dummy.scale.set(radius * 0.32, height, radius * 0.32)
    dummy.rotation.y = rng() * Math.PI
    dummy.updateMatrix()
    mountains.setMatrixAt(i, dummy.matrix)
  }
  scene.add(mountains)

  // ── замёрзшее озеро глубоко под трассой ───────────────────────────────
  let minY = Infinity
  for (let i = 0; i < n; i++) minY = Math.min(minY, track.centerY[i])
  const lake = new THREE.Mesh(
    new THREE.PlaneGeometry(2600, 2600),
    new THREE.MeshStandardMaterial({ color: '#16405e', roughness: 0.12, metalness: 0.55 }),
  )
  lake.rotation.x = -Math.PI / 2
  lake.position.set(track.centerX[midIdx], minY - 110, track.centerZ[midIdx])
  scene.add(lake)
}
