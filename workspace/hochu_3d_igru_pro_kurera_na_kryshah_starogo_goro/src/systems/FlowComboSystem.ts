import { events } from '../core/EventBus'
import type { ActionFeedbackType, FlowState } from '../core/types'

export class FlowComboSystem {
  private consecutivePerfectActions = 0
  private currentTier = 1
  private currentMultiplier = 1.0

  constructor() {
    this.reset()
  }

  public reset(): void {
    this.consecutivePerfectActions = 0
    this.currentTier = 1
    this.currentMultiplier = 1.0
    this.broadcast()
  }

  public registerPerfectAction(actionType: ActionFeedbackType): void {
    this.consecutivePerfectActions++
    // Flow_Tier = min(4, 1 + floor(consecutivePerfectActions / 3))
    this.currentTier = Math.min(4, 1 + Math.floor(this.consecutivePerfectActions / 3))
    this.currentMultiplier = 1.0 + (this.currentTier - 1) * 0.5

    events.emit('ACTION_FEEDBACK', actionType)
    this.broadcast()
  }

  public resetFlowOnCrash(): void {
    this.consecutivePerfectActions = 0
    this.currentTier = 1
    this.currentMultiplier = 1.0
    events.emit('ACTION_FEEDBACK', 'CRASH')
    this.broadcast()
  }

  public getTier(): number {
    return this.currentTier
  }

  public getMultiplier(): number {
    return this.currentMultiplier
  }

  public getStreak(): number {
    return this.consecutivePerfectActions
  }

  private broadcast(): void {
    const state: FlowState = {
      tier: this.currentTier,
      streak: this.consecutivePerfectActions,
      multiplier: this.currentMultiplier,
    }
    events.emit('FLOW_COMBO_UPDATED', state)
  }
}
