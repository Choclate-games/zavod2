#!/usr/bin/env node
/**
 * Проверка ядра физики в Node до запуска игры в браузере.
 *
 *   node scripts/physics-check.mjs
 *
 * Воспроизводит правила каскада из PhysicsWorld/DominoChainEvaluationSystem:
 * 1) импульс клина перекрывает энергетический барьер опрокидывания — башня
 *    набирает наклон и падает;
 * 2) AABB-детекция сближения фиксирует удар о соседа;
 * 3) передача 42% кинетической энергии превышает порог излома бетона (15 МДж);
 * 4) получивший удар сосед опрокидывается — цепь домино замыкается.
 */
import RAPIER from '@dimforge/rapier3d-compat'

const GRAVITY = 9.81
const DENSITY = 300 // MATERIAL_DENSITY.concrete
const IMPULSE_TRANSFER = 0.42
const FRACTURE_J = 15e6

function requiredTiltDv(w, d, h) {
  const foot = Math.max(w, d)
  const delta = (Math.sqrt(h * h + foot * foot) - h) / 2
  const lever = h * 0.22
  return Math.sqrt(((h * h + foot * foot) * GRAVITY * delta) / (6 * lever * lever))
}

function makeBuilding(world, x, z, w, d, h) {
  const body = world.createRigidBody(
    RAPIER.RigidBodyDesc.fixed().setTranslation(x, h / 2, z),
  )
  world.createCollider(
    RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setDensity(DENSITY).setFriction(0.85),
    body,
  )
  return { body, mass: w * d * h * DENSITY, x0: x, z0: z, w, d, h }
}

await RAPIER.init()
const world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 })
world.timestep = 1 / 60

const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, -0.5, 0))
world.createCollider(RAPIER.ColliderDesc.cuboid(400, 0.5, 400), ground)

const towerA = makeBuilding(world, -20, 0, 11, 11, 40)
const towerB = makeBuilding(world, -7, 0, 10, 10, 30)
let failed = 0
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`)
  if (!ok) failed++
}

// Пуск клина: импульс выше центра масс, dv перекрывает барьер с запасом ×1.7.
towerA.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true)
const dvWanted = Math.min(
  8,
  Math.max(requiredTiltDv(towerA.w, towerA.d, towerA.h) * 1.7, (850_000 * 2.2) / towerA.mass),
)
towerA.body.applyImpulseAtPoint(
  { x: dvWanted * towerA.mass, y: 0, z: 0 },
  { x: -20, y: towerA.h * 0.72, z: 0 },
  true,
)

// Покадровая AABB-детекция сближения — как в DominoChainEvaluationSystem.update.
let maxTiltA = 0
let impactEnergyJ = 0
let contacted = false
for (let i = 0; i < 360 && !contacted; i++) {
  world.step()
  const ta = towerA.body.translation()
  const tb = towerB.body.translation()
  const qa = towerA.body.rotation()
  // Наклон — крен оси «вверх», а не рыскание.
  const upY = Math.min(1, Math.max(-1, 1 - 2 * (qa.x * qa.x + qa.z * qa.z)))
  maxTiltA = Math.max(maxTiltA, Math.acos(upY))
  // AABB повёрнутой башни A против стоящей B.
  const sinT = Math.sin(Math.acos(upY))
  const exA = (towerA.h / 2) * sinT + (towerA.w / 2) * Math.cos(Math.acos(upY))
  const overlapX = Math.abs(tb.x - ta.x) <= exA + towerB.w / 2 + 0.6
  const overlapZ = Math.abs(tb.z - ta.z) <= towerA.d / 2 + towerB.d / 2 + 0.6
  const overlapY = Math.abs(tb.y - ta.y) <= towerA.h / 2 + towerB.h / 2
  if (overlapX && overlapY && overlapZ) {
    contacted = true
    const v = towerA.body.linvel()
    impactEnergyJ = 0.5 * towerA.mass * (v.x ** 2 + v.y ** 2 + v.z ** 2)
  }
}
check('башня A кренится после среза', maxTiltA > 0.02, `наклон ${(maxTiltA * 57.3).toFixed(1)}°`)
check('падающая башня достаёт до соседней', contacted)
check('энергия удара положительна и конечна', impactEnergyJ > 0 && Number.isFinite(impactEnergyJ))

// Передача 42% энергии ломает стоящего соседа: переводим его в динамику.
const delivered = impactEnergyJ * IMPULSE_TRANSFER
if (delivered >= FRACTURE_J) {
  towerB.body.setBodyType(RAPIER.RigidBodyType.Dynamic, true)
  const ratio = Math.min(delivered / FRACTURE_J, 3)
  const kickDv = Math.min(
    8,
    Math.max(1.5, requiredTiltDv(towerB.w, towerB.d, towerB.h) * (1.3 + 0.5 * Math.min(ratio, 1))),
  )
  towerB.body.applyImpulseAtPoint(
    { x: kickDv * towerB.mass, y: kickDv * 0.06 * towerB.mass, z: 0 },
    { x: -7, y: towerB.h * 0.7, z: 0 },
    true,
  )
  let fellOver = false
  for (let i = 0; i < 300; i++) {
    world.step()
    const q = towerB.body.rotation()
    const upY = Math.min(1, Math.max(-1, 1 - 2 * (q.x * q.x + q.z * q.z)))
    if (Math.acos(upY) > Math.PI / 4) {
      fellOver = true
      break
    }
  }
  check('соседняя башня опрокинулась от передачи энергии', fellOver)
} else {
  check('переданной энергии хватает на порог бетона', false,
    `${Math.round(delivered / 1e6)} МДж < 15 МДж`)
}

process.exit(failed ? 1 : 0)
