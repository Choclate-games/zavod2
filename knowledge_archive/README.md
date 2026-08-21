# Архивная база знаний (не загружается фабрикой)

Отдельная от `knowledge/` база. `app/knowledge.py` читает **только** `knowledge/`,
поэтому ничего отсюда не попадает ни в индекс тем, ни в `AI_DEVELOPER_PROMPT.md`
генерируемых игр.

Здесь лежит проверенное знание, которое **временно выведено из оборота**, а не
признано неверным. Удалять его нельзя: когда направление вернётся, переписывать
рецепты с нуля будет дороже, чем перенести файл обратно.

## `pixijs/`

Рецепты для PixiJS из времён, когда фабрика собирала 2D-игры на втором рендерере.

Статус: **отключено вместе с поддержкой 2D-игр** (`config/factory.yaml` →
`pipeline.enable_2d: false`). Фабрика выпускает только 3D-игры на Three.js.

| Файл | Что внутри | Аналог в активной базе |
|---|---|---|
| `path_drawing_and_movement.md` | Catmull-Rom-сплайны, рисование пути жестом, движение юнита | `knowledge/threejs/orthographic_2d_and_pointer_input.md` §3 |
| `card_drag_and_evidence_board.md` | Перетаскивание карточек, провисающие нити, доска улик | `knowledge/threejs/orthographic_2d_and_pointer_input.md` §5 |
| `sprite_batching.md` | Батчинг спрайтов, атласы | `knowledge/threejs/orthographic_2d_and_pointer_input.md` §6 |
| `particle_systems.md` | `ParticleContainer`, пул частиц | `knowledge/threejs/juice_and_vfx_pool.md` |

**Как вернуть в оборот:** поставить `pipeline.enable_2d: true`, перенести нужные
файлы в `knowledge/pixijs/`, вернуть ветку выбора рендерера в
`agents/renderer_selector.py` и снять форс `dimension = "3D"` в `providers/local.py`.
Сниппеты написаны под **PixiJS v7/v8** — перед возвратом сверить API.
