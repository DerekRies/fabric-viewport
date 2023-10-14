import { fabric } from "fabric";
import { clamp } from "./utils";
import "./scrollbar.css";

export interface ViewportOptions {
  screenWidth: number;
  screenHeight: number;
  worldWidth: number;
  worldHeight: number;
  scrollbars?: boolean;
}

export class Viewport {
  private screenWidth: number;
  private screenHeight: number;
  private worldWidth: number;
  private worldHeight: number;
  private isInstalled: boolean;
  private showingScrollbars: boolean;

  private fabricWorldObject: fabric.Rect | undefined;
  private canvas: fabric.Canvas | undefined;

  private horizontalScrollbarThumbEl: HTMLDivElement | undefined;
  private verticalScrollbarThumbEl: HTMLDivElement | undefined;
  private horizontalScrollbarContainerEl: HTMLDivElement | undefined;
  private verticalScrollbarContainerEl: HTMLDivElement | undefined;

  private scrollbarHeight: number = 0;
  private scrollbarWidth: number = 0;
  private zoom = 1;

  private scrollFactor = 0.5;

  // private isDragging = false;
  private draggingContext = {
    isDragging: false,
    lastX: 0,
    lastY: 0,
  };

  constructor({
    screenHeight,
    screenWidth,
    worldHeight,
    worldWidth,
    scrollbars = true,
  }: ViewportOptions) {
    this.screenHeight = screenHeight;
    this.screenWidth = screenWidth;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.showingScrollbars = scrollbars;
    this.isInstalled = false;
  }

  private installFabricCanvas(canvas: fabric.Canvas) {
    this.canvas = canvas;
    canvas.setDimensions({
      width: this.screenWidth,
      height: this.screenHeight,
    });
    this.fabricWorldObject = new fabric.Rect({
      left: 0,
      top: 0,
      width: this.worldWidth,
      height: this.worldHeight,
      selectable: false,
      fill: "#f1f1f1",
    });
    canvas.add(this.fabricWorldObject);
    this.injectScrollbars();
    canvas.on("mouse:down", this.handleMouseDown);
    canvas.on("mouse:move", this.handleMouseMove);
    canvas.on("mouse:up", this.handleMouseUp);
    canvas.on("mouse:wheel", this.handleMouseWheel);
  }

  private handleMouseWheel = (opt: fabric.IEvent<WheelEvent>) => {
    console.log("mousewheel", opt.e.deltaY);
    this.translate(0, -1 * opt.e.deltaY * this.scrollFactor);
  };

  private handleMouseDown = (opt: fabric.IEvent<MouseEvent>) => {
    this.draggingContext.isDragging = true;
    this.draggingContext.lastX = opt.e.clientX;
    this.draggingContext.lastY = opt.e.clientY;
  };

  private handleMouseMove = (opt: fabric.IEvent<MouseEvent>) => {
    if (!this.draggingContext.isDragging || this.canvas == undefined) return;
    if (!opt.e.ctrlKey) return;
    this.canvas.selection = false;

    const deltaX = opt.e.clientX - this.draggingContext.lastX;
    const deltaY = opt.e.clientY - this.draggingContext.lastY;

    this.translate(deltaX, deltaY);

    this.draggingContext.lastX = opt.e.clientX;
    this.draggingContext.lastY = opt.e.clientY;
  };

  translate(deltaX: number, deltaY: number) {
    if (this.canvas == undefined) return;
    const vpt = this.canvas.viewportTransform;
    if (vpt == undefined) return;

    const zoom = this.canvas.getZoom();
    const nextTranslateX = vpt[4] + deltaX;
    const nextTranslateY = vpt[5] + deltaY;

    const rightBorder =
      -1 *
      (this.worldWidth -
        this.screenWidth +
        this.worldWidth * zoom -
        this.worldWidth);
    const bottomBorder =
      -1 *
      (this.worldHeight -
        this.screenHeight +
        this.worldHeight * zoom -
        this.worldHeight);

    vpt[4] = clamp(Math.min(rightBorder, 0), nextTranslateX, 0);
    vpt[5] = clamp(Math.min(bottomBorder, 0), nextTranslateY, 0);

    this.canvas.requestRenderAll();
    this.calculateScrollbars();
  }

  private handleMouseUp = (opt: fabric.IEvent<MouseEvent>) => {
    if (this.draggingContext.isDragging) {
      this.canvas!.selection = true;
    }
    this.draggingContext.isDragging = false;
  };

