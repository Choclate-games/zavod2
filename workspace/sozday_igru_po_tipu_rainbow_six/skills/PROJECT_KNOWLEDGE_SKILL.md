# Skill: Знания, отобранные под этот проект

## Purpose
Документы базы знаний, выбранные куратором именно под эту игру: Проект опирается на связку FPS-контроллера, физики разрушения стен Rapier3D и тактического ИИ CQB-шутера; стандартные циклические паттерны не используются, так как игра построена на линейном штурме 3 последовательных комнат..

## When to Use
Читать перед реализацией ключевых механик проекта — здесь лежит проверенный код и числа для них.

## Core Rules & Constraints
- Код из этих документов берётся как есть, а не переписывается по памяти.
- Если документ противоречит спецификации проекта — прав документ в части API и прав проект в части дизайна; расхождение фиксируется в DEVLOG.md.
- Архетип петли проекта: не выбран, петля собственная.

## System Architecture
Документы отсортированы по роли: сначала ядро жанра, затем вспомогательные материалы.

## Implementation Guidance
Почему выбран каждый документ:
- `mechanics/physics_destruction.md` — Физика подрыва C4, разрушение гипсокартонных стен и генерация тактических проломов с разлётом обломков.
- `mechanics/cover_and_suppression.md` — Баллистическая защита ростового щита, механика укрытий и подавление дезориентированных врагов при штурме.

## Common Mistakes to Avoid
- ❌ **Mistake**: Реализовать механику по памяти, не открыв документ, который под неё выбран.
- ❌ **Mistake**: Притащить решение из документа, который куратор для этого проекта отклонил: patterns/arena_combat_loop.md, patterns/survivor_loop.md, patterns/roguelike_loop.md, threejs/horde_survivor_core.md, mechanics/upgrade_choices.md, mechanics/wave_survival.md, stack/recast_navigation.md, stack/bitecs.md, mechanics/parry.md.

## Validation Checklist
- [ ] Каждая ключевая механика реализована по своему документу из этого набора.
- [ ] Ни одна система не воспроизводит отклонённый жанровый шаблон.


## Reference Knowledge (verbatim, authoritative)
Sourced from the factory knowledge base — these rules override any conflicting example, including snippets from the platform docs that describe the deprecated Bridge v1 contract.

- `knowledge/mechanics/physics_destruction.md`
- `knowledge/mechanics/cover_and_suppression.md`

### Mechanic: Destructible Environment & Dynamic Hazards

Name: Destructible Environment & Dynamic Hazards
Category: Environment & Physics
Description: Arena structures (stone pillars, wooden crates, barricades, weapon racks, spike pits) with physical health and fracture meshes. High-velocity impacts from weapons or ragdoll bodies shatter elements into physical debris chunks.

Player interaction:
Players can lure enemies near hazards, push enemies into spikes, or bash structures down to crush opponents or collect dropped weapons.

Feedback:
- Instanced debris mesh physics explosion.
- Heavy stone/wood shattering audio.
- Screen shake and ground dust ring particles.

Strengths:
- Converts the static arena into an interactive weapon.
- High visual spectacle and emergent tactics.

Weaknesses:
- Creating new meshes dynamically causes garbage collection spikes in JS. Must use pre-instanced mesh pooling.

Good combinations:
- Ragdoll combat.
- Heavy weapon impacts.

Bad combinations:
- Minimalist abstract games.

Technical complexity:
Moderate to High. Requires instanced mesh pooling and debris lifetime culling (2.5s).

Three.js suitability:
Very High (9.5/10). Excellent with InstancedMesh and Rapier3D.

PixiJS suitability:
Moderate (5/10).

Retention potential:
High.

---

### Mechanic: Cover & Suppression

Name: Cover & Suppression
Category: Shooter / Tactics
Description: Pre-authored cover points carry a position, a facing normal, a height class and an occupancy slot. AI scores them against the current threat direction; sustained fire on a covered target suppresses it — accuracy and willingness to peek drop instead of health.

Player interaction:
Player flanks to invalidate the enemy's cover normal, or lays suppressing fire while a teammate/objective advances.

Feedback:
- Dust and chips bursting off the cover surface under fire.
- Suppressed enemies ducking, shouting, and firing blind over cover.
- Screen-edge vignette and increased weapon sway when the player is suppressed.

Strengths:
- Turns a firefight into a positional problem rather than a damage race.
- Occupancy slots stop two enemies sharing one rock — the classic engine-bug look.

Weaknesses:
- Runtime cover search by raycast is too expensive; the points must be authored or baked.
- Without visible suppression feedback players read it as random AI accuracy.

Good combinations:
- Squad AI with attack tokens, flanking behaviours, destructible cover.

Bad combinations:
- Horde shooters and bullet-hell, where standing still is fatal by design.

Technical complexity:
Moderate. Baked cover graph, scoring function, suppression accumulator per agent.
See `knowledge/threejs/shooter_enemy_ai_and_combat.md` §4.

Three.js suitability:
High (8/10).

Retention potential:
Moderate-high. Readable AI is what makes combat worth repeating.
