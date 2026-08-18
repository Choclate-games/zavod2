# Art Direction Specification: Слияние Турелей 3D: Оборона Базы

## 1. Visual Identity & Aesthetic
- **Style Name**: Stylized Low-Poly / Neo-Casual Arcade
- **Camera Perspective**: Orthographic-like Isometric Perspective (FOV: 45°, Pitch: 55°)
- **Environment Mood**: Футуристический полигон с неоновыми изометрическими платформами, парящими над кибер-каньоном с мягким объемным светом.
- **Character Proportions**: Модели турелей компактные, коренастые и выразительные (chunky mechanical style) с четко различимыми силуэтами стволов для мгновенного считывания уровня.

## 2. Color Palette & Lighting
- **Background Space**: `#0F172A`
- **Grid Surface**: `#1E293B`
- **Grid Slot Border**: `#334155`
- **Tier1 Wood**: `#A16207`
- **Tier5 Iron**: `#64748B`
- **Tier10 Laser Cyan**: `#06B6D4`
- **Tier15 Plasma Violet**: `#A855F7`
- **Enemy Ball Red**: `#EF4444`
- **Enemy Ball Green**: `#10B981`
- **Enemy Ball Yellow**: `#F59E0B`
- **Coin Gold**: `#FBBF24`

**Lighting Setup**: Основной направленный теплый свет (Directional Light) с мягкими тенями + холодный контровой свет (Rim Light) для подчеркивания контуров турелей и сфер + Ambient Light средней интенсивности.

## 3. Visual Effects (VFX)
- Партикловый взрыв салюта при открытии нового тира турели
- Трассеры плазменных сгустков с эффектом свечения (bloom-like additive blend)
- Фонтан золотых монет и конфетти при лопании сферы
- Ударная кольцевая волна (Shockwave Ring) при критическом попадании
- Вспышка дула (Muzzle Flash) уникального цвета для каждого типа ствола
