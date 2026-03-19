import type {
  Layout,
  LayoutItem,
  LayoutConstraint,
  ConstraintContext,
  Position,
  PositionStrategy,
  ResizeHandleAxis,
} from "../core/types.js";
import {
  calcGridItemPosition,
  calcGridColWidth,
  calcGridItemWHPx,
  calcXYRaw,
  type PositionParams,
} from "../core/calculate.js";
import { resizeItemInDirection } from "../core/position.js";
import {
  applyPositionConstraints,
  applySizeConstraints,
} from "../core/constraints.js";
import { DragManager } from "./drag-manager.js";
import type { DragData } from "./drag-manager.js";
import { ResizeManager } from "./resize-manager.js";

export interface GridItemCallbacks {
  onDragStart?: (id: string, x: number, y: number, e: Event, node: HTMLElement) => void;
  onDrag?: (id: string, x: number, y: number, e: Event, node: HTMLElement) => void;
  onDragStop?: (id: string, x: number, y: number, e: Event, node: HTMLElement) => void;
  onResizeStart?: (id: string, w: number, h: number, handle: ResizeHandleAxis, e: Event, node: HTMLElement) => void;
  onResize?: (id: string, w: number, h: number, handle: ResizeHandleAxis, e: Event, node: HTMLElement) => void;
  onResizeStop?: (id: string, w: number, h: number, handle: ResizeHandleAxis, e: Event, node: HTMLElement) => void;
}

export interface GridItemConfig {
  positionParams: PositionParams;
  positionStrategy: PositionStrategy;
  constraints: LayoutConstraint[];
  isDraggable: boolean;
  isResizable: boolean;
  isBounded: boolean;
  resizeHandles: readonly ResizeHandleAxis[];
  dragHandle?: string;
  dragCancel?: string;
  dragThreshold: number;
  classPrefix: string;
  layout: Layout;
  containerHeight: number;
}

export class GridItemManager {
  readonly el: HTMLElement;
  readonly id: string;
  private layoutItem: LayoutItem;
  private config: GridItemConfig;
  private callbacks: GridItemCallbacks;
  private dragManager: DragManager | null = null;
  private resizeManager: ResizeManager | null = null;
  private dragging = false;
  private resizing = false;
  private dragPosition: { top: number; left: number } | null = null;
  private resizePosition: Position | null = null;
  private lastResizeSize: { w: number; h: number } | null = null;
  private startDragPos: { top: number; left: number } = { top: 0, left: 0 };
  private cachedDimensions: { width: number; height: number } | null = null;
  private destroyed = false;

  constructor(
    el: HTMLElement,
    layoutItem: LayoutItem,
    config: GridItemConfig,
    callbacks: GridItemCallbacks
  ) {
    this.el = el;
    this.id = layoutItem.i;
    this.layoutItem = layoutItem;
    this.config = config;
    this.callbacks = callbacks;

    const p = config.classPrefix;
    this.el.classList.add(`${p}-item`);

    if (config.positionStrategy.type === "transform") {
      this.el.classList.add(`${p}-css-transforms`);
    }

    if (layoutItem.static) {
      this.el.classList.add(`${p}-static`);
    }

    this.setupDrag();
    this.setupResize();
  }

  private setupDrag(): void {
    const canDrag =
      this.config.isDraggable &&
      this.layoutItem.isDraggable !== false &&
      !this.layoutItem.static;

    if (!canDrag) {
      this.destroyDrag();
      return;
    }

    if (this.dragManager) return;

    const p = this.config.classPrefix;
    this.el.classList.add(`${p}-draggable`);

    this.dragManager = new DragManager(this.el, {
      onDragStart: (e, data) => this.handleDragStart(data, e),
      onDrag: (e, data) => this.handleDrag(data, e),
      onDragStop: (e, data) => this.handleDragStop(data, e),
    }, {
      handle: this.config.dragHandle,
      cancel: this.config.dragCancel
        ? `.${p}-resizable-handle,${this.config.dragCancel}`
        : `.${p}-resizable-handle`,
      scale: this.config.positionStrategy.scale,
      threshold: this.config.dragThreshold,
    });
  }

