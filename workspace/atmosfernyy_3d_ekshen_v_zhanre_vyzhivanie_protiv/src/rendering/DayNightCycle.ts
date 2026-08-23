import * as THREE from 'three'
import type { SceneManager } from './SceneManager.js'
import type { AtmosphereRenderer } from './AtmosphereRenderer.js'
import type { OceanRenderer } from './OceanRenderer.js'

/**
 * Режиссура 180-секундной ночи: свет, небо и вода едут от кромешного шторма
 * к золотому рассвету 06:00 без единого пересоздания объектов.
 */
export class DayNightCycle {
  private readonly dawnSunColor = new THREE.Color(0xffd28a)
  private readonly dawnHemisphere = new THREE.Color(0x3a4a66)

  constructor(
    private readonly sceneManager: SceneManager,
    private readonly sky: AtmosphereRenderer,
    private readonly ocean: OceanRenderer,
  ) {}

  update(progress: number): void {
    const clamped = Math.max(0, Math.min(1, progress))
    const dawn = Math.max(0, (clamped - 0.7) / 0.3)

    const sun = this.sceneManager.sunLight
    sun.intensity = 0.3 + dawn * 1.1
    sun.color.setHex(0x8fa7d9).lerp(this.dawnSunColor, dawn)
    // Солнце поднимается с востока.
    sun.position.set(-40 + dawn * 70, 55 + dawn * 10, -25 + dawn * 40)

    const hemi = this.sceneManager.hemisphere
    hemi.intensity = 0.55 + dawn * 0.5
    hemi.color.setHex(0x1a2340).lerp(this.dawnHemisphere, dawn)

    this.sky.setNightProgress(clamped)
    this.ocean.setDawnMix(dawn)
  }
}
