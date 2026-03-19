type EventMap = { [event: string]: unknown[] };
type Listener<Args extends unknown[] = unknown[]> = (...args: Args) => void;

export class EventEmitter<T extends EventMap = EventMap> {
  private _listeners: Map<string, Set<Listener>> = new Map();

  on<K extends keyof T & string>(event: K, fn: Listener<T[K]>): this {
    let set = this._listeners.get(event);
    if (!set) {
      set = new Set();
      this._listeners.set(event, set);
    }
    set.add(fn as Listener);
    return this;
  }

  off<K extends keyof T & string>(event: K, fn: Listener<T[K]>): this {
    const set = this._listeners.get(event);
    if (set) {
      set.delete(fn as Listener);
      if (set.size === 0) this._listeners.delete(event);
    }
    return this;
  }

  once<K extends keyof T & string>(event: K, fn: Listener<T[K]>): this {
    const wrapper: Listener = (...args: unknown[]) => {
      this.off(event, wrapper as Listener<T[K]>);
      (fn as Listener)(...args);
    };
    return this.on(event, wrapper as Listener<T[K]>);
  }

  emit<K extends keyof T & string>(event: K, ...args: T[K]): boolean {
    const set = this._listeners.get(event);
    if (!set || set.size === 0) return false;
    for (const fn of set) fn(...args);
    return true;
  }

  removeAllListeners<K extends keyof T & string>(event?: K): this {
    if (event) {
      this._listeners.delete(event);
    } else {
      this._listeners.clear();
    }
    return this;
  }
}
