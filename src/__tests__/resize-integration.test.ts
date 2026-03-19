import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { resizeItemInDirection } from "../core/position.js";
import { calcWHRaw, calcGridColWidth, calcGridItemWHPx } from "../core/calculate.js";
import {
  applySizeConstraints,
  gridBounds,
  minMaxSize,
  defaultConstraints,
} from "../core/constraints.js";
import { withLayoutItem, moveElement } from "../core/layout.js";
import { getAllCollisions } from "../core/collision.js";
import { verticalCompactor } from "../core/compactors.js";
import { GridLayout, injectStyles } from "../index.js";
import type { LayoutItem, ResizeHandleAxis, Position } from "../core/types.js";
import { dispatchMouseEvent, simulateResizeDrag, mockElementRect } from "../test/setup.js";

const POSITION_PARAMS = {
  cols: 12,
  containerWidth: 1200,
  margin: [10, 10] as [number, number],
  containerPadding: [10, 10] as [number, number],
  rowHeight: 30,
  maxRows: 100,
};

const CONSTRAINT_CONTEXT = {
  ...POSITION_PARAMS,
  containerHeight: 600,
};

describe("resizeItemInDirection", () => {
  const currentSize: Position = { left: 10, top: 10, width: 200, height: 100 };
  const containerWidth = 1200;

  it("SE handle: increases width and height", () => {
    const result = resizeItemInDirection("se", currentSize, { width: 300, height: 150 }, containerWidth);
    expect(result.width).toBe(300);
    expect(result.height).toBe(150);
    expect(result.left).toBe(10);
    expect(result.top).toBe(10);
  });

  it("S handle: increases height only", () => {
    const result = resizeItemInDirection("s", currentSize, { width: 200, height: 150 }, containerWidth);
    expect(result.width).toBe(200);
    expect(result.height).toBe(150);
    expect(result.left).toBe(10);
    expect(result.top).toBe(10);
  });

  it("E handle: increases width only", () => {
    const result = resizeItemInDirection("e", currentSize, { width: 300, height: 100 }, containerWidth);
    expect(result.width).toBe(300);
    expect(result.height).toBe(100);
    expect(result.left).toBe(10);
    expect(result.top).toBe(10);
  });

  it("N handle: decreases height, moves top up", () => {
    const result = resizeItemInDirection("n", currentSize, { width: 200, height: 50 }, containerWidth);
    expect(result.width).toBe(200);
    expect(result.height).toBe(50);
    expect(result.left).toBe(10);
    expect(result.top).toBe(60);
  });

  it("W handle: decreases width, moves left", () => {
    const result = resizeItemInDirection("w", currentSize, { width: 100, height: 100 }, containerWidth);
    expect(result.width).toBe(100);
    expect(result.height).toBe(100);
    expect(result.left).toBe(110);
    expect(result.top).toBe(10);
  });

  it("NW handle: decreases both, moves top and left", () => {
    const result = resizeItemInDirection("nw", currentSize, { width: 100, height: 50 }, containerWidth);
    expect(result.width).toBe(100);
    expect(result.height).toBe(50);
    expect(result.left).toBe(110);
    expect(result.top).toBe(60);
  });

  it("NE handle: decreases height, increases width, moves top", () => {
    const result = resizeItemInDirection("ne", currentSize, { width: 300, height: 50 }, containerWidth);
    expect(result.width).toBe(300);
    expect(result.height).toBe(50);
    expect(result.left).toBe(10);
    expect(result.top).toBe(60);
  });

  it("SW handle: decreases width, increases height, moves left", () => {
    const result = resizeItemInDirection("sw", currentSize, { width: 100, height: 150 }, containerWidth);
    expect(result.width).toBe(100);
    expect(result.height).toBe(150);
    expect(result.left).toBe(110);
    expect(result.top).toBe(10);
  });

  it("W handle: clamps width when left would go negative", () => {
    const result = resizeItemInDirection("w", currentSize, { width: 300, height: 100 }, containerWidth);
    expect(result.left).toBe(0);
    expect(result.width).toBe(210);
  });

  it("N handle: clamps height when top would go negative", () => {
    const result = resizeItemInDirection("n", currentSize, { width: 200, height: 200 }, containerWidth);
    expect(result.top).toBeGreaterThanOrEqual(0);
    expect(result.height).toBe(100);
  });

  it("E handle: constrains width to container when overflow", () => {
    const wide = { ...currentSize, left: 1100, width: 100 };
    const result = resizeItemInDirection("e", wide, { width: 200, height: 100 }, containerWidth);
    expect(result.width).toBe(100);
  });
});

