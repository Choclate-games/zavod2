export const GameConfig = {
  // Survival timer
  MAX_SURVIVAL_TIME: 600, // 10 minutes (600s)

  // Arena bounds
  ARENA_RADIUS: 85,
  ARENA_SIZE: 170,

  // Player defaults
  PLAYER: {
    INITIAL_HP: 100,
    INITIAL_MASS: 10,
    BASE_RADIUS: 0.65,
    BASE_SPEED: 12.5,
    MASS_ABSORB_RATIO: 1.15, // player mass must be > target.mass * 1.15 to absorb
    SPEED_MASS_EXPONENT: 0.18, // Speed = BaseSpeed * (1 / Mass^0.18)
    DASH_COOLDOWN: 3.5, // seconds
    DASH_DURATION: 0.28, // seconds
    DASH_SPEED_MULT: 2.8,
    DASH_MASS_COST_PERCENT: 0.04, // 4% mass
    BASE_MAGNET_RADIUS: 4.5,
    BASE_POISON_DAMAGE: 15,
  },

  // Camera Settings
  CAMERA: {
    FOV: 52,
    PITCH_DEG: 55,
    BASE_DISTANCE: 18,
    BASE_HEIGHT: 24,
    MIN_ZOOM: 1.0,
    MAX_ZOOM: 3.2,
    LERP_SPEED: 4.0,
  },

  // Rapier & Fixed update
  PHYSICS: {
    FIXED_TIMESTEP: 1 / 60,
    MAX_DELTA: 0.1, // 100ms
    HITSTOP_DURATION: 0.04, // 40ms
    HITSTOP_TIMESCALE: 0.05,
  },

  // Playgama integration
  PLAYGAMA: {
    INTERSTITIAL_COOLDOWN: 90, // 90 seconds
    SAVE_DEBOUNCE: 1500, // 1.5s
    STORAGE_KEY: 'bioslime_dna_balance',
  },

  // Spawning & waves
  WAVES: {
    SPAWN_RADIUS_MIN: 24,
    SPAWN_RADIUS_MAX: 38,
    MAX_ACTIVE_ENEMIES: 250,
  }
};
