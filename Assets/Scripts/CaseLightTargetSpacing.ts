// Owns: the spacing rule for pinchable targets seen from the eye: the angular gap between two head-relative angle boxes (yaw and pitch, degrees), every pair's gap smallest to largest, the pairs under a minimum, and the smallest target.
// Talks to: nothing (pure TypeScript: no imports, no scene objects, no Lens globals), so plain node can run it; the LEAF scenario extra-button-spacing feeds it the boxes it measures from what is drawn.
// Must not: touch the scene, find buttons or decide which ones count (the scenario does both and says why).

/**
 * Snap's guidance for Specs: pinch targets at least 2 deg each way, and at least 1 deg apart.
 * The gap between two boxes is how far apart they are as seen from the eye:
 * - apart along one axis only (they share some of the other): the gap along that axis;
 * - apart along both axes (one is off the other's corner): the straight-line distance between
 *   the nearest corners, sqrt(dx^2 + dy^2);
 * - overlapping: negative, the larger of the two (negative) axis gaps, so the overlap is the
 *   shallower of the two depths; touching edges give 0.
 */

/** Head-relative angle box, degrees: yaw left to right, pitch down to up. */
export interface SpacingBox {
  minYaw: number
  maxYaw: number
  minPitch: number
  maxPitch: number
}

export interface NamedBox {
  name: string
  box: SpacingBox
}

export interface PairGap {
  a: string
  b: string
  gap: number
}

/** Snap's spacing guidance for pinch targets (deg). */
export const MIN_TARGET_GAP_DEG = 1.0

/** Angular gap between two boxes (deg): positive apart, 0 touching, negative overlapping. */
export function angularGap(a: SpacingBox, b: SpacingBox): number {
  const dx = Math.max(a.minYaw - b.maxYaw, b.minYaw - a.maxYaw)
  const dy = Math.max(a.minPitch - b.maxPitch, b.minPitch - a.maxPitch)
  if (dx > 0 && dy > 0) return Math.sqrt(dx * dx + dy * dy)
  return Math.max(dx, dy)
}

/** Every unordered pair's gap, smallest to largest (ties by the names, so the order is stable). */
export function pairGaps(items: NamedBox[]): PairGap[] {
  const out: PairGap[] = []
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) out.push({a: items[i].name, b: items[j].name, gap: angularGap(items[i].box, items[j].box)})
  out.sort((p, q) => p.gap - q.gap || (p.a + "~" + p.b < q.a + "~" + q.b ? -1 : p.a + "~" + p.b > q.a + "~" + q.b ? 1 : 0))
  return out
}

/** The pairs closer than minDeg (overlaps included), smallest to largest. */
export function pairsCloserThan(items: NamedBox[], minDeg: number): PairGap[] {
  return pairGaps(items).filter((p) => p.gap < minDeg)
}

/** The smallest target: the one whose shorter side is shortest (ties: the smaller area). Null for none. */
export function smallestTarget(items: NamedBox[]): {name: string; width: number; height: number} | null {
  let best: {name: string; width: number; height: number} | null = null
  for (const it of items) {
    const w = it.box.maxYaw - it.box.minYaw
    const h = it.box.maxPitch - it.box.minPitch
    if (!best) {
      best = {name: it.name, width: w, height: h}
      continue
    }
    const side = Math.min(w, h)
    const bestSide = Math.min(best.width, best.height)
    if (side < bestSide || (side === bestSide && w * h < best.width * best.height)) best = {name: it.name, width: w, height: h}
  }
  return best
}
