# Mobile Controls & Ergonomics: Зомби Дрифт: Стальная Ярость 3D

## 1. Orientation & Layout
- **Target Orientation**: **LANDSCAPE**
- **Safe Area Insets**: `Отступы для экранов с вырезами (Notch) через `env(safe-area-inset-*)``

## 2. Touch Controls Implementation
- **Left Thumb Area**: Dynamic floating virtual joystick activating wherever the user touches on the left 50% of the screen.
- **Right Thumb Cluster**:
  - **Large Primary Action Button**: Center of cluster for instant thumb access.
  - **Secondary Action Button**: Located slightly lower-left for reactions.
  - **Dash / Evasion Button**: Located upper-left for quick evasion.

## 3. Mobile Performance Throttling
- Cap pixel density to 1.5x.
- Disable dynamic real-time shadows on low-end devices.
