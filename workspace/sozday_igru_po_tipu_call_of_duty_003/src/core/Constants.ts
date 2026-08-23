/**
 * Game balance constants and configuration.
 * Single source of truth corresponding to balance.yaml.
 */
export const BALANCE = {
  // Performance budgets
  target_fps: 60,
  max_draw_calls: 75,
  max_triangles: 45000,
  bundle_size_budget_mb: 4.5,

  // Breathing & Focus Mechanics
  max_breath_time: 4.00, // 4.00 s
  time_dilation: 0.50, // 0.50x
  scope_stabilization_time: 0.25, // 0.25 s
  hyperventilation_penalty_time: 2.50, // 2.50 s
  breath_recovery_speed: 33.3, // 33.3 %/s

  // Kinetic Environmental Sabotage
  spotlight_hazard_radius: 3.50, // 3.50 m
  structure_fall_time: 0.45, // 0.45 s
  guard_inspection_duration: 8.00, // 8.00 s
  accident_alarm_increase: 0.0, // 0.0 %
  accident_bounty_xp: 250, // +250 XP

  // AI Stealth & Detection
  suspicion_fill_time: 1.80, // 1.80 s
  panic_sprint_timer: 5.00, // 5.00 s
  panic_sprint_speed: 5.20, // 5.20 m/s
  guard_vision_range_clear: 45.0, // 45.0 m
  blizzard_vision_reduction_pct: -50.0, // -50.0 %

  // Ballistics & Wind
  bullet_muzzle_velocity: 850.0, // 850.0 m/s
  polar_wind_min: 0.0, // 0.0 m/s
  polar_wind_max: 14.0, // 14.0 m/s
  mil_dot_step_at_400m: 0.40, // 0.40 m/mil
  headshot_multiplier: 3.0, // x3.0
  body_groan_radius: 8.00, // 8.00 m

  // Acoustic Masking & Thunder
  thunder_masking_window: 1.40, // 1.40 s
  masking_noise_suppression_pct: -100.0, // -100.0 %
  natural_thunder_interval: 18.0, // 18.0 s
  diesel_generator_interval: 6.0, // 6.0 s
  unsuppressed_shot_noise_radius: 120.0, // 120.0 m
} as const;

export const SAVE_KEY = 'player_credits';
export const CURRENT_SAVE_VERSION = 1;
