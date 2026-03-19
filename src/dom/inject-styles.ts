const injectedPrefixes = new Set<string>();

function generateCSS(p: string): string {
  return `.${p}-layout {
  position: relative;
  transition: height 200ms ease;
}
.${p}-item {
  transition: all 200ms ease;
  transition-property: left, top, width, height;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}
.${p}-item img {
  pointer-events: none;
  user-select: none;
}
.${p}-item.${p}-css-transforms {
  transition-property: transform, width, height;
}
.${p}-item.${p}-resizing {
  transition: none;
  z-index: 1;
  will-change: width, height;
}
.${p}-item.${p}-dragging {
  transition: none;
  z-index: 3;
  will-change: transform;
}
.${p}-item.${p}-dropping {
  visibility: hidden;
}
.${p}-item.${p}-placeholder {
  background: red;
  opacity: 0.2;
  transition-duration: 100ms;
  z-index: 2;
  user-select: none;
}
.${p}-item.${p}-placeholder.${p}-placeholder-resizing {
  transition: none;
}
.${p}-item > .${p}-resizable-handle {
  position: absolute;
  width: 20px;
  height: 20px;
  opacity: 0;
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}
.${p}-item:hover > .${p}-resizable-handle {
  opacity: 1;
}
.${p}-item > .${p}-resizable-handle::after {
  content: "";
  position: absolute;
  right: 3px;
  bottom: 3px;
  width: 5px;
  height: 5px;
  border-right: 2px solid rgba(0, 0, 0, 0.4);
  border-bottom: 2px solid rgba(0, 0, 0, 0.4);
}
.${p}-resizable-hide > .${p}-resizable-handle {
  display: none;
}
.${p}-item > .${p}-resizable-handle-sw {
  bottom: 0;
  left: 0;
  cursor: sw-resize;
  transform: rotate(90deg);
}
.${p}-item > .${p}-resizable-handle-se {
  bottom: 0;
  right: 0;
  cursor: se-resize;
}
.${p}-item > .${p}-resizable-handle-nw {
  top: 0;
  left: 0;
  cursor: nw-resize;
  transform: rotate(180deg);
}
.${p}-item > .${p}-resizable-handle-ne {
  top: 0;
  right: 0;
  cursor: ne-resize;
  transform: rotate(270deg);
}
.${p}-item > .${p}-resizable-handle-w,
.${p}-item > .${p}-resizable-handle-e {
  top: 50%;
  margin-top: -10px;
  cursor: ew-resize;
}
.${p}-item > .${p}-resizable-handle-w {
  left: 0;
  transform: rotate(135deg);
}
.${p}-item > .${p}-resizable-handle-e {
  right: 0;
  transform: rotate(315deg);
}
.${p}-item > .${p}-resizable-handle-n,
.${p}-item > .${p}-resizable-handle-s {
  left: 50%;
  margin-left: -10px;
  cursor: ns-resize;
}
.${p}-item > .${p}-resizable-handle-n {
  top: 0;
  transform: rotate(225deg);
}
.${p}-item > .${p}-resizable-handle-s {
  bottom: 0;
  transform: rotate(45deg);
}
body:has(.${p}-dragging),
body:has(.${p}-resizing) {
  user-select: none;
  -webkit-user-select: none;
  -moz-user-select: none;
  -ms-user-select: none;
}`;
}

export function injectStyles(classPrefix: string = "grid"): void {
  if (injectedPrefixes.has(classPrefix)) return;
  injectedPrefixes.add(classPrefix);

  const style = document.createElement("style");
  style.setAttribute("data-grid-layout-engine", classPrefix);
  style.textContent = generateCSS(classPrefix);
  document.head.appendChild(style);
}
