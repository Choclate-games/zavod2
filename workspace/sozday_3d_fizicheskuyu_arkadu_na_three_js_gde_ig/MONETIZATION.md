# Monetization Specification: Метро-Балансир: Час Пик

## 1. Strategy Summary
Органичная аркадная монетизация: Rewarded Video для спасения разбитой стопки (Revive) и удвоения чаевых на станции, редкие Interstitial между успешными рейсами (кулдаун 90 сек), и косметические IAP (уникальные скины курьера и винтажные предметы груза).

## 2. Rewarded Video Ad Placements
### Аварийная страховка груза (Revive) (`revive_catch`)
- **Benefit**: Восстанавливает разрушенную стопку предметов и замедляет поезд на 3 секунды для продолжения заезда
- **Trigger**: Момент падения критического предмета на 15–50 секундах перегона
- **Limit**: 1 раз за перегон

### VIP Чаевые от заказчика (2x Reward) (`double_tips`)
- **Benefit**: Удваивает заработанные курьерские монеты за выполненный рейс
- **Trigger**: Экран успешного прибытия на станцию
- **Limit**: Без лимита


## 3. Interstitial Ads Rules
- Minimum **90 seconds** interval between consecutive interstitials.
- Zero interstitials during active combat gameplay.
- Shown only on run game over or returning to Main Menu.

## 4. Optional In-App Purchases (IAP)
- **Набор 'Винтажный Экспресс'** (`pack_vintage_courier`): Золотая куртка курьера + набор ретро-предметов (граммофон, антикварные часы) + отключение обязательной рекламы (Tier 2 ($1.99))
