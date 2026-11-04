// Owns: unit tests for Assets/Scripts/CaseLightMastery.ts: each letter's state from its latest recall event (unseen, weak, learned), practice ignored, row state priority with the hold letter in row 0, per-route isolation, and the row label wording.
// Talks to: Assets/Scripts/CaseLightMastery.ts (pure, no imports), node:test, node:assert.
// Must not: load any scene code; every expected value is written out here from the rules in research/packets/CASELIGHT-QUEUE.md item A1, not computed by the module under test.

import { test } from "node:test"
import assert from "node:assert/strict"
import {
  HOLD_TARGET,
  LEARNED_TEMPLATE,
  REVIEW_TEMPLATE,
  NOT_TRIED_TEMPLATE,
  MasteryMap,
  rowOfTarget,
  rowStateOf,
  rowLabel,
} from "../Assets/Scripts/CaseLightMastery.ts"

// A small bundle: letters 0, 1 and the hold letter 2 in row 0 (targets 9, 17, HOLD); letters 3 and 4 in row 1 (targets 46, 56).
const TARGETS = [9, 17, -2, 46, 56]
const ROUTE_1 = 1
const ROUTE_2 = 2

test("defaults: the three row label wordings and the HOLD target", () => {
  assert.equal(LEARNED_TEMPLATE, "From memory")
  assert.equal(REVIEW_TEMPLATE, "Review {n}")
  assert.equal(NOT_TRIED_TEMPLATE, "Not tried {n}")
  assert.equal(HOLD_TARGET, -2)
})

test("every letter starts unseen, on any route", () => {
  const m = new MasteryMap(5)
  for (let i = 0; i < 5; i++) {
    assert.equal(m.letterState(ROUTE_1, i), "unseen")
    assert.equal(m.letterState(ROUTE_2, i), "unseen")
  }
  assert.equal(m.letterState(ROUTE_1, 9), "unseen")
  assert.equal(m.letterState(ROUTE_1, -1), "unseen")
})

test("unseen to learned: a recall placement from memory", () => {
  const m = new MasteryMap(5)
  m.recordPlacement(ROUTE_1, 0, true)
  assert.equal(m.letterState(ROUTE_1, 0), "learned")
  assert.equal(m.letterState(ROUTE_1, 1), "unseen")
})

test("unseen to weak: a recall miss", () => {
  const m = new MasteryMap(5)
  m.recordMiss(ROUTE_1, 3)
  assert.equal(m.letterState(ROUTE_1, 3), "weak")
})

test("a helped placement counts as weak", () => {
  const m = new MasteryMap(5)
  m.recordPlacement(ROUTE_1, 4, false)
  assert.equal(m.letterState(ROUTE_1, 4), "weak")
})

test("a miss then the come-back placed right in the same pass stays weak", () => {
  const m = new MasteryMap(5)
  m.recordMiss(ROUTE_1, 3)
  // The come-back is placed right but the letter was helped in that pass: not from memory.
  m.recordPlacement(ROUTE_1, 3, false)
  assert.equal(m.letterState(ROUTE_1, 3), "weak")
})

test("weak to learned in a later pass, and learned back to weak after a later miss", () => {
  const m = new MasteryMap(5)
  m.recordMiss(ROUTE_1, 1)
  m.recordPlacement(ROUTE_1, 1, false)
  assert.equal(m.letterState(ROUTE_1, 1), "weak")
  m.recordPlacement(ROUTE_1, 1, true)
  assert.equal(m.letterState(ROUTE_1, 1), "learned")
  m.recordMiss(ROUTE_1, 1)
  assert.equal(m.letterState(ROUTE_1, 1), "weak")
})

test("practice is ignored: misses and placements in practice change nothing", () => {
  const m = new MasteryMap(5)
  m.recordMiss(ROUTE_1, 0, "practice")
  m.recordPlacement(ROUTE_1, 1, true, "practice")
  m.recordPlacement(ROUTE_1, 2, false, "practice")
  assert.equal(m.letterState(ROUTE_1, 0), "unseen")
  assert.equal(m.letterState(ROUTE_1, 1), "unseen")
  assert.equal(m.letterState(ROUTE_1, 2), "unseen")
  m.recordPlacement(ROUTE_1, 1, true)
  m.recordMiss(ROUTE_1, 1, "practice")
  assert.equal(m.letterState(ROUTE_1, 1), "learned")
})

test("rows: 0..39 is row 0, 40..79 row 1, the HOLD block is row 0", () => {
  assert.equal(rowOfTarget(0), 0)
  assert.equal(rowOfTarget(39), 0)
  assert.equal(rowOfTarget(40), 1)
  assert.equal(rowOfTarget(79), 1)
  assert.equal(rowOfTarget(-2), 0)
})

