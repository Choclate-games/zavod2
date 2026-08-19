# Контракты фабрики

Здесь лежат JSON-схемы машинных артефактов, которые фабрика кладёт в каждый
проект в каталог `.factory/contracts/`. Схемы существуют, чтобы артефакт мог
перейти от одного агента к другому (или к внешнему инструменту) без пересборки
контекста: документ читает человек, контракт читает программа.

| Файл | Артефакт проекта | О чём |
| --- | --- | --- |
| `player-promise-contract.schema.json` | `player-promise.json` | Обещание игроку: витрина, первые 60 секунд, долгая игра |
| `assumption-registry.schema.json` | `assumptions.json` | Реестр допущений с уровнем уверенности и опровергающим наблюдением |
| `experience-density-plan.schema.json` | `experience-density.json` | Плотность впечатлений, A/B-варианты и телеметрия |
| `validation-plan.schema.json` | `validation-plan.json` | Эксперименты и ворота объёма |
| `decision-log.schema.json` | `decisions.json` | Решения с альтернативами и путём отката |
| `gate-state.schema.json` | `gates.json` | Состояние человеческих ворот |

Проверка: `python -m app.cli contracts <slug>` или вкладка «Design OS» в веб-интерфейсе.

Валидатор (`validators/contract_validator.py`) поддерживает подмножество
JSON Schema, которого достаточно для этих файлов: `type`, `required`,
`properties`, `items`, `enum`, `const`, `pattern`, `minimum`. Внешних
зависимостей он не требует — фабрика должна проверять свои артефакты офлайн.
