# Monetization Specification: Снайпер: Призрачный Контракт

## 1. Strategy Summary
Мягкая гибридная модель (Rewarded Ads + ненавязчивый Interstitial + косметические IAP), ориентированная на высокий комфорт игрока без пейволлов энергии и без пейтувина.

## 2. Rewarded Video Ad Placements
### Тактическая Перемотка Времени (`rewind_alarm`)
- **Benefit**: Откат времени на 5 секунд назад при поднятии тревоги (второй шанс спасти контракт без перезапуска).
- **Trigger**: Экран срабатывания тревоги базы
- **Limit**: 1 раз за контракт

### Двойной Гонорар Контракта (`double_contract_payout`)
- **Benefit**: Удвоение всех полученных за успешную миссию кредитов и очков репутации.
- **Trigger**: Экран победы и дебрифинга
- **Limit**: После каждого успешного контракта

### Ящик Спецбоеприпасов (`special_ammo_crate`)
- **Benefit**: Получение 3 бронебойно-зажигательных патронов с увеличенным радиусом взрыва на текущий контракт.
- **Trigger**: Экран подготовки к контракту
- **Limit**: 1 раз в 10 минут


## 3. Interstitial Ads Rules
- Minimum **90 seconds** interval between consecutive interstitials.
- Zero interstitials during active combat gameplay.
- Shown only on run game over or returning to Main Menu.

## 4. Optional In-App Purchases (IAP)
- **Набор «Полярный Призрак»** (`bundle_arctic_ghost`): Крупнокалиберная винтовка Barrett M82 в арктическом камуфляже + Тепловизионный прицел FLIR + 5000 кредитов. (Tier 3 ($2.99 / 249 руб))
- **Тактический Пропуск (Отключение Рекламы)** (`no_ads_pass`): Полное отключение межстраничной рекламы навсегда + постоянный бонус +20% к гонорарам контрактов. (Tier 2 ($1.99 / 179 руб))
