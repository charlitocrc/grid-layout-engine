import type { CompactType, Layout, LayoutItem, Mutable } from "./types.js";
import { cloneLayoutItem, bottom } from "./layout.js";
import { getFirstCollision, collides } from "./collision.js";
import { sortLayoutItems } from "./sort.js";

function getStatics(layout: Layout): LayoutItem[] {
  return layout.filter((l) => l.static);
}

const heightWidth: { x: "w"; y: "h" } = { x: "w", y: "h" };

function resolveCompactionCollision(
  layout: Layout,
  item: LayoutItem,
  moveToCoord: number,
  axis: "x" | "y",
  hasStatics?: boolean
): void {
  const sizeProp = heightWidth[axis];
  (item as Mutable<LayoutItem>)[axis] += 1;

  const itemIndex = layout.findIndex((l) => l.i === item.i);
  const layoutHasStatics = hasStatics ?? getStatics(layout).length > 0;

  for (let i = itemIndex + 1; i < layout.length; i++) {
    const otherItem = layout[i];
    if (otherItem === undefined) continue;
    if (otherItem.static) continue;
    if (!layoutHasStatics && otherItem.y > item.y + item.h) break;

    if (collides(item, otherItem)) {
      resolveCompactionCollision(
        layout,
        otherItem,
        moveToCoord + item[sizeProp],
        axis,
        layoutHasStatics
      );
    }
  }

  (item as Mutable<LayoutItem>)[axis] = moveToCoord;
}

function compactItemInternal(
  compareWith: Layout,
  l: LayoutItem,
  compactType: CompactType,
  cols: number,
  fullLayout: Layout,
  allowOverlap: boolean | undefined,
  b: number | undefined
): LayoutItem {
  const compactV = compactType === "vertical";
  const compactH = compactType === "horizontal";

  if (!allowOverlap) {
    if (compactV) {
      if (typeof b === "number") {
        (l as Mutable<LayoutItem>).y = Math.min(b, l.y);
      } else {
        (l as Mutable<LayoutItem>).y = Math.min(bottom(compareWith), l.y);
      }
      while (l.y > 0 && !getFirstCollision(compareWith, l)) {
        (l as Mutable<LayoutItem>).y--;
      }
    } else if (compactH) {
      while (l.x > 0 && !getFirstCollision(compareWith, l)) {
        (l as Mutable<LayoutItem>).x--;
      }
    }
  }

  let collision: LayoutItem | undefined;
  while (
    (collision = getFirstCollision(compareWith, l)) !== undefined &&
    !allowOverlap
  ) {
    if (compactH) {
      resolveCompactionCollision(fullLayout, l, collision.x + collision.w, "x");
    } else {
      resolveCompactionCollision(fullLayout, l, collision.y + collision.h, "y");
    }

    if (compactH && l.x + l.w > cols) {
      (l as Mutable<LayoutItem>).x = cols - l.w;
      (l as Mutable<LayoutItem>).y++;
      while (l.x > 0 && !getFirstCollision(compareWith, l)) {
        (l as Mutable<LayoutItem>).x--;
      }
    }
  }

  (l as Mutable<LayoutItem>).y = Math.max(l.y, 0);
  (l as Mutable<LayoutItem>).x = Math.max(l.x, 0);

  return l;
}

export function compact(
  layout: Layout,
  compactType: CompactType,
  cols: number,
  allowOverlap?: boolean
): LayoutItem[] {
  const compareWith = getStatics(layout);
  let b = bottom(compareWith);
  const sorted = sortLayoutItems(layout, compactType);
  const out: LayoutItem[] = new Array(layout.length);

  for (let i = 0; i < sorted.length; i++) {
    const sortedItem = sorted[i];
    if (sortedItem === undefined) continue;

    let l = cloneLayoutItem(sortedItem);

    if (!l.static) {
      l = compactItemInternal(
        compareWith,
        l,
        compactType,
        cols,
        sorted,
        allowOverlap,
        b
      );
      b = Math.max(b, l.y + l.h);
      compareWith.push(l);
    }

    const originalIndex = layout.indexOf(sortedItem);
    out[originalIndex] = l;
    (l as Mutable<LayoutItem>).moved = false;
  }

  return out;
}

export function compactItem(
  compareWith: Layout,
  l: LayoutItem,
  compactType: CompactType,
  cols: number,
  fullLayout: Layout,
  allowOverlap: boolean | undefined,
  maxY: number | undefined
): LayoutItem {
  return compactItemInternal(
    compareWith,
    cloneLayoutItem(l),
    compactType,
    cols,
    fullLayout,
    allowOverlap,
    maxY
  );
}
