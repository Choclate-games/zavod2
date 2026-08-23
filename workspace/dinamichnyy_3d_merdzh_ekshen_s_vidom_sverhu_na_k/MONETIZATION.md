# Monetization Specification: Био-Колизей: Ударный Синтез

## 1. Strategy Summary
Ненавязчивая гибридная модель: вознаграждающие видео (Rewarded Ads) для второго шанса и спавна золотого био-кома, межстраничные объявления (Interstitial) с кулдауном 90 секунд строго между волнами/забегами, и внутриигровые покупки косметических обликов челюстей.

## 2. Rewarded Video Ad Placements
### Магматическое Спасение (Revive) (`revive_lava_rescue`)
- **Benefit**: Мгновенное возвращение упавшего титана на арену с мощной ударной волной, сдувающей всех врагов
- **Trigger**: Экран поражения при падении последнего кома
- **Limit**: 1 раз за забег

### Золотой Био-Ком (Golden Catalyst) (`spawn_golden_blob`)
- **Benefit**: Призыв золотого кома, который мгновенно соединяется с комком любого ранга, удваивая силу волны
- **Trigger**: Перед стартом 3-й волны босса
- **Limit**: 1 раз за волну


## 3. Interstitial Ads Rules
- Minimum **90 seconds** interval between consecutive interstitials.
- Zero interstitials during active combat gameplay.
- Shown only on run game over or returning to Main Menu.

## 4. Optional In-App Purchases (IAP)
- **Облик: Инфернальный Жнец** (`skin_pack_inferno`): Пылающие обсидиановые челюсти с огненным следом при швырке и эффектом лавовых брызг (Tier 1 ($0.99 / 99 YAN))
- **Отключение межстраничной рекламы** (`no_ads_permanent`): Полное отключение всех всплывающих Interstitial объявлений навсегда (Tier 2 ($1.99 / 199 YAN))
