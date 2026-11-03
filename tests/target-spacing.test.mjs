// Owns: unit tests for Assets/Scripts/CaseLightTargetSpacing.ts: the angular gap between two angle boxes (apart on one axis, apart on both, touching, overlapping, a box against itself), the pair list smallest to largest, the pairs under a minimum and the smallest target.
// Talks to: Assets/Scripts/CaseLightTargetSpacing.ts (pure, no imports), node:test, node:assert.
// Must not: load any scene code; every expected value is worked out by hand here from the boxes' corners, not computed by the module under test.

import { test } from "node:test"
import assert from "node:assert/strict"
import { angularGap, pairGaps, pairsCloserThan, smallestTarget, MIN_TARGET_GAP_DEG } from "../Assets/Scripts/CaseLightTargetSpacing.ts"

const box = (minYaw, maxYaw, minPitch, maxPitch) => ({ minYaw, maxYaw, minPitch, maxPitch })
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`)

test("Snap's spacing guidance is 1 deg", () => {
  assert.equal(MIN_TARGET_GAP_DEG, 1.0)
})

test("side by side: the gap is the yaw gap, either order", () => {
  const a = box(0, 1, 0, 1)
  const b = box(2, 3, 0, 1)
  close(angularGap(a, b), 1)
  close(angularGap(b, a), 1)
})

test("one above the other, sharing part of the yaw range: the pitch gap", () => {
  close(angularGap(box(0, 4, 0, 2), box(3, 6, 2.5, 4)), 0.5)
})

test("off the corner: the straight line between the nearest corners", () => {
  // dx = 4 - 1 = 3, dy = 5 - 1 = 4
  close(angularGap(box(0, 1, 0, 1), box(4, 5, 5, 6)), 5)
})

test("touching edges give 0", () => {
  close(angularGap(box(0, 1, 0, 1), box(1, 2, 0, 1)), 0)
})

test("overlap is negative: the shallower of the two depths", () => {
  // yaw overlap 1 (dx = -1), pitch overlap 3 (dy = -3): the gap is -1
  close(angularGap(box(0, 2, 0, 3), box(1, 3, 0, 3)), -1)
})

test("a box against itself overlaps", () => {
  const a = box(-11.5, -8.95, 12.84, 15.44)
  // dx = -2.55, dy = -2.6: the larger is -2.55
  close(angularGap(a, a), -2.55)
  assert.ok(angularGap(a, a) < 0)
})

test("one box inside another overlaps", () => {
  // dx = max(1 - 10, 0 - 2) = -2, dy = max(1 - 10, 0 - 2) = -2
  close(angularGap(box(0, 10, 0, 10), box(1, 2, 1, 2)), -2)
})

test("pairGaps lists every pair once, smallest to largest", () => {
  const items = [
    { name: "A", box: box(0, 1, 0, 1) },
    { name: "B", box: box(1.5, 2.5, 0, 1) },
    { name: "C", box: box(0, 1, 3, 4) },
  ]
  const g = pairGaps(items)
  assert.equal(g.length, 3)
  assert.deepEqual(g.map((p) => `${p.a}~${p.b}`), ["A~B", "A~C", "B~C"])
  close(g[0].gap, 0.5)
  close(g[1].gap, 2)
  // B~C: dx = 1.5 - 1 = 0.5, dy = 3 - 1 = 2
  close(g[2].gap, Math.sqrt(0.25 + 4))
})

test("pairsCloserThan keeps only the pairs under the minimum, overlaps included", () => {
  const items = [
    { name: "A", box: box(0, 2, 0, 2) },
    { name: "B", box: box(1, 3, 0, 2) },
    { name: "C", box: box(4, 6, 0, 2) },
    { name: "D", box: box(10, 12, 0, 2) },
  ]
  // A~B -1 (overlap), B~C 1.0 (exactly the minimum, kept out), A~C 2, C~D 4
  const under = pairsCloserThan(items, 1.0)
  assert.deepEqual(under.map((p) => `${p.a}~${p.b}`), ["A~B"])
  close(under[0].gap, -1)
})

test("two boxes 0.14 deg apart are reported", () => {
  const under = pairsCloserThan([{ name: "P", box: box(0, 2, 0, 2) }, { name: "Q", box: box(2.14, 4, 0, 2) }], 1.0)
  assert.equal(under.length, 1)
  close(under[0].gap, 0.14)
})

test("smallestTarget picks the shortest side, then the smaller area", () => {
  const s = smallestTarget([
    { name: "wide", box: box(0, 9.6, 0, 3) },
    { name: "route", box: box(0, 2.17, 0, 2.08) },
    { name: "toggle", box: box(0, 2.39, 0, 2.08) },
  ])
  assert.equal(s.name, "route")
  close(s.width, 2.17)
  close(s.height, 2.08)
  assert.equal(smallestTarget([]), null)
})
