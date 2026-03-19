import type { Layout, LayoutItem } from "./types.js";

export function collides(l1: LayoutItem, l2: LayoutItem): boolean {
  if (l1.i === l2.i) return false;
  if (l1.x + l1.w <= l2.x) return false;
  if (l1.x >= l2.x + l2.w) return false;
  if (l1.y + l1.h <= l2.y) return false;
  if (l1.y >= l2.y + l2.h) return false;
  return true;
}

export function getFirstCollision(
  layout: Layout,
  layoutItem: LayoutItem
): LayoutItem | undefined {
  for (let i = 0; i < layout.length; i++) {
    const item = layout[i];
    if (item !== undefined && collides(item, layoutItem)) {
      return item;
    }
  }
  return undefined;
}

export function getAllCollisions(
  layout: Layout,
  layoutItem: LayoutItem
): LayoutItem[] {
  return layout.filter((l): l is LayoutItem => collides(l, layoutItem));
}
