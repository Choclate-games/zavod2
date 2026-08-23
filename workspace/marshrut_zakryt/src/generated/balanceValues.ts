/** Автогенерировано из balance.yaml командой `npm run gen:balance`. Не править руками. */
export const BALANCE = {
  performance: {
    target_fps: 60,
    max_draw_calls: 80,
    max_triangles: 45000,
    bundle_size_budget_mb: 4.5,
  },
  mechanics: {
    podavlyayuschaya_ochered: {
      parameters: {
        vremya_zahvata_silueta: {
          value: 0.16,
        },
        interval_ocheredi: {
          value: 0.24,
        },
        konus_navedeniya: {
          value: 5,
        },
        dalnost_nadezhnogo_popadaniya: {
          value: 26,
        },
        skorost_otbrasyvaniya: {
          value: 3.2,
        },
        dlitelnost_impulsa_popadaniya: {
          value: 0.24,
        },
      },
    },
    pamyat_perekrytiy: {
      parameters: {
        shag_zapisi_vremeni: {
          value: 0.5,
        },
        dlitelnost_pervoy_volny: {
          value: 35,
        },
        ves_prezhnego_posescheniya: {
          value: 0.15,
        },
        vremya_materializatsii_massy: {
          value: 2,
        },
        minimum_otkrytyh_prohodov: {
          value: 2,
        },
        okno_chteniya_posle_volny: {
          value: 6,
        },
      },
    },
    perekrestok_na_hodu: {
      parameters: {
        distantsiya_preduprezhdeniya: {
          value: 18,
        },
        okno_vybora: {
          value: 2.5,
        },
        minimalnaya_dlina_svaypa: {
          value: 80,
        },
        vremya_fiksatsii_povorota: {
          value: 0.4,
        },
        shtraf_avtomaticheskogo_vhoda: {
          value: 0.5,
        },
        kolichestvo_variantov: {
          value: 2,
        },
      },
    },
    szhatie_stroya: {
      parameters: {
        razmer_dalnego_stroya: {
          value: 8,
        },
        bazovaya_skorost_stroya: {
          value: 1.7,
        },
        shirina_fronta: {
          value: 4.5,
        },
        minimalnaya_shirina_scheli: {
          value: 2.2,
        },
        vremya_povtornogo_svedeniya: {
          value: 1.4,
        },
        distantsiya_vizualnogo_telegrafa: {
          value: 32,
        },
      },
    },
    paket_mayak_i_hrupkiy_gruz: {
      parameters: {
        radius_svetovogo_mayaka: {
          value: 14,
        },
        ugol_svetovogo_konusa: {
          value: 42,
        },
        dlina_svetovogo_sleda: {
          value: 6,
        },
        vremya_razrushitelnogo_kontakta: {
          value: 2,
        },
        dlitelnost_dostavki: {
          value: 3,
        },
        zapas_vynoslivosti: {
          value: 3,
        },
      },
    },
  },
} as const

export type Balance = typeof BALANCE
