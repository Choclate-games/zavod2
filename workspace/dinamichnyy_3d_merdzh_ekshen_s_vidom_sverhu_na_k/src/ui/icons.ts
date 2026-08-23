export const icon = (name: 'jaw' | 'pause' | 'sound' | 'trophy'): string => {
  if (name === 'pause') return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14M16 5v14"/></svg>'
  if (name === 'sound') return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 10h4l5-4v12l-5-4H4zM17 9c1.8 1.5 1.8 4.5 0 6M19.5 6.5c3.3 2.8 3.3 8.2 0 11"/></svg>'
  if (name === 'trophy') return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 4h10v5a5 5 0 0 1-10 0zM4 6h3M20 6h-3M12 14v5M8 20h8"/></svg>'
  return '<svg class="icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h16l-2 9H6zM7 8l2-4h6l2 4M8 17l-1 3M16 17l1 3"/></svg>'
}
