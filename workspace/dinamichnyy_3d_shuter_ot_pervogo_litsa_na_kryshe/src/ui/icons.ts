// Инлайновый SVG-спрайт. Иконки красятся через currentColor.

export const ICONS = {
  crosshair:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="7"/><line x1="12" y1="1" x2="12" y2="6"/><line x1="12" y1="18" x2="12" y2="23"/><line x1="1" y1="12" x2="6" y2="12"/><line x1="18" y1="12" x2="23" y2="12"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/></svg>',
  bolt:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>',
  shield:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 2 20 5v6c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5l8-3z"/></svg>',
  pause:
    '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/></svg>',
  play:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4v16l13-8L7 4z"/></svg>',
  wind:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 8h10a3 3 0 1 0-3-3M3 12h15a3 3 0 1 1-3 3M3 16h7a2.5 2.5 0 1 1-2.5 2.5"/></svg>',
  speed:
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17 15.5 10" stroke-linecap="round"/></svg>',
  skull:
    '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a8 8 0 0 0-8 8c0 3 1.6 5.4 4 6.9V20a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2v-3.1c2.4-1.5 4-3.9 4-6.9a8 8 0 0 0-8-8zM9 12a1.7 1.7 0 1 1 0-3.4A1.7 1.7 0 0 1 9 12zm6 0a1.7 1.7 0 1 1 0-3.4A1.7 1.7 0 0 1 15 12z"/></svg>',
} as const

export type IconName = keyof typeof ICONS

export function icon(name: IconName): string {
  return ICONS[name]
}
