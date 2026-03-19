import type { ResizeHandleAxis, Position } from "../core/types.js";
import { DragManager } from "./drag-manager.js";
import type { DragData } from "./drag-manager.js";

export interface ResizeCallbacks {
  onResizeStart?: (handle: ResizeHandleAxis, size: Position, e: Event) => void | false;
  onResize?: (handle: ResizeHandleAxis, size: Position, e: Event) => void;
  onResizeStop?: (handle: ResizeHandleAxis, size: Position, e: Event) => void;
}

export interface ResizeManagerOptions {
  handles: readonly ResizeHandleAxis[];
  scale?: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  handleRenderer?: (axis: ResizeHandleAxis, el: HTMLElement) => HTMLElement | null;
  classPrefix?: string;
}

export class ResizeManager {
  private el: HTMLElement;
  private callbacks: ResizeCallbacks;
  private opts: ResizeManagerOptions;
  private handleElements: Map<ResizeHandleAxis, HTMLElement> = new Map();
  private dragManagers: Map<ResizeHandleAxis, DragManager> = new Map();
  
  private startWidth = 0;
  private startHeight = 0;
  private startLeft = 0;
  private startTop = 0;
  private destroyed = false;

  constructor(
    el: HTMLElement,
    callbacks: ResizeCallbacks,
    opts: ResizeManagerOptions
  ) {
    this.el = el;
    this.callbacks = callbacks;
    this.opts = opts;

    this.createHandles();
  }

  private createHandles(): void {
    for (const axis of this.opts.handles) {
      let handleEl: HTMLElement | null = null;

      if (this.opts.handleRenderer) {
        handleEl = this.opts.handleRenderer(axis, this.el);
      }

      if (!handleEl) {
        const p = this.opts.classPrefix ?? "grid";
        handleEl = document.createElement("span");
        handleEl.className = `${p}-resizable-handle ${p}-resizable-handle-${axis}`;
      }

      this.el.appendChild(handleEl);
      this.handleElements.set(axis, handleEl);

      const dm = new DragManager(handleEl, {
        onDragStart: (e, _data) => this.handleResizeStart(axis, e),
        onDrag: (e, data) => this.handleResize(axis, data, e),
        onDragStop: (e, _data) => this.handleResizeStop(axis, e),
      }, {
        scale: this.opts.scale,
        cancel: "",
      });

      this.dragManagers.set(axis, dm);
    }
  }

  private handleResizeStart(axis: ResizeHandleAxis, e: Event): void | false {
    const rect = this.el.getBoundingClientRect();
    const scale = this.opts.scale ?? 1;
    this.startWidth = rect.width / scale;
    this.startHeight = rect.height / scale;

    const offsetParent = this.el.offsetParent || document.body;
    const parentRect = offsetParent.getBoundingClientRect();
    const scrollLeft = offsetParent instanceof HTMLElement ? offsetParent.scrollLeft : 0;
    const scrollTop = offsetParent instanceof HTMLElement ? offsetParent.scrollTop : 0;
    this.startLeft = (rect.left - parentRect.left + scrollLeft) / scale;
    this.startTop = (rect.top - parentRect.top + scrollTop) / scale;

    const size: Position = {
      width: this.startWidth,
      height: this.startHeight,
      left: this.startLeft,
      top: this.startTop,
    };

    return this.callbacks.onResizeStart?.(axis, size, e);
  }

