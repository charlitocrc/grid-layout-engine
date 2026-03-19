import { GridLayout } from "./dom/grid-layout.js";
import { ResponsiveGridLayout } from "./dom/responsive-grid-layout.js";
import {
  verticalCompactor,
  horizontalCompactor,
  noCompactor,
  getCompactor,
} from "./core/compactors.js";
import {
  transformStrategy,
  absoluteStrategy,
} from "./core/position.js";
import {
  gridBounds,
  minMaxSize,
  defaultConstraints,
} from "./core/constraints.js";
import { compact, compactItem } from "./core/compact-compat.js";
import { createScaledStrategy } from "./core/position.js";
import { injectStyles } from "./dom/inject-styles.js";

(window as any).GridLayoutEngine = {
  GridLayout,
  ResponsiveGridLayout,
  verticalCompactor,
  horizontalCompactor,
  noCompactor,
  getCompactor,
  transformStrategy,
  absoluteStrategy,
  createScaledStrategy,
  gridBounds,
  minMaxSize,
  defaultConstraints,
  compact,
  compactItem,
  injectStyles,
};
