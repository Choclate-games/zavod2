# Механика: Поведение роя дронов и миньонов (Boids Swarm AI)

## 1. Правила Рейнольдса (Boids) на 60 FPS
1. **Три базовых вектора**:
   - **Разделение (Separation)**: $\vec{F}_{sep} = \sum_{j} \frac{\vec{P}_i - \vec{P}_j}{|\vec{P}_i - \vec{P}_j|^2}$ (избегать столкновений внутри стаи).
   - **Выравнивание (Alignment)**: $\vec{F}_{align} = \frac{1}{N} \sum_{j} \vec{V}_j - \vec{V}_i$ (лететь в одном направлении).
   - **Сплоченность (Cohesion)**: $\vec{F}_{coh} = \frac{1}{N} \sum_{j} \vec{P}_j - \vec{P}_i$ (держаться центра группы).
2. **Целеуказание (Target Attraction)**:
   - Сила следования за лидером/целью $\vec{F}_{target} = \text{normalize}(\vec{T} - \vec{P}_i) \cdot v_{max}$.