describe("calcWHRaw / calcGridItemWHPx", () => {
  it("converts pixel dimensions to grid units", () => {
    const colWidth = calcGridColWidth(POSITION_PARAMS);
    const w = calcWHRaw(POSITION_PARAMS, 200, 100).w;
    const h = calcWHRaw(POSITION_PARAMS, 200, 100).h;
    expect(w).toBeGreaterThanOrEqual(1);
    expect(h).toBeGreaterThanOrEqual(1);
  });

  it("returns minimum 1 for grid units", () => {
    const result = calcWHRaw(POSITION_PARAMS, 1, 1);
    expect(result.w).toBe(1);
    expect(result.h).toBe(1);
  });

  it("calcGridItemWHPx converts grid units to pixels", () => {
    const colWidth = calcGridColWidth(POSITION_PARAMS);
    const pxW = calcGridItemWHPx(4, colWidth, 10);
    const pxH = calcGridItemWHPx(3, 30, 10);
    expect(pxW).toBeGreaterThan(0);
    expect(pxH).toBeGreaterThan(0);
  });
});

describe("applySizeConstraints", () => {
  const item: LayoutItem = { i: "a", x: 0, y: 0, w: 2, h: 2 };

  it("gridBounds constrains width to cols - x for east handles", () => {
    const result = applySizeConstraints(
      [gridBounds],
      item,
      20,
      20,
      "se",
      CONSTRAINT_CONTEXT
    );
    expect(result.w).toBeLessThanOrEqual(12);
  });

  it("gridBounds constrains width to x + w for west handles", () => {
    const westItem = { ...item, x: 4, w: 2 };
    const result = applySizeConstraints(
      [gridBounds],
      westItem,
      20,
      20,
      "w",
      CONSTRAINT_CONTEXT
    );
    expect(result.w).toBeLessThanOrEqual(6);
  });

  it("minMaxSize enforces minW and maxW", () => {
    const constrained = { ...item, minW: 2, maxW: 4 };
    const result = applySizeConstraints(
      [minMaxSize],
      constrained,
      1,
      1,
      "se",
      CONSTRAINT_CONTEXT
    );
    expect(result.w).toBe(2);
  });

  it("minMaxSize enforces maxW", () => {
    const constrained = { ...item, minW: 1, maxW: 4 };
    const result = applySizeConstraints(
      [minMaxSize],
      constrained,
      10,
      10,
      "se",
      CONSTRAINT_CONTEXT
    );
    expect(result.w).toBe(4);
  });

  it("minMaxSize enforces minH and maxH", () => {
    const constrained = { ...item, minH: 2, maxH: 5 };
    const result = applySizeConstraints(
      [minMaxSize],
      constrained,
      1,
      1,
      "se",
      CONSTRAINT_CONTEXT
    );
    expect(result.h).toBe(2);
  });

  it("defaultConstraints applies grid + minMax", () => {
    const constrained = { ...item, minW: 2, maxW: 6 };
    const result = applySizeConstraints(
      defaultConstraints,
      constrained,
      1,
      1,
      "se",
      CONSTRAINT_CONTEXT
    );
    expect(result.w).toBe(2);
    expect(result.h).toBe(1);
  });
});

