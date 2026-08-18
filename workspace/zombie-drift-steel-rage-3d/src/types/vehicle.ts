export interface VehicleControls {
  throttle: number;    // -1 to 1 (reverse to forward)
  steering: number;    // -1 to 1 (left to right)
  handbrake: boolean;  // true = initiate drift
  nitro: boolean;      // true = nitro boost
}

export interface VehiclePhysicsState {
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  forward: { x: number; y: number; z: number };
  speed: number;
  driftAngle: number;
  isDrifting: boolean;
  isNitroActive: boolean;
  driftMultiplier: number;
  grounded: boolean;
}
