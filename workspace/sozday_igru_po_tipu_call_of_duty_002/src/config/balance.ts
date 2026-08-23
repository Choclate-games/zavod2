export interface WeaponDef {
  id: string;
  name: string;
  rank: number;
  damage: number;
  fireRate: number; // rounds per second
  magazineCapacity: number;
  isAutomatic: boolean;
  spread: number;
  range: number;
  bulletSpeed: number;
  pelletCount?: number;
  splashRadius?: number;
  recoilVertical: number;
  recoilHorizontal: number;
  color: string;
}

export const GAME_BALANCE = {
  // Performance & limits
  target_fps: 60,
  max_draw_calls: 65,
  max_triangles: 38000,
  bundle_size_budget_mb: 3.8,

  // Session & rules
  match_duration: 90, // seconds
  respawn_delay: 1.0, // seconds
  ladder_tier_count: 12, // 12 ranks
  win_frags: 12,
  morph_transition_duration: 0.08, // 80ms instant weapon swap
  frag_refill_ammo: 100, // 100% magazine refill on kill
  headshot_skip_ladder: 0, // 0 bonus ladder skip

  // Movement & Slide
  base_speed: 8.0, // m/s
  slide_velocity_multiplier: 1.35, // 1.35x = 10.8 m/s
  slide_speed: 10.8, // 10.8 m/s
  slide_duration: 0.90, // seconds
  slide_cooldown: 0.35, // seconds
  slide_spread_penalty: 0.25, // +25% hipfire spread
  hitbox_height_stand: 1.80, // m
  hitbox_height_slide: 0.90, // 50% reduction (from 1.80m to 0.90m)
  camera_height_stand: 1.68,
  camera_height_slide: 0.75,

  // Vertical & Vault
  jump_speed: 7.6,
  gravity: 24.0,
  max_vault_obstacle_height: 2.60, // 2.60m container height
  vault_animation_duration: 0.40, // 0.40s climb
  fall_damage_threshold: 6.0, // 6.0m fall threshold

  // Killstreak UAV «Overlord»
  killstreak_cost: 3, // 3 frags without death
  uav_active_duration: 8.0, // 8.0s duration
  radar_pulse_interval: 1.5, // 1.5s sonar sweep
  wallhack_outline_alpha: 0.85, // 0.85 opacity

  // Hit Zones & Damage multipliers
  headshot_damage_multiplier: 2.0, // 2.0x
  torso_damage_multiplier: 1.0,
  legs_damage_multiplier: 0.7,
  stagger_slowdown_duration: 0.35, // 0.35s duration (30% slowdown -> 0.70x speed)
  stagger_penalty: 0.70, // 30% slowdown
  hitmarker_duration: 0.18, // 0.18s
  hit_audio_pitch_headshot: 1320, // 1320 Hz
  hit_audio_pitch_body: 880, // 880 Hz

  // Bot AI settings
  bot_reaction_delay_min: 0.25,
  bot_reaction_delay_max: 0.45,
  bot_hearing_radius: 20.0, // 20m sound detection
  bot_spawn_min_dist: 12.0,
  bot_spawn_max_dist: 22.0,
  bot_strafe_speed: 4.5,
  bot_count: 6,

  // Camera settings
  fov_default: 75.0,
  fov_slide: 92.0,
  fov_aim: 68.0
} as const;

