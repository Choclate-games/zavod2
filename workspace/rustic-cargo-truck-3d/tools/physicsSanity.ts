import RAPIER from '@dimforge/rapier3d-compat';
import { buildTerrainGeometry, roadHeightAt } from '../src/world/terrain';
import {
  BED,
  BRAKE,
  CABIN,
  CARGO,
  CARGO_SLOTS,
  CARGO_PACKAGES,
  CARGO_SPECS,
  ENGINE,
  FRAME,
  MASS,
  RIDE_HEIGHT,
  SUSPENSION,
  TIRE,
  TRUCKS,
  WHEEL,
  type CargoPackageType,
  type TruckId,
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

function buildRig(truckId: TruckId = 'zil', packageType?: CargoPackageType): Rig {
  const world = new RAPIER.World({ x: 0, y: -14, z: 0 });
  world.timestep = DT;

  const cfg = TRUCKS[truckId];
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
  box(cfg.frame.hx, cfg.frame.hy, cfg.frame.hz, 0, 0, 0, cfg.mass.frame);
  box(cfg.cabin.hx, cfg.cabin.hy, cfg.cabin.hz, 0, cfg.cabin.y, cfg.cabin.z, cfg.mass.cabin);
  const wallHalfZ = (cfg.bed.frontZ - cfg.bed.backZ) / 2;
  const wallCentreZ = (cfg.bed.frontZ + cfg.bed.backZ) / 2;
  const wallY = cfg.bed.floorY + cfg.bed.wallHalfY;
  for (const side of [-1, 1]) {
    box(cfg.bed.wallThickness, cfg.bed.wallHalfY, wallHalfZ, side * (cfg.bed.innerHalfX + cfg.bed.wallThickness), wallY, wallCentreZ, cfg.mass.wall);
  }
  for (const z of [cfg.bed.frontZ + cfg.bed.wallThickness, cfg.bed.backZ - cfg.bed.wallThickness]) {
    box(cfg.bed.innerHalfX + cfg.bed.wallThickness * 2, cfg.bed.wallHalfY, cfg.bed.wallThickness, 0, wallY, z, cfg.mass.wall);
  }

  const vehicle = world.createVehicleController(chassis);
  vehicle.indexUpAxis = 1;
  vehicle.setIndexForwardAxis = 2;
  for (const w of cfg.wheels) {
    vehicle.addWheel({ x: w.x, y: cfg.suspension.connectionY, z: w.z }, { x: 0, y: -1, z: 0 }, { x: -1, y: 0, z: 0 }, cfg.suspension.restLength, cfg.wheelRadius);
  }
  for (let i = 0; i < cfg.wheels.length; i += 1) {
    vehicle.setWheelSuspensionStiffness(i, cfg.suspension.stiffness);
    vehicle.setWheelSuspensionCompression(i, cfg.suspension.compression);
    vehicle.setWheelSuspensionRelaxation(i, cfg.suspension.relaxation);
    vehicle.setWheelMaxSuspensionTravel(i, cfg.suspension.maxTravel);
    vehicle.setWheelMaxSuspensionForce(i, cfg.suspension.maxForce);
    vehicle.setWheelFrictionSlip(i, cfg.tire.frictionSlip);
    vehicle.setWheelSideFrictionStiffness(i, cfg.tire.sideFrictionStiffness);
  }

  const cargo: RAPIER.RigidBody[] = [];
  if (packageType) {
    const pkg = CARGO_PACKAGES[packageType] || CARGO_PACKAGES.logs;
    for (const slot of pkg.slots) {
      const body = world.createRigidBody(
        RAPIER.RigidBodyDesc.dynamic().setTranslation(slot.x, spawnY + slot.y, SPAWN_Z + slot.z).setLinearDamping(0.12).setAngularDamping(0.6),
      );
      const spec = CARGO_SPECS[slot.kind];
      const dims = spec.dimensions;
      const desc =
        spec.shape === 'cylinder'
          ? (slot.kind === 'barrel'
              ? RAPIER.ColliderDesc.cylinder(dims.halfLength ?? 0.38, dims.radius ?? 0.28)
              : RAPIER.ColliderDesc.cylinder(dims.halfLength ?? 0.95, dims.radius ?? 0.28).setRotation({ x: Math.sin(Math.PI / 4), y: 0, z: 0, w: Math.cos(Math.PI / 4) }))
          : RAPIER.ColliderDesc.cuboid(dims.halfX ?? 0.31, dims.halfY ?? 0.31, dims.halfZ ?? 0.31);

      world.createCollider(desc.setMass(spec.mass).setFriction(spec.friction).setCollisionGroups(CARGO_GROUPS), body);
      cargo.push(body);
    }
  }
  return { world, chassis, vehicle, cargo };
}

function drive(rig: Rig, steps: number, throttle: number, steering: number, brake = 0, driveWheels = [2, 3]): void {
  for (let step = 0; step < steps; step += 1) {
    const speed = rig.vehicle.currentVehicleSpeed();
    const force = throttle > 0 ? ENGINE.baseForce * throttle * Math.max(0, 1 - Math.max(0, speed) / ENGINE.maxSpeed) : 0;
    for (const i of driveWheels) rig.vehicle.setWheelEngineForce(i, force);
    const wheelCount = rig.vehicle.numWheels();
    for (let i = 0; i < wheelCount; i += 1) rig.vehicle.setWheelBrake(i, brake > 0 ? BRAKE.foot : throttle > 0 ? 0 : BRAKE.idle);
    for (let i = 0; i < Math.min(2, wheelCount); i += 1) rig.vehicle.setWheelSteering(i, steering);
    rig.vehicle.updateVehicle(DT, undefined, WHEEL_RAY);
    rig.world.step();
  }
}

async function main(): Promise<void> {
  await RAPIER.init();

  console.log('\nsettle at rest (2 s, no input)');
  const rest = buildRig('zil');
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
  const run = buildRig('zil', 'logs');
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

  console.log('\nsteering sign (positive steer input must turn right, towards screen right / world -X)');
  const turn = buildRig('zil');
  drive(turn, 120, 0, 0);
  drive(turn, 240, 1, 0);
  const beforeX = turn.chassis.translation().x;
  drive(turn, 180, 1, -0.4);
  const afterX = turn.chassis.translation().x;
  check('positive user input steers screen right (world -X)', afterX - beforeX < -0.5, `x moved ${(afterX - beforeX).toFixed(2)} m`);

  console.log('\nbraking from speed');
  const stop = buildRig('zil', 'logs');
  drive(stop, 120, 0, 0);
  drive(stop, 360, 1, 0);
  const beforeBrake = stop.vehicle.currentVehicleSpeed();
  drive(stop, 180, 0, 0, 1);
  const afterBrake = stop.vehicle.currentVehicleSpeed();
  check('the brake stops the truck within 3 s', Math.abs(afterBrake) < 1, `${beforeBrake.toFixed(2)} → ${afterBrake.toFixed(2)} m/s`);

  console.log('\nmud physics & slip response');
  const mudRig = buildRig('zil');
  mudRig.chassis.setTranslation({ x: 0, y: roadHeightAt(110) + RIDE_HEIGHT + 0.1, z: 110 }, true);
  drive(mudRig, 60, 0, 0);
  const mudStartZ = mudRig.chassis.translation().z;
  drive(mudRig, 180, 1, 0);
  const mudEndZ = mudRig.chassis.translation().z;
  check('the truck navigates deep mud with increased resistance', mudEndZ - mudStartZ > 8 && mudEndZ - mudStartZ < 35, `travelled ${(mudEndZ - mudStartZ).toFixed(1)} m in mud sector`);

  console.log('\n6x6 heavy truck (KRAZ-255) sanity');
  const krazRig = buildRig('kraz', 'construction');
  drive(krazRig, 120, 0, 0);
  const krazWheelContacts = [0, 1, 2, 3, 4, 5].every((i) => krazRig.vehicle.wheelIsInContact(i));
  check('all 6 wheels of KRAZ make ground contact', krazWheelContacts, `6 wheels in contact`);
  const krazStartZ = krazRig.chassis.translation().z;
  drive(krazRig, 240, 1, 0, 0, [2, 3, 4, 5]);
  const krazEndZ = krazRig.chassis.translation().z;
  check('6x6 truck drives forward with 4-wheel rear drive', krazEndZ - krazStartZ > 20, `travelled ${(krazEndZ - krazStartZ).toFixed(1)} m`);

  console.log('\ndiverse cargo packages validation (no floor overlaps)');
  const packages: CargoPackageType[] = ['logs', 'barrels', 'construction', 'farm', 'fragile', 'mixed'];
  for (const pkgType of packages) {
    const pkg = CARGO_PACKAGES[pkgType];
    const overlaps = pkg.slots.filter((s) => s.y < BED.floorY + 0.15);
    check(`cargo package «${pkg.title}» (${pkg.tag}) slots are valid`, overlaps.length === 0 && pkg.slots.length === 8, `${pkg.slots.length} slots, ${overlaps.length} overlaps`);
  }

  console.log(failures.length === 0 ? '\nAll physics checks passed.\n' : `\n${failures.length} check(s) failed: ${failures.join('; ')}\n`);
  process.exit(failures.length === 0 ? 0 : 1);
}

void main();


