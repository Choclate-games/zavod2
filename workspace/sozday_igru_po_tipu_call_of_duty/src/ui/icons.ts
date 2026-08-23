/**
 * SVG icons with currentColor fill/stroke. No emoji allowed in the interface.
 */
export const ICONS = {
  crosshair: `<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><line x1="12" y1="1" x2="12" y2="7" stroke="currentColor" stroke-width="2"/><line x1="12" y1="17" x2="12" y2="23" stroke="currentColor" stroke-width="2"/><line x1="1" y1="12" x2="7" y2="12" stroke="currentColor" stroke-width="2"/><line x1="17" y1="12" x2="23" y2="12" stroke="currentColor" stroke-width="2"/></svg>`,
  play: `<svg class="icon" viewBox="0 0 24 24"><polygon points="6,4 20,12 6,20" fill="currentColor"/></svg>`,
  pause: `<svg class="icon" viewBox="0 0 24 24"><rect x="5" y="4" width="4" height="16" fill="currentColor"/><rect x="15" y="4" width="4" height="16" fill="currentColor"/></svg>`,
  armory: `<svg class="icon" viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
  upgrade: `<svg class="icon" viewBox="0 0 24 24"><path d="M12 3l8 8h-5v10h-6V11H4l8-8z" fill="currentColor"/></svg>`,
  soundOn: `<svg class="icon" viewBox="0 0 24 24"><polygon points="3,9 8,9 13,4 13,20 8,15 3,15" fill="currentColor"/><path d="M16.5 7.5c1.5 1.5 1.5 7.5 0 9M19 4c3 3 3 13 0 16" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
  soundOff: `<svg class="icon" viewBox="0 0 24 24"><polygon points="3,9 8,9 13,4 13,20 8,15 3,15" fill="currentColor"/><line x1="16" y1="8" x2="22" y2="16" stroke="currentColor" stroke-width="2"/><line x1="22" y1="8" x2="16" y2="16" stroke="currentColor" stroke-width="2"/></svg>`,
  star: `<svg class="icon" viewBox="0 0 24 24"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" fill="currentColor"/></svg>`,
  credits: `<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/><text x="12" y="16" text-anchor="middle" font-weight="bold" font-size="12" fill="currentColor">C</text></svg>`,
  warning: `<svg class="icon" viewBox="0 0 24 24"><polygon points="12,2 23,21 1,21" fill="none" stroke="currentColor" stroke-width="2"/><line x1="12" y1="9" x2="12" y2="13" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="17" r="1" fill="currentColor"/></svg>`,
  shield: `<svg class="icon" viewBox="0 0 24 24"><path d="M12 2L4 5v6.09c0 5.05 3.41 9.76 8 10.91 4.59-1.15 8-5.86 8-10.91V5l-8-3z" fill="none" stroke="currentColor" stroke-width="2"/></svg>`,
  video: `<svg class="icon" viewBox="0 0 24 24"><rect x="2" y="4" width="14" height="16" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><polygon points="22,7 16,11 16,13 22,17" fill="currentColor"/></svg>`,
  thermal: `<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="12" r="4" fill="currentColor"/></svg>`,
  radio: `<svg class="icon" viewBox="0 0 24 24"><rect x="2" y="8" width="20" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><line x1="6" y1="8" x2="16" y2="2" stroke="currentColor" stroke-width="2"/><circle cx="8" cy="14" r="3" fill="currentColor"/></svg>`,
  refresh: `<svg class="icon" viewBox="0 0 24 24"><path d="M23 4v6h-6M1 20v-6h6" fill="none" stroke="currentColor" stroke-width="2"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" fill="none" stroke="currentColor" stroke-width="2"/></svg>`
} as const
