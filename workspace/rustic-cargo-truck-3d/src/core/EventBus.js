export class EventBus {
    listeners = new Map();
    on(event, listener) {
        let bucket = this.listeners.get(event);
        if (!bucket) {
            bucket = new Set();
            this.listeners.set(event, bucket);
        }
        const typed = listener;
        bucket.add(typed);
        return () => bucket?.delete(typed);
    }
    emit(event, payload) {
        const bucket = this.listeners.get(event);
        if (!bucket)
            return;
        for (const listener of bucket)
            listener(payload);
    }
    clear() {
        this.listeners.clear();
    }
}
