import type {
  Breakpoint,
  Breakpoints,
  LayoutItem,
  Layout,
  ResponsiveLayouts,
  Compactor,
  PositionStrategy,
  LayoutConstraint,
  DragConfig,
  ResizeConfig,
  DropConfig,
} from "../core/types.js";
import {
  getBreakpointFromWidth,
  getColsFromBreakpoint,
  findOrGenerateResponsiveLayout,
  getIndentationValue,
} from "../core/responsive.js";
import { cloneLayout } from "../core/layout.js";
import { verticalCompactor } from "../core/compactors.js";
import { GridLayout } from "./grid-layout.js";

type MarginValue<B extends Breakpoint> =
  | readonly [number, number]
  | Partial<Record<B, readonly [number, number]>>;

export const DEFAULT_BREAKPOINTS: Breakpoints<string> = { lg: 1200, md: 996, sm: 768, xs: 480, xxs: 0 };
export const DEFAULT_COLS: Breakpoints<string> = { lg: 12, md: 10, sm: 6, xs: 4, xxs: 2 };

export interface ResponsiveGridLayoutOptions<B extends Breakpoint = Breakpoint> {
  breakpoints?: Breakpoints<B>;
  cols?: Breakpoints<B>;
  layouts?: ResponsiveLayouts<B>;
  rowHeight?: number;
  maxRows?: number;
  margin?: MarginValue<B>;
  containerPadding?: MarginValue<B> | null;
  compactor?: Compactor;
  positionStrategy?: PositionStrategy;
  constraints?: LayoutConstraint[];
  dragConfig?: Partial<DragConfig>;
  resizeConfig?: Partial<ResizeConfig>;
  dropConfig?: Partial<DropConfig>;
  autoSize?: boolean;
  className?: string;
}

export class ResponsiveGridLayout extends GridLayout {
  private breakpoints: Breakpoints<string>;
  private breakpointCols: Breakpoints<string>;
  private layouts: ResponsiveLayouts<string>;
  private currentBreakpoint: string;
  private currentCols: number;
  private rowHeight: number;
  private maxRows: number;
  private marginValue: MarginValue<string>;
  private containerPaddingValue: MarginValue<string> | null;
  private respCompactor: Compactor;
  private lastWidth: number = 0;

  constructor(
    container: HTMLElement,
    opts: ResponsiveGridLayoutOptions<string>
  ) {
    const compactor = opts.compactor ?? verticalCompactor;
    const initialWidth = container.clientWidth;
    const breakpointsMap = opts.breakpoints ?? DEFAULT_BREAKPOINTS;
    const colsMap = opts.cols ?? DEFAULT_COLS;

    const breakpoint = getBreakpointFromWidth(breakpointsMap, initialWidth);
    const cols = getColsFromBreakpoint(breakpoint, colsMap);

    const margin = getIndentationValue(
      opts.margin ?? [10, 10],
      breakpoint
    );
    const containerPadding = opts.containerPadding
      ? getIndentationValue(opts.containerPadding as MarginValue<string>, breakpoint)
      : null;

    const layouts = opts.layouts ?? {};
    const layout = findOrGenerateResponsiveLayout(
      layouts,
      breakpointsMap,
      breakpoint,
      breakpoint,
      cols,
      compactor
    );

    super(container, {
      layout: layout as LayoutItem[],
      gridConfig: {
        cols,
        rowHeight: opts.rowHeight ?? 150,
        maxRows: opts.maxRows ?? Infinity,
        margin: margin as [number, number],
        containerPadding: containerPadding as [number, number] | null,
      },
      dragConfig: opts.dragConfig,
      resizeConfig: opts.resizeConfig,
      dropConfig: opts.dropConfig,
      compactor,
      positionStrategy: opts.positionStrategy,
      constraints: opts.constraints,
      autoSize: opts.autoSize,
      className: opts.className,
    });

    this.breakpoints = breakpointsMap;
    this.breakpointCols = colsMap;
    this.layouts = { ...layouts };
    this.currentBreakpoint = breakpoint;
    this.currentCols = cols;
    this.rowHeight = opts.rowHeight ?? 150;
    this.maxRows = opts.maxRows ?? Infinity;
    this.marginValue = opts.margin ?? [10, 10];
    this.containerPaddingValue = opts.containerPadding ?? null;
    this.respCompactor = compactor;
    this.lastWidth = initialWidth;

    this.layouts[breakpoint] = cloneLayout(layout);

    this.on("widthChange", (width: unknown) => {
      this.handleWidthChange(width as number);
    });

    this.on("layoutChange", (layout: unknown) => {
      this.layouts[this.currentBreakpoint] = cloneLayout(layout as Layout);
      this.emit("responsiveLayoutChange", this.getLayout(), this.getLayouts());
    });
  }

  private handleWidthChange(width: number): void {
    if (Math.abs(width - this.lastWidth) < 1) return;
    this.lastWidth = width;

    const newBreakpoint = getBreakpointFromWidth(this.breakpoints, width);
    const newCols = getColsFromBreakpoint(newBreakpoint, this.breakpointCols);

    if (newBreakpoint !== this.currentBreakpoint || newCols !== this.currentCols) {
      const lastBreakpoint = this.currentBreakpoint;

      if (!this.layouts[lastBreakpoint]) {
        this.layouts[lastBreakpoint] = this.getLayout();
      }

      this.currentBreakpoint = newBreakpoint;
      this.currentCols = newCols;

      const newLayout = findOrGenerateResponsiveLayout(
        this.layouts,
        this.breakpoints,
        newBreakpoint,
        lastBreakpoint,
        newCols,
        this.respCompactor
      );

      this.layouts[newBreakpoint] = cloneLayout(newLayout);

      const newMargin = getIndentationValue(this.marginValue, newBreakpoint);
      const newContainerPadding = this.containerPaddingValue
        ? getIndentationValue(this.containerPaddingValue as MarginValue<string>, newBreakpoint)
        : null;

      this.setOptions({
        gridConfig: {
          cols: newCols,
          rowHeight: this.rowHeight,
          maxRows: this.maxRows,
          margin: newMargin as [number, number],
          containerPadding: newContainerPadding as [number, number] | null,
        },
      });

      this.emit("breakpointChange", newBreakpoint, newCols);

      this.setLayout(newLayout as LayoutItem[]);
    }

    const currentMargin = getIndentationValue(this.marginValue, this.currentBreakpoint);
    const currentContainerPadding = this.containerPaddingValue
      ? getIndentationValue(this.containerPaddingValue as MarginValue<string>, this.currentBreakpoint)
      : null;
    this.emit("responsiveWidthChange", width, currentMargin, this.currentCols, currentContainerPadding);
  }

  getBreakpoint(): string {
    return this.currentBreakpoint;
  }

  getCols(): number {
    return this.currentCols;
  }

  getLayouts(): ResponsiveLayouts<string> {
    const result: ResponsiveLayouts<string> = {};
    for (const key of Object.keys(this.layouts)) {
      const layout = this.layouts[key];
      if (layout) result[key] = cloneLayout(layout);
    }
    return result;
  }

  setLayouts(layouts: ResponsiveLayouts<string>): void {
    this.layouts = { ...layouts };

    const currentLayout = this.layouts[this.currentBreakpoint];
    if (currentLayout) {
      this.setLayout(cloneLayout(currentLayout));
    }

    this.emit("responsiveLayoutChange", this.getLayout(), this.getLayouts());
  }
}