  private setupResize(): void {
    const canResize =
      this.config.isResizable &&
      this.layoutItem.isResizable !== false &&
      !this.layoutItem.static;

    if (!canResize) {
      this.destroyResize();
      this.el.classList.add(`${this.config.classPrefix}-resizable-hide`);
      return;
    }

    this.el.classList.remove(`${this.config.classPrefix}-resizable-hide`);

    const handles = this.layoutItem.resizeHandles ?? this.config.resizeHandles;

    if (this.resizeManager) {
      this.resizeManager.setHandles(handles);
      return;
    }

    const pp = this.config.positionParams;
    const colWidth = calcGridColWidth(pp);
    const item = this.layoutItem;
    const minW = item.minW ?? 1;
    const minH = item.minH ?? 1;
    const maxW = item.maxW ?? Infinity;
    const maxH = item.maxH ?? Infinity;

    this.resizeManager = new ResizeManager(this.el, {
      onResizeStart: (handle, size, e) => this.handleResizeStart(handle, size, e),
      onResize: (handle, size, e) => this.handleResize(handle, size, e),
      onResizeStop: (handle, _size, e) => this.handleResizeStop(handle, e),
    }, {
      handles,
      scale: this.config.positionStrategy.scale,
      classPrefix: this.config.classPrefix,
      minWidth: calcGridItemWHPx(minW, colWidth, pp.margin[0]),
      minHeight: calcGridItemWHPx(minH, pp.rowHeight, pp.margin[1]),
      maxWidth: Number.isFinite(maxW) ? calcGridItemWHPx(maxW, colWidth, pp.margin[0]) : undefined,
      maxHeight: Number.isFinite(maxH) ? calcGridItemWHPx(maxH, pp.rowHeight, pp.margin[1]) : undefined,
    });
  }

  private handleDragStart(_data: DragData, e: Event): void {
    const pp = this.config.positionParams;
    const pos = calcGridItemPosition(
      pp,
      this.layoutItem.x,
      this.layoutItem.y,
      this.layoutItem.w,
      this.layoutItem.h
    );

    this.startDragPos = { top: pos.top, left: pos.left };
    this.dragPosition = { top: pos.top, left: pos.left };
    this.cachedDimensions = { width: pos.width, height: pos.height };
    this.dragging = true;

    this.el.classList.add(`${this.config.classPrefix}-dragging`);
    this.el.style.transition = "none";

    const gridPos = this.toGridCoords(pos.top, pos.left);
    this.callbacks.onDragStart?.(this.id, gridPos.x, gridPos.y, e, this.el);
  }

  private handleDrag(data: DragData, e: Event): void {
    if (!this.dragging) return;

    let top = this.startDragPos.top + (data.y - data.lastY) + (this.dragPosition!.top - this.startDragPos.top);
    let left = this.startDragPos.left + (data.x - data.lastX) + (this.dragPosition!.left - this.startDragPos.left);

    if (this.config.isBounded || this.layoutItem.isBounded) {
      const pp = this.config.positionParams;
      const colWidth = calcGridColWidth(pp);
      const itemWidth = calcGridItemWHPx(this.layoutItem.w, colWidth, pp.margin[0]);
      left = Math.max(0, Math.min(left, pp.containerWidth - itemWidth));
      top = Math.max(0, top);
    }

    this.dragPosition = { top, left };

    const style = this.config.positionStrategy.calcStyle({
      top,
      left,
      width: this.cachedDimensions?.width ?? this.el.offsetWidth,
      height: this.cachedDimensions?.height ?? this.el.offsetHeight,
    });
    this.applyStyle(style);

    const gridPos = this.toGridCoords(top, left);
    this.callbacks.onDrag?.(this.id, gridPos.x, gridPos.y, e, this.el);
  }

