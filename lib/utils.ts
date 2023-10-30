import { clamp, isNil } from "lodash";

export function internalClamp(min: number, val: number, max: number): number {
  if (val < min) {
    return min;
  }
  if (val > max) {
    return max;
  }

  return val;
}

export function screenToWorldCoordinates() {}

export function worldToScreenCoordinates() {}

/**
 * Is a point within the world bounding box?
 */
export function isWithinWorld() {}

/**
 * Clamps an objects position within another target obj,
 * such that the object can never be positioned outside the
 * target object.
 * @param obj
 * @param withinObj
 */
export function clampWithin(
  obj: fabric.Object,
  targetObj: fabric.Object,
  newPosition?: fabric.IPoint
) {
  if (isNil(obj.left) || isNil(obj.top)) return;
  const bounds = targetObj.aCoords;
  if (isNil(bounds)) return;

  if (isNil(newPosition)) {
    return obj.set({
      left: clamp(obj.left, bounds.tl.x, bounds.tr.x - obj.getScaledWidth()),
      top: clamp(obj.top, bounds.tl.y, bounds.bl.y - obj.getScaledHeight()),
    });
  }

  obj.set({
    left: clamp(newPosition.x, bounds.tl.x, bounds.tr.x - obj.getScaledWidth()),
    top: clamp(newPosition.y, bounds.tl.y, bounds.bl.y - obj.getScaledHeight()),
  });
}
