# Monetization Specification: Один дубль: Разбор сцены

## 1. Strategy Summary
Монетизация не меняет точность, вместимость магазина или правила маршрута. Она предлагает один необязательный повтор после провала и косметику, связанную с киношной площадкой.

## 2. Rewarded Video Ad Placements
### Повтор дубля (`contract_retry`)
- **Benefit**: Один дополнительный повтор после провала без изменения условий и итоговой таблицы рекордов.
- **Trigger**: Экран провала после пустого магазина, трёх активированных зарядов или третьего попадания.
- **Limit**: не более 1 раза на дубль


## 3. Interstitial Ads Rules
- Minimum **90 seconds** interval between consecutive interstitials.
- Zero interstitials during active combat gameplay.
- Shown only on run game over or returning to Main Menu.

## 4. Optional In-App Purchases (IAP)
- **Набор реквизита** (`set_dressing_pack`): Три косметических оформления фасадов, прожекторов и хлопушки. (низкий)
- **Стиль режиссёра** (`director_style_pack`): Косметический набор прицела, перчаток и звуковых акцентов. (средний)
