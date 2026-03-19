import type { CompactType, Layout, LayoutItem, Mutable } from "./types.js";
import { getAllCollisions, getFirstCollision } from "./collision.js";
import { sortLayoutItems } from "./sort.js";

export function bottom(layout: Layout): number {
  let max = 0;
  for (let i = 0; i < layout.length; i++) {
    const item = layout[i];
    if (item !== undefined) {
      const bottomY = item.y + item.h;
      if (bottomY > max) max = bottomY;
    }
  }
  return max;
}

export function getLayoutItem(
  layout: Layout,
  id: string
): LayoutItem | undefined {
  for (let i = 0; i < layout.length; i++) {
    const item = layout[i];
    if (item !== undefined && item.i === id) return item;
  }
  return undefined;
}

export function getStatics(layout: Layout): LayoutItem[] {
  return layout.filter((l): l is LayoutItem => l.static === true);
}

export function cloneLayoutItem(layoutItem: LayoutItem): LayoutItem {
  return {
    i: layoutItem.i,
    x: layoutItem.x,
    y: layoutItem.y,
    w: layoutItem.w,
    h: layoutItem.h,
    minW: layoutItem.minW,
    maxW: layoutItem.maxW,
    minH: layoutItem.minH,
    maxH: layoutItem.maxH,
    moved: Boolean(layoutItem.moved),
    static: Boolean(layoutItem.static),
    isDraggable: layoutItem.isDraggable,
    isResizable: layoutItem.isResizable,
    resizeHandles: layoutItem.resizeHandles,
    constraints: layoutItem.constraints,
    isBounded: layoutItem.isBounded,
  };
}

export function cloneLayout(layout: Layout): LayoutItem[] {
  const newLayout: LayoutItem[] = new Array(layout.length);
  for (let i = 0; i < layout.length; i++) {
    const item = layout[i];
    if (item !== undefined) {
      newLayout[i] = cloneLayoutItem(item);
    }
  }
  return newLayout;
}

export function modifyLayout(
  layout: Layout,
  layoutItem: LayoutItem
): LayoutItem[] {
  const newLayout: LayoutItem[] = new Array(layout.length);
  for (let i = 0; i < layout.length; i++) {
    const item = layout[i];
    if (item !== undefined) {
      newLayout[i] = layoutItem.i === item.i ? layoutItem : item;
    }
  }
  return newLayout;
}

export function withLayoutItem(
  layout: Layout,
  itemKey: string,
  cb: (item: LayoutItem) => LayoutItem
): [LayoutItem[], LayoutItem | null] {
  let item = getLayoutItem(layout, itemKey);
  if (!item) return [[...layout], null];

  item = cb(cloneLayoutItem(item));
  const newLayout = modifyLayout(layout, item);
  return [newLayout, item];
}

export function correctBounds(
  layout: Mutable<LayoutItem>[],
  bounds: { cols: number }
): LayoutItem[] {
  const collidesWith = getStatics(layout);

  for (let i = 0; i < layout.length; i++) {
    const l = layout[i];
    if (l === undefined) continue;

    if (l.x + l.w > bounds.cols) l.x = bounds.cols - l.w;
    if (l.x < 0) {
      l.x = 0;
      l.w = bounds.cols;
    }

    if (!l.static) {
      collidesWith.push(l);
    } else {
      while (getFirstCollision(collidesWith, l)) {
        l.y++;
      }
    }
  }

  return layout;
}