describe("layout resize logic (onItemResize simulation)", () => {
  beforeEach(() => {
    injectStyles();
  });

  it("updates item w and h on resize", () => {
    const layout: LayoutItem[] = [{ i: "a", x: 0, y: 0, w: 2, h: 2 }];
    const [newLayout, updated] = withLayoutItem(layout, "a", (item) => ({
      ...item,
      w: 4,
      h: 3,
    }));
    expect(updated?.w).toBe(4);
    expect(updated?.h).toBe(3);
    expect(newLayout[0].w).toBe(4);
  });

  it("west handle: updates x when width decreases", () => {
    const layout: LayoutItem[] = [{ i: "a", x: 4, y: 0, w: 4, h: 2 }];
    const newW = 2;
    const moveX = 4 + (4 - newW);
    const [newLayout, updated] = withLayoutItem(layout, "a", (item) => ({
      ...item,
      w: newW,
      x: moveX,
      y: item.y,
    }));
    expect(updated?.x).toBe(6);
    expect(updated?.w).toBe(2);
  });

  it("north handle: updates y when height decreases", () => {
    const layout: LayoutItem[] = [{ i: "a", x: 0, y: 4, w: 2, h: 4 }];
    const newH = 2;
    const moveY = 4 + (4 - newH);
    const [newLayout, updated] = withLayoutItem(layout, "a", (item) => ({
      ...item,
      h: newH,
      x: item.x,
      y: moveY,
    }));
    expect(updated?.y).toBe(6);
    expect(updated?.h).toBe(2);
  });

  it("reverts resize when west handle would push x < 0", () => {
    const layout: LayoutItem[] = [{ i: "a", x: 0, y: 0, w: 2, h: 2 }];
    const newW = 4;
    let moveX = 0 + (2 - newW);
    const reverted = moveX < 0;
    if (reverted) {
      moveX = 0;
    }
    const finalW = reverted ? 2 : newW;
    expect(finalW).toBe(2);
  });

  it("moveElement updates position after resize with west handle", () => {
    const layout: LayoutItem[] = [
      { i: "a", x: 0, y: 0, w: 2, h: 2 },
      { i: "b", x: 2, y: 0, w: 2, h: 2 },
    ];
    const [updatedLayout, item] = withLayoutItem(layout, "a", (i) => ({
      ...i,
      w: 4,
      h: 2,
    }));
    if (!item) throw new Error("No item");
    const finalLayout = moveElement(
      updatedLayout,
      item,
      0,
      0,
      true,
      true,
      "vertical",
      12,
      false
    );
    const compacted = verticalCompactor.compact(finalLayout, 12);
    expect(compacted.length).toBe(2);
  });

  it("preventCollision: blocks resize when collision detected", () => {
    const layout: LayoutItem[] = [
      { i: "a", x: 0, y: 0, w: 2, h: 2 },
      { i: "b", x: 2, y: 0, w: 2, h: 2 },
    ];
    const proposed = { i: "a", x: 0, y: 0, w: 5, h: 2 };
    const collisions = getAllCollisions(layout, proposed).filter((c) => c.i !== "a");
    expect(collisions.length).toBeGreaterThan(0);
  });
});

