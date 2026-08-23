/**
 * Общий контракт интерфейса: экраны знают только действия и состояние,
 * никакой физики и рендера.
 */
export type BuyResult = 'ok' | 'poor' | 'owned'

export interface UiActions {
  startMatch(): void
  openGarage(): void
  openLeaderboard(): void
  backToMenu(): void
  nextMatch(): void
  acceptRevive(): void
  declineRevive(): void
  resumeMatch(): void
  toggleSound(): boolean
  claimTripleReward(): void
  buyItem(kind: 'tube' | 'pilot' | 'trail', id: string): BuyResult
  selectItem(kind: 'tube' | 'pilot' | 'trail', id: string): void
}

export interface UiState {
  trophies: number
  selectedTube: string
  selectedPilot: string
  selectedTrail: string
  unlockedTubes: string[]
  unlockedPilots: string[]
  unlockedTrails: string[]
  bestScores: readonly number[]
  muted: boolean
  rewardedSupported: boolean
}
