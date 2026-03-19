import type {
  Layout,
  LayoutItem,
  Compactor,
  PositionStrategy,
  LayoutConstraint,
  ResizeHandleAxis,
  GridConfig,
  DragConfig,
  ResizeConfig,
  DropConfig,
  Mutable,
  GridLayoutEventMap,
} from "../core/types.js";
import {
  defaultGridConfig,
  defaultDragConfig,
  defaultResizeConfig,
  defaultDropConfig,
} from "../core/types.js";
import {
  calcGridItemPosition,
  calcGridColWidth,
  calcGridItemWHPx,
  calcXY,
  type PositionParams,
} from "../core/calculate.js";
import {
  bottom,
  getLayoutItem,
  cloneLayout,
  cloneLayoutItem,
  withLayoutItem,
  moveElement,
  validateLayout,
} from "../core/layout.js";
import { getAllCollisions } from "../core/collision.js";
import { verticalCompactor, getCompactor } from "../core/compactors.js";
import { defaultConstraints } from "../core/constraints.js";
import { transformStrategy } from "../core/position.js";
import { EventEmitter } from "./event-emitter.js";
import { GridItemManager } from "./grid-item.js";
import type { GridItemConfig } from "./grid-item.js";
import { injectStyles } from "./inject-styles.js";

export const DROPPING_SENTINEL = "__dropping-elem__";

function asMut(layout: Layout): LayoutItem[] {
  return layout as LayoutItem[];
}

export interface GridLayoutOptions {
  layout: LayoutItem[];
  gridConfig?: Partial<GridConfig>;
  dragConfig?: Partial<DragConfig>;
  resizeConfig?: Partial<ResizeConfig>;
  dropConfig?: Partial<DropConfig>;
  compactor?: Compactor | string;
  positionStrategy?: PositionStrategy;
  constraints?: LayoutConstraint[];
  autoSize?: boolean;
  className?: string;
  classPrefix?: string;
  interactionThrottleMs?: number;
}

export interface InteractionStats {
  renderAllCalls: number;
  renderChangedCalls: number;
  managerConfigUpdates: number;
  interactionFrames: number;
}

export class GridLayout extends EventEmitter<GridLayoutEventMap> {
  readonly container: HTMLElement;
  private layout: LayoutItem[] = [];
  private gridConfig: GridConfig;
  private dragConfig: DragConfig;
  private resizeConfig: ResizeConfig;
  private dropConfig: DropConfig;
  private compactor: Compactor;
  private positionStrategy: PositionStrategy;
  private constraints: LayoutConstraint[];
  private autoSize: boolean;
  private items: Map<string, GridItemManager> = new Map();
  private placeholder: HTMLElement | null = null;
  private activeDrag: LayoutItem | null = null;
  private oldLayout: Layout | null = null;
  private oldItem: LayoutItem | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private containerWidth: number = 0;
  
  private layoutMap: Map<string, number> = new Map();
  private prevInteractionLayout: Layout | null = null;
  private classPrefix: string;
  private className: string | undefined;
  private interactionThrottleMs: number;
  private lastDragTime = 0;
  private lastResizeTime = 0;
  private interacting = false;
  private dragEnterCounter = 0;
  private destroyed = false;
  private rafId: number | null = null;
  private stats: InteractionStats = { renderAllCalls: 0, renderChangedCalls: 0, managerConfigUpdates: 0, interactionFrames: 0 };

