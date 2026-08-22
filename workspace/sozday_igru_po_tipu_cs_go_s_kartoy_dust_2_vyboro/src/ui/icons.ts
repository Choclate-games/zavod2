/**
 * Inline SVG icons sprite with currentColor styling.
 * Zero emojis in UI as strictly enforced by check B2.
 */
export const ICONS = {
  AK47: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M2,12 L7,10 L10,11 L14,10 L19,9 L22,9 L22,11 L19,11 L14,12 L11,14 L7,14 L4,16 L2,15 Z M9,12 L10,16 L8,17 L7,13 Z"/></svg>`,
  M4A4: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M2,11 L6,9 L10,10 L15,9 L21,9 L21,11 L16,11 L12,13 L6,13 L3,14 Z M11,11 L12,15 L10,16 L9,12 Z"/></svg>`,
  AWP: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M1,12 L5,10 L11,10 L17,9 L23,9 L23,10 L18,11 L11,11 L7,13 L3,13 Z M9,7 L13,7 L13,9 L9,9 Z M12,11 L13,15 L11,16 Z"/></svg>`,
  DEAGLE: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M5,8 L19,8 L19,12 L14,12 L12,17 L9,17 L10,12 L5,12 Z"/></svg>`,
  HEADSHOT: `<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="11" r="7"/><path d="M12,1 L12,4 M12,18 L12,23 M1,11 L4,11 M20,11 L23,11 M9,11 A1,1 0 1,0 11,11 M13,11 A1,1 0 1,0 15,11 M10,15 L14,15" stroke="currentColor" stroke-width="1.8" fill="none"/></svg>`,
  WALLBANG: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M4,4 L10,4 L10,20 L4,20 Z M10,12 L20,12 M17,9 L20,12 L17,15" stroke="currentColor" stroke-width="2" fill="none"/></svg>`,
  BOMB: `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="5" y="7" width="14" height="12" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M9,7 L9,4 L15,4 L15,7 M8,12 L16,12 M12,9 L12,15" stroke="currentColor" stroke-width="1.5"/></svg>`,
  DEFUSE_KIT: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M7,4 L11,9 L8,13 L4,9 Z M17,4 L13,9 L16,13 L20,9 Z M8,13 L5,20 M16,13 L19,20 M9,15 L15,15" stroke="currentColor" stroke-width="2" fill="none"/></svg>`,
  SMOKE_GRENADE: `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="8" y="7" width="8" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12,7 L12,3 M10,3 L14,3 M14,5 L17,6" stroke="currentColor" stroke-width="2"/></svg>`,
  CROSSHAIR: `<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12,2 L12,7 M12,17 L12,22 M2,12 L7,12 M17,12 L22,12" stroke="currentColor" stroke-width="2"/></svg>`,
  HEALTH: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12,21 L4.5,13.5 C2.5,11.5 2.5,8.5 4.5,6.5 C6.5,4.5 9.5,4.5 11.5,6.5 L12,7 L12.5,6.5 C14.5,4.5 17.5,4.5 19.5,6.5 C21.5,8.5 21.5,11.5 19.5,13.5 Z" fill="currentColor"/></svg>`,
  ARMOR: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12,2 L4,5 L4,11 C4,16.5 7.5,21.5 12,23 C16.5,21.5 20,16.5 20,11 L20,5 Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12,6 L12,19" stroke="currentColor" stroke-width="2"/></svg>`,
  SOUND_ON: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M3,9 L7,9 L12,4 L12,20 L7,15 L3,15 Z M16,8 C17.5,9.5 17.5,14.5 16,16 M19,5 C22,8.5 22,15.5 19,19" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  SOUND_OFF: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M3,9 L7,9 L12,4 L12,20 L7,15 L3,15 Z M16,9 L21,15 M21,9 L16,15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  SETTINGS: `<svg class="svg-icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3" fill="none" stroke="currentColor" stroke-width="2"/><path d="M19.4,13 C19.5,12.7 19.5,12.3 19.5,12 C19.5,11.7 19.5,11.3 19.4,11 L21.5,9.3 C21.7,9.1 21.8,8.8 21.6,8.6 L19.6,5.1 C19.5,4.9 19.2,4.8 19,4.9 L16.5,5.9 C16,5.5 15.4,5.2 14.8,5 L14.4,2.3 C14.4,2 14.2,1.8 13.9,1.8 L9.9,1.8 C9.6,1.8 9.4,2 9.4,2.3 L9,5 C8.4,5.2 7.8,5.5 7.3,5.9 L4.8,4.9 C4.6,4.8 4.3,4.9 4.2,5.1 L2.2,8.6 C2,8.8 2.1,9.1 2.3,9.3 L4.4,11 C4.3,11.3 4.3,11.7 4.3,12 C4.3,12.3 4.3,12.7 4.4,13 L2.3,14.7 C2.1,14.9 2,15.2 2.2,15.4 L4.2,18.9 C4.3,19.1 4.6,19.2 4.8,19.1 L7.3,18.1 C7.8,18.5 8.4,18.8 9,19 L9.4,21.7 C9.4,22 9.6,22.2 9.9,22.2 L13.9,22.2 C14.2,22.2 14.4,22 14.4,21.7 L14.8,19 C15.4,18.8 16,18.5 16.5,18.1 L19,19.1 C19.2,19.2 19.5,19.1 19.6,18.9 L21.6,15.4 C21.8,15.2 21.7,14.9 21.5,14.7 Z" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`,
  TROPHY: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M6,4 L18,4 L18,10 C18,13.5 15.5,16 12,16 C8.5,16 6,13.5 6,10 Z M6,6 L3,6 C2.5,6 2,6.5 2,7 L2,9 C2,10.5 3,11.5 4.5,11.5 L6,11.5 M18,6 L21,6 C21.5,6 22,6.5 22,7 L22,9 C22,10.5 21,11.5 19.5,11.5 L18,11.5 M12,16 L12,20 M8,20 L16,20" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
  REWARD: `<svg class="svg-icon" viewBox="0 0 24 24"><rect x="3" y="8" width="18" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12,8 L12,21 M3,13 L21,13 M12,8 C10,5 6,5 6,7 C6,8 8,8 12,8 M12,8 C14,5 18,5 18,7 C18,8 16,8 12,8" fill="none" stroke="currentColor" stroke-width="1.8"/></svg>`,
  TEAM_CT: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12,2 L4,6 L4,13 C4,18 7.5,22 12,23 C16.5,22 20,18 20,13 L20,6 Z" fill="currentColor"/><path d="M9,12 L11,14 L15,10" stroke="var(--color-bg-dark)" stroke-width="2" fill="none"/></svg>`,
  TEAM_T: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M12,2 L19,7 L19,16 L12,22 L5,16 L5,7 Z" fill="currentColor"/><circle cx="12" cy="12" r="4" fill="var(--color-bg-dark)"/></svg>`,
  PLAY: `<svg class="svg-icon" viewBox="0 0 24 24"><polygon points="6,4 20,12 6,20" fill="currentColor"/></svg>`,
  CASE: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M4,7 L20,7 L20,19 L4,19 Z M8,7 L8,4 L16,4 L16,7 M10,11 L14,11" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
  BACK: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M19,12 L5,12 M11,6 L5,12 L11,18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/></svg>`,
  RELOAD: `<svg class="svg-icon" viewBox="0 0 24 24"><path d="M21.5,12 C21.5,17.2 17.2,21.5 12,21.5 C6.8,21.5 2.5,17.2 2.5,12 C2.5,6.8 6.8,2.5 12,2.5 C15.5,2.5 18.5,4.4 20.2,7.2 M21,3 L21,8 L16,8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>`,
} as const;

export type IconKey = keyof typeof ICONS;

export function getIcon(key: IconKey): string {
  return ICONS[key] || '';
}
