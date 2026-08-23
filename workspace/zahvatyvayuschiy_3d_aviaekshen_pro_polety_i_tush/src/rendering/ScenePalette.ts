/**
 * Стилизованная палитра сцены. Значения читаются из токенов theme.css —
 * единственного места с цветами; при отсутствии DOM берутся резервные значения.
 */

export interface ScenePalette {
  sky: number
  fog: number
  water: number
  sandstone: number
  sandstoneDark: number
  sun: number
  planeBody: number
  planeWing: number
  fire: number
}

const FALLBACK: ScenePalette = {
  sky: 0x2c3e64,
  fog: 0x8a5a3a,
  water: 0x35c9be,
  sandstone: 0xb0562f,
  sandstoneDark: 0x7a3a20,
  sun: 0xffb36b,
  planeBody: 0xd93a2b,
  planeWing: 0xfff2e0,
  fire: 0xff7b33,
}

function cssColor(name: string, fallback: number): number {
  if (typeof document === 'undefined') return fallback
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  const hex = /^#([0-9a-fA-F]{6})$/.exec(raw)
  if (!hex) return fallback
  return parseInt(hex[1] as string, 16)
}

export function readScenePalette(): ScenePalette {
  return {
    sky: cssColor('--color-sky', FALLBACK.sky),
    fog: cssColor('--color-fog', FALLBACK.fog),
    water: cssColor('--color-water', FALLBACK.water),
    sandstone: cssColor('--color-sandstone', FALLBACK.sandstone),
    sandstoneDark: cssColor('--color-sandstone-dark', FALLBACK.sandstoneDark),
    sun: cssColor('--color-sun', FALLBACK.sun),
    planeBody: cssColor('--color-plane-body', FALLBACK.planeBody),
    planeWing: cssColor('--color-plane-wing', FALLBACK.planeWing),
    fire: cssColor('--color-danger', FALLBACK.fire),
  }
}
