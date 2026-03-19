const resizeObservers: Array<{ callback: ResizeObserverCallback; elements: Element[] }> = [];

(global as any).ResizeObserver = class MockResizeObserver {
  callback: ResizeObserverCallback;
  elements: Element[] = [];

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    resizeObservers.push({ callback, elements: this.elements });
  }

  observe(element: Element): void {
    this.elements.push(element);
    const width = (element as HTMLElement).offsetWidth ?? (element as HTMLElement).clientWidth ?? 1200;
    const height = (element as HTMLElement).offsetHeight ?? (element as HTMLElement).clientHeight ?? 600;
    this.callback(
      [
        {
          target: element,
          contentRect: { width, height, top: 0, left: 0, bottom: height, right: width },
        } as ResizeObserverEntry,
      ],
      this as unknown as ResizeObserver
    );
  }

  unobserve(_element: Element): void {}
  disconnect(): void {
    this.elements.length = 0;
  }
};

const rafCallbacks: Map<number, FrameRequestCallback> = new Map();
let rafId = 0;

(global as any).requestAnimationFrame = (callback: FrameRequestCallback): number => {
  rafId++;
  rafCallbacks.set(rafId, callback);
  queueMicrotask(() => {
    const cb = rafCallbacks.get(rafId);
    if (cb) {
      cb(performance.now());
      rafCallbacks.delete(rafId);
    }
  });
  return rafId;
};

(global as any).cancelAnimationFrame = (id: number): void => {
  rafCallbacks.delete(id);
};

Object.defineProperty(HTMLElement.prototype, "offsetParent", {
  get(this: HTMLElement) {
    return this.parentElement;
  },
  configurable: true,
});

export function dispatchMouseEvent(
  target: EventTarget,
  type: string,
  init: { clientX?: number; clientY?: number; button?: number } = {}
): MouseEvent {
  const doc = (target as Node).ownerDocument ?? document;
  const event = doc.createEvent("MouseEvents");
  event.initEvent(type, true, true);
  Object.defineProperty(event, "clientX", { value: init.clientX ?? 0 });
  Object.defineProperty(event, "clientY", { value: init.clientY ?? 0 });
  Object.defineProperty(event, "button", { value: init.button ?? 0 });
  (target as EventTarget).dispatchEvent(event);
  return event as unknown as MouseEvent;
}

export function simulateResizeDrag(
  handle: HTMLElement,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number
): void {
  dispatchMouseEvent(handle, "mousedown", { clientX: fromX, clientY: fromY });
  dispatchMouseEvent(document, "mousemove", { clientX: toX, clientY: toY });
  dispatchMouseEvent(document, "mouseup", { clientX: toX, clientY: toY });
}

export function mockElementRect(
  el: HTMLElement,
  rect: { left: number; top: number; width: number; height: number }
): () => void {
  const original = el.getBoundingClientRect;
  el.getBoundingClientRect = () =>
    ({
      ...rect,
      right: rect.left + rect.width,
      bottom: rect.top + rect.height,
      x: rect.left,
      y: rect.top,
      toJSON: () => ({}),
    }) as DOMRect;
  return () => {
    el.getBoundingClientRect = original;
  };
}
