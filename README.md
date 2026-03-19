# Grid Layout Engine

A pure JavaScript draggable, resizable grid layout engine with **no framework dependencies**. Build dashboards, admin panels, or any grid-based UI with vanilla JS, React, Vue, or any framework.

## Features

- **Framework-agnostic** — Use with vanilla JS, React, Vue, Svelte, or any framework
- **Draggable & resizable** — Full 8-handle resize support (n, s, e, w, ne, nw, se, sw)
- **Collision handling** — Prevent overlap or allow free stacking
- **Pluggable compactors** — Vertical, horizontal, or custom compaction algorithms
- **Constraints** — Per-item min/max size, grid bounds, aspect ratio, custom constraints
- **Drop from outside** — Drag external elements into the grid
- **Responsive** — Breakpoint-based layouts with `ResponsiveGridLayout`
- **Scaled containers** — Works inside CSS-scaled parents (zoom, transforms)
- **TypeScript** — Full type definitions included

## Installation

```bash
npm install grid-layout-engine
```

## Quick Start

```html
<div id="grid-container"></div>
<script src="node_modules/grid-layout-engine/dist/grid-layout-engine.min.js"></script>
<script>
  const GLE = window.GridLayoutEngine;
  GLE.injectStyles();

  const container = document.getElementById("grid-container");
  const layout = [
    { i: "a", x: 0, y: 0, w: 4, h: 2 },
    { i: "b", x: 4, y: 0, w: 4, h: 3 },
    { i: "c", x: 8, y: 0, w: 4, h: 2 },
  ];

  const grid = new GLE.GridLayout(container, {
    layout,
    gridConfig: { cols: 12, rowHeight: 60, margin: [8, 8], containerPadding: [8, 8] },
  });

  layout.forEach((item) => {
    const el = document.createElement("div");
    el.textContent = item.i.toUpperCase();
    grid.addItem(el, item);
  });
</script>
```

## Usage (ES Modules)

```javascript
import { GridLayout, injectStyles } from "grid-layout-engine";

injectStyles();

const container = document.getElementById("grid-container");
const grid = new GridLayout(container, {
  layout: [
    { i: "a", x: 0, y: 0, w: 4, h: 2 },
    { i: "b", x: 4, y: 0, w: 4, h: 2 },
  ],
  gridConfig: { cols: 12, rowHeight: 60, margin: [8, 8] },
});

layout.forEach((item) => {
  const el = document.createElement("div");
  el.textContent = item.i;
  grid.addItem(el, item);
});

grid.on("layoutChange", (layout) => console.log("Layout changed:", layout));
```

## Layout Item Schema

```typescript
interface LayoutItem {
  i: string;           // Unique ID
  x: number;           // X position (grid units)
  y: number;           // Y position (grid units)
  w: number;           // Width (grid units)
  h: number;           // Height (grid units)
  minW?: number;       // Min width (default: 1)
  maxW?: number;       // Max width
  minH?: number;       // Min height (default: 1)
  maxH?: number;       // Max height
  static?: boolean;    // Cannot be moved/resized
  isDraggable?: boolean;
  isResizable?: boolean;
  resizeHandles?: ResizeHandleAxis[];  // e.g. ["se", "s", "e"]
  isBounded?: boolean; // Constrain to container
}
```

## Configuration

### GridConfig

```javascript
{
  cols: 12,
  rowHeight: 60,
  margin: [8, 8],
  containerPadding: [8, 8],
  maxRows: Infinity,
}
```

### DragConfig

```javascript
{
  enabled: true,
  bounded: false,
  handle: ".drag-handle",  // CSS selector
  cancel: ".no-drag",      // CSS selector
  threshold: 3,
}
```

### ResizeConfig

```javascript
{
  enabled: true,
  handles: ["se", "s", "e", "n", "w", "nw", "ne", "sw"],
}
```

### DropConfig

```javascript
{
  enabled: true,
  defaultItem: { w: 2, h: 2 },
  onDragOver: (e) => ({ w: 3, h: 2 }),
}
```

## Events

```javascript
grid.on("layoutChange", (layout) => { /* layout updated */ });
grid.on("dragStart", (layout, oldItem, newItem, placeholder, e, node) => {});
grid.on("drag", (layout, oldItem, newItem, placeholder, e, node) => {});
grid.on("dragStop", (layout, oldItem, newItem, placeholder, e, node) => {});
grid.on("resizeStart", (layout, oldItem, newItem, placeholder, e, node) => {});
grid.on("resize", (layout, oldItem, newItem, placeholder, e, node) => {});
grid.on("resizeStop", (layout, oldItem, newItem, placeholder, e, node) => {});
grid.on("drop", (layout, droppedItem, e) => {});
grid.on("widthChange", (newWidth) => {});
```

