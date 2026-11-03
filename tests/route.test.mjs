// Owns: unit tests for the pure parts of Assets/Scripts/CaseLightRoute.ts: the route choice rule, the recall pass order, both routes' bundles and one-number cells.
// Talks to: Assets/Scripts/CaseLightRoute.ts and CaseLightGeometry.ts (loaded through tests/register-ts.mjs), node:test, node:assert.
// Must not: load any scene code. Expected values come from documents named next to each test, not from the module under test.

import { test } from "node:test"
import assert from "node:assert/strict"
import "./register-ts.mjs"

const route = await import("../Assets/Scripts/CaseLightRoute.ts")
const geometry = await import("../Assets/Scripts/CaseLightGeometry.ts")

test("a route switch is taken only between passes, and only to a known, different route", () => {
  assert.deepEqual(route.chooseRoute(1, 2, "idle"), { route: 2, switched: true })
  assert.deepEqual(route.chooseRoute(2, 1, "idle"), { route: 1, switched: true })
  assert.deepEqual(route.chooseRoute(1, 2, "recall"), { route: 1, switched: false })
  assert.deepEqual(route.chooseRoute(1, 2, "practice"), { route: 1, switched: false })
  assert.deepEqual(route.chooseRoute(1, 1, "idle"), { route: 1, switched: false })
  assert.deepEqual(route.chooseRoute(1, 3, "idle"), { route: 1, switched: false })
  assert.equal(route.routeLabel(2), "Route 2")
})

test("recall order: a reordering of the same letters, the same every time, never the practice order", () => {
  for (let n = 2; n <= 12; n++) {
    for (let pass = 0; pass < 6; pass++) {
      const order = route.recallOrder(n, pass)
      assert.deepEqual([...order].sort((a, b) => a - b), route.practiceOrder(n), `n ${n} pass ${pass}`)
      assert.notDeepEqual(order, route.practiceOrder(n), `n ${n} pass ${pass}`)
      assert.deepEqual(route.recallOrder(n, pass), order, `n ${n} pass ${pass} repeatable`)
    }
  }
  assert.deepEqual(route.recallOrder(1, 0), [0])
})

test("recall order for 8 letters on the opening recall pass is the one the Lens played", () => {
  // Read from the Lens Studio log of 2 November (session s1-yn2ho6, CASELIGHT_LOG lines seq 2 to 11):
  // letters 4 (missed, came back after 3 and 2), 3, 2, 4, 6, 1, 7, 5, 0.
  assert.deepEqual(route.recallOrder(8, 0), [4, 3, 2, 6, 1, 7, 5, 0])
  // The textbook exact 32-bit generator would give this order instead; the Lens evaluates in doubles and must not.
  assert.notDeepEqual(route.recallOrder(8, 0), [2, 7, 4, 1, 0, 3, 6, 5])
})

test("both routes: the same slots and sides, the hold letter in the HOLD block", () => {
  const one = route.buildBundle(8, 1)
  const two = route.buildBundle(8, 2)
  assert.equal(one.length, 8)
  assert.equal(two.length, 8)
  assert.deepEqual(one.map((p) => [p.target, p.side]), two.map((p) => [p.target, p.side]))
  // devpost/BUILD_LOG.md (v0.5 and feature 4): letter 0 and both hold letters.
  assert.equal(one[0].address, "2195 FAIRWAYS CT")
  assert.equal(two[0].address, "3189 SHIRLEY DR")
  assert.equal(route.holdAddressOf(1), "3553 FREY LAKE RD")
  assert.equal(route.holdAddressOf(2), "3053 SHIRLEY DR")
  const holds = one.filter((p) => p.target === geometry.HOLD_BLOCK_SLOT)
  assert.equal(holds.length, 1)
  assert.equal(holds[0].address, "3553 FREY LAKE RD")
  assert.equal(two.filter((p) => p.target === geometry.HOLD_BLOCK_SLOT)[0].address, "3053 SHIRLEY DR")
})

test("75 labelled cells per route; one-number cells where research/ROUTE-PICKER-DATA.md says", () => {
  for (const r of [1, 2]) assert.equal(route.cellLabels(r).length, 75)
  const single = (r) => route.cellLabels(r).filter((c) => c.right === null).map((c) => c.slot)
  assert.deepEqual(single(1), [78])
  assert.deepEqual(single(2), [45, 52, 74, 78])
})

test("street names fit the case label (12 characters at most)", () => {
  for (const r of [1, 2]) for (const s of route.routeStreets(r)) assert.ok(s.name.length <= 12, s.name)
  assert.equal(route.routeStreets(2).length, 8)
})
