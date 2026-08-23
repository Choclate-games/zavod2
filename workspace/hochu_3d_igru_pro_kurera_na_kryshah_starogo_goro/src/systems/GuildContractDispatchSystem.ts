import { events } from '../core/EventBus'
import type { ContractInfo } from '../core/types'
import { storageService } from '../platform/StorageService'

export class GuildContractDispatchSystem {
  public static readonly CONTRACTS: ContractInfo[] = [
    {
      id: 'contract_old_town',
      name: 'Срочная доставка в Мансарды Знати',
      districtName: 'Старый Черепичный Квартал',
      distance: 400,
      reward: 150,
      timeLimit: 60,
      fragility: 'Класс II (Эфирная Колба)',
    },
    {
      id: 'contract_alchemical',
      name: 'Спецзаказ для Алхимического Шпиля',
      districtName: 'Квартал Медных Реторт',
      distance: 550,
      reward: 280,
      timeLimit: 55,
      fragility: 'Класс IV (Кипящий Эфир)',
    },
    {
      id: 'contract_airship',
      name: 'Экспресс к Королевскому Дирижаблю',
      districtName: 'Доки Небесных Цеппелинов',
      distance: 700,
      reward: 450,
      timeLimit: 50,
      fragility: 'Класс V (Хрустальная Призма)',
    },
  ]

  private activeContract: ContractInfo = GuildContractDispatchSystem.CONTRACTS[0]

  constructor() {
    this.selectContract(GuildContractDispatchSystem.CONTRACTS[0].id)
  }

  public getActiveContract(): ContractInfo {
    return this.activeContract
  }

  public selectContract(contractId: string): void {
    const found = GuildContractDispatchSystem.CONTRACTS.find((c) => c.id === contractId)
    if (found) {
      this.activeContract = found
      events.emit('CONTRACT_SELECTED', found)
    }
  }

  /**
   * Payout formula from AI_DEVELOPER_PROMPT.md:
   * Payout_Shillings = round((Base_Reward + (Time_Remaining_Sec * 3.5)) * (Parcel_Integrity_Percent / 100.0) * (1.0 + (Final_Flow_Tier - 1) * 0.5))
   */
  public calculatePayout(
    timeRemainingSec: number,
    integrityPercent: number,
    finalFlowTier: number
  ): {
    shillings: number
    base: number
    timeBonus: number
    integrityBonus: number
    flowBonus: number
  } {
    const base = this.activeContract.reward
    const timeBonus = Math.round(Math.max(0, timeRemainingSec) * 3.5)
    const integrityMult = Math.max(0, integrityPercent) / 100.0
    const flowMult = 1.0 + Math.max(0, finalFlowTier - 1) * 0.5

    const total = Math.round((base + timeBonus) * integrityMult * flowMult)

    // Save earned currency
    storageService.updateSave((save) => {
      save.shillings += total
      if (total > save.highScore) {
        save.highScore = total
      }
      events.emit('CURRENCY_UPDATED', { shillings: save.shillings })
    })

    return {
      shillings: total,
      base,
      timeBonus,
      integrityBonus: Math.round(integrityMult * 100),
      flowBonus: Math.round((flowMult - 1.0) * 100),
    }
  }
}
