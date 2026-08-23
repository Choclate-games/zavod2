import rawYaml from '../../balance.yaml?raw'

/**
 * Все игровые числа читаются из balance.yaml — единственного источника баланса.
 * Парсер понимает ровно тот поднабор YAML, которым записан этот файл:
 * вложенность отступами и строки `value: <число> <единица>`.
 */
type BalanceNode = { [key: string]: BalanceNode | number }

function parseBalance(src: string): BalanceNode {
  const root: BalanceNode = {}
  const stack: { indent: number; node: BalanceNode }[] = [{ indent: -1, node: root }]
  for (const line of src.split('\n')) {
    const match = line.match(/^(\s*)([A-Za-z_][\w-]*):\s*(.*)$/)
    if (!match) continue
    const indent = match[1].length
    const key = match[2]
    let rest = match[3]
    while (stack.length > 1 && stack[stack.length - 1].indent >= indent) stack.pop()
    const parent = stack[stack.length - 1].node
    if (key === 'value') {
      const num = Number.parseFloat(rest.replace(',', '.').replace(/[^0-9.\-+eE]/g, ' '))
      if (Number.isFinite(num)) {
        const siblings = Object.keys(parent)
        parent[siblings.length ? `__v${siblings.length}` : '__v'] = num
        continue
      }
      continue
    }
    if (rest === '' || rest.startsWith("'") || rest.startsWith('"') || rest.startsWith('|')) {
      const node: BalanceNode = {}
      parent[key] = node
      stack.push({ indent, node })
    }
  }
  return root
}

const tree = parseBalance(rawYaml)

function collect(node: BalanceNode, prefix: string, out: Map<string, number>): void {
  for (const [key, value] of Object.entries(node)) {
    if (typeof value === 'number') out.set(`${prefix}${key}`, value)
    else collect(value, `${prefix}${key}.`, out)
  }
}

const flat = new Map<string, number>()
collect(tree, '', flat)

/** Число по имени листового ключа balance.yaml; fallback защищает от опечатки. */
function byLeaf(leaf: string, fallback: number): number {
  for (const [path, value] of flat) {
    if (path.split('.').includes(leaf)) return value
  }
  return fallback
}

/** Диапазон BPM трека задан именем параметра ритм-окна (120–135), играем в середине. */
export const MUSIC_BPM = 128

export const BAL = {
  targetFps: byLeaf('target_fps', 60),
  maxDrawCalls: byLeaf('max_draw_calls', 80),
  maxTriangles: byLeaf('max_triangles', 45000),
  bundleBudgetMb: byLeaf('bundle_size_budget_mb', 4.5),

  crowdMinSize: byLeaf('minimalnyy_razmer_gruppy_tantsorov', 3),
  disguiseRadius: byLeaf('radius_effektivnoy_zony_maskirovki', 1.8),
  marchSpeed: byLeaf('skorost_dvizheniya_shestviya_platform', 2.6),
  exposureGrace: byLeaf('bazovoe_vremya_obnaruzheniya_vne_tolpy', 0.45),
  disguiseFactor: 1 - byLeaf('snizhenie_zametnosti_v_maskirovke', 85) / 100,

  beatWindow: byLeaf('okno_silnoy_doli_treka_bpm_120_135', 0.15),
  lungeDistance: byLeaf('distantsiya_vypada_rapiry', 2.2),
  backstabSectorDeg: byLeaf('sektor_ataki_so_spiny', 135),
  offbeatNoiseRadius: byLeaf('radius_shuma_pri_neritmichnom_udare', 6.0),
  lungeAnimTime: byLeaf('dlitelnost_animatsii_vypada', 0.18),

  parryWindow: byLeaf('okno_idealnogo_parirovaniya', 0.18),
  kickImpulse: byLeaf('impuls_pinka_ragdoll_sbrosa', 14.5),
  stunDuration: byLeaf('dlitelnost_oglusheniya_posle_bloka', 1.2),
  parrySectorDeg: byLeaf('ugol_sektora_otrazheniya_udara', 110),
  whiffRecovery: byLeaf('shtraf_zamah_promaha_recovery', 0.35),

  totemSlowFactor: byLeaf('shtraf_bazovoy_skorosti_pri_perenoske', 35) / 100,
  inertiaRampTime: byLeaf('vremya_razgona_do_maksimalnoy_inertsii', 1.4),
  ramKnockdownRadius: byLeaf('radius_tarannogo_sbivaniya_strazhey_na_razgone', 1.6),
  rhythmLevitation: byLeaf('bonus_levitatsii_pri_dvizhenii_v_takt_muzyki', 70) / 100,
  loadedTurnRateDeg: byLeaf('uglovaya_skorost_razvorota_s_gruzom', 120),

  confettiRadius: byLeaf('radius_oblaka_konfetti_zavesy', 3.5),
  smokeDuration: byLeaf('dlitelnost_deystviya_dymovoy_zavesy', 4.0),
  blindDuration: byLeaf('dlitelnost_oslepleniya_strazhi_stun_blind', 2.5),
  confettiCharges: Math.round(byLeaf('maksimalnyy_zapas_hlopushek_v_zabege', 2)),
  popperNoiseRadius: byLeaf('radius_privlecheniya_patruley_zvukom_hlopushki', 8.0),
} as const

export type Balance = typeof BAL

/** Длина трека шествия: окно успеха из session.win — «за 90–120 секунд». */
export const TRACK_TIME_LIMIT = 120
/** Порог тревоги, при котором забег проигран. */
export const ALARM_LOSE = 100
/** Пропущенных ударов алебарды переживает вор. */
export const PLAYER_MAX_HITS = 3
