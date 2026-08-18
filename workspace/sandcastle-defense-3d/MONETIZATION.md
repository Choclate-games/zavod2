# Monetization Specification: Песочный Бастион 3D: Защита Пляжа

## 1. Strategy Summary
Мягкая гибридная модель (Rewarded Video + Interstitial с умным кулдауном + опциональные IAP/Ян-валюта), не ломающая игровой баланс и стимулирующая игрока наградами за просмотр.

## 2. Rewarded Video Ad Placements
### Второй Шанс: Восстановление Замка (`revive_castle`)
- **Benefit**: Мгновенно восстанавливает 50% прочности песчаного замка при критическом поражении и смывает волной текущих врагов на экране.
- **Trigger**: Экран критического урона или поражения замка.
- **Limit**: 1 раз за матч

### Двойной улов ракушек (`double_shells`)
- **Benefit**: Удваивает количество полученного за пройденный уровень Жемчуга и Ракушек.
- **Trigger**: Экран победы (Victory Screen).
- **Limit**: После каждого успешного уровня

### Приливный Смыв (Цунами) (`instant_boost_tsunami`)
- **Benefit**: Супер-способность: призывает мощную морскую волну, смывающую 100% слабых мобов и наносящую 500 урона боссам.
- **Trigger**: Кнопка паники в боевом HUD во время сложной волны.
- **Limit**: 1 раз за 3 волны


## 3. Interstitial Ads Rules
- Minimum **90 seconds** interval between consecutive interstitials.
- Zero interstitials during active combat gameplay.
- Shown only on run game over or returning to Main Menu.

## 4. Optional In-App Purchases (IAP)
- **Набор Песчаного Архитектора** (`starter_beach_pack`): 500 жемчужин + эксклюзивный золотой скин для Ракушечной Пушки + постоянный бонус +10% к стартовому песку. (Tier 1 (99 руб / $0.99))
- **VIP Отключение рекламы** (`no_ads_vip`): Полное отключение межстраничной рекламы (Interstitial) + удвоение наград за все уровни навсегда. (Tier 3 (299 руб / $2.99))