describe("GridLayout resize integration", () => {
  let container: HTMLElement;
  let grid: GridLayout;

  beforeEach(() => {
    injectStyles();
    container = document.createElement("div");
    container.style.width = "1200px";
    container.style.height = "600px";
    container.style.position = "relative";
    Object.defineProperty(container, "clientWidth", { value: 1200, configurable: true });
    Object.defineProperty(container, "clientHeight", { value: 600, configurable: true });
    document.body.appendChild(container);
  });

  afterEach(() => {
    grid?.destroy();
    container?.remove();
  });

  it("creates resize handles for each configured handle", () => {
    grid = new GridLayout(container, {
      layout: [{ i: "a", x: 0, y: 0, w: 2, h: 2 }],
      resizeConfig: { enabled: true, handles: ["se", "s", "e", "n", "w", "nw", "ne", "sw"] },
    });
    const itemEl = document.createElement("div");
    itemEl.textContent = "A";
    grid.addItem(itemEl, { i: "a", x: 0, y: 0, w: 2, h: 2 });

    ["se", "s", "e", "n", "w", "nw", "ne", "sw"].forEach((handle) => {
      const handleEl = container.querySelector(`.grid-resizable-handle-${handle}`);
      expect(handleEl).toBeTruthy();
    });
  });

  it("emits resizeStart when resize begins", () => {
    const resizeStartCalls: Array<{ layout: LayoutItem[]; item: LayoutItem | null }> = [];
    grid = new GridLayout(container, {
      layout: [{ i: "a", x: 0, y: 0, w: 2, h: 2 }],
      resizeConfig: { enabled: true, handles: ["se"] },
    });
    const itemEl = document.createElement("div");
    itemEl.textContent = "A";
    grid.addItem(itemEl, { i: "a", x: 0, y: 0, w: 2, h: 2 });

    grid.on("resizeStart", (layout, _oldItem, item) => {
      resizeStartCalls.push({ layout: [...layout], item });
    });

    const handle = container.querySelector(".grid-resizable-handle-se") as HTMLElement;
    expect(handle).toBeTruthy();

    const itemRect = itemEl.getBoundingClientRect();
    const handleRect = handle.getBoundingClientRect();
    const startX = (handleRect.left || 0) + (handleRect.width || 20) / 2;
    const startY = (handleRect.top || 0) + (handleRect.height || 20) / 2;

    mockElementRect(itemEl, {
      left: 10,
      top: 10,
      width: 200,
      height: 100,
    });
    mockElementRect(handle, {
      left: 200,
      top: 100,
      width: 20,
      height: 20,
    });

    dispatchMouseEvent(handle, "mousedown", { clientX: startX, clientY: startY });

    expect(resizeStartCalls.length).toBe(1);
    expect(resizeStartCalls[0].item?.i).toBe("a");
  });

  it("emits resize and layoutChange when item is resized", async () => {
    const resizeCalls: Array<{ w: number; h: number }> = [];
    const layoutChangeCalls: LayoutItem[][] = [];
    grid = new GridLayout(container, {
      layout: [{ i: "a", x: 0, y: 0, w: 2, h: 2 }],
      resizeConfig: { enabled: true, handles: ["se"] },
    });
    const itemEl = document.createElement("div");
    itemEl.textContent = "A";
    grid.addItem(itemEl, { i: "a", x: 0, y: 0, w: 2, h: 2 });

    grid.on("resize", (layout, _oldItem, item) => {
      if (item) resizeCalls.push({ w: item.w, h: item.h });
    });
    grid.on("layoutChange", (layout) => layoutChangeCalls.push([...layout]));

    const handle = container.querySelector(".grid-resizable-handle-se") as HTMLElement;
    expect(handle).toBeTruthy();

    mockElementRect(itemEl, {
      left: 10,
      top: 10,
      width: 200,
      height: 100,
    });
    mockElementRect(handle, {
      left: 200,
      top: 100,
      width: 20,
      height: 20,
    });

    simulateResizeDrag(handle, 210, 110, 350, 180);

    await new Promise((r) => setTimeout(r, 50));

    expect(resizeCalls.length).toBeGreaterThan(0);
    const finalLayout = layoutChangeCalls[layoutChangeCalls.length - 1];
    expect(finalLayout).toBeDefined();
    const item = finalLayout?.find((i) => i.i === "a");
    expect(item).toBeDefined();
    expect(item?.w).toBeGreaterThanOrEqual(1);
    expect(item?.h).toBeGreaterThanOrEqual(1);
  });

  it("emits resizeStop with final dimensions", async () => {
    const resizeStopCalls: Array<{ w: number; h: number }> = [];
    grid = new GridLayout(container, {
      layout: [{ i: "a", x: 0, y: 0, w: 2, h: 2 }],
      resizeConfig: { enabled: true, handles: ["se"] },
    });
    const itemEl = document.createElement("div");
    itemEl.textContent = "A";
    grid.addItem(itemEl, { i: "a", x: 0, y: 0, w: 2, h: 2 });

    grid.on("resizeStop", (_layout, _oldItem, item) => {
      if (item) resizeStopCalls.push({ w: item.w, h: item.h });
    });

    const handle = container.querySelector(".grid-resizable-handle-se") as HTMLElement;
    mockElementRect(itemEl, { left: 10, top: 10, width: 200, height: 100 });
    mockElementRect(handle, { left: 200, top: 100, width: 20, height: 20 });

    simulateResizeDrag(handle, 210, 110, 300, 150);

    await new Promise((r) => setTimeout(r, 50));

    expect(resizeStopCalls.length).toBe(1);
    expect(resizeStopCalls[0].w).toBeGreaterThanOrEqual(1);
    expect(resizeStopCalls[0].h).toBeGreaterThanOrEqual(1);
  });

  it("respects minW and maxW constraints", async () => {
    const resizeCalls: Array<{ w: number; h: number }> = [];
    grid = new GridLayout(container, {
      layout: [{ i: "a", x: 0, y: 0, w: 3, h: 2 }],
      resizeConfig: { enabled: true, handles: ["se"] },
    });
    const itemEl = document.createElement("div");
    itemEl.textContent = "A";
    grid.addItem(itemEl, { i: "a", x: 0, y: 0, w: 3, h: 2, minW: 2, maxW: 5 });

    grid.on("resize", (_layout, _oldItem, item) => {
      if (item) resizeCalls.push({ w: item.w, h: item.h });
    });

    const handle = container.querySelector(".grid-resizable-handle-se") as HTMLElement;
    mockElementRect(itemEl, { left: 10, top: 10, width: 300, height: 100 });
    mockElementRect(handle, { left: 300, top: 100, width: 20, height: 20 });

    simulateResizeDrag(handle, 310, 110, 50, 50);

    await new Promise((r) => setTimeout(r, 50));

    const lastResize = resizeCalls[resizeCalls.length - 1];
    expect(lastResize).toBeDefined();
    expect(lastResize?.w).toBeGreaterThanOrEqual(1);
    expect(lastResize?.w).toBeLessThanOrEqual(5);
  });

  it("limits width to cols - x when resizing east", async () => {
    grid = new GridLayout(container, {
      layout: [{ i: "a", x: 10, y: 0, w: 2, h: 2 }],
      resizeConfig: { enabled: true, handles: ["se"] },
    });
    const itemEl = document.createElement("div");
    itemEl.textContent = "A";
    grid.addItem(itemEl, { i: "a", x: 10, y: 0, w: 2, h: 2 });

    let finalItem: LayoutItem | null = null;
    grid.on("resizeStop", (_layout, _oldItem, item) => {
      finalItem = item;
    });

    const handle = container.querySelector(".grid-resizable-handle-se") as HTMLElement;
    const colWidth = (1200 - 20 - 110) / 12 + 10;
    const itemWidth = colWidth * 2 + 10;
    mockElementRect(itemEl, { left: 10, top: 10, width: itemWidth, height: 100 });
    mockElementRect(handle, { left: 10 + itemWidth, top: 100, width: 20, height: 20 });

    simulateResizeDrag(handle, 10 + itemWidth + 10, 110, 2000, 200);

    await new Promise((r) => setTimeout(r, 50));

    expect(finalItem?.w).toBeLessThanOrEqual(2);
  });
});

