// Owns: the LEAF check for done criterion 5 (the end-of-recall score card counting only pieces placed right with no help), including the explicit one-miss check X = Y - 1.
// Talks to: CaseLightLeafSupport (real SIK/UIKit input, approved-wording result parsing, independent answers, assertions), CaseLightMain read-only getters, ResultText by name.
// Must not: call CaseLightMain's test hooks or commands, or change product state except through real input.

/**
 * Done criterion 5 (devpost/design-brief.md):
 * "After the last piece, the case shows "Unaided: X/Y this session", counting only pieces placed
 * right with no help."
 * The approved default card wording is "From memory: X of Y this session". The test writes that
 * wording itself and does NOT read the product's resultTemplate input, so the product cannot
 * redefine its own oracle (the Inspector template stays a product option; it is not tested).
 *
 * Input: REAL (LEAF SIK interactor).
 * Pass 1 (fresh session): exactly one deliberate miss. Explicit check: X == Y - 1, X == total - 1,
 * helped delta == 1, and the helped piece's own placement adds to helped, not to unaided.
 * v0.6 feature 2: the missed letter comes back with exactly two letters before it (the live queue
 * is checked against the test's own model before every drop, CaseLightRecallSupport), the card's
 * second line is "Tried again: <our count>", and after pass 2 the retired count equals our model.
 * Pass 1's shown result is also the positive control for the result detector.
 * Pass 2: all right at once; the result is hidden from the Start press until the last piece
 * (negative checks, after the positive control), then shows the session totals.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {CaseLightMain} from "../CaseLightMain"
import {hideLeafOverlay, 
  CaseLightLeafInteractor,
  expectedResult,
  expectResult,
  log,
  mustFind,
  parseResult,
  waitForReady,
} from "./CaseLightLeafSupport"
import {OwnModel, playRecallPass} from "./CaseLightRecallSupport"

function shownText(): string {
  return (mustFind("ResultText").getComponent("Component.Text") as Text).text
}

@component
export class CaseLightC5RecallScoreScenario extends Scenario {
  /** Second non-hold piece in the order (where the deliberate miss goes). */
  private missPiece(main: CaseLightMain, order: number[]): number {
    let seen = 0
    for (const p of order) if (!main.isHoldPiece(p) && ++seen === 2) return p
    return -1
  }

  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    const n = main.pieceCount

    // ---------------- Pass 1: exactly one deliberate miss. ----------------
    const u0 = main.unaidedCount
    const h0 = main.helpedCount
    const t0 = main.totalCount
    await ix.pressButton("StartRecallButton")
    expect(main.mode, "pass 1 recall started").toBe("recall")
    const order1 = main.bundleOrder
    expect(order1.length, "pieces in the recall pass").toBe(n)
    const missOn = this.missPiece(main, order1)
    expect(missOn >= 0, "found a non-hold piece for the deliberate miss").toBe(true)

    // v0.6 feature 2: the missed letter comes back with exactly two others before it (our own
    // model, checked against the live queue before every drop) and its later right placement
    // counts as helped, never as unaided. (Replaces the old "same piece back on top" step.)
    const model = new OwnModel(n)
    expect(JSON.stringify(model.startPass()), "pass 1 start order (our model)").toBe(JSON.stringify(order1))
    let helpedPlace: {u: number; h: number; t: number} | null = null
    let helpedBefore: {u: number; h: number; t: number} | null = null
    const t1 = await playRecallPass(ix, main, model, "pass 1", (p, k) => p === missOn && k === 0, (d) => {
      if (d.piece === missOn && d.k === 0) {
        expect(d.queueAfter.indexOf(missOn), `piece ${missOn} after its miss: exactly ${2} letters before it (or the end)`).toBe(Math.min(2, d.queueAfter.length - 1))
      }
      if (d.piece === missOn && d.result === "correct") helpedPlace = {u: main.unaidedCount, h: main.helpedCount, t: main.totalCount}
    }, (p, k) => {
      if (p === missOn && k === 1) helpedBefore = {u: main.unaidedCount, h: main.helpedCount, t: main.totalCount}
    })
    const hb = helpedBefore as {u: number; h: number; t: number} | null
    const ha = helpedPlace as {u: number; h: number; t: number} | null
    if (!hb || !ha) throw new Error(`the missed piece ${missOn} never came back to be placed`)
    expect(ha.u - hb.u, `helped piece ${missOn} is NOT counted as unaided`).toBe(0)
    expect(ha.h - hb.h, `helped piece ${missOn} counted as helped`).toBe(1)
    expect(ha.t - hb.t, `helped piece ${missOn} counted in the total`).toBe(1)
    expect(t1.comeBacks, "pass 1: one come-back (our count)").toBe(1)

    const du = main.unaidedCount - u0
    const dh = main.helpedCount - h0
    const dt = main.totalCount - t0
    const text1 = shownText()
    log(`C5 pass 1: mode=${main.mode} unaided +${du} helped +${dh} total +${dt}; ResultText enabled=${mustFind("ResultText").enabled} text="${text1}"`)
    expect(main.mode, "pass 1 over").toBe("idle")
    expectResult(main, true, "after the last piece of pass 1 (positive control)")
    expect(dt, "pass 1 total delta").toBe(n)
    expect(dh, "pass 1 helped delta (the one missed piece)").toBe(1)
    expect(du, "pass 1 unaided delta (only pieces right at once)").toBe(n - 1)
    const xy1 = parseResult(text1)
    expect(xy1[0], "pass 1: X == Y - 1").toBe(xy1[1] - 1)
    expect(xy1[0], "pass 1: X == total - 1").toBe(main.totalCount - 1)
    expect(xy1[0], "pass 1: X == unaided count").toBe(main.unaidedCount)
    expect(xy1[1], "pass 1: Y == total count").toBe(main.totalCount)
    expect(text1, "pass 1 exact text (approved wording)").toBe(expectedResult(u0 + n - 1, t0 + n))
    expect(main.resultText, "resultText getter").toBe(text1)
    expect(main.comeBackCount, "pass 1: comeBackCount").toBe(t1.comeBacks)
    expect(main.isCameBackVisible && main.cameBackText === `Tried again: ${t1.comeBacks}`, `pass 1 card line 2 "${main.cameBackText}" = "Tried again: ${t1.comeBacks}" (our count)`).toBe(true)

    // ---------------- Pass 2: result hidden during the pass (after the positive control). ----------------
    await ix.pressButton("StartRecallButton")
    expect(main.mode, "pass 2 recall started").toBe("recall")
    expectResult(main, false, "pass 2 just started")
    // Pass 2 starts with every letter: after one completed pass no letter has a run of two yet.
    expect(model.startPass().length, "pass 2 start order holds every letter (our model)").toBe(n)
    let checkedHidden = 0
    const t2 = await playRecallPass(ix, main, model, "pass 2", () => false, undefined, () => {
      expectResult(main, false, `pass 2 before piece #${++checkedHidden}`)
    })
    expect(checkedHidden, "result hidden checked before every pass 2 drop").toBe(n)
    expectResult(main, true, "after the last piece of pass 2")
    expect(main.cameBackText, "pass 2 card line 2 (no miss)").toBe(`Tried again: ${t2.comeBacks}`)
    expect(main.retiredCount, `after pass 2: retired letters = our model (${model.retiredCount}: all but the missed one)`).toBe(model.retiredCount)
    const xy2 = parseResult(shownText())
    log(`C5 pass 2: text="${shownText()}"`)
    expect(xy2[0], "pass 2 session X").toBe(u0 + n - 1 + n)
    expect(xy2[1], "pass 2 session Y").toBe(t0 + 2 * n)
    log("C5 done")
    await hideLeafOverlay()
  }
}
