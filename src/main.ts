import { Viewport } from "../lib";
import { fabric } from "fabric";
import { isNil } from "lodash";
import "./styles.css";
import documentImageUrl from "./download.jpeg";

const CANVAS_ASPECT_RATIO = 4 / 3;
const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = CANVAS_WIDTH / CANVAS_ASPECT_RATIO;

const canvasContainerEl = document.getElementById("app-canvas-container");
const canvasEl = document.createElement("canvas");
canvasContainerEl?.appendChild(canvasEl);

const rawCanvas = new fabric.Canvas(canvasEl, {
  backgroundColor: "#f1f1f1",
});
const viewport = new Viewport({
  screenHeight: CANVAS_HEIGHT,
  screenWidth: CANVAS_WIDTH,
  worldHeight: 2000,
  worldWidth: 6000,
  scrollbars: true,
  worldBackgroundColor: "#f1f1f1",
});
const canvas = viewport.install(rawCanvas);
const image = fabric.Image.fromURL(documentImageUrl, (img) => {
  img.selectable = false;
  canvas.add(img);
  viewport.resizeWorldToFit(img, {
    // paddingX: 20,
    // paddingY: 50,
    maintainAspectRatio: true,
    center: true,
  });

  let draggingContext = {
    isDragging: false,
    lastX: 0,
    lastY: 0,
  };

  // viewport.setZoom(2);
  viewport.fitToWorld();
  viewport.setPageAreaTarget(img, { paddingX: 20, paddingY: 20 });

  const noNoObject = new fabric.Circle({
    fill: "red",
    radius: 200,
    left: 500,
    top: 500,
  });
  const noNoObject2 = new fabric.Circle({
    fill: "red",
    radius: 50,
    left: 900,
    top: 870,
  });
  // noNoObject.lockMovementX = true;
  // noNoObject.lockMovementY = true;
  canvas.add(noNoObject);
  canvas.add(noNoObject2);

  canvas.on("object:moving", (e) => {
    const obj = e.target;
    if (isNil(obj)) return;

    const objCoords = obj.aCoords;
    const imgBounds = img.aCoords;
    if (isNil(objCoords) || isNil(objCoords.tl.x) || isNil(imgBounds)) return;

    if (objCoords.tl.x < imgBounds.tl.x) {
      obj.left = imgBounds.tl.x;
      obj.lockMovementX = true;
    }
    // console.log("object:moving", e);
  });

  canvas.on("object:modified", (e) => {
    console.log("object:modified", e);
    const obj = e.target;
    if (isNil(obj)) return;

    obj.lockMovementX = false;
    obj.lockMovementY = false;
  });

  canvas.on("mouse:down", (e) => {
    if (isNil(canvas.getActiveObject())) return;

    draggingContext.isDragging = true;
    // console.log("mouse:down", e);
    console.log(canvas.getActiveObject());
  });

  canvas.on("mouse:move:before", (e) => {});

  canvas.on("before:transform", (e) => {
    console.log("before:transform", e);
  });

  // viewport.setZoom(0.65);

  // I essentially want the viewport to use the image instead
  // of the world to calculate the scrollable area and limit
  // panning to its rectangle.
});

// Should zoom / translate the viewport such that the target
// object fits just right within the viewport.
// viewport.fit(doc);

console.log(canvas._objects);

console.log("viewport transform", canvas.viewportTransform);

/**
 * TODOS:
 *  - Make the scrollbars click/drag-able to move the world around
 *  - Add an option for allowing panning past the world boundaries
 * with a little added friction and then "snap" back to the boundary.
 *  - Refactor all transformation-matrix based methods to use the
 * same underlying primitive (that also updates scrollbars).
 */
