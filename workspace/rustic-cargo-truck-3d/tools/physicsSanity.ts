/**
 * Head-less sanity run for the truck physics.
 *
 * Builds the real terrain and the real truck spec in Rapier — no renderer, no browser — and
 * asserts the things that silently break a driving game: the truck accelerates, the wheels
 * turn, the suspension settles instead of oscillating, steering is not mirrored, and the
 * cargo stays in the bed. Run with `npm run check:physics`.
 */
import RAPIER from '@dimforge/rapier3d-compat';
import { buildTerrainGeometry, roadHeightAt } from '../src/world/terrain';
import {
  BED,
  BRAKE,
  CABIN,
  CARGO,
  CARGO_SLOTS,
  ENGINE,
  FRAME,
  MASS,
  RIDE_HEIGHT,
  SUSPENSION,
  TIRE,
  WHEEL,
} from '../src/vehicle/truckSpec';

const SPAWN_Z = 2;
const DT = 1 / 60;
const GROUPS = (m: number, f: number): number => (m << 16) | f;
const GROUND = GROUPS(1, 2 | 4);
const VEHICLE = GROUPS(2, 1 | 4);
const CARGO_GROUPS = GROUPS(4, 1 | 2 | 4);
const WHEEL_RAY = GROUPS(2, 1);

const failures: string[] = [];
function check(label: string, condition: boolean, detail: string): void {
  const status = condition ? 'ok  ' : 'FAIL';
  console.log(`  [${status}] ${label} — ${detail}`);
  if (!condition) failures.push(label);
}

interface Rig {
  world: RAPIER.World;
  chassis: RAPIER.RigidBody;
  vehicle: RAPIER.DynamicRayCastVehicleController;
  cargo: RAPIER.RigidBody[];
}

function buildRig(withCargo: boolean): Rig {
  const world = new RAPIER.World({ x: 0, y: -14, z: 0 });
  world.timestep = DT;

  const geometry = buildTerrainGeometry();
  const ground = world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  world.createCollider(
    RAPIER.ColliderDesc.trimesh(
      geometry.getAttribute('position').array as Float32Array,
      new Uint32Array(geometry.getIndex()!.array),
    )
      .setFriction(1)
      .setCollisionGroups(GROUND),
    ground,
  );

  const spawnY = roadHeightAt(SPAWN_Z) + RIDE_HEIGHT + 0.1;
  const chassis = world.createRigidBody(
    RAPIER.RigidBodyDesc.dynamic().setTranslation(0, spawnY, SPAWN_Z).setLinearDamping(0.08).setAngularDamping(0.9),
  );
  const box = (hx: number, hy: number, hz: number, x: number, y: number, z: number, mass: number): void => {
    world.createCollider(
      RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setMass(mass).setFriction(0.6).setCollisionGroups(VEHICLE),
      chassis,
    );
  };
  box(FRAME.hx, FRAME.hy, FRAME.hz, 0, 0, 0, MASS.frame);
  box(CABIN.hx, CABIN.hy, CABIN.hz, 0, CABIN.y, CABIN.z, MASS.cabin);
  const wallHalfZ = (BED.frontZ - BED.backZ) / 2;
  const wallCentreZ = (BED.frontZ + BED.backZ) / 2;
  const wallY = BED.floorY + BED.wallHalfY;
  for (const side of [-1, 1]) {
    box(BED.wallThickness, BED.wallHalfY, wallHalfZ, side * (BED.innerHalfX + BED.wallThickness), wallY, wallCentreZ, MASS.wall);
  }
  for (const z of [BED.frontZ + BED.wallThickness, BED.backZ - BED.wallThickness]) {
    box(BED.innerHalfX + BED.wallThickness * 2, BED.wallHalfY, BED.wallThickness, 0, wallY, z, MASS.wall);
  }

  const vehicle = world.createVehicleController(chassis);
  vehicle.indexUpAxis = 1;
  vehicle.setIndexForwardAxis = 2;
  for (const z of [WHEEL.frontZ, WHEEL.rearZ]) {
    for (const x of [-WHEEL.offsetX, WHEEL.offsetX]) {
      vehicle.addWheel({ x, y: WHEEL.connectionY, z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, SUSPENSION.restLength, WHEEL.radius);
    }
  }
  for (let i = 0; i < 4; i += 1) {
    vehicle.setWheelSuspensionStiffness(i, SUSPENSION.stiffness);
    vehicle.setWheelSuspensionCompression(i, SUSPENSION.compression);
    vehicle.setWheelSuspensionRelaxation(i, SUSPENSION.relaxation);
    vehicle.setWheelMaxSuspensionTravel(i, SUSPENSION.maxTravel);
    vehicle.setWheelMaxSuspensionForce(i, SUSPENSION.maxForce);
    vehicle.setWheelFrictionSlip(i, TIRE.frictionSlip);
    vehicle.setWheelSideFrictionStiffness(i, TIRE.sideFrictionStiffness);
  }

  const cargo: RAPIER.RigidBody[] = [];
  if (withCargo) {
    for (const slot of CARGO_SLOTS) {
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(slot.x, spawnY + slot.y, SPAWN_Z + slot.z).setLinearDamping(0.12).setAngularDamping(0.6),
      );
      const desc =
        slot.kind === 'log'
          ? RAPIER.ColliderDesc.cylinder(CARGO.log.halfLength, CARGO.log.radius)
              .setRotation({ x: Math.sin(Math.PI / 4), y: 0, z: 0, w: Math.cos(Math.PI / 4) })
              .setMass(CARGO.log.mass)
          : RAPIER.ColliderDesc.cuboid(CARGO.crate.half, CARGO.crate.half, CARGO.crate.half).setMass(CARGO.crate.mass);
      world.createCollider(desc.setFriction(0.8).setCollisionGroups(CARGO_GROUPS), body);
      cargo.push(body);
    }
  }
  return { world, chassis, vehicle, cargo };
}

