# fabric-viewport

A simple 2d viewport for [fabric.js](https://github.com/fabricjs/fabric.js). Supports virtual scrollbars to scroll within the canvas when contents exceed the viewport.

## Example

```ts
const canvas = new fabric.Canvas("canvas-element", {
  backgroundColor: "white",
});
const viewport = new Viewport({
  screenHeight: 800,
  screenWidth: 1080,
  worldHeight: 2000,
  worldWidth: 2000,
  scrollbars: true,
});
viewport.install(canvas);

const doc = new fabric.Rect({ ... })
canvas.add(doc);

// Resizes the world to fit a fabric object
viewport.fitWorld(doc, { padding: 20});
// Zooms and translates the viewport to fit a fabric object
viewport.fit(doc)
```

_Work in progress..._
