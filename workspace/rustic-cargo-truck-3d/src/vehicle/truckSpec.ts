/**
 * Single source of truth for the truck's dimensions and handling.
 *
 * Everything else — collider layout, visual meshes, wheel rig, cargo spawn slots —
 * is derived from these numbers, so the picture and the physics cannot drift apart.
 * Chassis-local axes: +X right, +Y up, +Z forward. The cabin sits at +Z, the bed at -Z,
 * and the route runs from the village towards +Z.
 */

export const FRAME = { hx: 1.15, hy: 0.32, hz: 3.0 } as const;

export const CABIN = { hx: 1.02, hy: 0.62, hz: 1.02, y: 0.94, z: 1.6 } as const;

export const BED = {
  /** Inner walls of the cargo box, in chassis-local space. */
  innerHalfX: 1.02,
  floorY: FRAME.hy,
  /** Bed runs from the headboard behind the cabin backwards to the tailgate. */
  frontZ: -0.15,
  backZ: -2.95,
  wallHalfY: 0.42,
  wallThickness: 0.05,
} as const;

export const WHEEL = {
  radius: 0.6,
  halfWidth: 0.22,
  offsetX: 1.08,
  frontZ: 2.0,
  rearZ: -2.0,
  /** Suspension hard-point, relative to the chassis centre of mass. */
  connectionY: -0.1,
} as const;

export const SUSPENSION = {
  restLength: 0.5,
  stiffness: 70,
  compression: 3.4,
  relaxation: 5.2,
  maxTravel: 0.35,
  maxForce: 40000,
} as const;

export const TIRE = { frictionSlip: 2.6, sideFrictionStiffness: 0.8 } as const;

export const ENGINE = {
  baseForce: 1550,
  forcePerUpgrade: 280,
  maxSpeed: 15.5,
  speedPerUpgrade: 1.2,
  reverseForce: 780,
  maxReverseSpeed: 5.5,
} as const;

export const BRAKE = { foot: 26, hand: 90, idle: 2.6 } as const;

export const STEERING = {
  maxAngle: 0.52,
  /** Radians per second the virtual steering wheel turns / returns to centre. */
  turnRate: 3.2,
  returnRate: 5.4,
  /** Steering lock shrinks with speed so the truck cannot spin out at full throttle. */
  speedFalloff: 0.055,
} as const;

export const MASS = { frame: 360, cabin: 70, wall: 12 } as const;

/** Height of the chassis centre above the ground once the suspension has settled under load. */
export const RIDE_HEIGHT = WHEEL.radius - WHEEL.connectionY + SUSPENSION.restLength * 0.6;

export const CARGO = {
  log: { radius: 0.28, halfLength: 0.95, mass: 25 },
  crate: { half: 0.31, mass: 18 },
} as const;

interface CargoSlot {
  kind: 'log' | 'crate';
  x: number;
  y: number;
  z: number;
}

/** Cargo spawn slots in chassis-local space: a 3-2-1 log stack up front, two crates at the tailgate. */
export const CARGO_SLOTS: readonly CargoSlot[] = [
  { kind: 'log', x: -0.62, y: BED.floorY + CARGO.log.radius + 0.02, z: -1.05 },
  { kind: 'log', x: 0, y: BED.floorY + CARGO.log.radius + 0.02, z: -1.05 },
  { kind: 'log', x: 0.62, y: BED.floorY + CARGO.log.radius + 0.02, z: -1.05 },
  { kind: 'log', x: -0.31, y: BED.floorY + CARGO.log.radius * 2.7, z: -1.05 },
  { kind: 'log', x: 0.31, y: BED.floorY + CARGO.log.radius * 2.7, z: -1.05 },
  { kind: 'log', x: 0, y: BED.floorY + CARGO.log.radius * 4.4, z: -1.05 },
  { kind: 'crate', x: -0.5, y: BED.floorY + CARGO.crate.half + 0.02, z: -2.5 },
  { kind: 'crate', x: 0.5, y: BED.floorY + CARGO.crate.half + 0.02, z: -2.5 },
];
