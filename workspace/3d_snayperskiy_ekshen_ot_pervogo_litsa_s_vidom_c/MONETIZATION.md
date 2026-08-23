# Monetization Specification: Лавинный снайпер: Эхо Каньона

## 1. Strategy Summary
Этичная гибридная монетизация без элементов Pay-to-Win: добровольные Rewarded Video для дополнительного шанса/метео-сканирования и косметические внутриигровые покупки скинов винтовок и сеток оптики.

## 2. Rewarded Video Ad Placements
### Дополнительный патрон 'Золотой Калибр' (`second_chance_ammo`)
- **Benefit**: +1 бронебойный патрон при исчерпании боезапаса на перевале
- **Trigger**: Экран надвигающегося поражения при 0 патронов
- **Limit**: 1 раз за попытку

### Метео-сканирование ущелья (`wind_drone_scan`)
- **Benefit**: Точная проекция ветрового сноса на сетке прицела на 15 секунд
- **Trigger**: Кнопка на экране подготовки к выстрелу
- **Limit**: 1 раз за уровень

### Удвоение знаков дозорного (`double_mastery_reward`)
- **Benefit**: x2 к заработанным очкам мастерства за успешный контракт
- **Trigger**: Экран победы
- **Limit**: Без ограничений


## 3. Interstitial Ads Rules
- Minimum **90 seconds** interval between consecutive interstitials.
- Zero interstitials during active combat gameplay.
- Shown only on run game over or returning to Main Menu.

## 4. Optional In-App Purchases (IAP)
- **Набор 'Арсенал Нордхейма'** (`pack_nordic_arsenal`): 3 уникальных скина винтовок (Северное Сияние, Базальтовый Клык, Ледяной Страж) + 5 сеток прицела (tier_2 (199 YAN / $2.99))
- **Отключение рекламы (No Ads)** (`no_ads_forever`): Полное отключение межстраничных баннеров и interstitials (tier_1 (99 YAN / $1.49))
