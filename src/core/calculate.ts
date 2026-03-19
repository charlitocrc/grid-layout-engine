import type { Position, ResizeHandleAxis } from "./types.js";

export interface PositionParams {
  readonly margin: readonly [number, number];
  readonly containerPadding: readonly [number, number];
  readonly containerWidth: number;
  readonly cols: number;
  readonly rowHeight: number;
  readonly maxRows: number;
}

export function calcGridColWidth(positionParams: PositionParams): number {
  const { margin, containerPadding, containerWidth, cols } = positionParams;
  return (
    (containerWidth - margin[0] * (cols - 1) - containerPadding[0] * 2) / cols
  );
}

export function calcGridItemWHPx(
  gridUnits: number,
  colOrRowSize: number,
  marginPx: number
): number {
  if (!Number.isFinite(gridUnits)) return gridUnits;
  return Math.round(
    colOrRowSize * gridUnits + Math.max(0, gridUnits - 1) * marginPx
  );
}

export function calcGridItemPosition(
  positionParams: PositionParams,
  x: number,
  y: number,
  w: number,
  h: number,
  dragPosition?: { top: number; left: number } | null,
  resizePosition?: {
    top: number;
    left: number;
    height: number;
    width: number;
  } | null
): Position {
  const { margin, containerPadding, rowHeight } = positionParams;
  const colWidth = calcGridColWidth(positionParams);

  let width: number;
  let height: number;
  let top: number;
  let left: number;

  if (resizePosition) {
    width = Math.round(resizePosition.width);
    height = Math.round(resizePosition.height);
  } else {
    width = calcGridItemWHPx(w, colWidth, margin[0]);
    height = calcGridItemWHPx(h, rowHeight, margin[1]);
  }

  if (dragPosition) {
    top = Math.round(dragPosition.top);
    left = Math.round(dragPosition.left);
  } else if (resizePosition) {
    top = Math.round(resizePosition.top);
    left = Math.round(resizePosition.left);
  } else {
    top = Math.round((rowHeight + margin[1]) * y + containerPadding[1]);
    left = Math.round((colWidth + margin[0]) * x + containerPadding[0]);
  }

  if (!dragPosition && !resizePosition) {
    if (Number.isFinite(w)) {
      const siblingLeft = Math.round(
        (colWidth + margin[0]) * (x + w) + containerPadding[0]
      );
      const actualMarginRight = siblingLeft - left - width;
      if (actualMarginRight !== margin[0]) {
        width += actualMarginRight - margin[0];
      }
    }

    if (Number.isFinite(h)) {
      const siblingTop = Math.round(
        (rowHeight + margin[1]) * (y + h) + containerPadding[1]
      );
      const actualMarginBottom = siblingTop - top - height;
      if (actualMarginBottom !== margin[1]) {
        height += actualMarginBottom - margin[1];
      }
    }
  }

  return { top, left, width, height };
}

export function calcXY(
  positionParams: PositionParams,
  top: number,
  left: number,
  w: number,
  h: number
): { x: number; y: number } {
  const { margin, containerPadding, cols, rowHeight, maxRows } = positionParams;
  const colWidth = calcGridColWidth(positionParams);

  let x = Math.round((left - containerPadding[0]) / (colWidth + margin[0]));
  let y = Math.round((top - containerPadding[1]) / (rowHeight + margin[1]));

  x = clamp(x, 0, cols - w);
  y = clamp(y, 0, maxRows - h);

  return { x, y };
}

export function calcXYRaw(
  positionParams: PositionParams,
  top: number,
  left: number
): { x: number; y: number } {
  const { margin, containerPadding, rowHeight } = positionParams;
  const colWidth = calcGridColWidth(positionParams);

  const x = Math.round((left - containerPadding[0]) / (colWidth + margin[0]));
  const y = Math.round((top - containerPadding[1]) / (rowHeight + margin[1]));

  return { x, y };
}

export function calcWH(
  positionParams: PositionParams,
  width: number,
  height: number,
  x: number,
  y: number,
  handle: ResizeHandleAxis
): { w: number; h: number } {
  const { margin, maxRows, cols, rowHeight } = positionParams;
  const colWidth = calcGridColWidth(positionParams);

  const w = Math.round((width + margin[0]) / (colWidth + margin[0]));
  const h = Math.round((height + margin[1]) / (rowHeight + margin[1]));

  let _w = clamp(w, 0, cols - x);
  let _h = clamp(h, 0, maxRows - y);

  if (handle === "sw" || handle === "w" || handle === "nw") {
    _w = clamp(w, 0, cols);
  }

  if (handle === "nw" || handle === "n" || handle === "ne") {
    _h = clamp(h, 0, maxRows);
  }

  return { w: _w, h: _h };
}

export function calcWHRaw(
  positionParams: PositionParams,
  width: number,
  height: number
): { w: number; h: number } {
  const { margin, rowHeight } = positionParams;
  const colWidth = calcGridColWidth(positionParams);

  const w = Math.max(
    1,
    Math.round((width + margin[0]) / (colWidth + margin[0]))
  );
  const h = Math.max(
    1,
    Math.round((height + margin[1]) / (rowHeight + margin[1]))
  );

  return { w, h };
}

export function clamp(
  num: number,
  lowerBound: number,
  upperBound: number
): number {
  return Math.max(Math.min(num, upperBound), lowerBound);
}

export interface GridCellDimensions {
  readonly cellWidth: number;
  readonly cellHeight: number;
  readonly offsetX: number;
  readonly offsetY: number;
  readonly gapX: number;
  readonly gapY: number;
  readonly cols: number;
  readonly containerWidth: number;
}

export interface GridCellConfig {
  width: number;
  cols: number;
  rowHeight: number;
  margin?: readonly [number, number];
  containerPadding?: readonly [number, number] | null;
}

export function calcGridCellDimensions(
  config: GridCellConfig
): GridCellDimensions {
  const {
    width,
    cols,
    rowHeight,
    margin = [10, 10],
    containerPadding,
  } = config;

  const padding = containerPadding ?? margin;

  const cellWidth = (width - padding[0] * 2 - margin[0] * (cols - 1)) / cols;
  const cellHeight = rowHeight;

  return {
    cellWidth,
    cellHeight,
    offsetX: padding[0],
    offsetY: padding[1],
    gapX: margin[0],
    gapY: margin[1],
    cols,
    containerWidth: width,
  };
}
