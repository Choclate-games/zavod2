/**
 * Числа игры. Единственный источник истины — balance.yaml в корне проекта.
 * Значения ниже — снимок файла на момент сборки: они же являются безопасным
 * запасным вариантом, если файл не долетел до сборки.
 * При старте loadBalance() читает balance.yaml и перезаписывает поля,
 * поэтому правка баланса не требует правки кода.
 */

export interface BalanceData {
  massMilkKg: number
  waveLagS: number
  criticalRollDeg: number
  spillRateLps: number
  iceMu: number
  parryWindowS: number
  optimalDriftDeg: number
  steerRateDps: number
  handbrakeIdealHoldS: number
  whipAngAccelMult: number
  brakeLagS: number
  turboKickKmh: number
  edgeMaxRiskDistM: number
  edgePeakMultiplier: number
  turboChargePerSecPct: number
  turboDurationS: number
  valveDumpL: number
  valveCounterRollDeg: number
  valveCooldownS: number
  bafflesAbsorbPct: number
}

/** Ключи параметров в balance.yaml в порядке объявления. */
const PARAM_KEYS: readonly (keyof BalanceData)[] = [
  'massMilkKg', 'waveLagS', 'criticalRollDeg', 'spillRateLps',
  'iceMu', 'parryWindowS', 'optimalDriftDeg', 'steerRateDps',
  'handbrakeIdealHoldS', 'whipAngAccelMult', 'brakeLagS', 'turboKickKmh',
  'edgeMaxRiskDistM', 'edgePeakMultiplier', 'turboChargePerSecPct',
  'turboDurationS',   'valveDumpL', 'valveCounterRollDeg', 'valveCooldownS', 'bafflesAbsorbPct',
]

const YAML_PARAM_NAMES: readonly string[] = [
  'massa_perevozimogo_moloka', 'fazovoe_zapazdyvanie_volny_moloka',
  'kriticheskiy_ugol_oprokidyvaniya_shassi', 'intensivnost_vypleska_moloka_pri_razgermetizatsii',
  'koeffitsient_stsepleniya_sinego_lda', 'okno_reaktsii_na_parirovanie_zanosa',
  'optimalnyy_ugol_drifta_molokovoza', 'skorost_perekladki_rulevogo_mehanizma',
  'okno_idealnogo_uderzhaniya_ruchnika', 'mnozhitel_uglovogo_uskoreniya_hlysta',
  'zaderzhka_pnevmaticheskogo_privoda_kolodok', 'impuls_turbo_podhvata_pri_idealnom_sbrose',
  'distantsiya_zony_maksimalnogo_riska', 'pikovyy_mnozhitel_ochkov_drifta',
  'temp_nakopleniya_zaryada_turbo_busta_u_kraya', 'dlitelnost_impulsa_turbo_vyhoda',
  'obem_moloka_za_odin_sbros', 'stabiliziruyuschiy_protivoimpuls_krena',
  'kuldaun_avariynogo_klapana', 'effektivnost_pereborok_gasiteley_baffles',
]

export const balance: BalanceData = {
  massMilkKg: 8000,
  waveLagS: 0.35,
  criticalRollDeg: 32.0,
  spillRateLps: 350,
  iceMu: 0.18,
  parryWindowS: 0.22,
  optimalDriftDeg: 35.0,
  steerRateDps: 130,
  handbrakeIdealHoldS: 0.28,
  whipAngAccelMult: 2.4,
  brakeLagS: 0.08,
  turboKickKmh: 22.0,
  edgeMaxRiskDistM: 0.35,
  edgePeakMultiplier: 4.0,
  turboChargePerSecPct: 50,
  turboDurationS: 1.8,
  valveDumpL: 250,
  valveCounterRollDeg: -14.0,
  valveCooldownS: 4.0,
  bafflesAbsorbPct: 35,
}

/**
 * Читает balance.yaml и перезаписывает параметры по именам ключей.
 * Тихая деградация: файла нет или он битый — работают значения-снимок выше.
 */
export async function loadBalance(): Promise<void> {
  try {
    const response = await fetch('balance.yaml')
    if (!response.ok) return
    const text = await response.text()
    const lines = text.split('\n')
    let currentKey = ''
    for (const rawLine of lines) {
      const line = rawLine.trim()
      const keyMatch = /^([a-z_]+):\s*(?:$|value:)/.exec(line)
      if (keyMatch && !line.startsWith('value:')) currentKey = keyMatch[1]
      const valueMatch = /^value:\s*'?"?\s*(-?\d+(?:\.\d+)?)/.exec(line)
      if (!valueMatch || !currentKey) continue
      const slot = YAML_PARAM_NAMES.indexOf(currentKey)
      const field = PARAM_KEYS[slot]
      if (slot >= 0 && field) {
        const parsed = Number(valueMatch[1])
        if (Number.isFinite(parsed)) balance[field] = parsed
      }
    }
  } catch {
    /* офлайн-сборка без yaml — живём на снимке */
  }
}