  constructor(container: HTMLElement, opts: GridLayoutOptions) {
    super();
    this.container = container;

    this.gridConfig = { ...defaultGridConfig, ...opts.gridConfig };
    this.dragConfig = { ...defaultDragConfig, ...opts.dragConfig };
    this.resizeConfig = { ...defaultResizeConfig, ...opts.resizeConfig };
    this.dropConfig = { ...defaultDropConfig, ...opts.dropConfig };
    this.autoSize = opts.autoSize ?? true;
    this.constraints = opts.constraints ?? defaultConstraints;
    this.positionStrategy = opts.positionStrategy ?? transformStrategy;

    if (typeof opts.compactor === "string") {
      this.compactor = getCompactor(opts.compactor as any);
    } else {
      this.compactor = opts.compactor ?? verticalCompactor;
    }

    this.classPrefix = opts.classPrefix ?? "grid";
    this.className = opts.className;
    this.interactionThrottleMs = opts.interactionThrottleMs ?? 0;

    this.container.classList.add(`${this.classPrefix}-layout`);
    if (opts.className) this.container.classList.add(opts.className);
    this.container.style.position = "relative";

    this.containerWidth = this.container.clientWidth;

    const initial = opts.layout.map((item) => cloneLayoutItem(item));
    validateLayout(initial);
    this.setLayoutInternal(asMut(this.compactor.compact(initial, this.gridConfig.cols)));

    this.setupResizeObserver();
    this.setupDropZone();
    this.renderAllItems();
    this.updateContainerHeight();

    this.emit("layoutChange", this.getLayout());
  }

  private rebuildLayoutMap(): void {
    this.layoutMap.clear();
    for (let i = 0; i < this.layout.length; i++) {
      const item = this.layout[i];
      if (item !== undefined) this.layoutMap.set(item.i, i);
    }
  }

  private getLayoutItemFast(id: string): LayoutItem | undefined {
    const idx = this.layoutMap.get(id);
    if (idx === undefined) return undefined;
    const item = this.layout[idx];
    if (item !== undefined && item.i === id) return item;
    return getLayoutItem(this.layout, id);
  }

  private setLayoutInternal(layout: LayoutItem[]): void {
    this.layout = layout;
    this.rebuildLayoutMap();
  }

  private renderChangedItems(): void {
    this.stats.renderChangedCalls++;
    const config = this.getItemConfig();
    const prev = this.prevInteractionLayout;

    if (!prev || prev.length !== this.layout.length) {
      this.renderAllItems();
      this.prevInteractionLayout = this.layout;
      return;
    }

    for (let i = 0; i < this.layout.length; i++) {
      const cur = this.layout[i];
      const old = prev[i];
      if (!cur || !old) continue;
      if (cur.x !== old.x || cur.y !== old.y || cur.w !== old.w || cur.h !== old.h) {
        const manager = this.items.get(cur.i);
        if (manager) {
          this.stats.managerConfigUpdates++;
          manager.updateConfig(config);
          manager.updateLayout(cur);
        }
      }
    }
    this.prevInteractionLayout = this.layout;
  }

  private getPositionParams(): PositionParams {
    const gc = this.gridConfig;
    return {
      cols: gc.cols,
      containerWidth: this.containerWidth,
      containerPadding: gc.containerPadding ?? gc.margin,
      margin: gc.margin,
      rowHeight: gc.rowHeight,
      maxRows: gc.maxRows,
    };
  }