## Compactors

```javascript
import {
  verticalCompactor,
  horizontalCompactor,
  noCompactor,
  getCompactor,
} from "grid-layout-engine";

// Vertical (default) — items float up
compactor: verticalCompactor

// Horizontal — items float left
compactor: horizontalCompactor

// No compaction — free positioning
compactor: noCompactor

// With overlap and collision prevention
compactor: getCompactor("vertical", true)   // allowOverlap
compactor: getCompactor("vertical", false, true)  // preventCollision
```

## Constraints

```javascript
import {
  gridBounds,
  minMaxSize,
  aspectRatio,
  defaultConstraints,
} from "grid-layout-engine";

// Default: gridBounds + minMaxSize
constraints: defaultConstraints

// Custom: 16:9 aspect ratio
constraints: [gridBounds, minMaxSize, aspectRatio(16 / 9)]
```

## Responsive Layouts

```javascript
import { ResponsiveGridLayout } from "grid-layout-engine";

const responsive = new ResponsiveGridLayout(container, {
  layouts: {
    lg: [/* large screen layout */],
    md: [/* medium screen layout */],
    sm: [/* small screen layout */],
  },
  breakpoints: { lg: 1200, md: 996, sm: 768 },
  cols: { lg: 12, md: 10, sm: 6 },
});
```

## Using the min.js in Pure JavaScript

No build step required. Include the minified IIFE bundle via a `<script>` tag and use `window.GridLayoutEngine` in vanilla JS.

### Getting the file

**Option A — npm (local):**
```bash
npm install grid-layout-engine
```
Then reference: `node_modules/grid-layout-engine/dist/grid-layout-engine.min.js`

**Option B — CDN (unpkg):**
```html
<script src="https://unpkg.com/grid-layout-engine-js@0.1.0/dist/grid-layout-engine.min.js"></script>
```

**Option C — Copy the file** from `dist/grid-layout-engine.min.js` into your project.

### Basic usage

```html
<div id="grid-container"></div>

<script src="path/to/grid-layout-engine.min.js"></script>
<script>
  // The library exposes everything on window.GridLayoutEngine
  const GLE = window.GridLayoutEngine;

  // Required: inject default styles for drag handles and resize cursors
  GLE.injectStyles();

  const container = document.getElementById("grid-container");
  const layout = [
    { i: "a", x: 0, y: 0, w: 4, h: 2 },
    { i: "b", x: 4, y: 0, w: 4, h: 3 },
    { i: "c", x: 8, y: 0, w: 4, h: 2 },
  ];

  const grid = new GLE.GridLayout(container, {
    layout,
    gridConfig: { cols: 12, rowHeight: 60, margin: [8, 8], containerPadding: [8, 8] },
  });

  layout.forEach((item) => {
    const el = document.createElement("div");
    el.textContent = item.i.toUpperCase();
    grid.addItem(el, item);
  });

  grid.on("layoutChange", (layout) => console.log("Layout changed:", layout));
</script>
```

### Available exports on `window.GridLayoutEngine`

| Export | Description |
|--------|-------------|
| `GridLayout` | Main grid layout class |
| `ResponsiveGridLayout` | Breakpoint-based responsive layouts |
| `injectStyles()` | Injects required CSS (call once) |
| `verticalCompactor`, `horizontalCompactor`, `noCompactor`, `getCompactor` | Compaction algorithms |
| `gridBounds`, `minMaxSize`, `defaultConstraints` | Constraint helpers |
| `transformStrategy`, `absoluteStrategy`, `createScaledStrategy` | Position strategies |
| `compact`, `compactItem` | Layout compaction utilities |

## Core API (Framework-Agnostic)

Use the core module for layout logic without DOM:

```javascript
import {
  moveElement,
  collides,
  getAllCollisions,
  verticalCompactor,
  calcGridItemPosition,
  resizeItemInDirection,
} from "grid-layout-engine/core";
```

## Playground

Run the interactive playground:

```bash
npm run build
npx serve . -p 4000
# Open http://localhost:4000/playground/
```

## Building

```bash
npm install
npm run build
```

Output: `dist/` (ESM, CJS, IIFE, TypeScript declarations)

## Testing

```bash
npm test
```

## Project Structure

```
src/
├── core/           # Pure logic (no DOM)
│   ├── types.ts
│   ├── layout.ts
│   ├── collision.ts
│   ├── compactors.ts
│   ├── constraints.ts
│   ├── calculate.ts
│   ├── position.ts
│   └── responsive.ts
├── dom/            # DOM bindings
│   ├── grid-layout.ts
│   ├── grid-item.ts
│   ├── resize-manager.ts
│   ├── drag-manager.ts
│   └── inject-styles.ts
└── browser.ts      # IIFE bundle entry
```

## License

MIT