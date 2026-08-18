# Monetization Specification: Слияние Турелей 3D: Оборона Базы

## 1. Strategy Summary
Мягкая гибридная модель: Rewarded Video для ускорения прогресса и приятных бонусов, ненавязчивые Interstitial с тайм-аутом строго между волнами, и IAP (Яндекс Яны) для мгновенного отключения рекламы и премиум-стартер паков.

## 2. Rewarded Video Ad Placements
### Удвоение оффлайн дохода (`offline_x2_multiplier`)
- **Benefit**: Удваивает накопленные за время отсутствия золотые монеты (x2 Gold).
- **Trigger**: Модальное окно «С возвращением!» при запуске игры
- **Limit**: При каждом входе с оффлайн-наградой

### Золотой Ящик с мощной турелью (`instant_high_tier_drop`)
- **Benefit**: Мгновенный спавн турели высокого тира (HighestUnlockedTier - 1) на свободный слот.
- **Trigger**: Кнопка «Подарок» на панели сетки слияния
- **Limit**: Раз в 3 минуты

### Режим Безумия (2x Attack Speed) (`speed_frenzy_boost`)
- **Benefit**: Удваивает скорострельность всех турелей на 60 секунд.
- **Trigger**: Иконка бустера «Молния» в HUD
- **Limit**: Раз в 2 минуты

### Второе дыхание (Воскрешение) (`base_revive_shield`)
- **Benefit**: Восстанавливает 100% HP базы и взрывает все сферы на текущем экране ударной волной.
- **Trigger**: Экран поражения при прорыве врагов к базе
- **Limit**: 1 раз за попытку прохождения волны


## 3. Interstitial Ads Rules
- Minimum **90 seconds** interval between consecutive interstitials.
- Zero interstitials during active combat gameplay.
- Shown only on run game over or returning to Main Menu.

## 4. Optional In-App Purchases (IAP)
- **Отключение межстраничной рекламы (No Ads)** (`no_ads_permanent`): Навсегда убирает все всплывающие Interstitial баннеры и дает ежедневный бонус 500 кристаллов. (99 YAN / 199 RUB)
- **Стартовый набор: Плазменный Рейлган** (`starter_pack_plasma`): Мгновенная разблокировка легендарной плазменной пушки 8-го уровня и 10 000 золота. (149 YAN / 299 RUB)
- **Дрон Авто-Слияния (Auto-Merge Bot)** (`auto_merge_drone`): Автоматически объединяет одинаковые доступные турели на сетке на 7 дней. (199 YAN / 399 RUB)