  private injectScrollbars() {
    const containerEl = this.canvas?.getElement().parentElement;
    if (containerEl == undefined) return;

    // const scrollbarContainer = document.createElement("div");
    // scrollbarContainer.id = "fabric-viewport-virtual-scrollbar-root";

    const verticalScrollbarContainer = document.createElement("div");
    verticalScrollbarContainer.className =
      "fv-virtual-scrollbar-container vertical-scrollbar";
    const verticalScrollbarThumb = document.createElement("div");
    verticalScrollbarThumb.className = "fv-virtual-scrollbar-thumb";
    verticalScrollbarContainer.appendChild(verticalScrollbarThumb);

    const horizontalScrollbarContainer = document.createElement("div");
    horizontalScrollbarContainer.className =
      "fv-virtual-scrollbar-container horizontal-scrollbar";
    const horizontalScrollbarThumb = document.createElement("div");
    horizontalScrollbarThumb.className = "fv-virtual-scrollbar-thumb";
    horizontalScrollbarContainer.appendChild(horizontalScrollbarThumb);

    // scrollbarContainer.appendChild(verticalScrollbarContainer);
    // scrollbarContainer.appendChild(horizontalScrollbarContainer);
    // containerEl.appendChild(scrollbarContainer);
    containerEl.appendChild(verticalScrollbarContainer);
    containerEl.appendChild(horizontalScrollbarContainer);

    this.verticalScrollbarThumbEl = verticalScrollbarThumb;
    this.horizontalScrollbarThumbEl = horizontalScrollbarThumb;
    this.horizontalScrollbarContainerEl = horizontalScrollbarContainer;
    this.verticalScrollbarContainerEl = verticalScrollbarContainer;

    this.scrollbarHeight =
      verticalScrollbarContainer.getBoundingClientRect().height;
    this.scrollbarWidth =
      horizontalScrollbarContainer.getBoundingClientRect().width;
    this.calculateScrollbars(true);
  }

  private calculateScrollbars(recalcThumbSize = false) {
    if (
      this.canvas == undefined ||
      this.fabricWorldObject == undefined ||
      this.verticalScrollbarThumbEl == undefined ||
      this.horizontalScrollbarThumbEl == undefined ||
      this.horizontalScrollbarContainerEl == undefined ||
      this.verticalScrollbarContainerEl == undefined
    ) {
      return;
    }
    const viewportBounds = this.calcViewportBoundaries();
    const worldBounds = this.fabricWorldObject.getBoundingRect(true);

    const headRoom = viewportBounds.top - worldBounds.top;
    const headRoomPct = headRoom / worldBounds.height;
    const viewportVerticalPct = viewportBounds.height / worldBounds.height;

    const leftSideRoom = viewportBounds.left - worldBounds.left;
    const leftSideRoomPct = leftSideRoom / worldBounds.width;
    const viewportHorizontalPct = viewportBounds.width / worldBounds.width;

    if (recalcThumbSize) {
      if (viewportVerticalPct >= 1) {
        this.verticalScrollbarContainerEl.style.display = "none";
      } else {
        this.verticalScrollbarContainerEl.style.display = "block";
      }

      if (viewportHorizontalPct >= 1) {
        this.horizontalScrollbarContainerEl.style.display = "none";
      } else {
        this.horizontalScrollbarContainerEl.style.display = "block";
      }

      this.verticalScrollbarThumbEl.style.height = `${Math.round(
        viewportVerticalPct * 100
      )}%`;
      this.horizontalScrollbarThumbEl.style.width = `${Math.round(
        viewportHorizontalPct * 100
      )}%`;
    }

    const verticalTranslatePx = Math.round(headRoomPct * this.scrollbarHeight);
    const horizontalTranslatePx = Math.round(
      leftSideRoomPct * this.scrollbarWidth
    );

    this.verticalScrollbarThumbEl.style.transform = `translate3D(0px, ${verticalTranslatePx}px, 0px)`;
    this.horizontalScrollbarThumbEl.style.transform = `translate3D(${horizontalTranslatePx}px, 0px, 0px)`;
  }

  /**
   * Calculate the boundaries of the viewport in world coordinates.
   *
   * Use this instead of canvas.calcViewportBoundaries, because that
   * doesnt' actually give you the bounding box, it gives you the
   * 4 corners.
   */
  calcViewportBoundaries(): {
    top: number;
    left: number;
    width: number;
    height: number;
  } {
    if (this.canvas == undefined) {
      throw new Error("Cant calculate viewport boundaries with no canvas");
    }

    const viewportCorners = this.canvas.calcViewportBoundaries();
    return {
      top: viewportCorners.tl.y,
      left: viewportCorners.tl.x,
      width: viewportCorners.tr.x - viewportCorners.tl.x,
      height: viewportCorners.bl.y - viewportCorners.tl.y,
    };
  }

  install(canvas: fabric.Canvas): fabric.Canvas {
    if (this.isInstalled) {
      console.warning("Viewport is already installed with the fabric canvas");
      return canvas;
    }

    this.installFabricCanvas(canvas);
    return canvas;
    // const handlers = {
    //   get(target, prop, receiver) {
    //     console.log(`Accessing ${prop} on fabric.Canvas`);
    //     return target[prop];
    //   },
    // };

    // const proxyCanvas = new Proxy(canvas, handlers);
    // return proxyCanvas;
  }

  setZoom(level: number) {
    this.canvas?.setZoom(level);
    this.calculateScrollbars(true);
  }
}
