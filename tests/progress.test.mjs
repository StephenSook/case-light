// Owns: unit tests for Assets/Scripts/CaseLightProgress.ts: the storage keys (the learning curve's key included, so Reset progress removes it) and their JSON round trip, every branch of the row merge, the last score kept unless this session placed a letter, bad and other-version data read as no progress, per-route keys kept apart, when the welcome shows (Veteran mode hides it and brings it back), and the welcome wording.
// Talks to: Assets/Scripts/CaseLightProgress.ts (pure, no imports), node:test, node:assert.
// Must not: load any scene code; every expected value is written out here from the rules in research/packets/CASELIGHT-QUEUE.md item A2, not computed by the module under test.

import { test } from "node:test"
import assert from "node:assert/strict"
import {
  KEY_PREFIX,
  LAST_KEY,
  DEFAULT_WELCOME,
  routeKey,
  historyKey,
  ourKeys,
  emptyProgress,
  hasProgress,
  decodeRoute,
  encodeRoute,
  decodeLast,
  encodeLast,
  loadProgress,
  mergeRows,
  nextLast,
  welcomeLines,
  welcomeVisible,
} from "../Assets/Scripts/CaseLightProgress.ts"

/** A tiny fake store: a plain object of key -> string; a missing key reads "". */
function reader(store) {
  return (key) => (key in store ? store[key] : "")
}

test("keys: one per route, one for the last score and one learning curve per route, all under caselight.v1.", () => {
  assert.equal(KEY_PREFIX, "caselight.v1.")
  assert.equal(routeKey(1), "caselight.v1.route.1")
  assert.equal(routeKey(2), "caselight.v1.route.2")
  assert.equal(LAST_KEY, "caselight.v1.last")
  assert.equal(historyKey(1), "caselight.v1.history.1")
  assert.equal(historyKey(2), "caselight.v1.history.2")
  // What Reset progress removes: every key of ours, the learning curves included.
  assert.deepEqual(ourKeys([1, 2]), ["caselight.v1.route.1", "caselight.v1.route.2", "caselight.v1.last", "caselight.v1.history.1", "caselight.v1.history.2"])
})

test("route value: encode and decode round trip, rows ascending and unique", () => {
  assert.equal(encodeRoute([1, 0, 1]), '{"rows":[0,1]}')
  assert.equal(encodeRoute([]), '{"rows":[]}')
  assert.deepEqual(decodeRoute('{"rows":[0,1]}'), { value: [0, 1], bad: false })
  assert.deepEqual(decodeRoute(encodeRoute([0])), { value: [0], bad: false })
  assert.deepEqual(decodeRoute('{"rows":[]}'), { value: [], bad: false })
})

test("last value: encode and decode round trip", () => {
  assert.equal(encodeLast({ x: 7, y: 8 }), '{"x":7,"y":8}')
  assert.deepEqual(decodeLast('{"x":7,"y":8}'), { value: { x: 7, y: 8 }, bad: false })
})

test("missing values are no progress and not bad", () => {
  assert.deepEqual(decodeRoute(""), { value: null, bad: false })
  assert.deepEqual(decodeLast(""), { value: null, bad: false })
})

test("garbage JSON, wrong shapes and out-of-range rows are no progress, reported bad, never thrown", () => {
  assert.deepEqual(decodeRoute("{rows:"), { value: null, bad: true })
  assert.deepEqual(decodeRoute("[0,1]"), { value: null, bad: true })
  assert.deepEqual(decodeRoute('{"rows":"0"}'), { value: null, bad: true })
  assert.deepEqual(decodeRoute('{"rows":[2]}'), { value: null, bad: true })
  assert.deepEqual(decodeRoute('{"rows":[-1]}'), { value: null, bad: true })
  assert.deepEqual(decodeRoute('{"rows":[0.5]}'), { value: null, bad: true })
  assert.deepEqual(decodeLast("not json"), { value: null, bad: true })
  assert.deepEqual(decodeLast('{"x":9,"y":8}'), { value: null, bad: true })
  assert.deepEqual(decodeLast('{"x":0,"y":0}'), { value: null, bad: true })
  assert.deepEqual(decodeLast('{"x":"7","y":8}'), { value: null, bad: true })
  assert.deepEqual(decodeLast("null"), { value: null, bad: true })
})

test("a wrong version is no progress: a v other than 1 inside, and keys of another version are never read", () => {
  assert.deepEqual(decodeRoute('{"v":2,"rows":[0]}'), { value: null, bad: true })
  assert.deepEqual(decodeLast('{"v":2,"x":1,"y":2}'), { value: null, bad: true })
  const r = loadProgress(reader({ "caselight.v2.route.1": '{"rows":[0,1]}', "caselight.v2.last": '{"x":3,"y":4}' }), [1, 2])
  assert.equal(hasProgress(r.progress), false)
  assert.deepEqual(r.badKeys, [])
})

test("loadProgress reads each route and the last score, and lists bad keys", () => {
  const r = loadProgress(reader({ "caselight.v1.route.1": '{"rows":[0]}', "caselight.v1.route.2": "oops", "caselight.v1.last": '{"x":7,"y":8}' }), [1, 2])
  assert.deepEqual(r.progress.routes.get(1), [0])
  assert.equal(r.progress.routes.has(2), false)
  assert.deepEqual(r.progress.last, { x: 7, y: 8 })
  assert.deepEqual(r.badKeys, ["caselight.v1.route.2"])
  assert.equal(hasProgress(r.progress), true)
})

