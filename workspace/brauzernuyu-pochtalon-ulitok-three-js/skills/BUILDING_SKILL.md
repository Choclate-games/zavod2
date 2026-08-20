# Skill: Grid Modular Base & Power Grid Architecture

## Purpose
Реализация строительства по сетке, проверки коллизий и распространения энергии по пилонам.

## When to Use
При создании модульных стен, турелей, генераторов и конвейерных цепочек.

## Core Rules & Constraints
- Привязка к сетке (Snap-to-Grid) с полупрозрачным превью-призраком постройки.
- Граф смежности энергосети обновляется мгновенным поиском в ширину (BFS).
- Все постройки регистрируются в пространственной хеш-таблице (SpatialHash).

## System Architecture
BuildingGridManager хранит матрицу занятости и валидирует условия размещения.

## Implementation Guidance
Отключай турели при разрыве связи с электрогенератором.

## Common Mistakes to Avoid
- ❌ **Mistake**: Разрешение постройки поверх спавнеров врагов или внутри геометрии игрока.

## Validation Checklist
- [ ] Постройки мгновенно встают по сетке, энергосеть корректно питает подключенные узлы.


## Reference Knowledge (verbatim, authoritative)
Sourced from the factory knowledge base — these rules override any conflicting example, including snippets from the platform docs that describe the deprecated Bridge v1 contract.

- `knowledge/mechanics/grid_building.md`

### Механика: Модульное строительство по сетке (Grid Modular Base Building)

#### 1. Логика сетки и валидация
1. **Сетка и привязка (Snap-to-Grid)**:
   - Размер ячейки: $w = 2.0\text{ м}, h = 2.0\text{ м}$.
   - Координаты: $x_{grid} = \lfloor (x_{world} + w/2) / w \rfloor \times w$.

2. **Проверка условий размещения (Placement Validation)**:
   - `CanPlace(cell)`: ячейка свободна в пространственной матрице `SpatialGrid[x, z] == null`.
   - Ресурсы игрока $\ge$ стоимость постройки.
   - Зона не заблокирована спавнерами врагов и траекториями движения патрулей.

3. **Энергосеть и соединения (Pylon Power Flow)**:
   - При установке генератора или пилона строится граф смежности $G(V, E)$ с радиусом линка $R_{link} = 8.0\text{ м}$.
   - Поиск в ширину (BFS) обновляет флаг `isPowered` у всех подключенных турелей за 1 кадр.
