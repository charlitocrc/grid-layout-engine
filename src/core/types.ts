export type ResizeHandleAxis =
  | "s"
  | "w"
  | "e"
  | "n"
  | "sw"
  | "nw"
  | "se"
  | "ne";

export interface LayoutItem {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  maxW?: number;
  maxH?: number;
  static?: boolean;
  isDraggable?: boolean;
  isResizable?: boolean;
  resizeHandles?: ResizeHandleAxis[];
  isBounded?: boolean;
  moved?: boolean;
  constraints?: LayoutConstraint[];
}

export type Layout = readonly LayoutItem[];

export interface Position {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PartialPosition {
  left: number;
  top: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface DroppingPosition {
  left: number;
  top: number;
  e: Event;
}

export interface DragCallbackData {
  node: HTMLElement;
  x?: number;
  y?: number;
  deltaX: number;
  deltaY: number;
  lastX?: number;
  lastY?: number;
}

export interface GridDragEvent {
  e: Event;
  node: HTMLElement;
  newPosition: PartialPosition;
}

export interface GridResizeEvent {
  e: Event;
  node: HTMLElement;
  size: Size;
  handle: ResizeHandleAxis;
}

export type CompactType = "horizontal" | "vertical" | "wrap" | null;

export type EventCallback = (
  layout: Layout,
  oldItem: LayoutItem | null,
  newItem: LayoutItem | null,
  placeholder: LayoutItem | null,
  event: Event,
  element: HTMLElement | null
) => void;

export type OnLayoutChangeCallback = (layout: Layout) => void;

export interface Compactor {
  readonly type: CompactType;
  readonly allowOverlap: boolean;
  readonly preventCollision?: boolean;
  compact(layout: Layout, cols: number): Layout;
}

export interface PositionStrategy {
  readonly type: "transform" | "absolute";
  readonly scale: number;
  calcStyle(pos: Position): Record<string, string>;
  calcDragPosition?(
    clientX: number,
    clientY: number,
    offsetX: number,
    offsetY: number
  ): PartialPosition;
}

export interface ConstraintContext {
  cols: number;
  maxRows: number;
  containerWidth: number;
  containerHeight: number;
  rowHeight: number;
  margin: readonly [number, number];
  layout: Layout;
}

export interface LayoutConstraint {
  readonly name: string;
  constrainPosition?(
    item: LayoutItem,
    x: number,
    y: number,
    context: ConstraintContext
  ): { x: number; y: number };
  constrainSize?(
    item: LayoutItem,
    w: number,
    h: number,
    handle: ResizeHandleAxis,
    context: ConstraintContext
  ): { w: number; h: number };
}

export interface GridConfig {
  cols: number;
  rowHeight: number;
  margin: readonly [number, number];
  containerPadding: readonly [number, number] | null;
  maxRows: number;
}

export const defaultGridConfig: GridConfig = {
  cols: 12,
  rowHeight: 150,
  margin: [10, 10],
  containerPadding: null,
  maxRows: Infinity,
};

export interface DragConfig {
  enabled: boolean;
  bounded: boolean;
  handle?: string;
  cancel?: string;
  threshold: number;
}

export const defaultDragConfig: DragConfig = {
  enabled: true,
  bounded: false,
  threshold: 3,
};

export interface ResizeConfig {
  enabled: boolean;
  handles: readonly ResizeHandleAxis[];
  handleRenderer?: (
    axis: ResizeHandleAxis,
    el: HTMLElement
  ) => HTMLElement | null;
}

export const defaultResizeConfig: ResizeConfig = {
  enabled: true,
  handles: ["se"],
};

export interface DropConfig {
  enabled: boolean;
  defaultItem: { w: number; h: number };
  onDragOver?: (
    e: DragEvent
  ) =>
    | { w?: number; h?: number; dragOffsetX?: number; dragOffsetY?: number }
    | false
    | void;
}

export const defaultDropConfig: DropConfig = {
  enabled: false,
  defaultItem: { w: 1, h: 1 },
};

export type Breakpoint = string;

export type Breakpoints<B extends Breakpoint = Breakpoint> = Record<B, number>;

export type BreakpointCols<B extends Breakpoint = Breakpoint> = Record<
  B,
  number
>;

export type ResponsiveLayouts<B extends Breakpoint = Breakpoint> = Partial<
  Record<B, Layout>
>;

export type OnBreakpointChangeCallback<B extends Breakpoint = Breakpoint> = (
  newBreakpoint: B,
  cols: number
) => void;

export type Mutable<T> = {
  -readonly [P in keyof T]: T[P];
};

export interface GridLayoutEventMap extends Record<string, unknown[]> {
  layoutChange: [layout: Layout];
  dragStart: [layout: Layout, oldItem: LayoutItem | null, newItem: LayoutItem | null, placeholder: LayoutItem | null, event: Event | null, element: HTMLElement | null];
  drag: [layout: Layout, oldItem: LayoutItem | null, newItem: LayoutItem | null, placeholder: LayoutItem | null, event: Event | null, element: HTMLElement | null];
  dragStop: [layout: Layout, oldItem: LayoutItem | null, newItem: LayoutItem | null, placeholder: LayoutItem | null, event: Event | null, element: HTMLElement | null];
  resizeStart: [layout: Layout, oldItem: LayoutItem | null, newItem: LayoutItem | null, placeholder: LayoutItem | null, event: Event | null, element: HTMLElement | null];
  resize: [layout: Layout, oldItem: LayoutItem | null, newItem: LayoutItem | null, placeholder: LayoutItem | null, event: Event | null, element: HTMLElement | null];
  resizeStop: [layout: Layout, oldItem: LayoutItem | null, newItem: LayoutItem | null, placeholder: LayoutItem | null, event: Event | null, element: HTMLElement | null];
  drop: [layout: Layout, item: LayoutItem, event: DragEvent];
  widthChange: [width: number];
  breakpointChange: [breakpoint: string, cols: number];
  responsiveWidthChange: [width: number, margin: readonly [number, number], cols: number, containerPadding: readonly [number, number] | null];
  responsiveLayoutChange: [layout: Layout, layouts: ResponsiveLayouts<string>];
}
