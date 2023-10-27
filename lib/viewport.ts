/* eslint-disable no-param-reassign */
/* eslint-disable lines-between-class-members */
import { fabric } from "fabric";
import { clamp } from "./utils";
import { isNil } from "lodash";
import "./scrollbar.css";

export interface ViewportOptions {
  screenWidth: number;
  screenHeight: number;
  worldWidth: number;
  worldHeight: number;
  scrollbars?: boolean;
}

export interface BBox {
  top: number;
  left: number;
  right: number;
  bottom: number;
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

  private scrollbarHeight = 0;
  private scrollbarWidth = 0;
  private zoom = 1;

  private scrollFactor = 0.5;

  private draggingContext = {
    isDragging: false,
    lastX: 0,
    lastY: 0,
  };

  private verticalScrollDraggingContext = {
    isDragging: false,
    lastY: 0,
  };

  /**
   * The "thing" that viewport panning is clamped to, and controls
   * how scrollbars are calculated
   */
  private pageAreaTarget: fabric.Object | null = null;
  private pageAreaTargetPadding = { x: 0, y: 0 };

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

  private installFabricCanvas(canvas: fabric.Canvas): void {
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
    this.pageAreaTarget = this.fabricWorldObject;
    canvas.add(this.fabricWorldObject);
    this.injectScrollbars();
    canvas.on("mouse:down", this.handleMouseDown);
    canvas.on("mouse:move", this.handleMouseMove);
    canvas.on("mouse:up", this.handleMouseUp);
    canvas.on("mouse:wheel", this.handleMouseWheel);
  }

  private handleMouseWheel = (opt: fabric.IEvent<WheelEvent>): void => {
    this.translate(
      -1 * opt.e.deltaX * this.scrollFactor,
      -1 * opt.e.deltaY * this.scrollFactor
    );
  };

  private handleMouseDown = (opt: fabric.IEvent<MouseEvent>): void => {
    this.draggingContext.isDragging = true;
    this.draggingContext.lastX = opt.e.clientX;
    this.draggingContext.lastY = opt.e.clientY;
  };

  private handleMouseMove = (opt: fabric.IEvent<MouseEvent>): void => {
    if (!this.draggingContext.isDragging || !this.canvas) return;
    if (!opt.e.ctrlKey) return;
    this.canvas.selection = false;
    opt.e.stopPropagation();
    opt.e.preventDefault();

    const deltaX = opt.e.clientX - this.draggingContext.lastX;
    const deltaY = opt.e.clientY - this.draggingContext.lastY;

    this.translate(deltaX, deltaY);

    this.draggingContext.lastX = opt.e.clientX;
    this.draggingContext.lastY = opt.e.clientY;
  };

  private handleScrollThumbMouseDown = (e: MouseEvent): void => {
    // console.log('Starting scrollbar drag');
    this.verticalScrollDraggingContext.isDragging = true;
    this.verticalScrollDraggingContext.lastY = e.clientY;
  };

