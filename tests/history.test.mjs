// Owns: unit tests for Assets/Scripts/CaseLightHistory.ts: the learning curve's value and its JSON round trip, appending a recall pass with the newest five kept, a pass's point from the session score, per-route keys kept apart, bad data read as no history, the score labels and caption, where the points go (oldest left), and when the curve shows.
// Talks to: Assets/Scripts/CaseLightHistory.ts and Assets/Scripts/CaseLightProgress.ts (pure), node:test, node:assert.
// Must not: load any scene code; every expected value is written out here, not computed by the module under test.

import { test } from "node:test"
import assert from "node:assert/strict"
import "./register-ts.mjs"

// Dynamic import, so the resolver above is registered before CaseLightHistory.ts imports "./CaseLightProgress".
const { HISTORY_MAX, HISTORY_CAPTION, appendHistory, curvePoints, curveVisible, decodeHistory, encodeHistory, loadHistory, passScore, scoreLabel } = await import("../Assets/Scripts/CaseLightHistory.ts")

/** A tiny fake store: a plain object of key -> string; a missing key reads "". */
function reader(store) {
  return (key) => (key in store ? store[key] : "")
}

test("at most five points, one caption, labels read x/y", () => {
  assert.equal(HISTORY_MAX, 5)
  assert.equal(HISTORY_CAPTION, "Recall passes")
  assert.equal(scoreLabel({ x: 4, y: 8 }), "4/8")
  assert.equal(scoreLabel({ x: 8, y: 8 }), "8/8")
  assert.equal(scoreLabel({ x: 0, y: 7 }), "0/7")
})

test("value: a JSON list of {x, y}, oldest at the start, round trip", () => {
  const list = [{ x: 4, y: 8 }, { x: 6, y: 8 }, { x: 8, y: 8 }]
  assert.equal(encodeHistory(list), '[{"x":4,"y":8},{"x":6,"y":8},{"x":8,"y":8}]')
  assert.deepEqual(decodeHistory(encodeHistory(list)), { value: list, bad: false })
  assert.deepEqual(decodeHistory("[]"), { value: [], bad: false })
  assert.deepEqual(decodeHistory(""), { value: null, bad: false }, "a missing value is no history, not bad")
})

test("append: newest last, the newest five kept, the input untouched", () => {
  const one = appendHistory(null, { x: 4, y: 8 })
  assert.deepEqual(one, [{ x: 4, y: 8 }])
  let list = one
  for (const x of [5, 6, 7, 8]) list = appendHistory(list, { x, y: 8 })
  assert.deepEqual(list.map((s) => s.x), [4, 5, 6, 7, 8])
  const six = appendHistory(list, { x: 3, y: 8 })
  assert.deepEqual(six.map((s) => s.x), [5, 6, 7, 8, 3], "the oldest drops off the left")
  assert.equal(list.length, 5, "the list passed in is not changed")
  assert.deepEqual(appendHistory([{ x: 1, y: 2 }], { x: 2, y: 2 }, 1), [{ x: 2, y: 2 }])
})

test("a pass's point is the session score's change over the pass", () => {
  assert.deepEqual(passScore(0, 0, 7, 8), { x: 7, y: 8 })
  assert.deepEqual(passScore(7, 8, 15, 16), { x: 8, y: 8 }, "a second pass in the same session counts only its own letters")
  assert.equal(passScore(7, 8, 7, 8), null, "a pass with no placement adds nothing")
  assert.equal(passScore(7, 8, 3, 9), null, "a score that went down is not a pass")
})

test("bad data reads as no history and is reported; it never throws", () => {
  for (const bad of ["{", "{}", '{"x":1,"y":2}', '[{"x":3,"y":2}]', '[{"x":1,"y":0}]', '[{"x":-1,"y":2}]', '[{"x":1.5,"y":2}]', '[{"x":"1","y":2}]', '[null]', '[1,2]',
    '[{"x":1,"y":8},{"x":2,"y":8},{"x":3,"y":8},{"x":4,"y":8},{"x":5,"y":8},{"x":6,"y":8}]']) {
    assert.deepEqual(decodeHistory(bad), { value: null, bad: true }, bad)
  }
  const r = loadHistory(reader({ "caselight.v1.history.1": "[oops", "caselight.v1.history.2": '[{"x":2,"y":8}]' }), [1, 2])
  assert.deepEqual(r.badKeys, ["caselight.v1.history.1"])
  assert.equal(r.history.has(1), false)
  assert.deepEqual(r.history.get(2), [{ x: 2, y: 8 }])
  const throwing = loadHistory(() => {
    throw new Error("store gone")
  }, [1, 2])
  assert.equal(throwing.history.size, 0)
  assert.deepEqual(throwing.badKeys, [])
})

test("per route: each route reads its own key only", () => {
  const r = loadHistory(reader({ "caselight.v1.history.1": '[{"x":4,"y":8},{"x":6,"y":8}]', "caselight.v1.history.3": '[{"x":1,"y":8}]', "caselight.v1.last": '{"x":9,"y":9}' }), [1, 2])
  assert.deepEqual(r.history.get(1), [{ x: 4, y: 8 }, { x: 6, y: 8 }])
  assert.equal(r.history.has(2), false, "route 2 has none")
  assert.equal(r.history.has(3), false, "a route not asked for is not read")
  assert.equal(loadHistory(reader({ "caselight.v1.history.1": "[]" }), [1]).history.has(1), false, "an empty list draws nothing")
})

test("points: oldest left in five slots across, height by score share", () => {
  // Width 5, height 2: slots of 1 cm centred at -2, -1, 0, 1, 2; y from -1 (0 of y) to +1 (y of y).
  const pts = curvePoints([{ x: 4, y: 8 }, { x: 6, y: 8 }, { x: 8, y: 8 }], 5, 2)
  assert.deepEqual(pts, [{ x: -2, y: 0 }, { x: -1, y: 0.5 }, { x: 0, y: 1 }])
  assert.ok(pts[0].x < pts[1].x && pts[1].x < pts[2].x, "left to right is oldest to newest")
  assert.deepEqual(curvePoints([{ x: 0, y: 3 }], 5, 2), [{ x: -2, y: -1 }])
})

test("the curve shows only with history on the route in use and the pace caption down", () => {
  assert.equal(curveVisible([{ x: 4, y: 8 }], false), true)
  assert.equal(curveVisible([{ x: 4, y: 8 }], true), false, "the drill pace caption stands where the curve stands")
  assert.equal(curveVisible([], false), false, "nothing saved: nothing drawn, caption included")
  assert.equal(curveVisible(null, false), false)
})
