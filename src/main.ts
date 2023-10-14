import { Viewport } from "../lib";
import { fabric } from "fabric";
import "./styles.css";

const CANVAS_ASPECT_RATIO = 4 / 3;
const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = CANVAS_WIDTH / CANVAS_ASPECT_RATIO;

const canvasContainerEl = document.getElementById("app-canvas-container");
const canvasEl = document.createElement("canvas");
canvasContainerEl?.appendChild(canvasEl);

const rawCanvas = new fabric.Canvas(canvasEl, {
  backgroundColor: "white",
});
const viewport = new Viewport({
  screenHeight: CANVAS_HEIGHT,
  screenWidth: CANVAS_WIDTH,
  worldHeight: 2000,
  worldWidth: 2000,
  scrollbars: true,
});
const canvas = viewport.install(rawCanvas);

const doc = new fabric.Rect({
  top: 50,
  left: 50,
  height: 600,
  width: 400,
  fill: "white",
  stroke: "1px solid #bababa",
});

canvas.add(doc);
viewport.setZoom(1.5);

console.log("viewport transform", canvas.viewportTransform);
