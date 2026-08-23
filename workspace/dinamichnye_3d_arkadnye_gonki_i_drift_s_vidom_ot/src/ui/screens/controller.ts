/**
 * Контроллер экранов: единственная точка входа UI в игру.
 * Экраны не знают ни про физику, ни про рендер, ни про площадку.
 */
export interface UiController {
  startTrack(index: number): void
  openTrackSelect(): void
  resume(): void
  restartRun(): void
  toMenu(): void
  toggleSound(): boolean
  openLeaderboard(): void
  reviveForAd(): void
  reviveAvailableCheck(): boolean
  doubleReward(): void
  resultsPrimary(): void
}

export interface ScreenCaps {
  leaderboardsSupported: boolean
  rewardedSupported: boolean
}
