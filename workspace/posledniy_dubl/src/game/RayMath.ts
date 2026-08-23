import * as THREE from 'three'

/** Пересечение луча со сферой; возвращает дистанцию вдоль луча или -1. */
export function raySphere(
  o: THREE.Vector3, d: THREE.Vector3, cx: number, cy: number, cz: number, r: number,
): number {
  const ox = o.x - cx
  const oy = o.y - cy
  const oz = o.z - cz
  const b = ox * d.x + oy * d.y + oz * d.z
  const c = ox * ox + oy * oy + oz * oz - r * r
  const disc = b * b - c
  if (disc < 0) return -1
  const t = -b - Math.sqrt(disc)
  return t >= 0 ? t : -1
}

/** Приближённое пересечение луча с вертикальным цилиндром корпуса. */
export function rayCapsuleApprox(
  o: THREE.Vector3, d: THREE.Vector3, cx: number, cy: number, cz: number, halfW: number, halfH: number,
): number {
  const topY = cy + halfH
  const bottomY = cy - halfH
  const dx = cx - o.x
  const dz = cz - o.z
  const planar = d.x * d.x + d.z * d.z
  if (planar < 1e-8) {
    if (Math.hypot(dx, dz) > halfW) return -1
    if ((topY - o.y) * d.y < 0 && (bottomY - o.y) * d.y < 0) return -1
    return Math.max(topY - o.y, bottomY - o.y) / Math.max(1e-6, Math.abs(d.y))
  }
  const t = (dx * d.x + dz * d.z) / planar
  const px = o.x + d.x * t
  const pz = o.z + d.z * t
  if (Math.hypot(px - cx, pz - cz) > halfW) return -1
  const yAtT = o.y + d.y * t
  if (yAtT > topY || yAtT < bottomY) {
    const tTop = (topY - o.y) / d.y
    const pxTop = o.x + d.x * tTop
    const pzTop = o.z + d.z * tTop
    if (tTop >= 0 && Number.isFinite(tTop) && Math.hypot(pxTop - cx, pzTop - cz) <= halfW) return tTop
    const tBottom = (bottomY - o.y) / d.y
    const pxBot = o.x + d.x * tBottom
    const pzBot = o.z + d.z * tBottom
    if (tBottom >= 0 && Number.isFinite(tBottom) && Math.hypot(pxBot - cx, pzBot - cz) <= halfW) return tBottom
    return -1
  }
  return t >= 0 ? t : -1
}

