import type {
  Position,
  PartialPosition,
  ResizeHandleAxis,
  PositionStrategy,
} from "./types.js";

export function setTransform({
  top,
  left,
  width,
  height,
}: Position): Record<string, string> {
  const translate = `translate(${left}px,${top}px)`;
  return {
    transform: translate,
    WebkitTransform: translate,
    MozTransform: translate,
    msTransform: translate,
    OTransform: translate,
    width: `${width}px`,
    height: `${height}px`,
    position: "absolute",
  };
}

export function setTopLeft({
  top,
  left,
  width,
  height,
}: Position): Record<string, string> {
  return {
    top: `${top}px`,
    left: `${left}px`,
    width: `${width}px`,
    height: `${height}px`,
    position: "absolute",
  };
}

export function perc(num: number): string {
  return num * 100 + "%";
}

function constrainWidth(
  left: number,
  currentWidth: number,
  newWidth: number,
  containerWidth: number
): number {
  return left + newWidth > containerWidth ? currentWidth : newWidth;
}

function constrainHeight(
  top: number,
  currentHeight: number,
  newHeight: number
): number {
  return top < 0 ? currentHeight : newHeight;
}

function constrainLeft(left: number): number {
  return Math.max(0, left);
}

function constrainTop(top: number): number {
  return Math.max(0, top);
}

type ResizeHandler = (
  currentSize: Position,
  newSize: Position,
  containerWidth: number
) => Position;

const resizeNorth: ResizeHandler = (currentSize, newSize, _containerWidth) => {
  const { left, height, width } = newSize;
  const top = currentSize.top - (height - currentSize.height);
  return {
    left,
    width,
    height: constrainHeight(top, currentSize.height, height),
    top: constrainTop(top),
  };
};

const resizeEast: ResizeHandler = (currentSize, newSize, containerWidth) => {
  const { top, left, height, width } = newSize;
  return {
    top,
    height,
    width: constrainWidth(currentSize.left, currentSize.width, width, containerWidth),
    left: constrainLeft(left),
  };
};

const resizeWest: ResizeHandler = (currentSize, newSize, _containerWidth) => {
  const { top, height, width } = newSize;
  const left = currentSize.left + currentSize.width - width;

  if (left < 0) {
    return {
      height,
      width: currentSize.left + currentSize.width,
      top: constrainTop(top),
      left: 0,
    };
  }

  return { height, width, top: constrainTop(top), left };
};

const resizeSouth: ResizeHandler = (currentSize, newSize, _containerWidth) => {
  const { top, left, height, width } = newSize;
  return {
    width,
    left,
    height: constrainHeight(top, currentSize.height, height),
    top: constrainTop(top),
  };
};

const resizeNorthEast: ResizeHandler = (currentSize, newSize, containerWidth) =>
  resizeNorth(currentSize, resizeEast(currentSize, newSize, containerWidth), containerWidth);

const resizeNorthWest: ResizeHandler = (currentSize, newSize, containerWidth) =>
  resizeNorth(currentSize, resizeWest(currentSize, newSize, containerWidth), containerWidth);

const resizeSouthEast: ResizeHandler = (currentSize, newSize, containerWidth) =>
  resizeSouth(currentSize, resizeEast(currentSize, newSize, containerWidth), containerWidth);

const resizeSouthWest: ResizeHandler = (currentSize, newSize, containerWidth) =>
  resizeSouth(currentSize, resizeWest(currentSize, newSize, containerWidth), containerWidth);

const resizeHandlerMap: Record<ResizeHandleAxis, ResizeHandler> = {
  n: resizeNorth,
  ne: resizeNorthEast,
  e: resizeEast,
  se: resizeSouthEast,
  s: resizeSouth,
  sw: resizeSouthWest,
  w: resizeWest,
  nw: resizeNorthWest,
};

export function resizeItemInDirection(
  direction: ResizeHandleAxis,
  currentSize: Position,
  newSize: Position,
  containerWidth: number
): Position {
  const handler = resizeHandlerMap[direction];
  if (!handler) return newSize;
  return handler(currentSize, { ...currentSize, ...newSize }, containerWidth);
}

export const transformStrategy: PositionStrategy = {
  type: "transform",
  scale: 1,
  calcStyle(pos: Position): Record<string, string> {
    return setTransform(pos);
  },
};

export const absoluteStrategy: PositionStrategy = {
  type: "absolute",
  scale: 1,
  calcStyle(pos: Position): Record<string, string> {
    return setTopLeft(pos);
  },
};

export function createScaledStrategy(scale: number): PositionStrategy {
  return {
    type: "transform",
    scale,
    calcStyle(pos: Position): Record<string, string> {
      return setTransform(pos);
    },
    calcDragPosition(
      clientX: number,
      clientY: number,
      offsetX: number,
      offsetY: number
    ): PartialPosition {
      return {
        left: (clientX - offsetX) / scale,
        top: (clientY - offsetY) / scale,
      };
    },
  };
}

export const defaultPositionStrategy = transformStrategy;
