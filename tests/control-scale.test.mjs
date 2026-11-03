// Owns: unit tests for Assets/Scripts/CaseLightControlScale.ts: the design eye and the controls' design distance, the controls' scale (eye distance over the design distance, clamped, 1 for unusable input), held while the group is not in front of the eye, when a new scale is applied, and where a point lands when scaled about the anchor.
// Talks to: Assets/Scripts/CaseLightControlScale.ts (pure, no imports), node:test, node:assert.
// Must not: load any scene code; every expected value is worked out by hand here, not computed by the module under test.

import { test } from "node:test"
import assert from "node:assert/strict"
import { controlScale, designDistanceCm, nextControlScale, shouldRescale, scaledAbout, DESIGN_EYE_CM, MIN_CONTROL_SCALE, MAX_CONTROL_SCALE, RESCALE_TOLERANCE } from "../Assets/Scripts/CaseLightControlScale.ts"

const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`)

test("the clamp and tolerance are as documented", () => {
  assert.equal(MIN_CONTROL_SCALE, 0.5)
  assert.equal(MAX_CONTROL_SCALE, 6)
  assert.equal(RESCALE_TOLERANCE, 0.005)
})

test("the design eye is the world origin", () => {
  assert.deepEqual([...DESIGN_EYE_CM], [0, 0, 0])
})

test("the design distance is from the design eye to the anchor at its authored place", () => {
  // CaseRoot authored at (0, 0, -57), the anchor 3.8 cm up the case face: sqrt(3.8^2 + 57^2) = sqrt(3263.44)
  close(designDistanceCm([0, 3.8, -57]), Math.sqrt(3263.44))
  assert.ok(Math.abs(designDistanceCm([0, 3.8, -57]) - 57.1265) < 1e-3)
  // it does not depend on where a head is, only on the design eye given
  close(designDistanceCm([1, 2, 2]), 3)
  close(designDistanceCm([1, 2, -348], [0, 0, -350]), 3)
})

test("at the design distance the scale is exactly 1", () => {
  assert.equal(controlScale(57, 57), 1)
})

test("the scale is the eye distance over the opening distance", () => {
  close(controlScale(159, 57), 159 / 57)
  close(controlScale(114, 57), 2)
  close(controlScale(42.75, 57), 0.75)
})

test("the scale is clamped to 0.5 .. 6", () => {
  assert.equal(controlScale(10, 57), 0.5)
  assert.equal(controlScale(1000, 57), 6)
})

test("unusable input gives 1", () => {
  assert.equal(controlScale(0, 57), 1)
  assert.equal(controlScale(-5, 57), 1)
  assert.equal(controlScale(100, 0), 1)
  assert.equal(controlScale(NaN, 57), 1)
  assert.equal(controlScale(Infinity, 57), 1)
})

test("a new scale is applied only beyond 0.5 percent", () => {
  assert.equal(shouldRescale(1, 1.004), false)
  assert.equal(shouldRescale(1, 1.006), true)
  assert.equal(shouldRescale(2, 2.009), false)
  assert.equal(shouldRescale(2, 1.98), true)
  assert.equal(shouldRescale(0, 1), true)
})

test("the scale follows the distance only while the group is in front of the eye", () => {
  // in front (depth 150 cm): 159 / 57 applied
  close(nextControlScale(1, 159, 150, 57), 159 / 57)
  // behind the eye (depth -290 cm) or level with it: the current scale is held
  assert.equal(nextControlScale(1, 293, -290, 57), 1)
  assert.equal(nextControlScale(2.5, 293, 0, 57), 2.5)
  // in front but within the 0.5 percent step: held
  assert.equal(nextControlScale(1, 57.2, 57, 57), 1)
  // back in front at the design distance: back to 1
  assert.equal(nextControlScale(2.7, 57, 57, 57), 1)
})

test("scaling about the anchor moves a point only away from it", () => {
  // anchor (0, 3.8, 0); a control corner at (10, 5.2, 2) scaled by 3: (30, 3.8 + 3 * 1.4, 6)
  const p = scaledAbout([0, 3.8, 0], [10, 5.2, 2], 3)
  close(p[0], 30)
  close(p[1], 8)
  close(p[2], 6)
  // the anchor itself does not move, and scale 1 changes nothing
  scaledAbout([0, 3.8, 0], [0, 3.8, 0], 3).forEach((v, i) => close(v, [0, 3.8, 0][i]))
  scaledAbout([0, 3.8, 0], [10, 5.2, 2], 1).forEach((v, i) => close(v, [10, 5.2, 2][i]))
})
