/**
 * Web Audio Timing, Rhythm Beat Sync & Muting Logic.
 * Pure TS, independent of Three.js.
 * Implements knowledge/audio/procedural_sound_synthesizer.md,
 * knowledge/audio/web_audio_and_muting.md, and knowledge/mechanics/rhythm_sync.md.
 */

export const PERFECT_WINDOW = 0.065; // seconds
export const GOOD_WINDOW = 0.140; // seconds

export type HitRating = 'PERFECT' | 'GOOD' | 'MISS';

export interface HitResult {
  rating: HitRating;
  deltaSeconds: number;
  score: number;
  combo: number;
  multiplier: number;
}

export function computeBeat(songPositionSeconds: number, bpm: number): number {
  return songPositionSeconds * (bpm / 60.0);
}

export function evaluateRhythmHit(
  inputTimeSeconds: number,
  bpm: number,
  currentCombo: number,
): HitResult {
  const beatInterval = 60.0 / bpm;
  const nearestBeatIdx = Math.round(inputTimeSeconds / beatInterval);
  const nearestBeatTime = nearestBeatIdx * beatInterval;
  const delta = Math.abs(inputTimeSeconds - nearestBeatTime);

  let rating: HitRating = 'MISS';
  let baseScore = 0;
  let newCombo = 0;

  if (delta <= PERFECT_WINDOW) {
    rating = 'PERFECT';
    baseScore = 100;
    newCombo = currentCombo + 1;
  } else if (delta <= GOOD_WINDOW) {
    rating = 'GOOD';
    baseScore = 50;
    newCombo = currentCombo + 1;
  } else {
    rating = 'MISS';
    baseScore = 0;
    newCombo = 0;
  }

  let multiplier = 1.0;
  if (newCombo >= 50) multiplier = 3.0;
  else if (newCombo >= 25) multiplier = 2.0;
  else if (newCombo >= 10) multiplier = 1.5;

  return {
    rating,
    deltaSeconds: delta,
    score: Math.floor(baseScore * multiplier),
    combo: newCombo,
    multiplier,
  };
}

export interface MuteState {
  userMuted: boolean;
  platformMuted: boolean;
  tabHidden: boolean;
  masterVolume: number;
}

export function computeEffectiveVolume(state: MuteState): number {
  if (state.userMuted || state.platformMuted || state.tabHidden) {
    return 0.0001; // silent target
  }
  return state.masterVolume;
}
