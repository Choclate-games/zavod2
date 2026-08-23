import { balance } from './balance'

/** Класс сложности: 0 — Ущелье Новичков, 1 — Синий Карниз, 2 — Чертов Хребет. */
export type TrackTier = 0 | 1 | 2

export interface TrackDef {
  id: string
  index: number
  nameKey: string
  seed: number
  tier: TrackTier
  /** Норматив 3 звезды, секунд (квалификация трассы). */
  goldTimeS: number
  /** Норматив 2 звезд, секунд. */
  silverTimeS: number
}

const TIER_NAMES = ['Ущелье Новичков', 'Синий Карниз', 'Чертов Хребет'] as const

/**
 * 12 авторских перевалов. Геометрия каждого детерминированно строится из seed:
 * фиксированный серпантин со стартом и финишем, не процедурная труба.
 */
function buildCatalog(): TrackDef[] {
  const tracks: TrackDef[] = []
  for (let i = 0; i < 12; i++) {
    const tier = (i < 3 ? 0 : i < 7 ? 1 : 2) as TrackTier
    const gold = 75 + tier * 8 + (i % 3) * 4
    tracks.push({
      id: `pass_${String(i + 1).padStart(2, '0')}`,
      index: i,
      nameKey: `${tier + 1}. ${TIER_NAMES[tier]} · ${i + 1}`,
      seed: 1013 * (i + 1) + 37,
      tier,
      goldTimeS: gold,
      silverTimeS: gold + 25,
    })
  }
  return tracks
}

export const TRACKS: readonly TrackDef[] = buildCatalog()

export const MILK_WIN_RATIO = 0.75
export const INITIAL_MILK_L = balance.massMilkKg