test("loadProgress never throws, even when the reader does", () => {
  const r = loadProgress(() => {
    throw new Error("store gone")
  }, [1, 2])
  assert.equal(hasProgress(r.progress), false)
  assert.deepEqual(r.badKeys, [])
})

test("per-route keys are kept apart", () => {
  const r = loadProgress(reader({ "caselight.v1.route.2": '{"rows":[1]}' }), [1, 2])
  assert.equal(r.progress.routes.has(1), false)
  assert.deepEqual(r.progress.routes.get(2), [1])
  assert.deepEqual(welcomeLines(r.progress, 1), ["Welcome back.", "Route 1: 0 of 2 rows from memory"])
  assert.deepEqual(welcomeLines(r.progress, 2), ["Welcome back.", "Route 2: 1 of 2 rows from memory"])
})

test("merge: a learned row is saved learned", () => {
  assert.deepEqual(mergeRows(null, ["learned", "learned"]), [0, 1])
  assert.deepEqual(mergeRows([], ["learned", "unseen"]), [0])
})

test("merge: a weak row is saved not learned, even if it was learned before", () => {
  assert.deepEqual(mergeRows([0, 1], ["learned", "weak"]), [0])
  assert.deepEqual(mergeRows([0, 1], ["weak", "weak"]), [])
})

test("merge: an unseen row keeps what was saved", () => {
  assert.deepEqual(mergeRows([1], ["learned", "unseen"]), [0, 1])
  assert.deepEqual(mergeRows([0], ["unseen", "unseen"]), [0])
  assert.deepEqual(mergeRows(null, ["unseen", "unseen"]), [])
  assert.deepEqual(mergeRows([], ["unseen", "weak"]), [])
})

test("last score: replaced only when this session has a recall placement", () => {
  assert.deepEqual(nextLast({ x: 3, y: 8 }, 7, 8), { x: 7, y: 8 })
  assert.deepEqual(nextLast(null, 0, 2), { x: 0, y: 2 })
  assert.deepEqual(nextLast({ x: 3, y: 8 }, 0, 0), { x: 3, y: 8 })
  assert.equal(nextLast(null, 0, 0), null)
})

test("welcome: no progress, no welcome", () => {
  assert.equal(hasProgress(emptyProgress()), false)
  assert.deepEqual(welcomeLines(emptyProgress(), 1), [])
})

test("welcome wording: the last score and today's route's rows from memory", () => {
  const p = emptyProgress()
  p.last = { x: 7, y: 8 }
  p.routes.set(1, [0])
  assert.deepEqual(welcomeLines(p, 1), ["Welcome back. Last time: 7 of 8 from memory", "Route 1: 1 of 2 rows from memory"])
  assert.deepEqual(welcomeLines(p, 2), ["Welcome back. Last time: 7 of 8 from memory", "Route 2: 0 of 2 rows from memory"])
  p.routes.set(1, [0, 1])
  assert.deepEqual(welcomeLines(p, 1)[1], "Route 1: 2 of 2 rows from memory")
})

test("welcome wording comes from templates", () => {
  assert.equal(DEFAULT_WELCOME.line1, "Welcome back. Last time: {x} of {y} from memory")
  assert.equal(DEFAULT_WELCOME.line2, "Route {r}: {n} of 2 rows from memory")
  const p = emptyProgress()
  p.last = { x: 2, y: 5 }
  p.routes.set(2, [1])
  const t = { line1: "Last: {x}/{y}", line1NoScore: "Hi.", line2: "R{r}: {n}/2" }
  assert.deepEqual(welcomeLines(p, 2, t), ["Last: 2/5", "R2: 1/2"])
})

const OPEN = { savedAtStart: true, startPressed: false, resetPressed: false, mapShown: false, veteranOn: false, casePlaced: false }

test("welcome shows with saved progress at Lens start, before the opening Start, Reset and the map, with Veteran mode off", () => {
  assert.equal(welcomeVisible(OPEN), true)
  assert.equal(welcomeVisible({ ...OPEN, savedAtStart: false }), false)
  assert.equal(welcomeVisible({ ...OPEN, startPressed: true }), false)
  assert.equal(welcomeVisible({ ...OPEN, resetPressed: true }), false)
  assert.equal(welcomeVisible({ ...OPEN, mapShown: true }), false)
})

test("Veteran mode on hides the welcome; off brings it back only while the other conditions hold", () => {
  assert.equal(welcomeVisible({ ...OPEN, veteranOn: true }), false)
  assert.equal(welcomeVisible({ ...OPEN, veteranOn: false }), true)
  assert.equal(welcomeVisible({ ...OPEN, veteranOn: false, startPressed: true }), false)
  assert.equal(welcomeVisible({ ...OPEN, veteranOn: false, resetPressed: true }), false)
  assert.equal(welcomeVisible({ ...OPEN, veteranOn: false, savedAtStart: false }), false)
})

test("placing the case (on a wall or in front of the user) hides the welcome for good", () => {
  assert.equal(welcomeVisible({ ...OPEN, casePlaced: true }), false)
  assert.equal(welcomeVisible({ ...OPEN, casePlaced: true, veteranOn: false }), false)
  assert.equal(welcomeVisible({ ...OPEN, casePlaced: false }), true)
})