function drive(rig: Rig, steps: number, throttle: number, steering: number, brake = 0): void {
  for (let step = 0; step < steps; step += 1) {
    const speed = rig.vehicle.currentVehicleSpeed();
    const force = throttle > 0 ? ENGINE.baseForce * throttle * Math.max(0, 1 - Math.max(0, speed) / ENGINE.maxSpeed) : 0;
    for (const i of [2, 3]) rig.vehicle.setWheelEngineForce(i, force);
    for (let i = 0; i < 4; i += 1) rig.vehicle.setWheelBrake(i, brake > 0 ? BRAKE.foot : throttle > 0 ? 0 : BRAKE.idle);
    for (const i of [0, 1]) rig.vehicle.setWheelSteering(i, steering);
    rig.vehicle.updateVehicle(DT, undefined, WHEEL_RAY);
    rig.world.step();
  }
}

async function main(): Promise<void> {
  await RAPIER.init();

  console.log('\nsettle at rest (2 s, no input)');
  const rest = buildRig(false);
  drive(rest, 120, 0, 0);
  const restY = rest.chassis.translation().y;
  const restLengths = [0, 1, 2, 3].map((i) => rest.vehicle.wheelSuspensionLength(i) ?? -1);
  const allInContact = [0, 1, 2, 3].every((i) => rest.vehicle.wheelIsInContact(i));
  check('all four wheels touch the ground', allInContact, `contact = ${[0, 1, 2, 3].map((i) => rest.vehicle.wheelIsInContact(i)).join(', ')}`);
  check(
    'suspension settles inside its travel',
    restLengths.every((l) => l > 0.05 && l < SUSPENSION.restLength + SUSPENSION.maxTravel),
    `lengths = ${restLengths.map((l) => l.toFixed(3)).join(', ')} (rest ${SUSPENSION.restLength})`,
  );
  check(
    'chassis rides at the expected height',
    Math.abs(restY - roadHeightAt(SPAWN_Z) - RIDE_HEIGHT) < 0.25,
    `y = ${restY.toFixed(3)}, expected ≈ ${(roadHeightAt(SPAWN_Z) + RIDE_HEIGHT).toFixed(3)}`,
  );
  const restSpeed = Math.abs(rest.vehicle.currentVehicleSpeed());
  check('the truck stays put with no throttle', restSpeed < 0.35, `speed = ${restSpeed.toFixed(3)} m/s`);

  console.log('\nfull throttle for 8 s');
  const run = buildRig(true);
  drive(run, 120, 0, 0);
  const startZ = run.chassis.translation().z;
  drive(run, 480, 1, 0);
  const endZ = run.chassis.translation().z;
  const topSpeed = run.vehicle.currentVehicleSpeed();
  const wheelSpin = run.vehicle.wheelRotation(2) ?? 0;
  check('the truck actually drives forward', endZ - startZ > 40, `travelled ${(endZ - startZ).toFixed(1)} m along +Z`);
  check('top speed lands near the tuned target', topSpeed > 8 && topSpeed < ENGINE.maxSpeed + 2, `${topSpeed.toFixed(2)} m/s (target ${ENGINE.maxSpeed})`);
  check('wheels roll forward, not backwards', wheelSpin > 0, `rear wheel rotation = ${wheelSpin.toFixed(1)} rad`);
  check(
    'wheel angular speed matches ground speed',
    Math.abs(Math.abs(wheelSpin * WHEEL.radius) / 8 - Math.abs(topSpeed)) < topSpeed * 0.5,
    `implied ${(Math.abs(wheelSpin * WHEEL.radius) / 8).toFixed(2)} m/s vs actual ${topSpeed.toFixed(2)} m/s`,
  );
  const upright = run.chassis.rotation();
  const upY = 1 - 2 * (upright.x * upright.x + upright.z * upright.z);
  check('the truck stays upright over the bumps', upY > 0.8, `chassis up.y = ${upY.toFixed(3)}`);

  console.log('\ncargo retention over the same 8 s');
  const spawnY = roadHeightAt(SPAWN_Z) + RIDE_HEIGHT + 0.1;
  const kept = run.cargo.filter((body) => {
    const p = body.translation();
    return p.y > roadHeightAt(p.z) + 0.55;
  }).length;
  check('cargo stays in the bed', kept === CARGO_SLOTS.length, `${kept}/${CARGO_SLOTS.length} still loaded`);
  const overlapping = CARGO_SLOTS.filter((slot) => slot.y - (slot.kind === 'log' ? CARGO.log.radius : CARGO.crate.half) < BED.floorY - 1e-6);
  check('no cargo slot starts inside the bed floor', overlapping.length === 0, `${overlapping.length} overlapping slot(s), spawn y base ${spawnY.toFixed(2)}`);

  console.log('\nsteering sign (positive steering must turn right, towards +X)');
  const turn = buildRig(false);
  drive(turn, 120, 0, 0);
  drive(turn, 240, 1, 0);
  const beforeX = turn.chassis.translation().x;
  drive(turn, 180, 1, 0.4);
  const afterX = turn.chassis.translation().x;
  check('positive steering steers right', afterX - beforeX > 0.5, `x moved ${(afterX - beforeX).toFixed(2)} m`);

  console.log('\nbraking from speed');
  const stop = buildRig(true);
  drive(stop, 120, 0, 0);
  drive(stop, 360, 1, 0);
  const beforeBrake = stop.vehicle.currentVehicleSpeed();
  drive(stop, 180, 0, 0, 1);
  const afterBrake = stop.vehicle.currentVehicleSpeed();
  check('the brake stops the truck within 3 s', Math.abs(afterBrake) < 1, `${beforeBrake.toFixed(2)} → ${afterBrake.toFixed(2)} m/s`);

  console.log(failures.length === 0 ? '\nAll physics checks passed.\n' : `\n${failures.length} check(s) failed: ${failures.join('; ')}\n`);
  process.exit(failures.length === 0 ? 0 : 1);
}

void main();
