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
  top: 150,
  left: 150,
  height: 600,
  width: 400,
  fill: "white",
  data: {
    type: "document",
  },
  selectable: false,
});
canvas.add(doc);

const headerText = new fabric.Textbox("Super Important Document", {
  top: 170,
  left: 170,
  width: 300,
  fontWeight: 600,
  fill: "black",
  fontSize: 18,
});
canvas.add(headerText);

const paragraph1 = new fabric.Textbox(
  "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nullam odio quam, mattis eget augue ut, ornare aliquet turpis. Quisque iaculis nunc ac bibendum accumsan. Etiam porta vel urna quis facilisis. Integer et mi rutrum, fringilla ante in, malesuada sapien. Aenean lacinia arcu nibh, eu volutpat felis lobortis at. Pellentesque eget imperdiet lectus. Integer in neque arcu. Sed efficitur sapien vel nisl maximus, id dignissim ipsum pretium. Suspendisse accumsan, mi quis convallis rutrum, orci lectus scelerisque sapien, at aliquet velit risus in urna. Ut semper fermentum neque, ut fringilla massa hendrerit sit amet. Sed a magna vitae ante suscipit tempus nec sit amet ante. Ut eu nisl in nisl iaculis tincidunt a a mi. Mauris dapibus, diam non fermentum blandit, elit dolor porta tellus, sit amet placerat ante magna sed dui. Sed dignissim sit amet tellus eu venenatis.\n\n Nulla ac lectus sed erat gravida accumsan nec quis felis. Donec et lacus congue, hendrerit lectus nec, dignissim nulla. Maecenas vel eros enim. Mauris pretium tempor leo egestas imperdiet. Nulla blandit varius neque, quis fermentum nibh consectetur vitae. Fusce semper nibh sit amet sapien gravida vehicula. Vivamus et ex enim. Nullam mollis elit purus, sed hendrerit velit tempus consectetur.",
  {
    top: 220,
    left: 170,
    width: 360,
    fontSize: 12,
    fill: "black",
  }
);
canvas.add(paragraph1);

viewport.resizeWorldToFit(doc, {
  paddingX: 20,
  paddingY: 50,
  maintainAspectRatio: true,
  center: true,
});

viewport.fitToWorld();
viewport.setZoom(2.5);
viewport.centerToWorld({ vertical: false });

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
