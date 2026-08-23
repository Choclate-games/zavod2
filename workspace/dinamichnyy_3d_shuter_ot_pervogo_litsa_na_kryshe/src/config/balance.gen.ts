/* eslint-disable */
// Сгенерировано из balance.yaml скриптом scripts/gen-balance.mjs — не править руками.
// Правьте balance.yaml, числа приедут сюда сами при dev/build.

export const BALANCE = {
  target_fps: 60,
  max_draw_calls: 45,
  max_triangles: 35000,
  bundle_size_budget_mb: 3.8,
  skorost_poleta_puli: 450,
  bazovyy_vetrovoy_snos_puli: 0.42,
  amplituda_vibratsii_pritsela_ot_poezda: 3.5,
  temp_strelby_karabina: 4.5,
  radius_tsepnogo_emi_zahvata: 14,
  zaderzhka_kaskadnoy_dugi_mezhdu_dronami: 0.08,
  shans_generatsii_tyazhelogo_oblomka_s_lidera: 100,
  vremya_perestroeniya_mezhdu_polosami_nastila: 0.16,
  shirina_kryshi_vagona_3_polosy: 3.6,
  uron_ot_stolknoveniya_s_oblomkom: 50,
  dlitelnost_okna_skolzheniya_slide: 0.45,
  emkost_tesla_kondensatora: 100,
  dlitelnost_lucha_peregruzki: 2.2,
  summarnyy_uron_lucha: 600,
  sektor_avtozahvata_molniy: 40,
  shirina_mezhvagonnogo_razryva: 3.5,
  vremya_svobodnogo_poleta_nad_stsepkoy: 0.65,
} as const

export type BalanceKey = keyof typeof BALANCE
