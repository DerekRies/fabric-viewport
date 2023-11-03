/* eslint-disable consistent-return */
/* eslint-disable no-param-reassign */
/* eslint-disable lines-between-class-members */
import { fabric } from "fabric";
import isNil from "lodash/isNil";
import clamp from "lodash/clamp";
import "./scrollbar.css";

export interface ViewportOptions {
  screenWidth: number;
  screenHeight: number;
  worldWidth: number;
  worldHeight: number;
  worldBackgroundColor?: string;
  scrollbars?: boolean;
  minZoomLevel?: number;
  maxZoomLevel?: number;
  panningEnabledWhileHoldingSpace?: boolean;
  dynamicMinMaxZoom?: [number, number];
}

export interface BBox {
  top: number;
  left: number;
  right: number;
  bottom: number;
}

export type TransformationMatrix2D = [
  number,
  number,
  number,
  number,
  number,
  number
];

export class Viewport {
  private screenWidth: number;
  private screenHeight: number;
  private worldWidth: number;
  private worldHeight: number;
  private worldBackgroundColor: string | undefined;
  private isInstalled: boolean;

  private fabricWorldObject: fabric.Rect | undefined;
  private canvas: fabric.Canvas | undefined;

  private horizontalScrollbarThumbEl: HTMLDivElement | undefined;
  private verticalScrollbarThumbEl: HTMLDivElement | undefined;
  private horizontalScrollbarContainerEl: HTMLDivElement | undefined;
  private verticalScrollbarContainerEl: HTMLDivElement | undefined;

  private scrollbarHeight = 0;
  private scrollbarWidth = 0;

  private scrollFactor = 0.5;
  // We shouldn't use a linear scale on the zoom. Mac osx trackpads
  // produce values like `0.123` while windows mouse wheels produce
  // a value like `100`.
  private zoomFactor = 0.001;

  private minZoomLevel: number;
  private maxZoomLevel: number;
  private dynamicMinMaxZoomScales: [number, number] | undefined;

  private verticalScrollDraggingContext = {
    isDragging: false,
    lastY: 0,
  };

  private horizontalScrollDraggingContext = {
    isDragging: false,
    lastX: 0,
  };

  /**
   * The "thing" that viewport panning is clamped to, and controls
   * how scrollbars are calculated
   */
  private pageAreaTarget: fabric.Object | null = null;

