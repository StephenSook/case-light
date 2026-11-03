// Owns: the check that the Lens's route tables follow the Python reference: each route's cells, read left then right in slot order, give exactly the delivery order in tests/fixtures/route<N>_reference_order.json (case_layout.route_order, the USPS M-41 loop per street).
// Talks to: Assets/Scripts/CaseLightRoute.ts (through tests/register-ts.mjs), tests/fixtures/*.json, node:test, node:assert, node:fs.
// Must not: compute the M-41 order itself; the order comes only from the fixture, which tools/export_reference_fixtures.py writes from the Python reference.

import { test } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import "./register-ts.mjs"

const route = await import("../Assets/Scripts/CaseLightRoute.ts")

function fixture(r) {
  return JSON.parse(readFileSync(new URL(`./fixtures/route${r}_reference_order.json`, import.meta.url), "utf8"))
}

for (const r of [1, 2]) {
  test(`route ${r}: the Lens's cells give the Python reference's delivery order`, () => {
    const fx = fixture(r)
    assert.deepEqual(route.routeStreets(r).map((s) => s.name), fx.streets)
    const flat = []
    for (const c of [...route.cellLabels(r)].sort((a, b) => a.slot - b.slot)) {
      flat.push([c.street, c.left])
      if (c.right !== null) flat.push([c.street, c.right])
    }
    assert.equal(flat.length, fx.deliveries)
    assert.deepEqual(flat, fx.order)
  })
}

test("recall orders: the Lens's recallOrder equals the double-precision reference for 2 to 12 letters, passes 0 to 5", () => {
  const fx = JSON.parse(readFileSync(new URL("./fixtures/recall_orders.json", import.meta.url), "utf8"))
  for (const [n, orders] of Object.entries(fx.orders)) {
    orders.forEach((expected, pass) => assert.deepEqual(route.recallOrder(Number(n), pass), expected, `n ${n} pass ${pass}`))
  }
  assert.deepEqual(route.recallOrder(fx.observed.n, fx.observed.pass), fx.observed.order)
  // A switch to exact 32-bit arithmetic would change every recall order the LEAF runs were proven on: fail loudly.
  assert.notDeepEqual(route.recallOrder(8, 0), fx.exactIntegerOrderMustNotMatch.order)
})

test("the fixtures name their sources and carry the OpenStreetMap credit", () => {
  for (const r of [1, 2]) {
    const fx = fixture(r)
    assert.equal(fx.reference, "research/proto_case_layout/case_layout.py")
    assert.match(fx.referenceSha256, /^[0-9a-f]{64}$/)
    assert.match(fx.attribution, /OpenStreetMap contributors/)
  }
  assert.equal(fixture(1).deliveries, 149)
  assert.equal(fixture(2).deliveries, 146)
})
