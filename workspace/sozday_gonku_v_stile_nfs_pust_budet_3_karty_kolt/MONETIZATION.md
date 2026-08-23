# Monetization Specification: Ночной Синдикат: Дуэли и Контракты

## 1. Strategy Summary
Гибридная этичная модель монетизации для HTML5/Web: ненавязчивый Rewarded Video за удвоение наград и реванш + Interstitial между заездами с кулдауном 90+ секунд + IAP на покупку кредитов и эксклюзивного неонового стайлинга.

## 2. Rewarded Video Ad Placements
### Удвоение Награды за Заезд (`double_rewards`)
- **Benefit**: Удвоение всех заработанных за заезд кредитов и очков репутации (x2)
- **Trigger**: Экран победы/результатов заезда
- **Limit**: Без лимита (1 раз за завершенный заезд)

### Мгновенный Реванш (`instant_revive`)
- **Benefit**: Мгновенный рестарт заезда без потери накопленного комбо-множителя очков
- **Trigger**: Экран поражения при провале заезда
- **Limit**: 1 раз за заезд


## 3. Interstitial Ads Rules
- Minimum **90 seconds** interval between consecutive interstitials.
- Zero interstitials during active combat gameplay.
- Shown only on run game over or returning to Main Menu.

## 4. Optional In-App Purchases (IAP)
- **Пакет Кредитов 'Стритрейсер'** (`iap_credits_small`): Стартовый капитал 25 000 кредитов для мгновенной прокачки двигателя до Stage 2 ($0.99)
- **Пакет Кредитов 'Синдикат'** (`iap_credits_large`): Большой запас 100 000 кредитов для полной прокачки всех узлов спорткара ($2.99)
- **Премиум Набор Стайлинга 'Midnight Phantom'** (`iap_skin_phantom`): Эксклюзивный неоновый винил 'Midnight Phantom' + золотая подсветка днища + фиолетовый дым покрышек ($1.99)