  constructor({
    screenHeight,
    screenWidth,
    worldHeight,
    worldWidth,
    worldBackgroundColor,
    minZoomLevel = 0.25,
    maxZoomLevel = 3,
    dynamicMinMaxZoom,
  }: ViewportOptions) {
    this.screenHeight = screenHeight;
    this.screenWidth = screenWidth;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.isInstalled = false;
    this.worldBackgroundColor = worldBackgroundColor;
    this.minZoomLevel = minZoomLevel;
    this.maxZoomLevel = maxZoomLevel;
    this.dynamicMinMaxZoomScales = dynamicMinMaxZoom;
    document.addEventListener("mouseup", this.handleGlobalMouseUp);
    document.addEventListener("mousemove", this.handleVerticalMouseMove);
    document.addEventListener("mousemove", this.handleHorizontalMouseMove);
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
      fill: this.worldBackgroundColor,
      hoverCursor: "auto",
      data: {
        fabricViewport: {
          type: "world",
        },
      },
    });
    this.pageAreaTarget = this.fabricWorldObject;
    canvas.add(this.fabricWorldObject);
    this.injectScrollbars();
    canvas.on("mouse:wheel", this.handleMouseWheel);
  }

  private handleMouseWheel = (opt: fabric.IEvent<WheelEvent>): void => {
    opt.e.preventDefault();
    if (opt.e.ctrlKey) {
      const zoom = this.canvas?.getZoom();
      if (isNil(zoom) || isNil(opt.pointer)) return;

      this.zoomToPoint(zoom + -1 * opt.e.deltaY * this.zoomFactor, opt.pointer);
      return;
    }

    this.translate(
      -1 * opt.e.deltaX * this.scrollFactor,
      -1 * opt.e.deltaY * this.scrollFactor
    );
  };

  zoomToPoint(zoomLevel: number, point: fabric.IPoint): void {
    const nextZoom = clamp(zoomLevel, this.minZoomLevel, this.maxZoomLevel);
    this.canvas?.zoomToPoint(point, nextZoom);
    const vpt = this.getViewportTransform();
    this.setTransform(...vpt);
    this.calculateScrollbars(true);
  }

  private handleVerticalScrollThumbMouseDown = (e: MouseEvent): void => {
    this.verticalScrollDraggingContext.isDragging = true;
    this.verticalScrollDraggingContext.lastY = e.clientY;
  };

  private handleVerticalMouseMove = (e: MouseEvent): void => {
    if (!this.verticalScrollDraggingContext.isDragging) return;

    const deltaY = this.verticalScrollDraggingContext.lastY - e.clientY;
    const percentMovedOfScrollbar = deltaY / this.scrollbarHeight;
    const translateY = percentMovedOfScrollbar * this.pageAreaTarget.height;
    this.verticalScrollDraggingContext.lastY = e.clientY;
    this.translate(0, translateY);
  };

  private handleHorizontalScrollThumbMouseDown = (e: MouseEvent): void => {
    this.horizontalScrollDraggingContext.isDragging = true;
    this.horizontalScrollDraggingContext.lastX = e.clientX;
  };

  private handleHorizontalMouseMove = (e: MouseEvent): void => {
    if (!this.horizontalScrollDraggingContext.isDragging) return;

    const deltaX = this.horizontalScrollDraggingContext.lastX - e.clientX;
    const percentMovedOfScrollbar = deltaX / this.scrollbarWidth;
    const translateX = percentMovedOfScrollbar * this.pageAreaTarget.width;
    this.horizontalScrollDraggingContext.lastX = e.clientX;
    this.translate(translateX, 0);
  };

  private handleGlobalMouseUp = (): void => {
    this.verticalScrollDraggingContext.isDragging = false;
    this.horizontalScrollDraggingContext.isDragging = false;
  };

  /**
   * Check to see if a fabric object is fully contained within the viewport
   * @param obj
   */
  public isFullyContained(obj: fabric.Object): boolean {
    // We don't actually want to know if it's fully contained. We want to
    // know if the larger of the two axes (width vs height) fully contains
    // the target obj
    if (
      isNil(obj.left) ||
      isNil(obj.width) ||
      isNil(obj.top) ||
      isNil(obj.height)
    )
      return false;

    const viewportBounds = this.calcViewportBoundaries();
    if (viewportBounds.width > viewportBounds.height) {
      return (
        obj.left >= viewportBounds.left && obj.width <= viewportBounds.width
      );
    }

    return obj.top >= viewportBounds.top && obj.height <= viewportBounds.height;
  }

  private getPageArea(): fabric.Object | null {
    return this.pageAreaTarget;
    // return this.fabricWorldObject;
    // if (isNil(this.pageAreaTarget)) return null;

    // if (this.isFullyContained(this.pageAreaTarget)) {
    //   return this.fabricWorldObject ?? null;
    // }

    // return this.pageAreaTarget;
  }

  /**
   * The name is a little confusing. We're not really returning
   * the boundaries of the page area in world or screen coordinates.
   *
   * Effectively what we're doing is returning the min and max values
   * for translations such that the viewport can't be panned outside
   * the page area.
   */
  private calculatePageAreaMinMaxes(zoom?: number): BBox | undefined {
    if (isNil(this.canvas)) return;
    const actualZoom = zoom ?? this.canvas.getZoom();

    const pageArea = this.getPageArea();
    if (isNil(pageArea) || isNil(pageArea.width) || isNil(pageArea.height))
      return;

    const pageAreaWidth = pageArea.width;
    const pageAreaHeight = pageArea.height;
    if (isNil(pageArea.left) || isNil(pageArea.top)) return;

    const offsetLeft = pageArea.left * actualZoom;
    const offsetTop = pageArea.top * actualZoom;

    let rightBorder =
      -1 *
        (pageAreaWidth -
          this.screenWidth +
          pageAreaWidth * actualZoom -
          pageAreaWidth) -
      offsetLeft;

    let bottomBorder =
      -1 *
        (pageAreaHeight -
          this.screenHeight +
          pageAreaHeight * actualZoom -
          pageAreaHeight) -
      offsetTop;

    const horizontalExcess = pageAreaWidth * actualZoom - this.screenWidth;
    const verticalExcess = pageAreaHeight * actualZoom - this.screenHeight;

    let leftBorder;
    let topBorder;

    if (horizontalExcess <= 0) {
      leftBorder = (this.screenWidth - this.worldWidth * actualZoom) / 2;
      rightBorder = leftBorder;
    } else {
      leftBorder = rightBorder + horizontalExcess;
    }

    if (verticalExcess <= 0) {
      topBorder = (this.screenHeight - this.worldHeight * actualZoom) / 2;
      bottomBorder = topBorder;
    } else {
      topBorder = bottomBorder + verticalExcess;
    }

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

    const nextTranslateX = vpt[4] + deltaX;
    const nextTranslateY = vpt[5] + deltaY;

    this.setTransform(
      vpt[0],
      vpt[1],
      vpt[2],
      vpt[3],
      nextTranslateX,
      nextTranslateY
    );
  }

  setTransform(
    a: number,
    b: number,
    c: number,
    d: number,
    translateX: number,
    translateY: number
  ): void {
    const bounds = this.calculatePageAreaMinMaxes();
    if (isNil(bounds)) return;

    const nextTranslateX = clamp(
      translateX,
      bounds.right,
      // Math.min(bounds.right, 0),
      bounds.left
    );
    const nextTranslateY = clamp(
      translateY,
      bounds.bottom,
      // Math.min(bounds.bottom, 0),
      bounds.top
    );
    this.canvas?.setViewportTransform([
      a,
      b,
      c,
      d,
      nextTranslateX,
      nextTranslateY,
    ]);
    this.canvas?.requestRenderAll();
    this.calculateScrollbars();
  }

  getViewportTransform(): TransformationMatrix2D {
    if (isNil(this.canvas) || isNil(this.canvas.viewportTransform)) {
      throw new Error("No transformation matrix found for canvas");
    }

    return [...this.canvas?.viewportTransform] as TransformationMatrix2D;
  }

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
      this.handleVerticalScrollThumbMouseDown
    );
    horizontalScrollbarThumb.addEventListener(
      "mousedown",
      this.handleHorizontalScrollThumbMouseDown
    );

    this.scrollbarHeight =
      verticalScrollbarContainer.getBoundingClientRect().height;
    this.scrollbarWidth =
      horizontalScrollbarContainer.getBoundingClientRect().width;
    this.calculateScrollbars(true);
  }

  private getPageAreaTargetBounds():
    | { top: number; left: number; height: number; width: number }
    | undefined {
    if (isNil(this.pageAreaTarget)) return;

    const target = this.getPageArea();
    if (isNil(target)) return;
    const bounds = target.getBoundingRect(true);

    return {
      height: bounds.height,
      width: bounds.width,
      left: bounds.left,
      top: bounds.top,
    };
  }

  private calculateScrollbars(recalcThumbSize = false): void {
    if (
      isNil(this.canvas) ||
      isNil(this.fabricWorldObject) ||
      isNil(this.verticalScrollbarThumbEl) ||
      isNil(this.horizontalScrollbarThumbEl) ||
      isNil(this.horizontalScrollbarContainerEl) ||
      isNil(this.verticalScrollbarContainerEl) ||
      isNil(this.pageAreaTarget)
    )
      return;

    const viewportBounds = this.calcViewportBoundaries();
    const pageAreaTargetBounds = this.getPageAreaTargetBounds();
    if (isNil(pageAreaTargetBounds)) return;

    const headRoom = viewportBounds.top - pageAreaTargetBounds.top;
    const headRoomPct = headRoom / pageAreaTargetBounds.height;
    const viewportVerticalPct =
      viewportBounds.height / pageAreaTargetBounds.height;

    const leftSideRoom = viewportBounds.left - pageAreaTargetBounds.left;
    const leftSideRoomPct = leftSideRoom / pageAreaTargetBounds.width;
    const viewportHorizontalPct =
      viewportBounds.width / pageAreaTargetBounds.width;

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
  resizeWorldToFit(targetObj: fabric.Object): void {
    if (
      isNil(this.fabricWorldObject) ||
      isNil(targetObj.top) ||
      isNil(targetObj.left) ||
      isNil(this.canvas)
    )
      return;

    const objBounds = targetObj.getBoundingRect();
    const viewportAspectRatio = this.screenWidth / this.screenHeight;
    const objAspectRatio = objBounds.width / objBounds.height;

    // When maintaining the viewport aspect ratio
    // our final world width / final world height
    // must be the same.
    // So which do we find, height or width?

    let newHeight;
    let newWidth;
    if (objAspectRatio < 1) {
      // portrait
      newHeight = objBounds.height;
      newWidth = newHeight * viewportAspectRatio;
    } else {
      // landscape
      newWidth = objBounds.width;
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
    this.canvas._objects.forEach((obj: fabric.Object) => {
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

  private updateZoomMinMax(): void {
    if (isNil(this.dynamicMinMaxZoomScales)) return;
    const [minScaler, maxScaler] = this.dynamicMinMaxZoomScales;

    const scaleX = this.screenWidth / this.worldWidth;
    const scaleY = this.screenHeight / this.worldHeight;
    const scaleFactor = Math.min(scaleX, scaleY);
    this.minZoomLevel = scaleFactor * minScaler;
    this.maxZoomLevel = scaleFactor * maxScaler;
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
   * @param opts
   */
  setPageAreaTarget(obj: fabric.Object): void {
    this.pageAreaTarget = obj;
    this.translate(0, 0);
    this.updateZoomMinMax();
    this.requestRenderAll();
  }

  /**
   * Pass-through to canvas.requestRenderAll that also recalculates
   * the virtual scrollbars.
   */
  requestRenderAll(): void {
    this.calculateScrollbars(true);
    this.canvas?.requestRenderAll();
  }
}

export interface CenterOptions {
  horizontal: boolean;
  vertical: boolean;
}

export interface FitOptions {
  maintainAspectRatio: boolean;
  center: boolean;
}
