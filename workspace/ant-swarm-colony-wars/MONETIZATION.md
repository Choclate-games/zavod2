# Monetization Specification: Муравьиный Рой: Война Колоний

## 1. Strategy Summary
Мягкая гибридная модель: ненавязчивая реклама между уровнями с кулдауном, ценные Rewarded-видео за мгновенное подкрепление роя и x2 биомассу, а также IAP-наборы мутаций и скинов.

## 2. Rewarded Video Ad Placements
### Королевское Подкрепление (`rewarded_instant_swarm`)
- **Benefit**: Мгновенный призыв +150 элитных солдат во время критической фазы боя.
- **Trigger**: При падении численности роя игрока ниже 20%.
- **Limit**: 1 раз за уровень

### Удвоение Биомассы (`rewarded_double_biomass`)
- **Benefit**: Умножает собранную за уровень биомассу на 2 для быстрой прокачки.
- **Trigger**: Экран победы в конце уровня.
- **Limit**: Без ограничений

### Мега-Бомбардир (`rewarded_super_bombardier`)
- **Benefit**: Призыв огромного муравья-титана, уничтожающего любые стены с одного удара.
- **Trigger**: Перед началом сложного уровня с боссом.
- **Limit**: 2 раза за игровую сессию


## 3. Interstitial Ads Rules
- Minimum **90 seconds** interval between consecutive interstitials.
- Zero interstitials during active combat gameplay.
- Shown only on run game over or returning to Main Menu.

## 4. Optional In-App Purchases (IAP)
- **Золотая Пчелиная Матка (Отключение рекламы)** (`no_ads_permanent`): Навсегда отключает межуровневую рекламу и дает постоянный бонус +25% к приросту муравьев. (Tier 2 ($1.99 / 179 YAN))
- **Набор Эволюции: Кислотный Шторм** (`starter_mutation_pack`): 5000 биомассы и эксклюзивный некро-скин для касты Бомбардиров. (Tier 1 ($0.99 / 99 YAN))
