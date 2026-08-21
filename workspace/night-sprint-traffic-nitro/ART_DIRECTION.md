# Art Direction Specification: Ночной Спринт: Трафик и Закись

## 1. Visual Identity & Aesthetic
- **Style Name**: Ночной Стилизованный Неон-Рейсинг (Synthwave / NFS Underground Aesthetic)
- **Camera Perspective**: Низкая динамическая камера сзади-сверху от третьего лица (Third-Person Chase Cam) (FOV: 60°, Pitch: 14°)
- **Environment Mood**: Ночной мегаполис: мокрое многополосное шоссе, небоскребы с неоновой рекламой, светящиеся светодиодные отбойники, дождевая дымка и эстакады
- **Character Proportions**: Аутентичные пропорции заниженных японских и европейских спорткаров (JDM / GT Sports Cars) с гипертрофированными спойлерами, расширенными арками и низкопрофильными дисками

## 2. Color Palette & Lighting
- **Chameleon Purple**: `#7928ca`
- **Headlights Warm**: `#fff4d4`
- **Hud Gold**: `#ffd700`
- **Neon Cyan**: `#00f0ff`
- **Neon Magenta**: `#ff007f`
- **Nitro Flame Blue**: `#2979ff`
- **Taillights Red**: `#ff073a`
- **Wet Asphalt**: `#0d1117`

**Lighting Setup**: Направленный лунный свет (DirectionalLight темно-синий #0a1128), яркие точечные источники света фар (SpotLight #ffffff / #ffea00), красные задние габариты (PointLight #ff0033) и неоновые полосы подсветки днища (PointLight #00ffff / #ff00ff)

## 3. Visual Effects (VFX)
- Кастомный шейдер мокрого асфальта с экранными отражениями фар и неоновых вывесок (PBR Roughness + Specular Mapping)
- Двухструйный анимированный факел закиси азота из глушителей с партиклами синих искр и теплового искажения
- Снопы водяных брызг и дымки из-под вращающихся колес при движении по мокрой дороге
- Радиальный экранный размыв скорости (Post-processing Radial Speed Blur) при активации нитро
- Золотистые вспышки и волны давления при срабатывании Near Miss
- Световые шлейфы (Light Trails) от задних габаритных огней на высоких скоростях