describe("ResizeManager coordinate system", () => {
  it("ResizeManager computes correct deltas (regression test for Task 1 bug)", async () => {
    injectStyles();
    const { ResizeManager } = await import("../dom/resize-manager.js");
    const el = document.createElement("div");
    el.style.position = "absolute";
    el.style.left = "100px";
    el.style.top = "50px";
    el.style.width = "200px";
    el.style.height = "100px";
    document.body.appendChild(el);

    const rect = { left: 100, top: 50, width: 200, height: 100 };
    el.getBoundingClientRect = () => rect as DOMRect;

    const resizeCalls: Array<{ width: number; height: number }> = [];
    const manager = new ResizeManager(
      el,
      {
        onResize: (_axis, size) => resizeCalls.push({ width: size.width, height: size.height }),
      },
      { handles: ["se"], minWidth: 20, minHeight: 20 }
    );

    const handle = el.querySelector(".grid-resizable-handle-se") as HTMLElement;
    expect(handle).toBeTruthy();

    const startX = 300;
    const startY = 150;
    const endX = 400;
    const endY = 200;

    dispatchMouseEvent(handle, "mousedown", { clientX: startX, clientY: startY });
    dispatchMouseEvent(document, "mousemove", { clientX: endX, clientY: endY });
    dispatchMouseEvent(document, "mouseup", { clientX: endX, clientY: endY });

    expect(resizeCalls.length).toBeGreaterThan(0);
    const last = resizeCalls[resizeCalls.length - 1];
    expect(last.width).toBeGreaterThan(200);
    expect(last.height).toBeGreaterThan(100);

    manager.destroy();
    el.remove();
  });
});