test("row counts: the hold letter is counted in row 0", () => {
  const m = new MasteryMap(5)
  assert.deepEqual(m.rowCounts(ROUTE_1, TARGETS, 0), { learned: 0, weak: 0, unseen: 3 })
  assert.deepEqual(m.rowCounts(ROUTE_1, TARGETS, 1), { learned: 0, weak: 0, unseen: 2 })
  m.recordPlacement(ROUTE_1, 2, true)
  assert.deepEqual(m.rowCounts(ROUTE_1, TARGETS, 0), { learned: 1, weak: 0, unseen: 2 })
  assert.deepEqual(m.rowCounts(ROUTE_1, TARGETS, 1), { learned: 0, weak: 0, unseen: 2 })
})

test("row priority: any weak makes the row weak, else any unseen makes it unseen, else learned", () => {
  const m = new MasteryMap(5)
  assert.equal(m.rowState(ROUTE_1, TARGETS, 0), "unseen")
  m.recordPlacement(ROUTE_1, 0, true)
  m.recordPlacement(ROUTE_1, 1, true)
  // The hold letter is still unseen, so row 0 is not learned yet.
  assert.equal(m.rowState(ROUTE_1, TARGETS, 0), "unseen")
  m.recordPlacement(ROUTE_1, 2, true)
  assert.equal(m.rowState(ROUTE_1, TARGETS, 0), "learned")
  // Row 1: one weak letter and one unseen letter: weak wins.
  m.recordMiss(ROUTE_1, 3)
  assert.equal(m.rowState(ROUTE_1, TARGETS, 1), "weak")
  assert.deepEqual(m.rowCounts(ROUTE_1, TARGETS, 1), { learned: 0, weak: 1, unseen: 1 })
  // A weak hold letter makes row 0 weak.
  m.recordMiss(ROUTE_1, 2)
  assert.equal(m.rowState(ROUTE_1, TARGETS, 0), "weak")
  assert.deepEqual(m.rowCounts(ROUTE_1, TARGETS, 0), { learned: 2, weak: 1, unseen: 0 })
})

test("rowStateOf on counts alone, and an empty row reads unseen", () => {
  assert.equal(rowStateOf({ learned: 3, weak: 0, unseen: 0 }), "learned")
  assert.equal(rowStateOf({ learned: 3, weak: 0, unseen: 1 }), "unseen")
  assert.equal(rowStateOf({ learned: 3, weak: 1, unseen: 1 }), "weak")
  assert.equal(rowStateOf({ learned: 0, weak: 0, unseen: 0 }), "unseen")
})

test("per-route isolation: each route keeps its own letters", () => {
  const m = new MasteryMap(5)
  m.recordPlacement(ROUTE_1, 0, true)
  m.recordMiss(ROUTE_2, 0)
  assert.equal(m.letterState(ROUTE_1, 0), "learned")
  assert.equal(m.letterState(ROUTE_2, 0), "weak")
  assert.equal(m.letterState(ROUTE_2, 1), "unseen")
  assert.equal(m.rowState(ROUTE_1, TARGETS, 0), "unseen")
  assert.equal(m.rowState(ROUTE_2, TARGETS, 0), "weak")
  assert.deepEqual(m.rowCounts(ROUTE_2, TARGETS, 1), { learned: 0, weak: 0, unseen: 2 })
  assert.deepEqual(m.routesRecorded, [1, 2])
})

test("label wording: From memory, Review {n} with the weak count, Not tried {n} with the unseen count", () => {
  assert.equal(rowLabel("learned", { learned: 4, weak: 0, unseen: 0 }), "From memory")
  assert.equal(rowLabel("weak", { learned: 3, weak: 1, unseen: 0 }), "Review 1")
  assert.equal(rowLabel("weak", { learned: 0, weak: 2, unseen: 2 }), "Review 2")
  assert.equal(rowLabel("unseen", { learned: 1, weak: 0, unseen: 3 }), "Not tried 3")
})

test("label wording comes from templates", () => {
  const t = { learned: "Known", review: "Look again: {n}", notTried: "{n} new" }
  assert.equal(rowLabel("learned", { learned: 2, weak: 0, unseen: 0 }, t), "Known")
  assert.equal(rowLabel("weak", { learned: 0, weak: 3, unseen: 0 }, t), "Look again: 3")
  assert.equal(rowLabel("unseen", { learned: 0, weak: 0, unseen: 5 }, t), "5 new")
})
