import { isNil } from "lodash";
import { clampWithin } from "./utils";

/**
 * Used in conjunction with a Viewport to be able to limit
 * interactions to a sub region of the entire canvas.
 */
export class InteractionManager {
  private targetObj: fabric.Object | undefined;
  private enabled: boolean = false;

  constructor(private canvas: fabric.Canvas) {
    canvas.on("object:modified", this.handleObjectModified);
    canvas.on("object:moving", this.handleObjectMoving);
  }

  private handleObjectModified = (e: fabric.IEvent<MouseEvent>) => {
    if (!this.enabled || isNil(this.targetObj)) return;
    const obj = e.target;
    if (isNil(obj)) return;

    clampWithin(obj, this.targetObj);
  };

  private handleObjectMoving = (e: fabric.IEvent<MouseEvent>) => {
    if (!this.enabled || isNil(this.targetObj)) return;
    const obj = e.target;
    if (
      isNil(obj) ||
      isNil(obj.left) ||
      isNil(obj.top) ||
      isNil(obj.width) ||
      isNil(obj.height)
    )
      return;

    const newLeft = obj.left + e.e.movementX;
    const newTop = obj.top + e.e.movementY;

    clampWithin(obj, this.targetObj, { x: newLeft, y: newTop });
  };

  /**
   * Limits all interactions to the bounds of the target object.
   *
   * When enabled, fabric objects wont be able to be dragged,
   * or scaled outside the target objects bounds.
   */
  constrainInteractions(targetObj: fabric.Object): void {
    this.targetObj = targetObj;
    this.enabled = true;
  }

  clearConstraints() {
    this.targetObj = undefined;
    this.enabled = false;
  }

  enable() {
    this.enabled = true;
  }

  disable() {
    this.enabled = false;
  }

  destroy() {
    // @ts-expect-error: Fabric types are incorrect
    this.canvas.off("object:modified", this.handleObjectModified);
    // @ts-expect-error: Fabric types are incorrect
    this.canvas.off("object:moving", this.handleObjectMoving);
  }
}
