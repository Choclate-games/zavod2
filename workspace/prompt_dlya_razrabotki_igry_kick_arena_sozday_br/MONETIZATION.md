# Monetization Specification: Судебный Пристав: Штурм Локдауна

## 1. Strategy Summary
Ненавязчивая гибридная монетизация для WebGL и мобильных платформ: Rewarded Video за тактическое воскрешение и удвоение награды контракта, Interstitial между завершенными штурмами с жестким кулдауном 90 с, и косметические скины визора/оружия за внутриигровую валюту/IAP.

## 2. Rewarded Video Ad Placements
### Экстренная Дефибрилляция Экзокостюма (`revive_contract`)
- **Benefit**: Мгновенное воскрешение на месте гибели с 50% здоровья и кинетической волной отталкивания всех врагов в радиусе 5 м (1 раз за забег)
- **Trigger**: Экран гибели до истечения таймера локдауна
- **Limit**: 1 per run

### Удвоение Кредитов Контракта (`double_contract_reward`)
- **Benefit**: Удвоение полученных за успешный штурм бункера кредитов и энергоячеек
- **Trigger**: Экран победной эвакуации
- **Limit**: После каждого успешного штурма


## 3. Interstitial Ads Rules
- Minimum **90 seconds** interval between consecutive interstitials.
- Zero interstitials during active combat gameplay.
- Shown only on run game over or returning to Main Menu.

## 4. Optional In-App Purchases (IAP)
- **Набор Оператора Штурма** (`starter_pack_operator`): Кастомный скин визора «Кибер-Пристав», золотой скин карабина и 5000 кредитов (Tier 1 (99 RUB / 45 YAN))
- **Пакет Быстрого Доступа (Без Рекламы)** (`no_ads_pass`): Отключение межстраничной рекламы Interstitial и постоянный бонус +25% к кредитам (Tier 2 (199 RUB / 90 YAN))
