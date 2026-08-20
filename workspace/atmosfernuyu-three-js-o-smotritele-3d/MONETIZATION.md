# Monetization Specification: Атмосферную three.js о смотрителе 3D

## 1. Strategy Summary
Гибридная модель Free-to-Play для Яндекс Игр и веб-порталов. Высокий eCPM за счет полезных Rewarded видео без агрессивного навязывания.

## 2. Rewarded Video Ad Placements
### Второе Дыхание (Возрождение) (`revive_run`)
- **Benefit**: Восстановление 50% HP + 3 сек неуязвимости с силовой волной, раскидывающей врагов.
- **Trigger**: При получении смертельного урона.
- **Limit**: 1 раз за забег.

### Удвоение Наград (2x Золото) (`double_gold_run`)
- **Benefit**: Удваивает все заработанные шестеренки и монеты за завершенный раунд.
- **Trigger**: Экран окончания игры.
- **Limit**: Доступно на каждом экране результатов.

### Переброс Карт Улучшений (`free_card_reroll`)
- **Benefit**: Обновляет список 3 карт улучшений с гарантией Редкой или Эпической карты.
- **Trigger**: Окно выбора 3 карт.
- **Limit**: До 2 раз за забег.


## 3. Interstitial Ads Rules
- Minimum **90 seconds** interval between consecutive interstitials.
- Zero interstitials during active combat gameplay.
- Shown only on run game over or returning to Main Menu.

## 4. Optional In-App Purchases (IAP)
- **VIP Пропуск (Без Рекламы)** (`ad_free_vip_pass`): Отключает межстраничные баннеры, дает вечный бонус +25% к золоту и эксклюзивный скин. (199 YAN / 199 руб)