  private handleDragStop(_data: DragData, e: Event): void {
    if (!this.dragging) return;
    this.dragging = false;
    this.cachedDimensions = null;
    this.el.classList.remove(`${this.config.classPrefix}-dragging`);
    this.el.style.transition = "";

    const gridPos = this.toGridCoords(
      this.dragPosition!.top,
      this.dragPosition!.left
    );
    this.dragPosition = null;

    this.callbacks.onDragStop?.(this.id, gridPos.x, gridPos.y, e, this.el);
  }

  private handleResizeStart(handle: ResizeHandleAxis, size: Position, e: Event): void {
    this.resizing = true;
    this.resizePosition = { ...size };

    this.el.classList.add(`${this.config.classPrefix}-resizing`);
    this.el.style.transition = "none";

    this.callbacks.onResizeStart?.(
      this.id,
      this.layoutItem.w,
      this.layoutItem.h,
      handle,
      e,
      this.el
    );
  }

  private handleResize(handle: ResizeHandleAxis, newSize: Position, e: Event): void {
    if (!this.resizing) return;

    const pp = this.config.positionParams;
    const currentPos = calcGridItemPosition(
      pp,
      this.layoutItem.x,
      this.layoutItem.y,
      this.layoutItem.w,
      this.layoutItem.h
    );

    const adjusted = resizeItemInDirection(
      handle,
      currentPos,
      newSize,
      pp.containerWidth
    );

    this.resizePosition = adjusted;

    const style = this.config.positionStrategy.calcStyle(adjusted);
    this.applyStyle(style);

    const gridSize = calcWHRaw(pp, adjusted.width, adjusted.height);

    const context: ConstraintContext = {
      cols: pp.cols,
      maxRows: pp.maxRows,
      containerWidth: pp.containerWidth,
      containerHeight: this.config.containerHeight,
      rowHeight: pp.rowHeight,
      margin: pp.margin,
      layout: this.config.layout,
    };

    const constrained = applySizeConstraints(
      this.config.constraints,
      this.layoutItem,
      gridSize.w,
      gridSize.h,
      handle,
      context
    );

    this.lastResizeSize = { w: constrained.w, h: constrained.h };
    this.callbacks.onResize?.(this.id, constrained.w, constrained.h, handle, e, this.el);
  }

  private handleResizeStop(handle: ResizeHandleAxis, e: Event): void {
    if (!this.resizing) return;
    this.resizing = false;
    this.resizePosition = null;

    const w = this.lastResizeSize?.w ?? this.layoutItem.w;
    const h = this.lastResizeSize?.h ?? this.layoutItem.h;
    this.lastResizeSize = null;

    this.el.classList.remove(`${this.config.classPrefix}-resizing`);
    this.el.style.transition = "";

    this.callbacks.onResizeStop?.(this.id, w, h, handle, e, this.el);
  }

  private toGridCoords(top: number, left: number): { x: number; y: number } {
    const pp = this.config.positionParams;
    const raw = calcXYRaw(pp, top, left);

    const context: ConstraintContext = {
      cols: pp.cols,
      maxRows: pp.maxRows,
      containerWidth: pp.containerWidth,
      containerHeight: this.config.containerHeight,
      rowHeight: pp.rowHeight,
      margin: pp.margin,
      layout: this.config.layout,
    };

    return applyPositionConstraints(
      this.config.constraints,
      this.layoutItem,
      raw.x,
      raw.y,
      context
    );
  }

  updateLayout(item: LayoutItem): void {
    const prevItem = this.layoutItem;
    this.layoutItem = item;

    if (prevItem.minW !== item.minW || prevItem.maxW !== item.maxW ||
        prevItem.minH !== item.minH || prevItem.maxH !== item.maxH) {
      this.syncResizeConstraints();
    }

    if (this.dragging || this.resizing) return;

    const pp = this.config.positionParams;
    const pos = calcGridItemPosition(pp, item.x, item.y, item.w, item.h);
    const style = this.config.positionStrategy.calcStyle(pos);
    this.applyStyle(style);
  }

