export interface DragCallbacks {
  onDragStart?: (e: MouseEvent | TouchEvent, data: DragData) => void | false;
  onDrag?: (e: MouseEvent | TouchEvent, data: DragData) => void;
  onDragStop?: (e: MouseEvent | TouchEvent, data: DragData) => void;
}

export interface DragData {
  node: HTMLElement;
  x: number;
  y: number;
  deltaX: number;
  deltaY: number;
  lastX: number;
  lastY: number;
}

export interface DragManagerOptions {
  handle?: string;
  cancel?: string;
  scale?: number;
  threshold?: number;
}

export class DragManager {
  private el: HTMLElement;
  private callbacks: DragCallbacks;
  private opts: Required<DragManagerOptions>;
  private dragging = false;
  private thresholdExceeded = false;
  private startX = 0;
  private startY = 0;
  private lastX = 0;
  private lastY = 0;
  private initialClientX = 0;
  private initialClientY = 0;
  private cachedParentRect: DOMRect | null = null;
  private cachedOffsetParent: Element | null = null;
  private destroyed = false;

  private boundMouseDown: (e: MouseEvent) => void;
  private boundMouseMove: (e: MouseEvent) => void;
  private boundMouseUp: (e: MouseEvent) => void;
  private boundTouchStart: (e: TouchEvent) => void;
  private boundTouchMove: (e: TouchEvent) => void;
  private boundTouchEnd: (e: TouchEvent) => void;

  constructor(
    el: HTMLElement,
    callbacks: DragCallbacks,
    opts: DragManagerOptions = {}
  ) {
    this.el = el;
    this.callbacks = callbacks;
    this.opts = {
      handle: opts.handle ?? "",
      cancel: opts.cancel ?? "",
      scale: opts.scale ?? 1,
      threshold: opts.threshold ?? 0,
    };

    this.boundMouseDown = this.handleMouseDown.bind(this);
    this.boundMouseMove = this.handleMouseMove.bind(this);
    this.boundMouseUp = this.handleMouseUp.bind(this);
    this.boundTouchStart = this.handleTouchStart.bind(this);
    this.boundTouchMove = this.handleTouchMove.bind(this);
    this.boundTouchEnd = this.handleTouchEnd.bind(this);

    this.el.addEventListener("mousedown", this.boundMouseDown);
    this.el.addEventListener("touchstart", this.boundTouchStart, { passive: false });
  }

  private matchesSelector(target: EventTarget | null, selector: string): boolean {
    if (!selector || !target || !(target instanceof Element)) return false;
    return target.matches(selector) || target.closest(selector) !== null;
  }

  private shouldStart(e: MouseEvent | TouchEvent): boolean {
    const target = e.target;

    if (this.opts.cancel && this.matchesSelector(target, this.opts.cancel)) {
      return false;
    }

    if (this.opts.handle) {
      return this.matchesSelector(target, this.opts.handle);
    }

    return true;
  }

  private getPosition(e: MouseEvent | TouchEvent): { clientX: number; clientY: number } {
    if ("touches" in e) {
      const touch = e.touches[0] || e.changedTouches[0];
      return { clientX: touch!.clientX, clientY: touch!.clientY };
    }
    return { clientX: e.clientX, clientY: e.clientY };
  }

  private getOffsetFromParent(clientX: number, clientY: number): { x: number; y: number } {
    const offsetParent = this.cachedOffsetParent || this.el.offsetParent || document.body;
    const rect = this.cachedParentRect ?? offsetParent.getBoundingClientRect();
    const scrollLeft = offsetParent instanceof HTMLElement ? offsetParent.scrollLeft : 0;
    const scrollTop = offsetParent instanceof HTMLElement ? offsetParent.scrollTop : 0;
    return {
      x: (clientX - rect.left + scrollLeft) / this.opts.scale,
      y: (clientY - rect.top + scrollTop) / this.opts.scale,
    };
  }

