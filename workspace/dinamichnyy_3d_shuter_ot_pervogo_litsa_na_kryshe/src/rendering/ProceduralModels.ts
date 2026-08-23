// РџСЂРѕС†РµРґСѓСЂРЅС‹Рµ РјРѕРґРµР»Рё: РІСЃСЏ РіРµРѕРјРµС‚СЂРёСЏ СЃС‚СЂРѕРёС‚СЃСЏ РєРѕРґРѕРј, РЅРёРєР°РєРёС… РІРЅРµС€РЅРёС… GLTF.
// Р“РµРѕРјРµС‚СЂРёРё СЃРѕР·РґР°СЋС‚СЃСЏ РѕРґРёРЅ СЂР°Р· Рё РїРµСЂРµРёСЃРїРѕР»СЊР·СѓСЋС‚СЃСЏ; РјР°С‚РµСЂРёР°Р»РѕРІ РѕРіСЂР°РЅРёС‡РµРЅРЅС‹Р№ РЅР°Р±РѕСЂ.
// metalness <= 0.4 РІРµР·РґРµ вЂ” Р±РµР· env map РјРµС‚Р°Р»Р» РІС‹РіР»СЏРґРµР» Р±С‹ С‡С‘СЂРЅС‹Рј.

import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export const PALETTE = {
  nightTop: 0x05070d,
  nightBottom: 0x14263f,
  armorDark: 0x232f40,
  armorLight: 0x39485f,
  ironFrame: 0x4d3b28,
  copper: 0xb87333,
  visorCyan: 0x00f0ff,
  plasmaOrange: 0xff6b00,
  dangerRed: 0xff003c,
  teslaPurple: 0x7b2cbf,
  leaderGold: 0xffd75e,
} as const

export function makeStandard(color: number, roughness = 0.75, metalness = 0.35): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness })
}

function box(w: number, h: number, d: number, x: number, y: number, z: number): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(w, h, d)
  geo.translate(x, y, z)
  return geo
}

/** РџРѕР»РёСЌРґСЂС‹ (РѕРєС‚Р°СЌРґСЂ/РґРѕРґРµРєР°СЌРґСЂ) РїСЂРёС…РѕРґСЏС‚ Р±РµР· РёРЅРґРµРєСЃР° вЂ” РїСЂРёРІРѕРґРёРј РІСЃС‘ Рє РѕР±С‰РµРјСѓ РІРёРґСѓ. */
function uniform(parts: THREE.BufferGeometry[]): THREE.BufferGeometry[] {
  return parts.map((part) => (part.index != null ? part.toNonIndexed() : part))
}

/** Р‘СЂРѕРЅРёСЂРѕРІР°РЅРЅС‹Р№ РІР°РіРѕРЅ РґР»РёРЅРѕР№ 36 Рј: РєСЂС‹С€Р° СЃ СЂС‘Р±СЂР°РјРё, С‚РµСЃР»Р°-РєСѓРїРѕР»Р°, Р±РѕСЂС‚Р°. */
export function buildWagonGeometry(lengthM: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const halfL = lengthM / 2
  // РєРѕСЂРїСѓСЃ
  parts.push(box(3.9, 2.4, lengthM - 0.6, 0, -1.2, 0))
  // РєСЂС‹С€Р° СЃРѕ СЃРєРѕСЃРѕРј Рє РєСЂР°СЏРј
  parts.push(box(3.6, 0.25, lengthM - 0.4, 0, 0.05, 0))
  parts.push(box(3.0, 0.15, lengthM - 1.2, 0, 0.2, 0))
  // РїРѕРїРµСЂРµС‡РЅС‹Рµ СЂС‘Р±СЂР° РєСЂС‹С€Рё
  for (let i = -3; i <= 3; i++) {
    parts.push(box(3.55, 0.1, 0.35, 0, 0.16, (i / 3.5) * (halfL - 2)))
  }
  // С‚РµСЃР»Р°-РєСѓРїРѕР»Р° РїРѕ СѓРіР»Р°Рј РєСЂС‹С€Рё
  for (const sx of [-1.45, 1.45]) {
    for (const sz of [-halfL + 2, halfL - 2]) {
      const dome = new THREE.CylinderGeometry(0.32, 0.42, 0.5, 8)
      dome.translate(sx, 0.35, sz)
      parts.push(dome)
    }
    // РјРµРґРЅС‹Р№ РїРѕСЂСѓС‡РµРЅСЊ РІРґРѕР»СЊ РєСЂР°СЏ
    parts.push(box(0.12, 0.1, lengthM - 1, sx * 1.65, 0.28, 0))
  }
  // СЋР±РєР° РєРѕСЂРїСѓСЃР°
  parts.push(box(4.1, 0.5, lengthM - 0.2, 0, -2.35, 0))
  return mergeGeometries(uniform(parts)) ?? new THREE.BoxGeometry(1, 1, 1)
}

