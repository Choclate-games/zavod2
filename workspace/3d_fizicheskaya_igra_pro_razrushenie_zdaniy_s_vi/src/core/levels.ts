import type { MaterialKind } from './balance'
import { DELAYED_CHARGE, SESSION } from './balance'

export type BuildingSpec = {
  x: number
  z: number
  w: number
  d: number
  h: number
  material: MaterialKind
}

export type LevelSpec = {
  name: string
  perimeterRadius: number
  chargeLimit: number
  microChargeAllowed: boolean
  buildings: BuildingSpec[]
}

type Rect = { x: number; z: number; w: number; d: number }

function overlapsAny(rect: Rect, placed: Rect[]): boolean {
  for (const other of placed) {
    const dx = Math.abs(rect.x - other.x) - (rect.w + other.w) / 2
    const dz = Math.abs(rect.z - other.z) - (rect.d + other.d) / 2
    if (dx < 4 && dz < 4) return true
  }
  return false
}

/**
 * Детерминированный генератор сектора: одинаковый номер уровня — одинаковый квартал.
 * Первая башня ставится в центр как домино-толкач, остальные расходятся цепочкой.
 */
export function buildLevel(index: number): LevelSpec {
  let seed = 1337 + index * 7919
  const rand = (): number => {
    seed = (seed * 1103515245 + 12345) % 2147483648
    return seed / 2147483648
  }

  const count = Math.min(3 + Math.floor(index / 3), SESSION.TOTAL_LEVELS > 0 ? 7 : 7)
  const materials: MaterialKind[] = ['glass', 'concrete', 'steel']
  const buildings: BuildingSpec[] = []
  const placed: Rect[] = []

  const firstHeight = 34 + rand() * 26 + Math.min(index, 12)
  buildings.push({ x: -18 - index * 0.6, z: 0, w: 11, d: 11, h: firstHeight, material: 'concrete' })
  placed.push({ x: buildings[0]!.x, z: 0, w: 11, d: 11 })

  let cursorX = buildings[0]!.x
  let cursorZ = 0
  for (let i = 1; i < count; i++) {
    const w = 8 + rand() * 7
    const d = 8 + rand() * 7
    const h = 20 + rand() * 42 * (i % 3 === 0 ? 1 : 0.65) + index * 0.4
    const stepX = w / 2 + 9 + rand() * 5
    cursorX += stepX
    if (rand() > 0.62) cursorZ += (rand() - 0.5) * 26
    const rect: Rect = { x: cursorX, z: cursorZ, w, d }
    if (overlapsAny(rect, placed)) {
      cursorZ += 24
    }
    placed.push({ ...rect })
    const material = materials[Math.floor(rand() * materials.length)]!
    buildings.push({ x: rect.x, z: rect.z, w, d, h, material })
  }

  return {
    name: `S-${String(index + 1).padStart(2, '0')}`,
    perimeterRadius: 70 + count * 9,
    chargeLimit: index < 2 ? 2 : 1 + (index >= 15 ? 1 : 0),
    microChargeAllowed: index + 1 >= DELAYED_CHARGE.UNLOCK_LEVEL,
    buildings,
  }
}
