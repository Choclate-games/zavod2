# Monetization Specification: Сейсмо-Домино: Точечный Снос

## 1. Strategy Summary
Честная ненавязчивая гибридная модель: межстраничная реклама с кулдауном между уровнями, Rewarded Video за дополнительный спасительный клин при 85-95% сносе, продажа косметических визуальных тем (лазеры, архитектура).

## 2. Rewarded Video Ad Placements
### Дополнительный Инженерный Клин (`extra_charge_revive`)
- **Benefit**: +1 аварийный заряд клина для завершения почти зачищенного уровня (когда зачищено >=85%)
- **Trigger**: Появление окна DefeatModal при нехватке нескольких процентов до победы
- **Limit**: 1 раз за попытку уровня

### Супер-Предпросмотр Каскада (`trajectory_guide_boost`)
- **Benefit**: Полноразмерная проекция падения всех зданий цепочки на 1 попытку
- **Trigger**: Кнопка помощи на сложных уровнях (начиная с 10 уровня)
- **Limit**: Не чаще 1 раза за 3 уровня


## 3. Interstitial Ads Rules
- Minimum **90 seconds** interval between consecutive interstitials.
- Zero interstitials during active combat gameplay.
- Shown only on run game over or returning to Main Menu.

## 4. Optional In-App Purchases (IAP)
- **Отключение Рекламы + Золотой Пакет** (`no_ads_pack`): Полное отключение межстраничной рекламы и эксклюзивный янтарный скин лазера (Tier 2 ($1.99 / 199 YAN))
- **Пропуск в Закрытые Сектора** (`all_sectors_unlock`): Мгновенный доступ ко всем 30 уровням и режиму Песочницы (Tier 3 ($2.99 / 299 YAN))
