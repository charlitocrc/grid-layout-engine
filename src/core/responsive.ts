import type {
  Breakpoint,
  Breakpoints,
  Compactor,
  CompactType,
  Layout,
  ResponsiveLayouts,
} from "./types.js";
import { cloneLayout, correctBounds } from "./layout.js";
import { getCompactor } from "./compactors.js";

export function sortBreakpoints<B extends Breakpoint>(
  breakpoints: Breakpoints<B>
): B[] {
  const keys = Object.keys(breakpoints) as B[];
  return keys.sort((a, b) => breakpoints[a] - breakpoints[b]);
}

export function getBreakpointFromWidth<B extends Breakpoint>(
  breakpoints: Breakpoints<B>,
  width: number
): B {
  const sorted = sortBreakpoints(breakpoints);
  let matching = sorted[0];

  if (matching === undefined) throw new Error("No breakpoints defined");

  for (let i = 1; i < sorted.length; i++) {
    const breakpointName = sorted[i];
    if (breakpointName === undefined) continue;
    if (width > breakpoints[breakpointName]) matching = breakpointName;
  }

  return matching;
}

export function getColsFromBreakpoint<B extends Breakpoint>(
  breakpoint: B,
  cols: Breakpoints<B>
): number {
  const colCount = cols[breakpoint];
  if (colCount === undefined) {
    throw new Error(
      `ResponsiveGridLayout: \`cols\` entry for breakpoint ${String(breakpoint)} is missing!`
    );
  }
  return colCount;
}

export function findOrGenerateResponsiveLayout<B extends Breakpoint>(
  layouts: ResponsiveLayouts<B>,
  breakpoints: Breakpoints<B>,
  breakpoint: B,
  lastBreakpoint: B,
  cols: number,
  compactTypeOrCompactor: CompactType | Compactor
): Layout {
  const existingLayout = layouts[breakpoint];
  if (existingLayout) return cloneLayout(existingLayout);

  let layout = layouts[lastBreakpoint];
  const breakpointsSorted = sortBreakpoints(breakpoints);
  const breakpointsAbove = breakpointsSorted.slice(
    breakpointsSorted.indexOf(breakpoint)
  );

  for (let i = 0; i < breakpointsAbove.length; i++) {
    const b = breakpointsAbove[i];
    if (b === undefined) continue;
    const layoutForBreakpoint = layouts[b];
    if (layoutForBreakpoint) {
      layout = layoutForBreakpoint;
      break;
    }
  }

  const clonedLayout = cloneLayout(layout || []);
  const corrected = correctBounds(clonedLayout, { cols });
  const compactor: Compactor =
    typeof compactTypeOrCompactor === "object" &&
    compactTypeOrCompactor !== null
      ? compactTypeOrCompactor
      : getCompactor(compactTypeOrCompactor);
  return compactor.compact(corrected, cols);
}

type IndentationValue<B extends Breakpoint> =
  | readonly [number, number]
  | Partial<Record<B, readonly [number, number]>>;

export function getIndentationValue<B extends Breakpoint>(
  value: IndentationValue<B>,
  breakpoint: B
): readonly [number, number] {
  if (Array.isArray(value)) return value as readonly [number, number];

  const breakpointMap = value as Partial<Record<B, readonly [number, number]>>;
  const breakpointValue = breakpointMap[breakpoint];
  if (breakpointValue !== undefined) return breakpointValue;

  const keys = Object.keys(breakpointMap) as B[];
  for (const key of keys) {
    const v = breakpointMap[key];
    if (v !== undefined) return v;
  }

  return [10, 10];
}
