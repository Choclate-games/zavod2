import * as THREE from 'three'
import type { BuildingSpec } from '../core/levels'
import type { MaterialKind } from '../core/balance'

const FACADE_COLORS: Record<MaterialKind, number> = {
  glass: 0x8fb8c9,
  concrete: 0xb9a894,
  steel: 0x7c8595,
}

type FacadeSet = {
  geometry: THREE.BoxGeometry
  materialsByKind: Record<MaterialKind, THREE.MeshStandardMaterial>
}

let facadeSet: FacadeSet | null = null

function windowTexture(kind: MaterialKind): THREE.CanvasTexture {
  const canvas = document.createElement('canvas')
  canvas.width = 64
  canvas.height = 128
  const ctx = canvas.getContext('2d')!
  const base = '#' + new THREE.Color(FACADE_COLORS[kind]).getHexString()
  ctx.fillStyle = base
  ctx.fillRect(0, 0, 64, 128)
  for (let y = 4; y < 124; y += 8) {
    for (let x = 3; x < 61; x += 6) {
      const lit = (x * 31 + y * 17) % 11 < 3
      ctx.fillStyle = lit ? '#ffd98a' : '#1f2836'
      ctx.fillRect(x, y, 3, 4)
    }
  }
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  return texture
}

/** Геометрия и материалы переиспользуются между всеми зданиями сектора. */
export function getFacadeSet(): FacadeSet {
  if (facadeSet) return facadeSet
  const geometry = new THREE.BoxGeometry(1, 1, 1)
  const make = (kind: MaterialKind): THREE.MeshStandardMaterial => {
    const map = kind === 'glass' ? null : null
    void map
    return new THREE.MeshStandardMaterial({
      color: FACADE_COLORS[kind],
      roughness: kind === 'glass' ? 0.25 : 0.85,
      metalness: kind === 'glass' ? 0.35 : 0.05,
      emissive: new THREE.Color(kind === 'glass' ? 0x0e2230 : 0x000000),
    })
  }
  facadeSet = {
    geometry,
    materialsByKind: {
      glass: make('glass'),
      concrete: make('concrete'),
      steel: make('steel'),
    },
  }
  // Текстуры окон создаются один раз на материал.
  for (const kind of ['glass', 'concrete', 'steel'] as MaterialKind[]) {
    facadeSet.materialsByKind[kind].map = windowTexture(kind)
    facadeSet.materialsByKind[kind].needsUpdate = true
  }
  return facadeSet
}

/** Стилизованная башня: шаг объёмов + шпиль, силуэт читается на расстоянии. */
export function createBuildingMesh(spec: BuildingSpec): THREE.Group {
  const set = getFacadeSet()
  const group = new THREE.Group()
  const body = new THREE.Mesh(set.geometry, set.materialsByKind[spec.material])
  body.scale.set(spec.w, spec.h, spec.d)
  body.position.y = spec.h / 2
  body.castShadow = true
  body.receiveShadow = true
  group.add(body)

  const crownHeight = Math.max(2, spec.h * 0.05)
  const crown = new THREE.Mesh(set.geometry, set.materialsByKind.steel)
  crown.scale.set(spec.w * 0.55, crownHeight, spec.d * 0.55)
  crown.position.y = spec.h + crownHeight / 2
  crown.castShadow = true
  group.add(crown)

  const spire = new THREE.Mesh(set.geometry, set.materialsByKind.steel)
  spire.scale.set(0.6, Math.max(4, spec.h * 0.12), 0.6)
  spire.position.y = spec.h + crownHeight + spire.scale.y / 2
  group.add(spire)
  return group
}