  private handleResize(axis: ResizeHandleAxis, data: DragData, e: Event): void {
    let width = this.startWidth;
    let height = this.startHeight;
    let left = this.startLeft;
    let top = this.startTop;

    const totalDeltaX = data.x - this.getHandleOffsetX(axis);
    const totalDeltaY = data.y - this.getHandleOffsetY(axis);

    switch (axis) {
      case "se":
        width = this.startWidth + totalDeltaX;
        height = this.startHeight + totalDeltaY;
        break;
      case "s":
        height = this.startHeight + totalDeltaY;
        break;
      case "e":
        width = this.startWidth + totalDeltaX;
        break;
      case "ne":
        width = this.startWidth + totalDeltaX;
        height = this.startHeight - totalDeltaY;
        top = this.startTop + totalDeltaY;
        break;
      case "n":
        height = this.startHeight - totalDeltaY;
        top = this.startTop + totalDeltaY;
        break;
      case "nw":
        width = this.startWidth - totalDeltaX;
        height = this.startHeight - totalDeltaY;
        left = this.startLeft + totalDeltaX;
        top = this.startTop + totalDeltaY;
        break;
      case "w":
        width = this.startWidth - totalDeltaX;
        left = this.startLeft + totalDeltaX;
        break;
      case "sw":
        width = this.startWidth - totalDeltaX;
        height = this.startHeight + totalDeltaY;
        left = this.startLeft + totalDeltaX;
        break;
    }

    const minW = this.opts.minWidth ?? 20;
    const minH = this.opts.minHeight ?? 20;
    const maxW = this.opts.maxWidth;
    const maxH = this.opts.maxHeight;

    const clampedWidth = maxW !== undefined
      ? Math.min(Math.max(width, minW), maxW)
      : Math.max(width, minW);
    const clampedHeight = maxH !== undefined
      ? Math.min(Math.max(height, minH), maxH)
      : Math.max(height, minH);

    if (clampedWidth !== width) {
      const widthDiff = width - clampedWidth;
      width = clampedWidth;
      if (axis === "w" || axis === "nw" || axis === "sw") {
        left += widthDiff;
      }
    }

    if (clampedHeight !== height) {
      const heightDiff = height - clampedHeight;
      height = clampedHeight;
      if (axis === "n" || axis === "nw" || axis === "ne") {
        top += heightDiff;
      }
    }

    this.callbacks.onResize?.(axis, { width, height, left, top }, e);
  }

  private getHandleOffsetX(axis: ResizeHandleAxis): number {
    if (axis === "e" || axis === "se" || axis === "ne") return this.startWidth;
    if (axis === "w" || axis === "sw" || axis === "nw") return 0;
    return this.startWidth / 2;
  }

  private getHandleOffsetY(axis: ResizeHandleAxis): number {
    if (axis === "s" || axis === "se" || axis === "sw") return this.startHeight;
    if (axis === "n" || axis === "ne" || axis === "nw") return 0;
    return this.startHeight / 2;
  }

  private handleResizeStop(axis: ResizeHandleAxis, e: Event): void {
    const rect = this.el.getBoundingClientRect();
    const scale = this.opts.scale ?? 1;
    const offsetParent = this.el.offsetParent || document.body;
    const parentRect = offsetParent.getBoundingClientRect();
    const scrollLeft = offsetParent instanceof HTMLElement ? offsetParent.scrollLeft : 0;
    const scrollTop = offsetParent instanceof HTMLElement ? offsetParent.scrollTop : 0;

    this.callbacks.onResizeStop?.(axis, {
      width: rect.width / scale,
      height: rect.height / scale,
      left: (rect.left - parentRect.left + scrollLeft) / scale,
      top: (rect.top - parentRect.top + scrollTop) / scale,
    }, e);
  }

  updateConstraints(constraints: {
    minWidth?: number;
    minHeight?: number;
    maxWidth?: number;
    maxHeight?: number;
  }): void {
    if (constraints.minWidth !== undefined) this.opts.minWidth = constraints.minWidth;
    if (constraints.minHeight !== undefined) this.opts.minHeight = constraints.minHeight;
    this.opts.maxWidth = constraints.maxWidth;
    this.opts.maxHeight = constraints.maxHeight;
  }

  setHandles(handles: readonly ResizeHandleAxis[]): void {
    this.removeHandles();
    this.opts = { ...this.opts, handles };
    this.createHandles();
  }

  private removeHandles(): void {
    for (const [, dm] of this.dragManagers) dm.destroy();
    this.dragManagers.clear();

    for (const [, el] of this.handleElements) {
      if (el.parentNode) el.parentNode.removeChild(el);
    }
    this.handleElements.clear();
  }

  hideHandles(): void {
    for (const [, el] of this.handleElements) {
      el.style.display = "none";
    }
  }

  showHandles(): void {
    for (const [, el] of this.handleElements) {
      el.style.display = "";
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.removeHandles();
  }
}