  private handleStart(e: MouseEvent | TouchEvent): void {
    if (!this.shouldStart(e)) return;

    e.preventDefault();

    const offsetParent = this.el.offsetParent || document.body;
    this.cachedOffsetParent = offsetParent;
    this.cachedParentRect = offsetParent.getBoundingClientRect();

    const { clientX, clientY } = this.getPosition(e);
    const pos = this.getOffsetFromParent(clientX, clientY);

    this.initialClientX = clientX;
    this.initialClientY = clientY;
    this.startX = pos.x;
    this.startY = pos.y;
    this.lastX = pos.x;
    this.lastY = pos.y;

    if (this.opts.threshold > 0) {
      this.thresholdExceeded = false;
      this.dragging = true;
      return;
    }

    const data: DragData = {
      node: this.el,
      x: pos.x,
      y: pos.y,
      deltaX: 0,
      deltaY: 0,
      lastX: pos.x,
      lastY: pos.y,
    };

    const result = this.callbacks.onDragStart?.(e, data);
    if (result === false) return;

    this.dragging = true;
    this.thresholdExceeded = true;
  }

  private handleMove(e: MouseEvent | TouchEvent): void {
    if (!this.dragging) return;

    const { clientX, clientY } = this.getPosition(e);

    if (!this.thresholdExceeded) {
      const dx = clientX - this.initialClientX;
      const dy = clientY - this.initialClientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < this.opts.threshold) return;

      this.thresholdExceeded = true;
      const pos = this.getOffsetFromParent(clientX, clientY);
      const data: DragData = {
        node: this.el,
        x: pos.x,
        y: pos.y,
        deltaX: 0,
        deltaY: 0,
        lastX: this.startX,
        lastY: this.startY,
      };
      const result = this.callbacks.onDragStart?.(e, data);
      if (result === false) {
        this.dragging = false;
        return;
      }
    }

    e.preventDefault();

    const pos = this.getOffsetFromParent(clientX, clientY);
    const deltaX = pos.x - this.lastX;
    const deltaY = pos.y - this.lastY;

    const data: DragData = {
      node: this.el,
      x: pos.x,
      y: pos.y,
      deltaX,
      deltaY,
      lastX: this.lastX,
      lastY: this.lastY,
    };

    this.lastX = pos.x;
    this.lastY = pos.y;

    this.callbacks.onDrag?.(e, data);
  }

  private handleEnd(e: MouseEvent | TouchEvent): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.cachedParentRect = null;
    this.cachedOffsetParent = null;

    if (!this.thresholdExceeded) return;

    const { clientX, clientY } = this.getPosition(e);
    const pos = this.getOffsetFromParent(clientX, clientY);

    const data: DragData = {
      node: this.el,
      x: pos.x,
      y: pos.y,
      deltaX: pos.x - this.lastX,
      deltaY: pos.y - this.lastY,
      lastX: this.lastX,
      lastY: this.lastY,
    };

    this.callbacks.onDragStop?.(e, data);
  }

  private handleMouseDown(e: MouseEvent): void {
    if (e.button !== 0) return;
    this.handleStart(e);
    if (this.dragging) {
      document.addEventListener("mousemove", this.boundMouseMove);
      document.addEventListener("mouseup", this.boundMouseUp);
    }
  }

  private handleMouseMove(e: MouseEvent): void {
    this.handleMove(e);
  }

  private handleMouseUp(e: MouseEvent): void {
    document.removeEventListener("mousemove", this.boundMouseMove);
    document.removeEventListener("mouseup", this.boundMouseUp);
    this.handleEnd(e);
  }

  private handleTouchStart(e: TouchEvent): void {
    if (e.touches.length > 1) return;
    this.handleStart(e);
    if (this.dragging) {
      document.addEventListener("touchmove", this.boundTouchMove, { passive: false });
      document.addEventListener("touchend", this.boundTouchEnd);
    }
  }

  private handleTouchMove(e: TouchEvent): void {
    this.handleMove(e);
  }

  private handleTouchEnd(e: TouchEvent): void {
    document.removeEventListener("touchmove", this.boundTouchMove);
    document.removeEventListener("touchend", this.boundTouchEnd);
    this.handleEnd(e);
  }

  updateOptions(opts: Partial<DragManagerOptions>): void {
    if (opts.handle !== undefined) this.opts.handle = opts.handle;
    if (opts.cancel !== undefined) this.opts.cancel = opts.cancel;
    if (opts.scale !== undefined) this.opts.scale = opts.scale;
    if (opts.threshold !== undefined) this.opts.threshold = opts.threshold;
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.el.removeEventListener("mousedown", this.boundMouseDown);
    this.el.removeEventListener("touchstart", this.boundTouchStart);
    document.removeEventListener("mousemove", this.boundMouseMove);
    document.removeEventListener("mouseup", this.boundMouseUp);
    document.removeEventListener("touchmove", this.boundTouchMove);
    document.removeEventListener("touchend", this.boundTouchEnd);
  }
}
