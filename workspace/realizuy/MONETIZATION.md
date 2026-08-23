# Monetization Specification: Kick Arena: Кинетический Рикошет

## 1. Strategy Summary
Гибридная модель: мягкая ненавязчивая монетизация через Rewarded Video за критические бонусы (второй шанс / удвоение наличных за раунд) и тактичные Interstitial между матчами.

## 2. Rewarded Video Ad Placements
### Второе дыхание (Revive) (`revive_second_wind`)
- **Benefit**: Мгновенное воскрешение бойца с 50% HP и ударной кинетической волной, раскидывающей всех врагов вокруг
- **Trigger**: Экран нокаута игрока при обнулении HP
- **Limit**: 1 раз за матч

### Двойной куш (Double Cash) (`double_cash_round`)
- **Benefit**: Удвоение всех собранных за завершившийся раунд уличных наличных перед походом к верстаку
- **Trigger**: Экран завершения натиска перед открытием верстака
- **Limit**: 1 раз за раунд

### Контрабандный арсенал (Weapon Drop) (`legendary_weapon_crate`)
- **Benefit**: Мгновенное получение золотого Арматурного Молота на текущий раунд
- **Trigger**: Кнопка на экране верстака
- **Limit**: 1 раз за матч


## 3. Interstitial Ads Rules
- Minimum **90 seconds** interval between consecutive interstitials.
- Zero interstitials during active combat gameplay.
- Shown only on run game over or returning to Main Menu.

## 4. Optional In-App Purchases (IAP)
- **VIP Набор: Без Рекламы + Неоновые Перчатки** (`no_ads_vip_gloves`): Отключение межстраничной рекламы навсегда + эксклюзивный скин 'Неоновый Гладиатор' с постоянным +10% к стартовому импульсу (Tier 2 ($1.99 / 199 Янов))
