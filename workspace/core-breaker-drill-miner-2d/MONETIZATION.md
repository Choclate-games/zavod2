# Monetization Specification: Бурильщик Бездны: Рикошет Руды

## 1. Strategy Summary
Мягкая гибридная модель: просмотры Rewarded видео для спасения удачных забегов и удвоения добычи + ненавязчивые Interstitial между забегами + IAP стартовые наборы и отключение обязательной рекламы.

## 2. Rewarded Video Ad Placements
### Аварийный Квантовый Щит (Revive) (`revive_run`)
- **Benefit**: Возрождение с 60% HP, уничтожение всех врагов и породы в радиусе 10 метров.
- **Trigger**: Экран гибели меха при глубине > 100 метров
- **Limit**: 1 раз за забег

### Грузовой Дрон (2x Ore Multiplier) (`double_ore`)
- **Benefit**: Удвоение всей добытой за забег руды для ускорения прокачки в ангаре.
- **Trigger**: Экран завершения спуска
- **Limit**: После каждого успешного забега или смерти

### Перекалибровка Чипа (Perk Reroll) (`reroll_perks`)
- **Benefit**: Полная замена трех предложенных карт улучшений на новые.
- **Trigger**: Окно выбора перка
- **Limit**: 1 раз за чекпоинт 50м


## 3. Interstitial Ads Rules
- Minimum **90 seconds** interval between consecutive interstitials.
- Zero interstitials during active combat gameplay.
- Shown only on run game over or returning to Main Menu.

## 4. Optional In-App Purchases (IAP)
- **Пакет 'Без Рекламы' + VIP Бур** (`no_ads_pack`): Отключает межстраничные баннеры и дает эксклюзивный Неоновый Бур (+10% к скорости копания). ($2.99 / 249 RUB)
- **Набор Горного Магната** (`starter_miner_pack`): 5000 титана, 50 плазменных ядер и мгновенное открытие второго меха 'Джаггернаут'. ($4.99 / 399 RUB)
