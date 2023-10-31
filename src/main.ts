import { Viewport, InteractionManager } from "../lib";
import { fabric } from "fabric";
import { clamp, isNil } from "lodash";
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
  panningEnabledWhileHoldingSpace: true,
  dynamicMinMaxZoom: [0.5, 5],
});
const canvas = viewport.install(rawCanvas);
const interactionManager = new InteractionManager(canvas);
const image = fabric.Image.fromURL(documentImageUrl, (img) => {
  img.selectable = false;
  canvas.add(img);
  viewport.resizeWorldToFit(img);
  interactionManager.constrainInteractions(img);

  // viewport.setZoom(1);
  viewport.fitToWorld();
  viewport.setPageAreaTarget(img);

  const noNoObject = new fabric.Circle({
    fill: "red",
    radius: 200,
    left: 700,
    top: 500,
    lockScalingFlip: true,
  });
  const noNoObject2 = new fabric.Circle({
    fill: "red",
    radius: 50,
    left: 900,
    top: 870,
    lockScalingFlip: true,
  });
  canvas.add(noNoObject);
  canvas.add(noNoObject2);
});

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