/** Р›РѕРєРѕРјРѕС‚РёРІ: РѕР±С‚РµРєР°С‚РµР»СЊ, РїСЂРѕР¶РµРєС‚РѕСЂ, РіСЂРѕРјРѕРѕС‚РІРѕРґС‹. */
export function buildLocomotiveGeometry(lengthM: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const halfL = lengthM / 2
  parts.push(box(3.9, 2.6, lengthM, 0, -1.3, 0))
  const nose = new THREE.CylinderGeometry(0.4, 1.95, 3.2, 6, 1, false, 0, Math.PI)
  nose.rotateX(Math.PI / 2)
  nose.rotateY(Math.PI / 2)
  nose.scale(1, 1, 1)
  nose.translate(0, 0, halfL + 1.5)
  parts.push(nose)
  parts.push(box(2.6, 0.2, lengthM - 2, 0, 0.05, 0))
  // РіСЂРѕРјРѕРѕС‚РІРѕРґС‹
  for (const sx of [-1.2, 0, 1.2]) {
    const rod = new THREE.CylinderGeometry(0.05, 0.09, 1.6, 5)
    rod.translate(sx, 0.85, halfL - 3)
    parts.push(rod)
  }
  return mergeGeometries(uniform(parts)) ?? new THREE.BoxGeometry(1, 1, 1)
}

/** Р”СЂРѕРЅ: РІРѕСЃСЊРјРёРіСЂР°РЅРЅРёРє + РєРѕР»СЊС†Рѕ РІРёРЅС‚РѕРІ, СЃС‚СЂРѕРёС‚СЃСЏ РІРґРѕР»СЊ +Z РїРѕРґ lookAt. */
export function buildDroneGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const body = new THREE.OctahedronGeometry(0.55, 0)
  body.scale(1, 0.7, 1.3)
  parts.push(body)
  const ring = new THREE.TorusGeometry(0.72, 0.07, 5, 14)
  ring.rotateX(Math.PI / 2)
  parts.push(ring)
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2
    const pod = box(0.18, 0.12, 0.34, Math.cos(angle) * 0.72, 0, Math.sin(angle) * 0.72)
    parts.push(pod)
  }
  return mergeGeometries(uniform(parts)) ?? new THREE.BoxGeometry(1, 1, 1)
}

/** Р“РѕСЂСЏС‰РёР№ РѕР±Р»РѕРјРѕРє С‚СѓСЂР±РёРЅС‹. */
export function buildDebrisGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const core = new THREE.DodecahedronGeometry(0.42, 0)
  parts.push(core)
  const blade = box(0.9, 0.08, 0.26, 0.3, 0.2, 0)
  blade.rotateZ(0.5)
  parts.push(blade)
  const blade2 = box(0.7, 0.07, 0.2, -0.2, -0.25, 0.1)
  blade2.rotateZ(-0.9)
  parts.push(blade2)
  return mergeGeometries(uniform(parts)) ?? new THREE.BoxGeometry(1, 1, 1)
}

/** Р РµР»СЊСЃРѕРІС‹Р№ С‡Р°РЅРє СЌСЃС‚Р°РєР°РґС‹: РїРѕР»РѕС‚РЅРѕ, С€РїР°Р»С‹, С„РµСЂРјС‹ РѕРїРѕСЂ. Р”Р»РёРЅР° chunkLength. */
export function buildTrackChunkGeometry(chunkLength: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  // РґРІРµ РЅРёС‚РєРё СЂРµР»СЊСЃ
  parts.push(box(0.3, 0.25, chunkLength, -1.1, -4.2, 0))
  parts.push(box(0.3, 0.25, chunkLength, 1.1, -4.2, 0))
  // С€РїР°Р»С‹
  const sleeperCount = Math.floor(chunkLength / 2.4)
  for (let i = 0; i < sleeperCount; i++) {
    parts.push(box(3.2, 0.16, 0.5, 0, -4.45, -chunkLength / 2 + i * 2.4))
  }
  // Р±Р°Р»РєР° СЌСЃС‚Р°РєР°РґС‹
  parts.push(box(4.6, 0.7, chunkLength, 0, -5.1, 0))
  return mergeGeometries(uniform(parts)) ?? new THREE.BoxGeometry(1, 1, 1)
}

