/**
 * Единый источник балансных констант, синхронизированный с balance.yaml.
 * Числа не должны объявляться в коде случайными литералами.
 */

export const BALANCE = {
  performance: {
    target_fps: 60,
    max_draw_calls: 65,
    max_triangles: 45000,
    bundle_size_budget_mb: 3.5,
  },
  montazh: {
    vremya_bazovogo_montazha_t1: 1.5,
    stoimost_t1_tureli_v_skrape: 75,
    sektor_avtozahvata_tseley: 120,
    dalnost_effektivnogo_ognya_t1: 28.0,
  },
  thermal: {
    skorost_nagreva_stvola_t1_pri_nepreryvnoy_strelbe: 4.2,
    skorost_sbrosa_tepla_krio_spreem: 75.0,
    shtraf_klina_pri_100_c_jammed_duration: 8.0,
    distantsiya_primeneniya_sopla_ohlazhdeniya: 2.2,
    zapas_krio_hladagenta_v_rantse: 100.0,
  },
  overcharge: {
    dlitelnost_rezhima_overcharge: 25.0,
    bonus_k_skorostrelnosti_i_uronu_v_overcharge: 1.8,
    shtraf_k_skorosti_inzhenera_pri_perenoske_yacheyki: 0.30,
    vremya_perezaryadki_generatora_na_baze: 20.0,
    kolichestvo_dostupnyh_yacheek_na_rubezhe: 2,
  },
  detonation: {
    radius_porazheniya_krio_bochki: 6.0,
    dlitelnost_zamorozki_mutantov_freeze_stun: 4.0,
    uron_ot_termicheskogo_shoka_kombo_krio_dizel: 1200,
    dalnost_broska_signalnogo_faera: 18.0,
    kolichestvo_bochek_na_volnu: 4,
  },
  repair: {
    prochnost_sektsii_brustvera: 500,
    skorost_remonta_klepalnikom: 120,
    rashod_skrapa_na_remont: 10,
    radius_pnevmo_udara: 3.5,
    sila_ottalkivaniya_pnevmo_udara: 450,
    kuldaun_silovogo_pnevmo_udara: 6.0,
  },
  player: {
    walk_speed: 4.2,
    sprint_speed: 7.5,
    carried_sprint_speed: 5.25,
    max_stamina: 100,
    stamina_drain_sprint: 25,
    stamina_recovery: 20,
  },
  waves: {
    w1_count: 25,
    w1_interval: 2.4,
    w2_count: 62,
    w2_interval: 1.2,
    w3_count: 110,
    w3_interval: 0.8,
  }
} as const;
