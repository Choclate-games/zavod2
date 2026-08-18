# Skill: Интеграция Playgama Bridge для WebGL-игр

## Purpose
Обеспечить стабильную работу рекламы, облачных сохранений и лидербордов на всех поддерживаемых площадках (Yandex Games, VK, CrazyGames).

## When to Use
При подготовке финальной сборки и настройке монетизации Web/Mobile проектов.

## Core Rules & Constraints
- Всегда глушить звук игры при показе рекламы и ставить игровой процесс на паузу.
- Никогда не вызывать Interstitial без проверки таймера кулдауна (минимум 90-120 сек).
- Всегда обрабатывать сценарии сбоя показа рекламы (ad failed) без блокировки интерфейса игрока.

## System Architecture
Bridge Facade Pattern -> Platform Event Listeners -> Storage & Ad Handlers.

## Implementation Guidance
Инициализируйте bridge в entry-point файле main.ts до запуска игрового цикла. Подписывайтесь на события паузы и отключения звука.

## Common Mistakes to Avoid
- ❌ **Mistake**: Показ рекламы во время динамичного боя или свайпа игрока.
- ❌ **Mistake**: Потеря наград игрока при сетевых ошибках в Rewarded Video.

## Validation Checklist
- [ ] Протестированы события ad_started и ad_closed
- [ ] Настроено сохранение прогресса в Cloud Storage
- [ ] Проверена работа на мобильных WebView
