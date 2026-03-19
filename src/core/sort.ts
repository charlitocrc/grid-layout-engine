import type { CompactType, Layout, LayoutItem } from "./types.js";

export function sortLayoutItems(
  layout: Layout,
  compactType: CompactType
): LayoutItem[] {
  if (compactType === "horizontal") return sortLayoutItemsByColRow(layout);
  if (compactType === "vertical" || compactType === "wrap")
    return sortLayoutItemsByRowCol(layout);
  return [...layout];
}

export function sortLayoutItemsByRowCol(layout: Layout): LayoutItem[] {
  return [...layout].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });
}

export function sortLayoutItemsByColRow(layout: Layout): LayoutItem[] {
  return [...layout].sort((a, b) => {
    if (a.x !== b.x) return a.x - b.x;
    return a.y - b.y;
  });
}
