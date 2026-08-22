# Mechanic: Active Ragdoll Physics Combat

> 💡 **Реализация и демо**: `workspace/knowledge-showcase/src/world/ragdoll.ts`,
> вкладка *«⚔️ Слэшер и рэгдолл»*. Проверка: `npm run check:melee` (физика трупа
> гоняется на настоящем Rapier в Node). Разбор — в
> `knowledge/threejs/melee_combat_and_ragdoll.md` §7.
>
> **Второй вариант реализации** — `src/world/boxerRagdoll.ts`, вкладка
> *«🥊 Файтинг»*: физике отдаются НАСТОЯЩИЕ меши персонажа, а не капсулы-
> заменители. Дороже и требует аккуратности с иерархией Three, но для одного-
> двух героев крупным планом подмена на капсулы видна в первом же кадре
> падения. Разбор — `knowledge/threejs/procedural_character_rig.md` §5.
>
> **Возврат из рэгдолла — половина работы.** Выключить физику и поставить
> стойку недостаточно: боец, мгновенно оказавшийся на ногах там, где лежал,
> выглядит как баг. Нужна отдельная фаза подъёма и первый кадр без
> интерполяции — там же, §5.
>
> **Важная оговорка к описанию ниже.** Полный «активный рэгдолл» с PD-контроллерами
> на каждом суставе — верхняя планка жанра, но в фабричных играх по умолчанию
> применяется **пассивный** рэгдолл: пока враг жив, им управляет автомат состояний
> с предсказуемыми кадрами, а физика включается ровно в момент смерти и получает
> импульс от последнего удара. Причина — не экономия: с активным рэгдоллом фрейм-дата
> перестаёт быть фрейм-датой (враг «доезжает» до удара по инерции), и парирование
> становится нечестным.

Name: Active Ragdoll Physics Combat
Category: Combat & Physics
Description: A hybrid physics-driven character controller where characters have underlying kinematic bone targets tracked by physical rigidbodies connected via damped spring joints (PD controllers). When struck by weapon forces, equilibrium is lost, generating emergent staggering, flailing, and tumbling before attempting self-righting balance.

Player interaction:
Players direct movement and swing momentum. The physical weapon rigidbody collides with enemy body segments, applying directional impulses proportional to weapon mass and angular velocity.

Feedback:
- Dynamic particle sparks / blood spray at point of impact.
- Screen trauma shake proportional to kinetic energy transfer.
- Hit-stop micro-pause (40ms) on heavy critical connections.
- Audio pitch modulation based on impact velocity.

Strengths:
- Endless emergent comedy and tactical variety.
- Every strike feels uniquely tactile rather than canned animation playback.
- Extremely high viral and streaming appeal.

Weaknesses:
- CPU overhead for multi-joint solving on low-end mobile.
- Risk of glitchy joint snapping or physics instability if simulation steps drop.

Good combinations:
- Weapon Weight & Inertia.
- Destructible Arena Obstacles (knocking enemies into pillars/hazards).
- Crowd Favor / Momentum Buffs.

Bad combinations:
- Pixel-perfect platforming.
- Ultra-fast twitch hitscans.

Technical complexity:
High. Requires Rapier3D or Cannon-es with sub-stepping (fixed timestep 60Hz) and joint angle constraints.

Three.js suitability:
Excellent (9.5/10). Direct integration with Rapier3D or Cannon-es.

PixiJS suitability:
Moderate (4/10). Better suited for 2D ragdolls with Matter.js or Box2D.

Retention potential:
Very High. Emergent physical interactions prevent gameplay fatigue.

---

## Измеренные факты (Rapier 0.20, 7 тел / 6 сферических суставов)

* **Части одного рэгдолла не должны сталкиваться друг с другом.** Соседние капсулы
  всегда пересекаются в суставе, решатель контактов спорит с решателем суставов, труп
  дрожит и уползает. Лечится группами столкновений: одна membership на все части,
  фильтр — только «земля».
* **`setAngularDamping(4)` обязателен** — иначе труп вращается до конца сессии.
* **Импульс прикладывается один раз и клампится** (в стенде — 26 Н·с). Импульс «как в
  кино» разрывает суставы: тела разлетаются, решатель стягивает их обратно, получается
  судорога. Проверка бьёт импульсом 400 Н·с и требует, чтобы все тела остались в
  пределах 1.3 м от таза.
* **`body.isSleeping()` у рэгдолла не срабатывает никогда.** Замер: за 15 секунд ни
  одно тело не уснуло — решатель суставов постоянно подталкивает соседей и сбрасывает
  таймер сна. «Труп успокоился» считается по скорости (`< 0.06 м/с`, достигается за
  ~1.3 с). Уборка по `isSleeping()` не удалила бы ни одного трупа.
* **Удалять только успокоившийся труп** и держать лимит количества (в стенде 6,
  старший вытесняется). Труп, растворившийся в полёте, читается как баг.
* **`dispose()` снимает и суставы, и тела**: WASM-память Rapier не собирается
  сборщиком мусора JS.
