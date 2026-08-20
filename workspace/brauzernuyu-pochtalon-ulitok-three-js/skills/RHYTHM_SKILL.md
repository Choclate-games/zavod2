# Skill: Web Audio Beat Sync & Accuracy System

## Purpose
Аппаратная синхронизация игровых действий с тактовой сеткой музыки через AudioContext.currentTime.

## When to Use
При реализации ритм-механик, попадания в долю, окон Perfect/Good и комбо-множителей.

## Core Rules & Constraints
- AudioContext.currentTime — единственный источник истины времени (не Date.now() и не performance.now()).
- Окна точности: Perfect <= 65 мс, Good <= 140 мс, Miss > 140 мс.
- Учитывать калибровку задержки звукового тракта (audio latency offset).

## System Architecture
RhythmClock отслеживает BPM и рассылает события 'rhythm:beat' через EventBus.

## Implementation Guidance
Пульсируй параметры шейдеров и масштаб элементов UI в такт музыке.

## Common Mistakes to Avoid
- ❌ **Mistake**: Синхронизация через requestAnimationFrame приводит к рассинхрону при просадках FPS.

## Validation Checklist
- [ ] Попадание в такт регистрируется точно независимо от частоты обновления монитора.


## Reference Knowledge (verbatim, authoritative)
Sourced from the factory knowledge base — these rules override any conflicting example, including snippets from the platform docs that describe the deprecated Bridge v1 contract.

- `knowledge/mechanics/rhythm_sync.md`

### Механика: Синхронизация с тактом музыки (Web Audio Beat Sync)

#### 1. Архитектура аудио-тайминга
1. **AudioContext.currentTime как единственный источник истины**:
   - `AudioContext.currentTime` аппаратный и не подвержен троттлингу requestAnimationFrame.
   - Вычисление текущей доли:
     $$\text{songPosition} = \text{audioCtx.currentTime} - \text{startTime}$$
     $$\text{currentBeat} = \text{songPosition} \times \frac{\text{BPM}}{60}$$

2. **Окна попадания (Accuracy Windows)**:
   - $\Delta t = |\text{inputTime} - \text{nearestBeatTime}|$.
   - **PERFECT**: $\Delta t \le 0.065\text{ с}$ ($+100\text{ очков}, +1\text{ комбо}$).
   - **GOOD**: $0.065\text{ с} < \Delta t \le 0.140\text{ с}$ ($+50\text{ очков}$).
   - **MISS**: $\Delta t > 0.140\text{ с}$ (сброс множителя комбо, промах атаки).
