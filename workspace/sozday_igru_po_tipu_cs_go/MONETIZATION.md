# Monetization Specification: Ван-Тап: Дуэли на Крыше

## 1. Strategy Summary
Гибридная ненавязчивая монетизация: косметика оружия (скины, гравировки), кастомизация перчаток, дуэльный баттл-пасс и просмотр вознаграждаемой рекламы (Rewarded Video) для удвоения наград за победные серии и открытия редких кейсов.

## 2. Rewarded Video Ad Placements
### Удвоение награды за матч (`double_victory_reward`)
- **Benefit**: Удваивает заработанные золотые слитки за выигранный матч Best of 5
- **Trigger**: Экран финальной победы в матче
- **Limit**: Без ограничений

### Дуэльный кейс со скином (`free_weapon_case`)
- **Benefit**: Бесплатное открытие элитного оружейного кейса с редким скином Desert Eagle или AK-47
- **Trigger**: Главное меню / Раздел 'Оружейная'
- **Limit**: 1 раз в 10 минут

### Защита рейтинга (Shield) (`rank_shield`)
- **Benefit**: Предотвращает потерю ELO-рейтинга при поражении в решающем 5-м раунде (счет 2:3)
- **Trigger**: Экран поражения при счете 2:3
- **Limit**: 2 раза в день


## 3. Interstitial Ads Rules
- Minimum **90 seconds** interval between consecutive interstitials.
- Zero interstitials during active combat gameplay.
- Shown only on run game over or returning to Main Menu.

## 4. Optional In-App Purchases (IAP)
- **Пропуск Элитного Дуэлянта** (`vip_duelist_pass`): Доступ ко всем уникальным скинам оружия, золотым гильзам и отключению обязательной рекламы (Tier 2 ($2.99 / 249 руб))
- **Мешочек Золотых Слитков (1200)** (`gold_pack_medium`): Пакет валюты для покупки любых скинов и перчаток в оружейной (Tier 1 ($0.99 / 99 руб))
