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

  private verticalScrollDraggingContext = {
    isDragging: false,
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
    document.addEventListener("mousemove", this.handleGlobalMouseMove);
    document.addEventListener("mouseup", this.handleGlobalMouseUp);
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
      data: {
        fabricViewport: {
          type: "world",
        },
      },
    });
    canvas.add(this.fabricWorldObject);
    this.injectScrollbars();
    canvas.on("mouse:down", this.handleMouseDown);
    canvas.on("mouse:move", this.handleMouseMove);
    canvas.on("mouse:up", this.handleMouseUp);
    canvas.on("mouse:wheel", this.handleMouseWheel);
  }

  private handleMouseWheel = (opt: fabric.IEvent<WheelEvent>) => {
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

  private handleScrollThumbMouseDown = (e: MouseEvent) => {
    console.log("Starting scrollbar drag");
    this.verticalScrollDraggingContext.isDragging = true;
    this.verticalScrollDraggingContext.lastY = e.clientY;
  };

  private handleGlobalMouseMove = (e: MouseEvent) => {
    if (!this.verticalScrollDraggingContext.isDragging) return;

    const deltaY = -1 * (e.clientY - this.verticalScrollDraggingContext.lastY);
    this.verticalScrollDraggingContext.lastY = e.clientY;
    // 2.1 is the magic number where the scroll translation matches
    // the apparent scrolling speed with the scrollbar.
    // We could make this less magical by actually calculating the
    // percent translation required to match the scrollbar exactly
    // but then we've got two directions for the data behind our
    // scrollbar to synchronize.
    this.translate(0, deltaY * 2.1);
  };

  private handleGlobalMouseUp = (e) => {
    this.verticalScrollDraggingContext.isDragging = false;
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

    containerEl.appendChild(verticalScrollbarContainer);
    containerEl.appendChild(horizontalScrollbarContainer);

    this.verticalScrollbarThumbEl = verticalScrollbarThumb;
    this.horizontalScrollbarThumbEl = horizontalScrollbarThumb;
    this.horizontalScrollbarContainerEl = horizontalScrollbarContainer;
    this.verticalScrollbarContainerEl = verticalScrollbarContainer;

    verticalScrollbarThumb.addEventListener(
      "mousedown",
      this.handleScrollThumbMouseDown
    );

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
      // console.log("cancelling calc scrollbars");
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
  }

  setZoom(level: number) {
    this.canvas?.setZoom(level);
    this.calculateScrollbars(true);
  }

  /**
   * Resizes the world to fit around a provided fabric object.
   *
   * NOTE: This will move your objects as the underlying world
   * is changed.
   * @param targetObj
   * @param options
   */
  resizeWorldToFit(targetObj: fabric.Object, options?: Partial<FitOptions>) {
    const actualOptions: FitOptions = {
      paddingX: 0,
      paddingY: 0,
      maintainAspectRatio: true,
      center: true,
      ...options,
    };
    const objBounds = targetObj.getBoundingRect();
    const viewportAspectRatio = this.screenWidth / this.screenHeight;
    const objAspectRatio =
      (objBounds.width + actualOptions.paddingX) /
      (objBounds.height + actualOptions.paddingY);

    // When maintaining the viewport aspect ratio
    // our final world width / final world height
    // must be the same.
    // So which do we find, height or width?

    let newHeight, newWidth;
    if (objAspectRatio < 1) {
      // portrait
      newHeight = objBounds.height + actualOptions.paddingY;
      newWidth = newHeight * viewportAspectRatio;
    } else {
      // landscape
      newWidth = objBounds.width + actualOptions.paddingX;
      newHeight = newWidth / viewportAspectRatio;
    }

    this.fabricWorldObject!.width = newWidth;
    this.fabricWorldObject!.height = newHeight;
    this.worldHeight = newHeight;
    this.worldWidth = newWidth;

    // Translate the target object such that its centered within
    // the world now.
    const centerOffsetX = objBounds.width / 2;
    const centerOffsetY = objBounds.height / 2;

    const worldCenterX = newWidth / 2;
    const worldCenterY = newHeight / 2;

    const newTargetX = worldCenterX - centerOffsetX;
    const newTargetY = worldCenterY - centerOffsetY;
    const deltaX = targetObj.left! - newTargetX;
    const deltaY = targetObj.top! - newTargetY;

    // targetObj.top = newTargetY;
    // targetObj.left = newTargetX;
    targetObj.top! -= deltaY;
    targetObj.left! -= deltaX;

    // Then translate all the existing objects by the same amount.
    this.canvas?._objects.forEach((obj) => {
      if (obj.data?.fabricViewport?.type === "world") return;
      if (obj === targetObj) return;

      obj.left! -= deltaX;
      obj.top! -= deltaY;
    });

    this.calculateScrollbars(true);
  }

  fitToWorld() {
    const viewportAspectRatio = this.screenWidth / this.screenHeight;
    const worldAspectRatio = this.worldWidth / this.worldHeight;

    const scaleX = this.screenWidth / this.worldWidth;
    const scaleY = this.screenHeight / this.worldHeight;
    const scaleFactor = Math.min(scaleX, scaleY);

    const translateX = (this.screenWidth - this.worldWidth * scaleFactor) / 2;
    const translateY = (this.screenHeight - this.worldHeight * scaleFactor) / 2;

    this.canvas?.setViewportTransform([
      scaleFactor,
      0,
      0,
      scaleFactor,
      translateX,
      translateY,
    ]);
    this.calculateScrollbars(true);
    this.canvas?.requestRenderAll();
  }

  centerToWorld(opts?: Partial<CenterOptions>) {
    if (this.canvas == undefined) return;
    const options: CenterOptions = {
      horizontal: true,
      vertical: true,
      ...opts,
    };

    const scaleFactor = this.canvas.getZoom();
    const translateX = options.horizontal
      ? (this.screenWidth - this.worldWidth * scaleFactor) / 2
      : 0;
    const translateY = options.vertical
      ? (this.screenHeight - this.worldHeight * scaleFactor) / 2
      : 0;

    this.canvas?.setViewportTransform([
      scaleFactor,
      0,
      0,
      scaleFactor,
      translateX,
      translateY,
    ]);
    this.calculateScrollbars(true);
    this.canvas?.requestRenderAll();
  }
}

export interface CenterOptions {
  horizontal: boolean;
  vertical: boolean;
}

export interface FitOptions {
  paddingX: number;
  paddingY: number;
  maintainAspectRatio: boolean;
  center: boolean;
}
