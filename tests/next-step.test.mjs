// Owns: unit tests for Assets/Scripts/CaseLightNextStep.ts: which Start button is drawn as the next step.
// Talks to: Assets/Scripts/CaseLightNextStep.ts (pure), node:test, node:assert.
// Must not: load any scene code; every expected value is written out here.

import { test } from "node:test"
import assert from "node:assert/strict"
import "./register-ts.mjs"

const { primaryActionFor } = await import("../Assets/Scripts/CaseLightNextStep.ts")

test("before any practice on the route: Start practice is the next step", () => {
  assert.equal(primaryActionFor("idle", false), "practice")
})

test("after a practice pass on the route: Start recall is the next step", () => {
  assert.equal(primaryActionFor("idle", true), "recall")
})

test("during a pass neither Start button is the next step", () => {
  assert.equal(primaryActionFor("practice", false), "none")
  assert.equal(primaryActionFor("practice", true), "none")
  assert.equal(primaryActionFor("recall", true), "none")
})
