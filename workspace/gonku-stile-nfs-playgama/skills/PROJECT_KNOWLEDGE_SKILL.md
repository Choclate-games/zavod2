# Skill: Знания, отобранные под этот проект

## Purpose
Документы базы знаний, выбранные куратором именно под эту игру: Проект опирается на связку аркадной физики дрифта и кинетических таранов на Rapier3D с рогаликовым циклом сессии, разрушаемым окружением и процедурным визуалом..

## When to Use
Читать перед реализацией ключевых механик проекта — здесь лежит проверенный код и числа для них.

## Core Rules & Constraints
- Код из этих документов берётся как есть, а не переписывается по памяти.
- Если документ противоречит спецификации проекта — прав документ в части API и прав проект в части дизайна; расхождение фиксируется в DEVLOG.md.
- Архетип петли проекта: patterns/roguelike_loop.md.

## System Architecture
Документы отсортированы по роли: сначала ядро жанра, затем вспомогательные материалы.

## Implementation Guidance
Почему выбран каждый документ:
- `mechanics/chain_reaction.md` — Расчет кинетического импульса тарана для превращения сбитых зомби в снаряды, поражающие ряды врагов по принципу домино.
- `mechanics/physics_destruction.md` — Реализация механики Pursuit Breakers с обрушением опорных городских конструкций на преследователей при таране.
- `patterns/roguelike_loop.md` — Организация структуры забега с нарастающим уровнем Heat, битвой с боссом-мутантом и мета-прогрессией в гараже.
- `mechanics/drift_scoring.md` — Подсчет множителя и непрерывности заноса для конвертации угла дрифта в шкалу нитро-ускорения.

## Common Mistakes to Avoid
- ❌ **Mistake**: Реализовать механику по памяти, не открыв документ, который под неё выбран.
- ❌ **Mistake**: Притащить решение из документа, который куратор для этого проекта отклонил: threejs/racing_track_and_opponents.md, mechanics/checkpoint_lap_racing.md, patterns/racing_event_loop.md, threejs/horde_survivor_core.md, patterns/survivor_loop.md, stack/bitecs.md, stack/recast_navigation.md, mechanics/rubberband_opposition.md, mechanics/upgrade_choices.md.

## Validation Checklist
- [ ] Каждая ключевая механика реализована по своему документу из этого набора.
- [ ] Ни одна система не воспроизводит отклонённый жанровый шаблон.


## Reference Knowledge (verbatim, authoritative)
Sourced from the factory knowledge base — these rules override any conflicting example, including snippets from the platform docs that describe the deprecated Bridge v1 contract.

- `knowledge/mechanics/chain_reaction.md`
- `knowledge/mechanics/physics_destruction.md`
- `knowledge/patterns/roguelike_loop.md`
- `knowledge/mechanics/drift_scoring.md`

### Механика: Физические цепные реакции (Kinetic Chain Reactions)

#### 1. Распространение взрывной волны и кинетики
1. **Радиусы поражения**:
   - Эпицентр $R_{core} = 2.0\text{ м}$: $100\%$ урон, максимальный физический импульс разлета.
   - Внешняя зона $R_{outer} = 6.0\text{ м}$: квадратичный спад урона $Damage = D_{base} \times (1 - d / R_{outer})^2$.
2. **Задержка детонации (Chain Fuse)**:
   - Попадание осколка во вторичный взрывоопасный объект ставит таймер задержки $0.12\text{ с}$. Это создает красивую визуальную волну взрывов вместо одновременного схлопывания в 1 кадр.

---

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

### Pattern: Roguelike Loop

Pattern Name: Roguelike Loop
Primary Genre: Action Roguelite / Dungeon Crawler

Starting State:
Starting loadout, procedural run seed, 0 floor progress.

Player Action:
- Clear procedural rooms/arenas, make branching node decisions on path map (Combat, Elite, Shop, Mystery Event, Rest).

Challenge:
- Permadeath per run, limited healing opportunities, increasing enemy aggression.

Reward:
- Relics that fundamentally alter mechanics, synergistic loot drops, run currency.

Progression:
- Mid-run: Relic deck and stat scaling.
- Meta: Persistent unlocks in hub town (new starting classes, relic pool expansions).

Escalation:
- Biome transitions with unique mechanics (e.g. lava floor hazards, ice physics).

Session Ending:
- Final Boss victory or death with run summary showing damage dealt, relics collected.

Replay Trigger:
- Daily run seeds, Ascension difficulty levels (Ascension 1 to 20).

---

### Mechanic: Drift Scoring & Chain Multiplier

Name: Drift Scoring
Category: Racing & Vehicles
Description: A sustained slip angle between roughly 12° and 50° accumulates points proportional to speed and angle. Points bank when the car straightens cleanly; a spin, a wall hit or a full stop drops the pending chain.

Player interaction:
Player initiates with handbrake or a weight-transfer flick, then holds the slide on the throttle, linking one corner into the next without straightening in between.

Feedback:
- Score ticking up in real time with rising audio pitch.
- Tyre smoke density and skid-mark opacity tied to the same slip ratio that scores.
- Multiplier badge (x2, x3) with a shake when a link is registered.
- Distinct "banked" chime vs. a downward "lost" sweep — the two must never be confused.

Strengths:
- Turns pure driving into a scoring game with no extra systems.
- Risk/reward is legible: bank early and safe, or push for the multiplier.

Weaknesses:
- Meaningless unless the physics genuinely supports controllable slides.
- Scoring above ~50° rewards spinning in place; cap it.

Good combinations:
- Nitro charged by drifting, checkpoint racing, time attack.

Bad combinations:
- Simulation handling models where any slide loses time — the goals contradict.

Technical complexity:
Moderate. Slip ratio from the vehicle controller, not from throttle heuristics.
See `knowledge/threejs/arcade_racing_and_drift.md` §3.1.

Three.js suitability:
High (10/10) with Rapier's ray-cast vehicle controller.

Retention potential:
High. Score chasing plus leaderboards is the genre's whole retention loop.
