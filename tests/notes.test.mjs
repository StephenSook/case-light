// Owns: unit tests for Assets/Scripts/CaseLightNotes.ts: the three fixed sorting reminders, one note per slot, the chooser's options, when a note shows, and notes kept per route.
// Talks to: Assets/Scripts/CaseLightNotes.ts (pure, no imports), node:test, node:assert.
// Must not: load any scene code; the three texts are copied from research/packets/CASELIGHT-QUEUE.md item 3, not read from the module.

import { test } from "node:test"
import assert from "node:assert/strict"
import { REMINDER_TEXTS, REMOVE_NOTE_LABEL, isReminderText, NoteStore, RouteNotes, chooserOptions, notesToShow } from "../Assets/Scripts/CaseLightNotes.ts"

const STREET = "Check the street name"
const SIDES = "Odd side up, even side back"
const NUMBER = "Read the whole number"

test("exactly the three reminders, in order, with no house number in any", () => {
  assert.deepEqual([...REMINDER_TEXTS], [STREET, SIDES, NUMBER])
  for (const t of REMINDER_TEXTS) assert.equal(/[0-9]/.test(t), false, t)
  assert.equal(REMOVE_NOTE_LABEL, "Remove note")
})

test("no free text: anything but the three reminders is refused and changes nothing", () => {
  const s = new NoteStore()
  assert.equal(isReminderText("Check the street"), false)
  assert.equal(s.set(20, "Leave at 2195 FAIRWAYS CT"), false)
  assert.equal(s.set(20, ""), false)
  assert.equal(s.set(-1, STREET), false)
  assert.equal(s.set(1.5, STREET), false)
  assert.equal(s.count, 0)
})

test("one note per slot: a pick pins, a different pick replaces, the same pick changes nothing, Remove note clears", () => {
  const s = new NoteStore()
  assert.equal(s.applyPick(20, STREET), true)
  assert.equal(s.noteFor(20), STREET)
  assert.equal(s.applyPick(20, STREET), false)
  assert.equal(s.applyPick(20, SIDES), true)
  assert.equal(s.noteFor(20), SIDES)
  assert.equal(s.count, 1)
  assert.equal(s.applyPick(20, REMOVE_NOTE_LABEL), true)
  assert.equal(s.noteFor(20), null)
  assert.equal(s.applyPick(20, REMOVE_NOTE_LABEL), false)
})

test("the chooser offers Remove note only when the slot already has a note", () => {
  const s = new NoteStore()
  s.set(20, NUMBER)
  assert.deepEqual(chooserOptions(s, 21), [STREET, SIDES, NUMBER])
  assert.deepEqual(chooserOptions(s, 20), [STREET, SIDES, NUMBER, REMOVE_NOTE_LABEL])
})

test("slots with a note come back in ascending order", () => {
  const s = new NoteStore()
  s.set(76, STREET)
  s.set(9, SIDES)
  s.set(20, NUMBER)
  assert.deepEqual(s.slots(), [9, 20, 76])
})

test("when a note shows: every note in Veteran mode, none between passes, otherwise only on the lit slot", () => {
  const s = new NoteStore()
  s.set(20, STREET)
  s.set(76, SIDES)
  assert.deepEqual(notesToShow(s, { mode: "recall", litSlot: -1, veteranMode: true }), [20, 76])
  assert.deepEqual(notesToShow(s, { mode: "idle", litSlot: 76, veteranMode: false }), [])
  assert.deepEqual(notesToShow(s, { mode: "recall", litSlot: -1, veteranMode: false }), [])
  assert.deepEqual(notesToShow(s, { mode: "recall", litSlot: 76, veteranMode: false }), [76])
  assert.deepEqual(notesToShow(s, { mode: "recall", litSlot: 5, veteranMode: false }), [])
  assert.deepEqual(notesToShow(s, { mode: "recall", litSlot: -2, veteranMode: false }), [])
  assert.deepEqual(notesToShow(s, { mode: "practice", litSlot: 20, veteranMode: false }), [20])
})

test("each route keeps its own notes", () => {
  const r = new RouteNotes()
  r.storeFor(1).set(20, STREET)
  assert.equal(r.storeFor(2).has(20), false)
  r.storeFor(2).set(61, NUMBER)
  assert.equal(r.storeFor(1).noteFor(20), STREET)
  assert.equal(r.storeFor(1).has(61), false)
  assert.equal(r.storeFor(1), r.storeFor(1))
})
