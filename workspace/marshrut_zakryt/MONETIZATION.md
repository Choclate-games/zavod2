# Monetization Specification: Курьерский прорыв

## 1. Strategy Summary
Монетизация не меняет силу оружия и не продаёт лучший маршрут. Доход строится на редком возрождении за вознаграждаемую рекламу и косметических наборах для сумки, плаща и городских эффектов.

## 2. Rewarded Video Ad Placements
### Продолжить доставку (`restart_contract`)
- **Benefit**: Один раз за контракт восстановить 1 заряд выносливости и вернуться к последнему терминалу.
- **Trigger**: После поражения, только после показа итогов маршрута.
- **Limit**: 1 раз за контракт

### Сохранить маршрут (`route_replay`)
- **Benefit**: После завершения контракта открыть подробную запись маршрута и сравнение с лучшим результатом.
- **Trigger**: На экране итогов, без прерывания активной доставки.
- **Limit**: 1 раз за сессию


## 3. Interstitial Ads Rules
- Minimum **90 seconds** interval between consecutive interstitials.
- Zero interstitials during active combat gameplay.
- Shown only on run game over or returning to Main Menu.

## 4. Optional In-App Purchases (IAP)
- **Неоновая сумка маршрута** (`bag_neon_route`): Косметический светящийся рисунок на пакете. (низкий)
- **Комплект дождевого плаща** (`raincoat_set`): Три цветовых варианта плаща курьера. (средний)
