# Monetization Specification: Куриный Побег 3D: Стелс на Ферме

## 1. Strategy Summary
Мягкая гибридная модель: ненавязчивые межстраничные баннеры между уровнями и высокоценные Rewarded Video за мгновенный ревайв на месте поимки, удвоение наград и эксклюзивные скины шпионских куриц.

## 2. Rewarded Video Ad Placements
### Мгновенное спасение (Revive) (`revive_checkpoint`)
- **Benefit**: Возрождает курицу на безопасном расстоянии от собаки с временной 3-секундной неуязвимостью и сохраненным прогрессом собранных зерен.
- **Trigger**: Экран поимки собакой (Game Over Screen)
- **Limit**: 1 раз за уровень

### Удвоение урожая зерен (`double_grain_reward`)
- **Benefit**: Удваивает количество собранных на уровне золотых зерен для ускоренной разблокировки скинов.
- **Trigger**: Экран победы (Victory Screen)
- **Limit**: После каждого успешного уровня

### Скин 'Курица-Ниндзя' в аренду (`unlock_ninja_skin`)
- **Benefit**: Предоставляет доступ к уникальному скину с бесшумным бегом на 3 уровня.
- **Trigger**: Магазин скинов / Экран выбора уровня
- **Limit**: Без ограничений


## 3. Interstitial Ads Rules
- Minimum **90 seconds** interval between consecutive interstitials.
- Zero interstitials during active combat gameplay.
- Shown only on run game over or returning to Main Menu.

## 4. Optional In-App Purchases (IAP)
- **Набор 'Шпионский Комфорт' (No Ads)** (`no_ads_pack`): Полное отключение обязательной межстраничной рекламы навсегда + 500 золотых зерен в подарок. (Tier 2 (~150 Yans / 149 RUB))
- **Премиум-набор скинов 'Спецназ Курятника'** (`skin_pack_special_ops`): 3 легендарных скина курицы (Курица 007, Кибер-Цыпленок, Курица в смокинге) и 3 скина коробок (Дипломат, Сейф, Металлическая бочка). (Tier 3 (~250 Yans / 249 RUB))
