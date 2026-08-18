export class GameLoop {
    target;
    fixedStep = 1 / 60;
    accumulator = 0;
    previous = 0;
    raf = 0;
    running = false;
    resetOnResume = false;
    constructor(target) {
        this.target = target;
    }
    start() {
        if (this.running)
            return;
        this.running = true;
        this.previous = performance.now();
        this.raf = requestAnimationFrame(this.frame);
    }
    stop() {
        this.running = false;
        cancelAnimationFrame(this.raf);
    }
    resetAccumulator() {
        this.accumulator = 0;
        this.resetOnResume = true;
    }
    frame = (now) => {
        if (!this.running)
            return;
        const rawDt = Math.min((now - this.previous) / 1000, 0.1);
        this.previous = now;
        if (this.resetOnResume) {
            this.resetOnResume = false;
        }
        else {
            this.accumulator = Math.min(this.accumulator + rawDt, this.fixedStep * 5);
            while (this.accumulator >= this.fixedStep) {
                this.target.fixedUpdate(this.fixedStep);
                this.accumulator -= this.fixedStep;
            }
        }
        this.target.render(this.accumulator / this.fixedStep);
        this.raf = requestAnimationFrame(this.frame);
    };
}
