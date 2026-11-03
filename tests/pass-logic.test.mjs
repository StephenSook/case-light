// Owns: unit tests for Assets/Scripts/CaseLightPassLogic.ts: the come-back queue, the per-pass helped set, the answer light after a pick-up, retirement, the session score and the card wording.
// Talks to: Assets/Scripts/CaseLightPassLogic.ts (pure, no imports), node:test, node:assert.
// Must not: load any scene code; every expected value is written out here from the rules in devpost/BUILD_LOG.md, not computed by the module under test.

import { test } from "node:test"
import assert from "node:assert/strict"
import {
  COME_BACK_GAP,
  RETIRE_AFTER_PASSES,
  comeBackQueue,
  missLitAfterGrab,
  withoutRetired,
  PassQueue,
  Retirement,
  SessionScore,
  formatScore,
  formatCameBack,
} from "../Assets/Scripts/CaseLightPassLogic.ts"

test("defaults: a missed letter comes back 2 letters later; 2 passes from memory retire it", () => {
  assert.equal(COME_BACK_GAP, 2)
  assert.equal(RETIRE_AFTER_PASSES, 2)
})

test("comeBackQueue puts the missed top letter behind exactly 2 others", () => {
  assert.deepEqual(comeBackQueue([0, 1, 2, 3, 4, 5, 6, 7]), [1, 2, 0, 3, 4, 5, 6, 7])
  assert.deepEqual(comeBackQueue([4, 3, 2, 6]), [3, 2, 4, 6])
})

test("comeBackQueue with fewer than 2 others left goes to the end; alone it comes straight back", () => {
  assert.deepEqual(comeBackQueue([5, 6]), [6, 5])
  assert.deepEqual(comeBackQueue([5]), [5])
  assert.deepEqual(comeBackQueue([]), [])
})

test("comeBackQueue does not change its input", () => {
  const q = [0, 1, 2]
  comeBackQueue(q)
  assert.deepEqual(q, [0, 1, 2])
})

test("PassQueue: a miss marks only that letter helped for the rest of the pass", () => {
  const p = new PassQueue([0, 1, 2, 3])
  assert.equal(p.missTop(), 2)
  assert.deepEqual(p.queue, [1, 2, 0, 3])
  assert.equal(p.isHelped(0), true)
  assert.equal(p.isHelped(1), false)
  assert.equal(p.comeBackCount, 1)
  assert.deepEqual(p.placeTop(), { piece: 1, helped: false })
  assert.deepEqual(p.placeTop(), { piece: 2, helped: false })
  assert.deepEqual(p.placeTop(), { piece: 0, helped: true })
  assert.deepEqual(p.placeTop(), { piece: 3, helped: false })
  assert.equal(p.done, true)
  assert.equal(p.placedCount, 4)
  assert.deepEqual(p.helpedLetters, [0])
})

test("PassQueue: the last letter left comes straight back when missed, and stays helped", () => {
  const p = new PassQueue([5])
  assert.equal(p.missTop(), 0)
  assert.deepEqual(p.queue, [5])
  assert.deepEqual(p.placeTop(), { piece: 5, helped: true })
  assert.equal(p.comeBackCount, 1)
})

test("PassQueue: nothing to place or miss once the pass is done", () => {
  const p = new PassQueue([])
  assert.equal(p.top, -1)
  assert.deepEqual(p.placeTop(), { piece: -1, helped: false })
  assert.equal(p.missTop(), -1)
  assert.equal(p.comeBackCount, 0)
})

test("missLitAfterGrab: any pick-up puts out a miss's answer, the missed letter's own return included (decision 7, option A)", () => {
  assert.equal(missLitAfterGrab(3, 3), -1)
  assert.equal(missLitAfterGrab(3, 4), -1)
  assert.equal(missLitAfterGrab(3, -1), 3)
  assert.equal(missLitAfterGrab(-1, 2), -1)
})

test("Retirement: 2 completed recall passes in a row from memory retire a letter", () => {
  const r = new Retirement(3)
  const helpedIn = (set) => (p) => set.has(p)
  assert.deepEqual(r.recordPass([0, 1, 2], helpedIn(new Set([1]))), [])
  assert.equal(r.streakOf(0), 1)
  assert.equal(r.streakOf(1), 0)
  assert.deepEqual(r.recordPass([0, 1, 2], helpedIn(new Set())), [0, 2])
  assert.deepEqual(r.retiredLetters, [0, 2])
  assert.equal(r.isRetired(1), false)
  assert.equal(r.retiredCount, 2)
  assert.equal(r.allRetired, false)
  assert.deepEqual(r.recordPass(withoutRetired([0, 1, 2], (p) => r.isRetired(p)), helpedIn(new Set())), [1])
  assert.equal(r.allRetired, true)
})

test("Retirement: a helped pass breaks the run", () => {
  const r = new Retirement(1)
  r.recordPass([0], () => false)
  r.recordPass([0], () => true)
  assert.equal(r.streakOf(0), 0)
  assert.deepEqual(r.recordPass([0], () => false), [])
  assert.equal(r.isRetired(0), false)
})

test("Retirement: reset clears every run and every retirement (Done)", () => {
  const r = new Retirement(2)
  r.recordPass([0, 1], () => false)
  r.recordPass([0, 1], () => false)
  assert.equal(r.retiredCount, 2)
  r.reset()
  assert.equal(r.retiredCount, 0)
  assert.equal(r.streakOf(0), 0)
})

test("Retirement: retired letters are skipped, and a setting below 1 still needs one pass", () => {
  const r = new Retirement(2, 0)
  assert.deepEqual(r.recordPass([0], () => false), [0])
  assert.deepEqual(r.recordPass([0, 1], () => false), [1])
  assert.equal(r.streakOf(0), 1)
})

test("withoutRetired keeps the order of the others", () => {
  assert.deepEqual(withoutRetired([4, 3, 2, 6], (p) => p === 3), [4, 2, 6])
})

test("SessionScore and the card: only placements without help count from memory", () => {
  const s = new SessionScore()
  s.add(false)
  s.add(true)
  s.add(false)
  assert.deepEqual([s.unaided, s.helped, s.total], [2, 1, 3])
  assert.equal(formatScore("From memory: {x} of {y} this session", s.unaided, s.total), "From memory: 2 of 3 this session")
  assert.equal(formatScore("Unaided: {x}/{y} this session", 7, 8), "Unaided: 7/8 this session")
  assert.equal(formatCameBack("Came back: {n}", 1), "Came back: 1")
})