export function buildPylonGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  parts.push(box(0.7, 46, 0.7, 0, -28, 0))
  parts.push(box(2.4, 0.6, 1.6, 0, -5.4, 0))
  const cross = box(3.4, 0.4, 0.4, 0, -20, 0)
  parts.push(cross)
  return mergeGeometries(uniform(parts)) ?? new THREE.BoxGeometry(1, 1, 1)
}

export function buildRockGeometry(width: number, height: number, depth: number): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []
  const rows = 3
  for (let r = 0; r < rows; r++) {
    const w = width * (1 - r * 0.22)
    const geo = new THREE.CylinderGeometry(w * 0.62, w * 0.8, height / rows, 5)
    const angle = (r * 37 * Math.PI) / 180
    geo.rotateY(angle)
    geo.translate(Math.sin(angle) * width * 0.06, -height / 2 + (height / rows) * (r + 0.5), 0)
    parts.push(geo)
  }
  void depth
  return mergeGeometries(uniform(parts)) ?? new THREE.BoxGeometry(1, 1, 1)
}

/** РўРµСЃР»Р°-РєР°СЂР°Р±РёРЅ: РІСЊСЋРјРѕРґРµР»СЊ РёР· СЃС‚РІРѕР»Р°, РєРѕРЅРґРµРЅСЃР°С‚РѕСЂРЅРѕРіРѕ РєРѕР»СЊС†Р° Рё Р»РѕР¶Р°. РћСЃСЊ СЃС‚РІРѕР»Р° вЂ” -Z. */
export interface CarbineModel {
  root: THREE.Group
  coreMaterial: THREE.MeshBasicMaterial
}

export function buildCarbineModel(): CarbineModel {
  const root = new THREE.Group()
  const dark = makeStandard(PALETTE.armorDark, 0.6, 0.38)
  const copperMat = makeStandard(PALETTE.copper, 0.45, 0.4)

  const bodyGeo = mergeGeometries(uniform([
    box(0.09, 0.13, 0.52, 0, 0, -0.1),
    box(0.07, 0.1, 0.3, 0, 0.02, -0.44),
    box(0.08, 0.16, 0.12, 0, -0.11, 0.12),
  ]))
  const body = new THREE.Mesh(bodyGeo ?? new THREE.BoxGeometry(0.1, 0.1, 0.4), dark)
  root.add(body)

  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.03, 0.5, 8), copperMat)
  barrel.rotation.x = Math.PI / 2
  barrel.position.set(0, 0.02, -0.78)
  root.add(barrel)

  const coreMaterial = new THREE.MeshBasicMaterial({ color: PALETTE.visorCyan })
  const coil = new THREE.Mesh(new THREE.TorusGeometry(0.062, 0.016, 6, 16), coreMaterial)
  coil.position.set(0, 0.02, -0.56)
  root.add(coil)

  const stock = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.22, 6), copperMat)
  stock.rotation.x = Math.PI / 2
  stock.position.set(0, -0.04, 0.3)
  root.add(stock)

  return { root, coreMaterial }
}

/** Р‘РѕСЃСЃ В«Р“СЂРѕРјРѕРІРµСЂР¶РµС†В»: С‚СЏР¶С‘Р»С‹Р№ РїРµСЂРµС…РІР°С‚С‡РёРє СЃ СЌРЅРµСЂРіРѕСЏРґСЂРѕРј. РќРѕСЃ РІРґРѕР»СЊ +Z. */
export interface BossModel {
  root: THREE.Group
  core: THREE.Mesh
  coreMaterial: THREE.MeshBasicMaterial
}

export function buildBossModel(): BossModel {
  const root = new THREE.Group()
  const hullMat = makeStandard(PALETTE.armorLight, 0.55, 0.4)
  const frameMat = makeStandard(PALETTE.copper, 0.5, 0.4)

  const hull = new THREE.Mesh(new THREE.IcosahedronGeometry(3.4, 0), hullMat)
  hull.scale.set(1.4, 0.8, 1.8)
  root.add(hull)

  for (const sx of [-3.2, 3.2]) {
    const wing = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.5, 2.2), frameMat)
    wing.position.set(sx, 0, -0.6)
    wing.rotation.z = sx > 0 ? -0.18 : 0.18
    root.add(wing)
  }

  const spine = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 7, 6), frameMat)
  spine.rotation.x = Math.PI / 2
  spine.position.z = -2
  root.add(spine)

  const coreMaterial = new THREE.MeshBasicMaterial({ color: PALETTE.leaderGold })
  const core = new THREE.Mesh(new THREE.SphereGeometry(1.05, 12, 10), coreMaterial)
  core.position.set(0, 0, 3.1)
  root.add(core)

  return { root, core, coreMaterial }
}

