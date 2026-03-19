import type {
  Compactor,
  CompactType,
  Layout,
  LayoutItem,
  Mutable,
} from "./types.js";
import { getFirstCollision, collides } from "./collision.js";
import { sortLayoutItemsByRowCol, sortLayoutItemsByColRow } from "./sort.js";
import { bottom, cloneLayoutItem, getStatics, cloneLayout } from "./layout.js";

export function resolveCompactionCollision(
  layout: Layout,
  item: LayoutItem,
  moveToCoord: number,
  axis: "x" | "y",
  hasStatics?: boolean
): void {
  const sizeProp = axis === "x" ? "w" : "h";
  (item as Mutable<LayoutItem>)[axis] += 1;

  const itemIndex = layout.findIndex((l) => l.i === item.i);
  const layoutHasStatics = hasStatics ?? getStatics(layout).length > 0;

  for (let i = itemIndex + 1; i < layout.length; i++) {
    const otherItem = layout[i];
    if (otherItem === undefined || otherItem.static) continue;
    if (!layoutHasStatics && otherItem.y > item.y + item.h) break;

    if (collides(item, otherItem)) {
      resolveCompactionCollision(
        layout, otherItem, moveToCoord + item[sizeProp], axis, layoutHasStatics
      );
    }
  }

  (item as Mutable<LayoutItem>)[axis] = moveToCoord;
}

export function compactItemVertical(
  compareWith: Layout,
  l: LayoutItem,
  fullLayout: Layout,
  maxY: number
): LayoutItem {
  (l as Mutable<LayoutItem>).x = Math.max(l.x, 0);
  (l as Mutable<LayoutItem>).y = Math.max(l.y, 0);
  (l as Mutable<LayoutItem>).y = Math.min(maxY, l.y);

  while (l.y > 0 && !getFirstCollision(compareWith, l)) {
    (l as Mutable<LayoutItem>).y--;
  }

  let collision: LayoutItem | undefined;
  while ((collision = getFirstCollision(compareWith, l)) !== undefined) {
    resolveCompactionCollision(fullLayout, l, collision.y + collision.h, "y");
  }

  (l as Mutable<LayoutItem>).y = Math.max(l.y, 0);
  return l;
}

export function compactItemHorizontal(
  compareWith: Layout,
  l: LayoutItem,
  cols: number,
  fullLayout: Layout
): LayoutItem {
  (l as Mutable<LayoutItem>).x = Math.max(l.x, 0);
  (l as Mutable<LayoutItem>).y = Math.max(l.y, 0);

  while (l.x > 0 && !getFirstCollision(compareWith, l)) {
    (l as Mutable<LayoutItem>).x--;
  }

  let collision: LayoutItem | undefined;
  while ((collision = getFirstCollision(compareWith, l)) !== undefined) {
    resolveCompactionCollision(fullLayout, l, collision.x + collision.w, "x");

    if (l.x + l.w > cols) {
      (l as Mutable<LayoutItem>).x = cols - l.w;
      (l as Mutable<LayoutItem>).y++;

      while (l.x > 0 && !getFirstCollision(compareWith, l)) {
        (l as Mutable<LayoutItem>).x--;
      }
    }
  }

  (l as Mutable<LayoutItem>).x = Math.max(l.x, 0);
  return l;
}

export const verticalCompactor: Compactor = {
  type: "vertical",
  allowOverlap: false,

  compact(layout: Layout, _cols: number): Layout {
    const compareWith = getStatics(layout);
    let maxY = bottom(compareWith);
    const sorted = sortLayoutItemsByRowCol(layout);
    const out: LayoutItem[] = new Array(layout.length);

    for (let i = 0; i < sorted.length; i++) {
      const sortedItem = sorted[i];
      if (sortedItem === undefined) continue;

      let l = cloneLayoutItem(sortedItem);

      if (!l.static) {
        l = compactItemVertical(compareWith, l, sorted, maxY);
        maxY = Math.max(maxY, l.y + l.h);
        compareWith.push(l);
      }

      const originalIndex = layout.indexOf(sortedItem);
      out[originalIndex] = l;
      l.moved = false;
    }

    return out;
  },
};

export const horizontalCompactor: Compactor = {
  type: "horizontal",
  allowOverlap: false,

  compact(layout: Layout, cols: number): Layout {
    const compareWith = getStatics(layout);
    const sorted = sortLayoutItemsByColRow(layout);
    const out: LayoutItem[] = new Array(layout.length);

    for (let i = 0; i < sorted.length; i++) {
      const sortedItem = sorted[i];
      if (sortedItem === undefined) continue;

      let l = cloneLayoutItem(sortedItem);

      if (!l.static) {
        l = compactItemHorizontal(compareWith, l, cols, sorted);
        compareWith.push(l);
      }

      const originalIndex = layout.indexOf(sortedItem);
      out[originalIndex] = l;
      l.moved = false;
    }

    return out;
  },
};

export const noCompactor: Compactor = {
  type: null,
  allowOverlap: false,

  compact(layout: Layout, _cols: number): Layout {
    return cloneLayout(layout);
  },
};

export const verticalOverlapCompactor: Compactor = {
  ...verticalCompactor,
  allowOverlap: true,
  compact(layout: Layout, _cols: number): Layout {
    return cloneLayout(layout);
  },
};

export const horizontalOverlapCompactor: Compactor = {
  ...horizontalCompactor,
  allowOverlap: true,
  compact(layout: Layout, _cols: number): Layout {
    return cloneLayout(layout);
  },
};

export const noOverlapCompactor: Compactor = {
  ...noCompactor,
  allowOverlap: true,
};

export function getCompactor(
  compactType: CompactType,
  allowOverlap: boolean = false,
  preventCollision: boolean = false
): Compactor {
  let baseCompactor: Compactor;

  if (allowOverlap) {
    if (compactType === "vertical") baseCompactor = verticalOverlapCompactor;
    else if (compactType === "horizontal")
      baseCompactor = horizontalOverlapCompactor;
    else baseCompactor = noOverlapCompactor;
  } else {
    if (compactType === "vertical") baseCompactor = verticalCompactor;
    else if (compactType === "horizontal") baseCompactor = horizontalCompactor;
    else baseCompactor = noCompactor;
  }

  if (preventCollision) return { ...baseCompactor, preventCollision };
  return baseCompactor;
}

export interface SelectCompactorOptions {
  itemCount?: number;
  compactType: CompactType;
  allowOverlap?: boolean;
  preventCollision?: boolean;
}

export function selectCompactor(opts: SelectCompactorOptions): Compactor {
  return getCompactor(opts.compactType, opts.allowOverlap ?? false, opts.preventCollision ?? false);
}