  private setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver((entries) => {
      if (this.rafId !== null) cancelAnimationFrame(this.rafId);
      this.rafId = requestAnimationFrame(() => {
        this.rafId = null;
        const entry = entries[0];
        if (!entry) return;
        const newWidth = entry.contentRect.width;
        if (Math.abs(newWidth - this.containerWidth) < 1) return;
        this.containerWidth = newWidth;
        this.renderAllItems();
        this.updateContainerHeight();
        this.emit("widthChange", newWidth);
      });
    });
    this.resizeObserver.observe(this.container);
  }

  private setupDropZone(): void {
    if (!this.dropConfig.enabled) return;

    this.container.addEventListener("dragenter", this.handleDragEnter);
    this.container.addEventListener("dragleave", this.handleDragLeave);
    this.container.addEventListener("dragover", this.handleDragOver);
    this.container.addEventListener("drop", this.handleDrop);
  }

  private teardownDropZone(): void {
    this.container.removeEventListener("dragenter", this.handleDragEnter);
    this.container.removeEventListener("dragleave", this.handleDragLeave);
    this.container.removeEventListener("dragover", this.handleDragOver);
    this.container.removeEventListener("drop", this.handleDrop);
    this.dragEnterCounter = 0;
  }

  private handleDragEnter = (e: DragEvent): void => {
    e.preventDefault();
    this.dragEnterCounter++;
  };

  private handleDragLeave = (e: DragEvent): void => {
    e.preventDefault();
    this.dragEnterCounter = Math.max(0, this.dragEnterCounter - 1);
    if (this.dragEnterCounter === 0) {
      this.removeDroppingPlaceholder();
    }
  };

  private handleDragOver = (e: DragEvent): void => {
    e.preventDefault();
    e.dataTransfer!.dropEffect = "move";

    let dropItem = this.dropConfig.defaultItem;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    if (this.dropConfig.onDragOver) {
      const result = this.dropConfig.onDragOver(e);
      if (result === false) {
        this.removeDroppingPlaceholder();
        return;
      }
      if (result) {
        const { dragOffsetX: ox = 0, dragOffsetY: oy = 0, w, h } = result;
        dragOffsetX = ox;
        dragOffsetY = oy;
        if (w !== undefined) dropItem = { ...dropItem, w };
        if (h !== undefined) dropItem = { ...dropItem, h };
      }
    }

    const pp = this.getPositionParams();
    const rect = this.container.getBoundingClientRect();

    const colWidth = calcGridColWidth(pp);
    const itemPixelW = calcGridItemWHPx(dropItem.w, colWidth, pp.margin[0]);
    const itemPixelH = calcGridItemWHPx(dropItem.h, pp.rowHeight, pp.margin[1]);

    const rawLeft = e.clientX - rect.left + dragOffsetX - itemPixelW / 2;
    const rawTop = e.clientY - rect.top + dragOffsetY - itemPixelH / 2;
    const mouseLeft = Math.max(0, rawLeft);
    const mouseTop = Math.max(0, rawTop);

    const { x, y } = calcXY(
      pp, mouseTop, mouseLeft, dropItem.w, dropItem.h
    );

    const droppingId = DROPPING_SENTINEL;
    const existing = this.getLayoutItemFast(droppingId);

    if (!existing) {
      const newItem: LayoutItem = {
        i: droppingId,
        x,
        y,
        w: dropItem.w,
        h: dropItem.h,
      };
      this.setLayoutInternal([...this.layout, newItem]);
    } else {
      if (existing.x !== x || existing.y !== y) {
        const [newLayout] = withLayoutItem(this.layout, droppingId, (item) => ({
          ...item,
          x,
          y,
        }));
        this.setLayoutInternal(asMut(this.compactor.compact(newLayout, this.gridConfig.cols)));
      }
    }

    this.showDropPlaceholder(x, y, dropItem.w, dropItem.h);
  };

  private handleDrop = (e: DragEvent): void => {
    e.preventDefault();
    this.dragEnterCounter = 0;

    const droppingId = DROPPING_SENTINEL;
    const droppedItem = this.getLayoutItemFast(droppingId);

    this.setLayoutInternal(this.layout.filter((item) => item.i !== droppingId));
    this.removePlaceholder();

    if (!droppedItem) return;

    this.emit("drop", this.getLayout(), { ...droppedItem, i: "" }, e);
  };

  private showDropPlaceholder(
    x: number,
    y: number,
    w: number,
    h: number
  ): void {
    if (!this.placeholder) {
      this.placeholder = document.createElement("div");
      this.placeholder.className = `${this.classPrefix}-item ${this.classPrefix}-placeholder`;
      this.container.appendChild(this.placeholder);
    }
    const pp = this.getPositionParams();
    const pos = calcGridItemPosition(pp, x, y, w, h);
    const style = this.positionStrategy.calcStyle(pos);
    for (const key of Object.keys(style)) {
      (this.placeholder.style as any)[key] = style[key];
    }
  }

  private removeDroppingPlaceholder(): void {
    const droppingId = DROPPING_SENTINEL;
    const hasDropping = this.getLayoutItemFast(droppingId);
    if (!hasDropping && !this.placeholder) return;
    this.setLayoutInternal(this.layout.filter((item) => item.i !== droppingId));
    this.removePlaceholder();
  }

  addItem(el: HTMLElement, layoutItem: LayoutItem): void {
    if (layoutItem.i === DROPPING_SENTINEL) {
      throw new Error(`Item ID "${DROPPING_SENTINEL}" is reserved for internal drop handling.`);
    }
    if (this.items.has(layoutItem.i)) {
      this.removeItem(layoutItem.i);
    }

    const existing = this.getLayoutItemFast(layoutItem.i);
    if (!existing) {
      const item = cloneLayoutItem(layoutItem);
      this.setLayoutInternal([...this.layout, item]);
      this.setLayoutInternal(asMut(this.compactor.compact(this.layout, this.gridConfig.cols)));
    }

    const updatedItem = this.getLayoutItemFast(layoutItem.i);
    if (!updatedItem) return;

    this.createItemManager(el, updatedItem);
    this.updateContainerHeight();
    this.emit("layoutChange", this.getLayout());
  }

  attachElement(id: string, el: HTMLElement): void {
    if (this.items.has(id)) return;

    const item = this.getLayoutItemFast(id);
    if (!item) return;

    this.createItemManager(el, item);
  }

  private createItemManager(el: HTMLElement, item: LayoutItem): void {
    if (!this.container.contains(el)) {
      this.container.appendChild(el);
    }

    const manager = new GridItemManager(el, item, this.getItemConfig(), {
      onDragStart: (id, x, y, e, node) => this.onItemDragStart(id, x, y, e, node),
      onDrag: (id, x, y, e, node) => this.onItemDrag(id, x, y, e, node),
      onDragStop: (id, x, y, e, node) => this.onItemDragStop(id, x, y, e, node),
      onResizeStart: (id, w, h, handle, e, node) => this.onItemResizeStart(id, w, h, handle, e, node),
      onResize: (id, w, h, handle, e, node) => this.onItemResize(id, w, h, handle, e, node),
      onResizeStop: (id, w, h, handle, e, node) => this.onItemResizeStop(id, w, h, handle, e, node),
    });

    manager.updateLayout(item);
    this.items.set(item.i, manager);
  }

  removeItem(id: string): void {
    if (id === DROPPING_SENTINEL) return;
    const manager = this.items.get(id);
    if (manager) {
      if (manager.el.parentNode === this.container) {
        this.container.removeChild(manager.el);
      }
      manager.destroy();
      this.items.delete(id);
    }

    this.setLayoutInternal(this.layout.filter((item) => item.i !== id));
    this.setLayoutInternal(asMut(this.compactor.compact(this.layout, this.gridConfig.cols)));
    this.renderAllItems();
    this.updateContainerHeight();
    this.emit("layoutChange", this.getLayout());
  }

  private getItemConfig(): GridItemConfig {
    return {
      positionParams: this.getPositionParams(),
      positionStrategy: this.positionStrategy,
      constraints: this.constraints,
      isDraggable: this.dragConfig.enabled,
      isResizable: this.resizeConfig.enabled,
      isBounded: this.dragConfig.bounded,
      resizeHandles: this.resizeConfig.handles,
      dragHandle: this.dragConfig.handle,
      dragCancel: this.dragConfig.cancel,
      dragThreshold: this.dragConfig.threshold,
      classPrefix: this.classPrefix,
      layout: this.layout,
      containerHeight: this.container.clientHeight,
    };
  }

  private onItemDragStart(id: string, x: number, y: number, e: Event, node: HTMLElement): void {
    this.interacting = true;
    this.oldLayout = cloneLayout(this.layout);
    this.prevInteractionLayout = this.layout;
    const item = this.getLayoutItemFast(id);
    if (item) this.oldItem = cloneLayoutItem(item);
    this.activeDrag = item ? { ...cloneLayoutItem(item), x, y } : null;

    if (this.activeDrag) {
      this.showPlaceholder(this.activeDrag);
    }

    this.emit("dragStart", this.getLayout(), this.oldItem, item ?? null, null, e, node);
  }

  private onItemDrag(id: string, x: number, y: number, e: Event, node: HTMLElement): void {
    this.stats.interactionFrames++;
    if (this.interactionThrottleMs > 0) {
      const now = performance.now();
      if (now - this.lastDragTime < this.interactionThrottleMs) return;
      this.lastDragTime = now;
    }

    const item = this.getLayoutItemFast(id);
    if (!item) return;

    const placeholder = this.activeDrag;
    if (!placeholder) return;

    const cols = this.gridConfig.cols;
    const compactType = this.compactor.type;

    let newLayout = moveElement(
      this.layout,
      item,
      x,
      y,
      true,
      this.compactor.preventCollision,
      compactType,
      cols,
      this.compactor.allowOverlap
    );

    newLayout = asMut(this.compactor.compact(newLayout, cols));
    this.setLayoutInternal(newLayout);

    (placeholder as Mutable<LayoutItem>).x = x;
    (placeholder as Mutable<LayoutItem>).y = y;
    this.activeDrag = placeholder;

    this.renderChangedItems();
    this.showPlaceholder(placeholder);
    this.updateContainerHeight();

    this.emit("drag", this.getLayout(), this.oldItem, item, placeholder, e, node);
  }

  private onItemDragStop(id: string, x: number, y: number, e: Event, node: HTMLElement): void {
    this.lastDragTime = 0;
    this.interacting = false;
    this.prevInteractionLayout = null;
    const item = this.getLayoutItemFast(id);
    if (!item) return;

    const cols = this.gridConfig.cols;
    const compactType = this.compactor.type;

    let newLayout = moveElement(
      this.layout,
      item,
      x,
      y,
      true,
      this.compactor.preventCollision,
      compactType,
      cols,
      this.compactor.allowOverlap
    );

    newLayout = asMut(this.compactor.compact(newLayout, cols));
    this.setLayoutInternal(newLayout);

    this.activeDrag = null;
    this.removePlaceholder();
    this.renderAllItems();
    this.updateContainerHeight();

    const layoutChanged = !layoutsEqual(this.layout, this.oldLayout || []);
    const oldItem = this.oldItem;
    this.oldLayout = null;
    this.oldItem = null;

    if (layoutChanged) {
      this.emit("layoutChange", this.getLayout());
    }

    this.emit("dragStop", this.getLayout(), oldItem, item, null, e, node);
  }

  private onItemResizeStart(
    id: string,
    _w: number,
    _h: number,
    _handle: ResizeHandleAxis,
    e: Event,
    node: HTMLElement
  ): void {
    this.interacting = true;
    this.oldLayout = cloneLayout(this.layout);
    this.prevInteractionLayout = this.layout;
    const item = this.getLayoutItemFast(id);
    if (item) {
      this.oldItem = cloneLayoutItem(item);
      this.activeDrag = cloneLayoutItem(item);
      this.showPlaceholder(item);
    }

    this.emit("resizeStart", this.getLayout(), this.oldItem, item ?? null, null, e, node);
  }

  private onItemResize(
    id: string,
    w: number,
    h: number,
    handle: ResizeHandleAxis,
    e: Event,
    node: HTMLElement
  ): void {
    this.stats.interactionFrames++;
    if (this.interactionThrottleMs > 0) {
      const now = performance.now();
      if (now - this.lastResizeTime < this.interactionThrottleMs) return;
      this.lastResizeTime = now;
    }

    const cols = this.gridConfig.cols;

    let shouldMoveItem = false;
    let moveX: number | undefined;
    let moveY: number | undefined;

    const [newLayout, updatedItem] = withLayoutItem(
      this.layout,
      id,
      (item) => {
        let newW = w;
        let newH = h;

        newW = Math.min(newW, cols - item.x);

        moveX = item.x;
        moveY = item.y;

        if (handle === "sw" || handle === "w" || handle === "nw") {
          moveX = item.x + (item.w - newW);
          if (moveX < 0) {
            newW = item.w;
            moveX = item.x;
          }
          shouldMoveItem = true;
        }
        if (handle === "nw" || handle === "n" || handle === "ne") {
          moveY = item.y + (item.h - newH);
          if (moveY < 0) {
            newH = item.h;
            moveY = item.y;
          }
          shouldMoveItem = true;
        }

        if (this.compactor.preventCollision && !this.compactor.allowOverlap) {
          const proposed = {
            ...item,
            w: newW,
            h: newH,
            x: moveX ?? item.x,
            y: moveY ?? item.y,
          };
          const collisions = getAllCollisions(this.layout, proposed)
            .filter(c => c.i !== item.i);

          if (collisions.length > 0) {
            moveY = item.y;
            newH = item.h;
            moveX = item.x;
            newW = item.w;
            shouldMoveItem = false;
          }
        }

        return { ...item, w: newW, h: newH };
      }
    );

    if (!updatedItem) return;

    let finalLayout: LayoutItem[] = newLayout;

    if (shouldMoveItem && moveX !== undefined && moveY !== undefined) {
      finalLayout = moveElement(
        finalLayout,
        updatedItem,
        moveX,
        moveY,
        true,
        this.compactor.preventCollision,
        this.compactor.type,
        cols,
        this.compactor.allowOverlap
      );
    }

    finalLayout = asMut(this.compactor.compact(finalLayout, cols));
    this.setLayoutInternal(finalLayout);

    this.activeDrag = updatedItem;
    this.showPlaceholder(updatedItem);
    this.renderChangedItems();
    this.updateContainerHeight();

    this.emit("resize", this.getLayout(), this.oldItem, updatedItem, updatedItem, e, node);
  }

  private onItemResizeStop(
    id: string,
    _w: number,
    _h: number,
    _handle: ResizeHandleAxis,
    e: Event,
    node: HTMLElement
  ): void {
    this.lastResizeTime = 0;
    this.interacting = false;
    this.prevInteractionLayout = null;
    this.setLayoutInternal(asMut(this.compactor.compact(this.layout, this.gridConfig.cols)));
    this.activeDrag = null;
    this.removePlaceholder();
    this.renderAllItems();
    this.updateContainerHeight();

    const layoutChanged = !layoutsEqual(this.layout, this.oldLayout || []);
    const item = this.getLayoutItemFast(id);
    this.oldLayout = null;

    if (layoutChanged) {
      this.emit("layoutChange", this.getLayout());
    }

    this.emit("resizeStop", this.getLayout(), this.oldItem, item ?? null, null, e, node);
    this.oldItem = null;
  }

  private showPlaceholder(item: LayoutItem): void {
    if (!this.placeholder) {
      this.placeholder = document.createElement("div");
      this.placeholder.className = `${this.classPrefix}-item ${this.classPrefix}-placeholder`;
      this.container.appendChild(this.placeholder);
    }

    if (this.interacting && this.activeDrag) {
      const isResizing = this.items.get(item.i) !== undefined &&
        (this.activeDrag.w !== item.w || this.activeDrag.h !== item.h);
      this.placeholder.classList.toggle(
        `${this.classPrefix}-placeholder-resizing`,
        isResizing
      );
    }

    const pp = this.getPositionParams();
    const pos = calcGridItemPosition(pp, item.x, item.y, item.w, item.h);
    const style = this.positionStrategy.calcStyle(pos);
    for (const key of Object.keys(style)) {
      (this.placeholder.style as any)[key] = style[key];
    }
  }

  private removePlaceholder(): void {
    if (this.placeholder && this.placeholder.parentNode) {
      this.placeholder.parentNode.removeChild(this.placeholder);
      this.placeholder = null;
    }
  }

  private renderAllItems(): void {
    this.stats.renderAllCalls++;
    const config = this.getItemConfig();

    for (const [id, manager] of this.items) {
      const item = this.getLayoutItemFast(id);
      if (item) {
        this.stats.managerConfigUpdates++;
        manager.updateConfig(config);
        manager.updateLayout(item);
      }
    }
  }

  private updateContainerHeight(): void {
    if (!this.autoSize) return;

    const pp = this.getPositionParams();
    const nbRow = bottom(this.layout);
    const height =
      nbRow * pp.rowHeight +
      (nbRow - 1) * pp.margin[1] +
      (pp.containerPadding[1]) * 2;

    this.container.style.height = `${Math.max(height, 0)}px`;
  }

  getLayout(): LayoutItem[] {
    return cloneLayout(this.layout).filter((item) => item.i !== DROPPING_SENTINEL);
  }

  setLayout(layout: LayoutItem[]): void {
    const oldLayout = this.layout;
    const newLayout = layout.map((item) => cloneLayoutItem(item));
    validateLayout(newLayout);
    this.setLayoutInternal(asMut(this.compactor.compact(newLayout, this.gridConfig.cols)));
    this.renderAllItems();
    this.updateContainerHeight();
    if (!layoutsEqual(this.layout, oldLayout)) {
      this.emit("layoutChange", this.getLayout());
    }
  }

  updateItem(id: string, updates: Partial<LayoutItem>): void {
    if (id === DROPPING_SENTINEL) return;
    const oldLayout = this.layout;
    const [newLayout, item] = withLayoutItem(this.layout, id, (existing) => ({
      ...existing,
      ...updates,
    }));

    if (!item) return;

    this.setLayoutInternal(asMut(this.compactor.compact(newLayout, this.gridConfig.cols)));
    this.renderAllItems();
    this.updateContainerHeight();
    if (!layoutsEqual(this.layout, oldLayout)) {
      this.emit("layoutChange", this.getLayout());
    }
  }

  setOptions(opts: Partial<GridLayoutOptions>): void {
    let needsRelayout = false;

    if (opts.gridConfig) {
      const oldCols = this.gridConfig.cols;
      Object.assign(this.gridConfig, opts.gridConfig);
      if (this.gridConfig.cols !== oldCols) needsRelayout = true;
    }

    if (opts.dragConfig) Object.assign(this.dragConfig, opts.dragConfig);
    if (opts.resizeConfig) Object.assign(this.resizeConfig, opts.resizeConfig);
    if (opts.dropConfig) {
      const wasEnabled = this.dropConfig.enabled;
      Object.assign(this.dropConfig, opts.dropConfig);
      const isEnabled = this.dropConfig.enabled;
      if (!wasEnabled && isEnabled) this.setupDropZone();
      if (wasEnabled && !isEnabled) this.teardownDropZone();
    }
    if (opts.positionStrategy) this.positionStrategy = opts.positionStrategy;
    if (opts.constraints) this.constraints = opts.constraints;
    if (opts.autoSize !== undefined) this.autoSize = opts.autoSize;

    if (opts.classPrefix !== undefined && opts.classPrefix !== this.classPrefix) {
      const oldPrefix = this.classPrefix;
      this.classPrefix = opts.classPrefix;
      this.container.classList.remove(`${oldPrefix}-layout`);
      this.container.classList.add(`${this.classPrefix}-layout`);
      needsRelayout = true;
    }

    if (opts.className !== undefined && opts.className !== this.className) {
      if (this.className) this.container.classList.remove(this.className);
      if (opts.className) this.container.classList.add(opts.className);
      this.className = opts.className;
    }

    if (opts.interactionThrottleMs !== undefined) {
      this.interactionThrottleMs = opts.interactionThrottleMs;
    }

    if (opts.compactor) {
      if (typeof opts.compactor === "string") {
        this.compactor = getCompactor(opts.compactor as any);
      } else {
        this.compactor = opts.compactor;
      }
      needsRelayout = true;
    }

    if (needsRelayout) {
      const oldLayout = this.layout;
      this.setLayoutInternal(asMut(this.compactor.compact(this.layout, this.gridConfig.cols)));
      if (!layoutsEqual(this.layout, oldLayout)) {
        this.emit("layoutChange", this.getLayout());
      }
    }

    this.renderAllItems();
    this.updateContainerHeight();
  }

  getContainerWidth(): number {
    return this.containerWidth;
  }

  getInteractionStats(): InteractionStats {
    return { ...this.stats };
  }

  resetInteractionStats(): void {
    this.stats = { renderAllCalls: 0, renderChangedCalls: 0, managerConfigUpdates: 0, interactionFrames: 0 };
  }

  static injectStyles(classPrefix: string = "grid"): void {
    injectStyles(classPrefix);
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    for (const [, manager] of this.items) manager.destroy();
    this.items.clear();

    this.removePlaceholder();

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    this.teardownDropZone();

    this.container.classList.remove(`${this.classPrefix}-layout`);
    this.container.style.position = "";
    this.container.style.height = "";

    this.removeAllListeners();
  }
}

function layoutsEqual(a: Layout, b: Layout): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ai = a[i];
    const bi = b[i];
    if (!ai || !bi) return false;
    if (ai.x !== bi.x || ai.y !== bi.y || ai.w !== bi.w || ai.h !== bi.h) return false;
  }
  return true;
}
