# Monetization Specification: Гангейм: Контейнерный Прорыв

## 1. Strategy Summary
Гибридная гипер-честная модель: просмотр Rewarded Video для удвоения опыта/золота после матча и мгновенного возрождения с сохранением киллстрика 1 раз за матч; Interstitial реклама строго между матчами с кулдауном 90 секунд; ненавязчивые IAP для покупки эксклюзивных скинов оружия.

## 2. Rewarded Video Ad Placements
### Удвоение награды за победу (`double_match_rewards`)
- **Benefit**: Удваивает заработанные за матч монеты и опыт ранга в 2 раза
- **Trigger**: Экран результатов матча
- **Limit**: После каждого матча

### Тактическое подкрепление (`revive_keep_streak`)
- **Benefit**: Мгновенное возрождение на месте с сохранением текущего набранного киллстрика
- **Trigger**: Экран гибели при серии >= 2 фрагов
- **Limit**: 1 раз за матч


## 3. Interstitial Ads Rules
- Minimum **90 seconds** interval between consecutive interstitials.
- Zero interstitials during active combat gameplay.
- Shown only on run game over or returning to Main Menu.

## 4. Optional In-App Purchases (IAP)
- **Стартовый Набор Оперативника** (`starter_operator_pack`): Набор из 3 эксклюзивных скинов (Неон, Карбон, Граффити) и 500 золотых монет ($1.99 / 149 YAN)
- **Золотой Арсенал Gun Game** (`gold_arsenal_bundle`): Премиальный золотой камуфляж на все 12 видов оружия лестницы ($3.99 / 299 YAN)
