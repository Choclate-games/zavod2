# Playgama Bridge Integration: Биослизь: Королевская Охота 3D

## 1. SDK Overview
- **SDK**: `@playgama/bridge 1.x`
- **Supported Portals**: yandex, vk, crazygames, gamepix, generic_web

## 2. Initialization Flow
- Инициализация Playgama Bridge при старте загрузки HTML-страницы
- Загрузка сохраненного профиля игрока из Cloud Storage
- Определение платформы, языка интерфейса (RU/EN) и типа устройства (мобильное/десктоп)
- Предзагрузка баннеров и скрытие стандартного сплэш-скрина платформы

## 3. Cloud Storage Keys
- `bioslime_dna_balance`
- `bioslime_gene_upgrades`
- `bioslime_unlocked_skins`
- `bioslime_best_survive_time`
- `bioslime_settings`

## 4. Leaderboards
- `Лидерборд по максимальному времени выживания (секунды)`
- `Лидерборд по максимальной достигнутой массе слизи за один забег`
- `Лидерборд по количеству поглощенных врагов`

## 5. Lifecycle & Auto-Pause
- Listen to `visibility_state_changed` to pause physics and mute master volume when tab is hidden or ad displays.
