# Механика: Синхронизация с тактом музыки (Web Audio Beat Sync)

## 1. Архитектура аудио-тайминга
1. **AudioContext.currentTime как единственный источник истины**:
   - `AudioContext.currentTime` аппаратный и не подвержен троттлингу requestAnimationFrame.
   - Вычисление текущей доли:
     $$\text{songPosition} = \text{audioCtx.currentTime} - \text{startTime}$$
     $$\text{currentBeat} = \text{songPosition} \times \frac{\text{BPM}}{60}$$

2. **Окна попадания (Accuracy Windows)**:
   - $\Delta t = |\text{inputTime} - \text{nearestBeatTime}|$.
   - **PERFECT**: $\Delta t \le 0.065\text{ с}$ ($+100\text{ очков}, +1\text{ комбо}$).
   - **GOOD**: $0.065\text{ с} < \Delta t \le 0.140\text{ с}$ ($+50\text{ очков}$).
   - **MISS**: $\Delta t > 0.140\text{ с}$ (сброс множителя комбо, промах атаки).
