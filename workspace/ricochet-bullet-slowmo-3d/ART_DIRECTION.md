# Art Direction Specification: Рикошет Снайпер 3D: Замедленный Выстрел

## 1. Visual Identity & Aesthetic
- **Style Name**: Стилизованный минималистичный Кибер-Неон / Superhot-Low-Poly
- **Camera Perspective**: First-Person при прицеливании с динамическим переходом в Third-Person Cinematic Follow-Cam при полете пули (FOV: 65°, Pitch: 0°)
- **Environment Mood**: Стерильные абстрактные полигональные тренировочные залы с чистыми белыми/серыми поверхностями и контрастными неоновыми интерактивными объектами.
- **Character Proportions**: Ярко-красные граненые кубические манекены-силуэты (Low-poly humanoid dummies) без лишних текстур.

## 2. Color Palette & Lighting
- **Background Clean**: `#ECEFF1`
- **Walls Geometry**: `#B0BEC5`
- **Player Laser**: `#00E5FF`
- **Bullet Glow**: `#FFD600`
- **Enemy Red**: `#FF1744`
- **Explosive Barrel**: `#FF6D00`
- **Portal Blue**: `#2979FF`
- **Portal Orange**: `#FF9100`
- **Shield Steel**: `#37474F`
- **Ui Accent Gold**: `#FFC107`

**Lighting Setup**: Контрастный трехточечный свет: Directional Light с мягкими тенями, заливающий Ambient Light и динамические точечные Point Lights в местах взрывов и порталов.

## 3. Visual Effects (VFX)
- Неоновый светящийся лазерный луч с анимацией бегущих точек
- Искры и брызги раскаленного металла при каждом рикошете
- Следящий шлейф пули (Ribbon Trail / Bullet Shockwave)
- Объемный огненный взрыв бочки с физическими осколками и дымом
- Разлет красных кристаллических осколков при разрушении врагов
- Энергетическое искажение и частицы у входа/выхода порталов
- Виньетка замедления времени и радиальный blur
