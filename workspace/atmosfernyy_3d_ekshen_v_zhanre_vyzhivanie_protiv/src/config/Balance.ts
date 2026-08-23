import balanceRaw from '../../balance.yaml?raw'

/**
 * Единственный источник чисел игры: `balance.yaml` читается при старте,
 * значения ниже — резерв на случай, если файл не распарсился. Резерв повторяет
 * те же числа дословно, игра обязана стартовать в любом окружении.
 */
export type BalanceKey =
  | 'target_fps' | 'max_draw_calls' | 'max_triangles' | 'bundle_size_budget_mb'
  | 'bazovyy_nagrev_linzy' | 'skorost_estestvennogo_ostyvaniya'
  | 'dlitelnost_shtrafnoy_blokirovki_peregreva' | 'vremya_svedeniya_linzy_v_fokus'
  | 'bazovyy_uron_kontsentrirovannogo_fokusa'
  | 'sektor_rasseyannogo_osvescheniya' | 'maksimalnaya_skorost_vrascheniya_prozhektora'
  | 'distantsiya_obnaruzheniya_fosfornyh_glaz_vo_tme' | 'zamedlenie_povorota_v_rezhime_fokusa'
  | 'vremya_termicheskogo_kataliza_yadra_bio_miny' | 'bazovyy_radius_biodetonatsii'
  | 'radialnyy_uron_vzryva_bio_miny' | 'mnozhitel_ochkov_za_tsepnuyu_reaktsiyu'
  | 'koeffitsient_zamedleniya_v_shirokom_svete' | 'dlitelnost_stagger_shoka_pri_pervom_kasanii_sveta'
  | 'vremya_adaptatsii_k_svetu_spad_effekta' | 'shirina_zaschitnogo_svetovogo_barera'
  | 'radius_krugovogo_parovogo_koltsa' | 'sila_fizicheskogo_otbrasyvaniya_parom'
  | 'snizhenie_temperatury_linzy_pri_sbrose' | 'trebuemoe_chislo_tsepnyh_ubiystv_dlya_perezaryadki'

const DEFAULTS: Record<BalanceKey, number> = {
  target_fps: 60,
  max_draw_calls: 80,
  max_triangles: 45000,
  bundle_size_budget_mb: 4.5,
  bazovyy_nagrev_linzy: 28.0,
  skorost_estestvennogo_ostyvaniya: 35.0,
  dlitelnost_shtrafnoy_blokirovki_peregreva: 3.0,
  vremya_svedeniya_linzy_v_fokus: 0.18,
  bazovyy_uron_kontsentrirovannogo_fokusa: 140.0,
  sektor_rasseyannogo_osvescheniya: 60.0,
  maksimalnaya_skorost_vrascheniya_prozhektora: 240.0,
  distantsiya_obnaruzheniya_fosfornyh_glaz_vo_tme: 18.0,
  zamedlenie_povorota_v_rezhime_fokusa: 62.5,
  vremya_termicheskogo_kataliza_yadra_bio_miny: 0.8,
  bazovyy_radius_biodetonatsii: 4.5,
  radialnyy_uron_vzryva_bio_miny: 250.0,
  mnozhitel_ochkov_za_tsepnuyu_reaktsiyu: 1.5,
  koeffitsient_zamedleniya_v_shirokom_svete: 65.0,
  dlitelnost_stagger_shoka_pri_pervom_kasanii_sveta: 0.25,
  vremya_adaptatsii_k_svetu_spad_effekta: 4.0,
  shirina_zaschitnogo_svetovogo_barera: 60.0,
  radius_krugovogo_parovogo_koltsa: 6.0,
  sila_fizicheskogo_otbrasyvaniya_parom: 12.0,
  snizhenie_temperatury_linzy_pri_sbrose: 20.0,
  trebuemoe_chislo_tsepnyh_ubiystv_dlya_perezaryadki: 15,
}

/** Производные константы из формул мастер-спецификации (секция 3). */
export const DERIVED = {
  nightDurationSec: 180,
  gameClockMinutes: 360,
  baseTempC: 20.0,
  overheatTempC: 100.0,
  overheatLockCoolRate: 26.6,
  focusBeamAngleDeg: 10.0,
  beamLengthM: 32.0,
  angleLerpTimeSec: 0.18,
  narrowStaggerFactor: 0.85,
  staggerRecoveryDelaySec: 0.45,
  lightAdaptationTimeSec: 4.0,
  blastChainDelaySec: 0.12,
  blastChainDamageThreshold: 30.0,
  scorePerSecond: 50,
  scorePerHpPoint: 10,
  scorePerChainKill: 120,
  noOverheatBonus: 2500,
  lighthouseMaxHp: 1000,
  enemyContactDamagePerSec: 40,
  phaseBoundariesSec: [0, 45, 90, 135] as const,
  spawnIntervalStartSec: 2.4,
  spawnIntervalEndSec: 0.6,
  crawlerHp: 80,
  carapaceHp: 320,
  bioMineHp: 55,
  leviathanHp: 2600,
  crawlerSpeed: 2.6,
  carapaceSpeed: 1.4,
  bioMineSpeed: 1.9,
  leviathanSpeed: 0.85,
  enemyAttackRangeM: 3.4,
  steamKnockbackDistanceM: 5.5,
  reviveHealRatio: 0.5,
} as const

function firstNumber(text: string): number {
  const match = text.match(/-?\d+(?:\.\d+)?/)
  return match ? Number(match[0]) : Number.NaN
}

/** Минимальный разбор YAML-карты баланса: интересуют только пары `ключ: value:`. */
function parseBalance(raw: string): Partial<Record<BalanceKey, number>> {
  const parsed: Partial<Record<BalanceKey, number>> = {}
  const stack: Array<{ indent: number; key: string }> = []
  const lines = raw.split(/\r?\n/)
  for (const line of lines) {
    if (!line.trim() || line.trim().startsWith('#')) continue
    const match = line.match(/^(\s*)([A-Za-z_][\w]*):\s*(.*)$/)
    if (!match) continue
    const indent = match[1].length
    const key = match[2]
    const rest = match[3]
    while (stack.length && stack[stack.length - 1].indent >= indent) stack.pop()
    stack.push({ indent, key })
    if (key === 'value' && stack.length >= 2) {
      const parent = stack[stack.length - 2].key
      const num = firstNumber(rest)
      if (!Number.isNaN(num) && parent in DEFAULTS) {
        parsed[parent as BalanceKey] = num
      }
    }
  }
  return parsed
}

const parsed = parseBalance(balanceRaw)

/** Доступ к числам баланса по ключу с обязательным резервом из спецификации. */
export class Balance {
  get(key: BalanceKey, fallback?: number): number {
    const value = parsed[key]
    if (value !== undefined) return value
    if (key in DEFAULTS) return DEFAULTS[key]
    return fallback ?? 0
  }

  raw(key: BalanceKey): number {
    return parsed[key] ?? DEFAULTS[key]
  }
}
