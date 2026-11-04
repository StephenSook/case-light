// Owns: unit tests for Assets/Scripts/CaseLightNoteShare.ts (when notes are shared, what one shared note carries, how a received note is checked and applied) and for the note-sent and note-received lines in Assets/Scripts/CaseLightLog.ts.
// Talks to: Assets/Scripts/CaseLightNoteShare.ts and Assets/Scripts/CaseLightNotes.ts (pure), Assets/Scripts/CaseLightLog.ts (pure), node:test, node:assert.
// Must not: load any scene code or the Sync Kit; the reminder texts are written out here, not read from the modules.

import { test } from "node:test"
import assert from "node:assert/strict"
import "./register-ts.mjs"

// Dynamic imports, so the resolver above is registered before CaseLightNoteShare.ts imports "./CaseLightNotes".
const { NoteStore } = await import("../Assets/Scripts/CaseLightNotes.ts")
const { REMOVED_NOTE, SHARED_SLOT_COUNT, allSharedNotes, applySharedNote, decodeNote, encodeNote, shouldShare } = await import("../Assets/Scripts/CaseLightNoteShare.ts")
const { formatNoteShare } = await import("../Assets/Scripts/CaseLightLog.ts")

const STREET = "Check the street name"
const SIDES = "Odd side up, even side back"
const NUMBER = "Read the whole number"

test("nothing is shared without Share notes on, a ready session and more than one player", () => {
  assert.equal(shouldShare({ sharingOn: true, sessionReady: true, singleplayer: false }), true)
  assert.equal(shouldShare({ sharingOn: false, sessionReady: true, singleplayer: false }), false)
  assert.equal(shouldShare({ sharingOn: true, sessionReady: false, singleplayer: false }), false)
  assert.equal(shouldShare({ sharingOn: true, sessionReady: true, singleplayer: true }), false)
  // Solo as the Lens starts: start mode Off, no session.
  assert.equal(shouldShare({ sharingOn: false, sessionReady: false, singleplayer: false }), false)
})

test("a shared note is exactly a slot and a reminder text, or an empty text for a removal", () => {
  assert.equal(REMOVED_NOTE, "")
  assert.equal(SHARED_SLOT_COUNT, 80)
  assert.deepEqual(encodeNote(12, STREET), { slot: 12, note: STREET })
  assert.deepEqual(encodeNote(79, NUMBER), { slot: 79, note: NUMBER })
  assert.deepEqual(encodeNote(0, null), { slot: 0, note: "" })
  assert.deepEqual(Object.keys(encodeNote(5, SIDES)).sort(), ["note", "slot"])
})

test("encode refuses free text, house numbers and slots off the case", () => {
  assert.equal(encodeNote(12, "Leave at 2195 FAIRWAYS CT"), null)
  assert.equal(encodeNote(12, "check the street name"), null)
  assert.equal(encodeNote(-1, STREET), null)
  assert.equal(encodeNote(80, STREET), null)
  assert.equal(encodeNote(1.5, STREET), null)
})

test("decode takes only { slot, note } with a valid slot and a reminder or a removal", () => {
  assert.deepEqual(decodeNote({ slot: 40, note: SIDES }), { slot: 40, note: SIDES })
  assert.deepEqual(decodeNote({ note: NUMBER, slot: 3 }), { slot: 3, note: NUMBER })
  assert.deepEqual(decodeNote({ slot: 3, note: "" }), { slot: 3, note: "" })
  assert.equal(decodeNote({ slot: 3, note: NUMBER, name: "someone" }), null, "an extra field such as a name is refused")
  assert.equal(decodeNote({ slot: 3, note: NUMBER, route: 2 }), null, "a route is refused")
  assert.equal(decodeNote({ slot: 3 }), null)
  assert.equal(decodeNote({ slot: "3", note: NUMBER }), null)
  assert.equal(decodeNote({ slot: 80, note: NUMBER }), null)
  assert.equal(decodeNote({ slot: 3, note: "Ring the bell at 12 Main St" }), null)
  assert.equal(decodeNote(null), null)
  assert.equal(decodeNote("slot=3"), null)
  assert.equal(decodeNote([3, NUMBER]), null)
})

test("a received note pins, replaces and removes like a local pick; the same note twice changes nothing", () => {
  const s = new NoteStore()
  assert.equal(applySharedNote(s, { slot: 20, note: STREET }), true)
  assert.equal(s.noteFor(20), STREET)
  assert.equal(applySharedNote(s, { slot: 20, note: STREET }), false)
  assert.equal(applySharedNote(s, { slot: 20, note: SIDES }), true)
  assert.equal(s.noteFor(20), SIDES)
  assert.equal(applySharedNote(s, { slot: 20, note: "" }), true)
  assert.equal(s.has(20), false)
  assert.equal(applySharedNote(s, { slot: 20, note: "" }), false, "removing a note that is not there changes nothing")
})

test("every held note, ascending by slot, for sending when sharing starts or someone joins", () => {
  const s = new NoteStore()
  s.set(61, NUMBER)
  s.set(2, STREET)
  s.set(20, SIDES)
  assert.deepEqual(allSharedNotes(s), [
    { slot: 2, note: STREET },
    { slot: 20, note: SIDES },
    { slot: 61, note: NUMBER },
  ])
  assert.deepEqual(allSharedNotes(new NoteStore()), [])
})

test("note-sent and note-received log lines: the slot and the text, nothing about the other person", () => {
  const head = { seq: 9, session: "s1-k3x9q2", route: 1, pass: 0, mode: "idle" }
  assert.equal(formatNoteShare(head, "sent", 12, STREET), 'CASELIGHT_LOG v1 seq=9 session=s1-k3x9q2 route=1 pass=0 mode=idle event=note-sent slot=12 note="Check the street name"')
  assert.equal(formatNoteShare(head, "received", 12, ""), 'CASELIGHT_LOG v1 seq=9 session=s1-k3x9q2 route=1 pass=0 mode=idle event=note-received slot=12 note=""')
})
