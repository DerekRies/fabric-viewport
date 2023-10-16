export function clamp(min: number, val: number, max: number): number {
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