export function moveElement(
  layout: Layout,
  l: LayoutItem,
  x: number | undefined,
  y: number | undefined,
  isUserAction: boolean | undefined,
  preventCollision: boolean | undefined,
  compactType: CompactType,
  cols: number,
  allowOverlap?: boolean
): LayoutItem[] {
  if (l.static && l.isDraggable !== true) return [...layout];
  if (l.y === y && l.x === x) return [...layout];

  const oldX = l.x;
  const oldY = l.y;

  if (typeof x === "number") (l as Mutable<LayoutItem>).x = x;
  if (typeof y === "number") (l as Mutable<LayoutItem>).y = y;
  (l as Mutable<LayoutItem>).moved = true;

  let sorted = sortLayoutItems(layout, compactType);
  const movingUp =
    compactType === "vertical" && typeof y === "number"
      ? oldY >= y
      : compactType === "horizontal" && typeof x === "number"
        ? oldX >= x
        : false;

  if (movingUp) sorted = sorted.reverse();

  const collisions = getAllCollisions(sorted, l);
  const hasCollisions = collisions.length > 0;

  if (hasCollisions && allowOverlap) return cloneLayout(layout);

  if (hasCollisions && preventCollision) {
    (l as Mutable<LayoutItem>).x = oldX;
    (l as Mutable<LayoutItem>).y = oldY;
    (l as Mutable<LayoutItem>).moved = false;
    return layout as LayoutItem[];
  }

  let resultLayout: LayoutItem[] = [...layout];
  for (let i = 0; i < collisions.length; i++) {
    const collision = collisions[i];
    if (collision === undefined || collision.moved) continue;

    if (collision.static) {
      resultLayout = moveElementAwayFromCollision(
        resultLayout, collision, l, isUserAction, compactType, cols
      );
    } else {
      resultLayout = moveElementAwayFromCollision(
        resultLayout, l, collision, isUserAction, compactType, cols
      );
    }
  }

  return resultLayout;
}

export function moveElementAwayFromCollision(
  layout: Layout,
  collidesWith: LayoutItem,
  itemToMove: LayoutItem,
  isUserAction: boolean | undefined,
  compactType: CompactType,
  cols: number
): LayoutItem[] {
  const compactH = compactType === "horizontal";
  const compactV = compactType === "vertical";
  const preventCollision = collidesWith.static;

  if (isUserAction) {
    isUserAction = false;

    const fakeItem: LayoutItem = {
      x: compactH ? Math.max(collidesWith.x - itemToMove.w, 0) : itemToMove.x,
      y: compactV ? Math.max(collidesWith.y - itemToMove.h, 0) : itemToMove.y,
      w: itemToMove.w,
      h: itemToMove.h,
      i: "-1",
    };

    const firstCollision = getFirstCollision(layout, fakeItem);
    const collisionNorth =
      firstCollision !== undefined &&
      firstCollision.y + firstCollision.h > collidesWith.y;
    const collisionWest =
      firstCollision !== undefined &&
      collidesWith.x + collidesWith.w > firstCollision.x;

    if (!firstCollision) {
      return moveElement(
        layout, itemToMove,
        compactH ? fakeItem.x : undefined,
        compactV ? fakeItem.y : undefined,
        isUserAction, preventCollision, compactType, cols
      );
    }

    if (collisionNorth && compactV) {
      return moveElement(
        layout, itemToMove, undefined, itemToMove.y + 1,
        isUserAction, preventCollision, compactType, cols
      );
    }

    if (collisionNorth && compactType === null) {
      (collidesWith as Mutable<LayoutItem>).y = itemToMove.y;
      (itemToMove as Mutable<LayoutItem>).y = itemToMove.y + itemToMove.h;
      return [...layout];
    }

    if (collisionWest && compactH) {
      return moveElement(
        layout, collidesWith, itemToMove.x, undefined,
        isUserAction, preventCollision, compactType, cols
      );
    }
  }

  const newX = compactH ? itemToMove.x + 1 : undefined;
  const newY = compactV ? itemToMove.y + 1 : undefined;

  if (newX === undefined && newY === undefined) return [...layout];

  return moveElement(
    layout, itemToMove, newX, newY,
    isUserAction, preventCollision, compactType, cols
  );
}

export function validateLayout(
  layout: Layout,
  contextName: string = "Layout"
): void {
  const requiredProps = ["x", "y", "w", "h"] as const;

  if (!Array.isArray(layout)) {
    throw new Error(`${contextName} must be an array!`);
  }

  for (let i = 0; i < layout.length; i++) {
    const item = layout[i];
    if (item === undefined) continue;

    for (const key of requiredProps) {
      const value = item[key];
      if (typeof value !== "number" || Number.isNaN(value)) {
        throw new Error(
          `GridLayout: ${contextName}[${i}].${key} must be a number! ` +
            `Received: ${String(value)} (${typeof value})`
        );
      }
    }

    if (item.i !== undefined && typeof item.i !== "string") {
      throw new Error(
        `GridLayout: ${contextName}[${i}].i must be a string! ` +
          `Received: ${String(item.i)} (${typeof item.i})`
      );
    }
  }
}