  private handleGlobalMouseMove = (e: MouseEvent): void => {
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

  private handleGlobalMouseUp = (): void => {
    this.verticalScrollDraggingContext.isDragging = false;
  };

  /**
   * The name is a little confusing. We're not really returning
   * the boundaries of the page area in world or screen coordinates.
   *
   * Effectively what we're doing is returning the min and max values
   * for translations such that the viewport can't be panned outside
   * the page area.
   */
  private calculatePageAreaBoundaries(): BBox | undefined {
    if (isNil(this.canvas)) return;
    const zoom = this.canvas.getZoom();
    if (isNil(this.pageAreaTarget)) return;

    const pageAreaWidth = this.pageAreaTarget.width;
    const pageAreaHeight = this.pageAreaTarget.height;
    if (
      isNil(pageAreaHeight) ||
      isNil(pageAreaWidth) ||
      isNil(this.pageAreaTarget.left) ||
      isNil(this.pageAreaTarget.top)
    )
      return;

    const offsetLeft = this.pageAreaTarget.left * zoom;
    const offsetTop = this.pageAreaTarget.top * zoom;

    const rightBorder =
      -1 *
        (pageAreaWidth -
          this.screenWidth +
          pageAreaWidth * zoom -
          pageAreaWidth) -
      offsetLeft;

    const bottomBorder =
      -1 *
        (pageAreaHeight -
          this.screenHeight +
          pageAreaHeight * zoom -
          pageAreaHeight) -
      offsetTop;

    const horizontalExcess = pageAreaWidth * zoom - this.screenWidth;
    const verticalExcess = pageAreaHeight * zoom - this.screenHeight;
    const leftBorder = rightBorder + horizontalExcess;
    const topBorder = bottomBorder + verticalExcess;

    return {
      right: rightBorder,
      bottom: bottomBorder,
      left: leftBorder,
      top: topBorder,
    };
  }

  translate(deltaX: number, deltaY: number): void {
    if (isNil(this.canvas)) return;
    const vpt = this.canvas.viewportTransform;
    if (isNil(vpt)) return;

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

    const bounds = this.calculatePageAreaBoundaries();
    if (isNil(bounds)) return;
    console.log({ bounds });

    // vpt[4] = clamp(Math.min(rightBorder, 0), nextTranslateX, 0);
    // vpt[5] = clamp(Math.min(bottomBorder, 0), nextTranslateY, 0);

    vpt[4] = clamp(Math.min(bounds.right, 0), nextTranslateX, bounds.left);
    vpt[5] = clamp(Math.min(bounds.bottom, 0), nextTranslateY, bounds.top);

    console.log(vpt);
    this.canvas.requestRenderAll();
    this.calculateScrollbars();
  }

  private handleMouseUp = (_opt: fabric.IEvent<MouseEvent>): void => {
    if (isNil(this.canvas)) return;

    if (this.draggingContext.isDragging) {
      this.canvas.selection = true;
    }
    this.draggingContext.isDragging = false;
  };

  private injectScrollbars(): void {
    const containerEl = this.canvas?.getElement().parentElement;
    if (isNil(containerEl)) return;

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

  private calculateScrollbars(recalcThumbSize = false): void {
    if (
      isNil(this.canvas) ||
      isNil(this.fabricWorldObject) ||
      isNil(this.verticalScrollbarThumbEl) ||
      isNil(this.horizontalScrollbarThumbEl) ||
      isNil(this.horizontalScrollbarContainerEl) ||
      isNil(this.verticalScrollbarContainerEl)
    )
      return;

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
    if (isNil(this.canvas)) {
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

  install<T extends fabric.Canvas>(canvas: T): T {
    if (this.isInstalled) {
      // eslint-disable-next-line no-console
      console.warn("Viewport is already installed with the fabric canvas");
      return canvas;
    }

    this.installFabricCanvas(canvas);
    return canvas;
  }

  setZoom(level: number): void {
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
  resizeWorldToFit(
    targetObj: fabric.Object,
    options?: Partial<FitOptions>
  ): void {
    if (
      isNil(this.fabricWorldObject) ||
      isNil(targetObj.top) ||
      isNil(targetObj.left) ||
      isNil(this.canvas)
    )
      return;

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

    let newHeight;
    let newWidth;
    if (objAspectRatio < 1) {
      // portrait
      newHeight = objBounds.height + actualOptions.paddingY;
      newWidth = newHeight * viewportAspectRatio;
    } else {
      // landscape
      newWidth = objBounds.width + actualOptions.paddingX;
      newHeight = newWidth / viewportAspectRatio;
    }

    this.fabricWorldObject.width = newWidth;
    this.fabricWorldObject.height = newHeight;
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
    const deltaX = targetObj.left - newTargetX;
    const deltaY = targetObj.top - newTargetY;

    targetObj.top -= deltaY;
    targetObj.left -= deltaX;

    // Then translate all the existing objects by the same amount.
    this.canvas._objects.forEach((obj) => {
      if (obj.data?.fabricViewport?.type === "world") return;
      if (obj === targetObj) return;
      if (isNil(obj.left) || isNil(obj.top)) return;

      obj.left -= deltaX;
      obj.top -= deltaY;
    });

    this.calculateScrollbars(true);
  }

  /**
   * Translates and zooms the viewport such that the world
   * is fully visible.
   */
  fitToWorld(): void {
    // const viewportAspectRatio = this.screenWidth / this.screenHeight;
    // const worldAspectRatio = this.worldWidth / this.worldHeight;
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

  /**
   * Centers the viewport to the center of the world.
   */
  centerToWorld(opts?: Partial<CenterOptions>): void {
    if (isNil(this.canvas)) return;

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

  /**
   *
   * @param obj
   * @param opts
   */
  setPageAreaTarget(obj: fabric.Object, opts: any) {
    this.pageAreaTarget = obj;
    this.requestRenderAll();
  }

  /**
   * Pass-through to canvas.requestRenderAll that also recalculates
   * the virtual scrollbars.
   */
  requestRenderAll() {
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
