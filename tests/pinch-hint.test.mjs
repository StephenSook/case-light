// Owns: unit tests for Assets/Scripts/CaseLightPinchHintRule.ts: the hint shows only with no saved progress and no demo replay, a Start press or a release leaves it up, only a grab ends it ("grab"), and nothing brings it back.
// Talks to: Assets/Scripts/CaseLightPinchHintRule.ts (pure, no imports), node:test, node:assert.
// Must not: load any scene code; every expected value is written out here from the coordinator's A3 fix-round rule (shown only with no saved progress at Lens start; stays up through the opening Start press; only the grab of a letter ends it; never back), not computed by the module under test.

import { test } from "node:test"
import assert from "node:assert/strict"
import { openingPinchHint, nextPinchHint } from "../Assets/Scripts/CaseLightPinchHintRule.ts"

const PLAYING = { playing: true, ended: "none" }
const HIDDEN = { playing: false, ended: "none" }
const GRABBED = { playing: false, ended: "grab" }

test("shown at Lens start only when nothing was saved", () => {
  assert.deepEqual(openingPinchHint(false, false), PLAYING)
  assert.deepEqual(openingPinchHint(true, false), HIDDEN)
})

test("never shown in a demo replay", () => {
  assert.deepEqual(openingPinchHint(false, true), HIDDEN)
  assert.deepEqual(openingPinchHint(true, true), HIDDEN)
})

test("a Start press does not end it (the letter cannot be grabbed before Start)", () => {
  assert.deepEqual(nextPinchHint(PLAYING, "start"), PLAYING)
  assert.deepEqual(nextPinchHint(nextPinchHint(PLAYING, "start"), "start"), PLAYING)
})

test("a release while it plays changes nothing", () => {
  assert.deepEqual(nextPinchHint(PLAYING, "release"), PLAYING)
})

test("a grab ends it with grab, after a Start press too", () => {
  assert.deepEqual(nextPinchHint(PLAYING, "grab"), GRABBED)
  assert.deepEqual(nextPinchHint(nextPinchHint(PLAYING, "start"), "grab"), GRABBED)
})

test("once ended it never comes back: not on release, a later grab, Start or Again", () => {
  // Again starts a recall pass, which reaches the rule as a Start press.
  let s = nextPinchHint(nextPinchHint(PLAYING, "start"), "grab")
  for (const e of ["release", "start", "grab", "start", "release"]) {
    s = nextPinchHint(s, e)
    assert.deepEqual(s, GRABBED)
  }
})

test("never shown: no event starts it, and it stays none", () => {
  let s = HIDDEN
  for (const e of ["start", "grab", "release"]) {
    s = nextPinchHint(s, e)
    assert.deepEqual(s, HIDDEN)
  }
})

test("the state passed in is not changed", () => {
  const s = { playing: true, ended: "none" }
  nextPinchHint(s, "grab")
  assert.deepEqual(s, PLAYING)
})