export const WEAPON_LADDER: WeaponDef[] = [
  {
    id: 'p99',
    name: 'P99 Tactical',
    rank: 1,
    damage: 38,
    fireRate: 5.5,
    magazineCapacity: 12,
    isAutomatic: false,
    spread: 0.015,
    range: 45,
    bulletSpeed: 500,
    recoilVertical: 0.03,
    recoilHorizontal: 0.01,
    color: '#8295a8'
  },
  {
    id: 'magnum',
    name: '.44 Magnum',
    rank: 2,
    damage: 70,
    fireRate: 2.2,
    magazineCapacity: 6,
    isAutomatic: false,
    spread: 0.012,
    range: 60,
    bulletSpeed: 600,
    recoilVertical: 0.08,
    recoilHorizontal: 0.02,
    color: '#d4af37'
  },
  {
    id: 'spas12',
    name: 'SPAS-12 Pump',
    rank: 3,
    damage: 15,
    pelletCount: 8,
    fireRate: 1.4,
    magazineCapacity: 8,
    isAutomatic: false,
    spread: 0.065,
    range: 25,
    bulletSpeed: 380,
    recoilVertical: 0.09,
    recoilHorizontal: 0.03,
    color: '#a0522d'
  },
  {
    id: 'aa12',
    name: 'AA-12 Auto Shotgun',
    rank: 4,
    damage: 13,
    pelletCount: 6,
    fireRate: 4.5,
    magazineCapacity: 20,
    isAutomatic: true,
    spread: 0.075,
    range: 22,
    bulletSpeed: 360,
    recoilVertical: 0.06,
    recoilHorizontal: 0.03,
    color: '#364559'
  },
  {
    id: 'mp5',
    name: 'MP5 Navy',
    rank: 5,
    damage: 26,
    fireRate: 13.0,
    magazineCapacity: 30,
    isAutomatic: true,
    spread: 0.028,
    range: 50,
    bulletSpeed: 450,
    recoilVertical: 0.032,
    recoilHorizontal: 0.015,
    color: '#2a3442'
  },
  {
    id: 'p90',
    name: 'P90 CQB',
    rank: 6,
    damage: 22,
    fireRate: 15.0, // 900 rpm
    magazineCapacity: 50,
    isAutomatic: true,
    spread: 0.032,
    range: 50,
    bulletSpeed: 480,
    recoilVertical: 0.028,
    recoilHorizontal: 0.018,
    color: '#3d4d60'
  },
  {
    id: 'm4a1',
    name: 'M4A1 Carbine',
    rank: 7,
    damage: 32,
    fireRate: 12.0,
    magazineCapacity: 30,
    isAutomatic: true,
    spread: 0.020,
    range: 75,
    bulletSpeed: 650,
    recoilVertical: 0.040,
    recoilHorizontal: 0.015,
    color: '#46586d'
  },
  {
    id: 'ak47',
    name: 'AK-47 Tactical',
    rank: 8,
    damage: 38,
    fireRate: 10.0,
    magazineCapacity: 30,
    isAutomatic: true,
    spread: 0.025,
    range: 75,
    bulletSpeed: 620,
    recoilVertical: 0.055,
    recoilHorizontal: 0.025,
    color: '#8b4513'
  },
  {
    id: 'saw',
    name: 'M249 SAW',
    rank: 9,
    damage: 30,
    fireRate: 13.5,
    magazineCapacity: 100,
    isAutomatic: true,
    spread: 0.038,
    range: 80,
    bulletSpeed: 630,
    recoilVertical: 0.045,
    recoilHorizontal: 0.030,
    color: '#556b2f'
  },
  {
    id: 'dmr14',
    name: 'DMR-14 Marksman',
    rank: 10,
    damage: 55,
    fireRate: 5.0,
    magazineCapacity: 20,
    isAutomatic: false,
    spread: 0.008,
    range: 90,
    bulletSpeed: 600,
    recoilVertical: 0.060,
    recoilHorizontal: 0.010,
    color: '#2f4f4f'
  },
  {
    id: 'awp',
    name: 'AWP .338 Sniper',
    rank: 11,
    damage: 120,
    fireRate: 0.9,
    magazineCapacity: 5,
    isAutomatic: false,
    spread: 0.090, // large hipfire spread
    range: 120,
    bulletSpeed: 850,
    recoilVertical: 0.12,
    recoilHorizontal: 0.03,
    color: '#1a472a'
  },
  {
    id: 'rpg7',
    name: 'Golden RPG-7',
    rank: 12,
    damage: 200,
    splashRadius: 3.5,
    fireRate: 0.8,
    magazineCapacity: 1,
    isAutomatic: false,
    spread: 0.020,
    range: 80,
    bulletSpeed: 65,
    recoilVertical: 0.15,
    recoilHorizontal: 0.04,
    color: '#ffd700'
  }
];