  updateConfig(config: Partial<GridItemConfig>): void {
    const prev = this.config;

    const strategyChanged = config.positionStrategy !== undefined &&
      config.positionStrategy !== prev.positionStrategy;

    const dragChanged = strategyChanged ||
      (config.isDraggable !== undefined && config.isDraggable !== prev.isDraggable) ||
      (config.dragHandle !== undefined && config.dragHandle !== prev.dragHandle) ||
      (config.dragCancel !== undefined && config.dragCancel !== prev.dragCancel) ||
      (config.dragThreshold !== undefined && config.dragThreshold !== prev.dragThreshold);

    const handlesChanged = config.resizeHandles !== undefined &&
      !arraysEqual(config.resizeHandles, prev.resizeHandles);

    const resizeChanged = strategyChanged ||
      (config.isResizable !== undefined && config.isResizable !== prev.isResizable) ||
      handlesChanged;

    Object.assign(this.config, config);

    if (dragChanged) {
      if (this.dragManager) {
        const canDrag =
          this.config.isDraggable &&
          this.layoutItem.isDraggable !== false &&
          !this.layoutItem.static;
        if (!canDrag) {
          this.destroyDrag();
        } else {
          const p = this.config.classPrefix;
          this.dragManager.updateOptions({
            handle: this.config.dragHandle,
            cancel: this.config.dragCancel
              ? `.${p}-resizable-handle,${this.config.dragCancel}`
              : `.${p}-resizable-handle`,
            scale: this.config.positionStrategy.scale,
            threshold: this.config.dragThreshold,
          });
        }
      } else {
        this.setupDrag();
      }
    }

    if (resizeChanged) {
      this.destroyResize();
      this.setupResize();
    }

    this.syncResizeConstraints();
  }

  private syncResizeConstraints(): void {
    if (!this.resizeManager) return;
    const pp = this.config.positionParams;
    const colWidth = calcGridColWidth(pp);
    const item = this.layoutItem;

    const minW = item.minW ?? 1;
    const minH = item.minH ?? 1;
    const maxW = item.maxW ?? Infinity;
    const maxH = item.maxH ?? Infinity;

    this.resizeManager.updateConstraints({
      minWidth: calcGridItemWHPx(minW, colWidth, pp.margin[0]),
      minHeight: calcGridItemWHPx(minH, pp.rowHeight, pp.margin[1]),
      maxWidth: Number.isFinite(maxW)
        ? calcGridItemWHPx(maxW, colWidth, pp.margin[0])
        : undefined,
      maxHeight: Number.isFinite(maxH)
        ? calcGridItemWHPx(maxH, pp.rowHeight, pp.margin[1])
        : undefined,
    });
  }

  private applyStyle(style: Record<string, string>): void {
    for (const key of Object.keys(style)) {
      (this.el.style as any)[key] = style[key];
    }
  }

  private destroyDrag(): void {
    if (this.dragManager) {
      this.dragManager.destroy();
      this.dragManager = null;
      this.el.classList.remove(`${this.config.classPrefix}-draggable`);
    }
  }

  private destroyResize(): void {
    if (this.resizeManager) {
      this.resizeManager.destroy();
      this.resizeManager = null;
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    this.destroyDrag();
    this.destroyResize();
    const p = this.config.classPrefix;
    this.el.classList.remove(`${p}-item`, `${p}-css-transforms`, `${p}-static`, `${p}-draggable`, `${p}-resizable-hide`);
  }
}

function calcWHRaw(
  pp: PositionParams,
  width: number,
  height: number
): { w: number; h: number } {
  const colWidth = calcGridColWidth(pp);
  const w = Math.max(1, Math.round((width + pp.margin[0]) / (colWidth + pp.margin[0])));
  const h = Math.max(1, Math.round((height + pp.margin[1]) / (pp.rowHeight + pp.margin[1])));
  return { w, h };
}

function arraysEqual(
  a: readonly ResizeHandleAxis[],
  b: readonly ResizeHandleAxis[]
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
