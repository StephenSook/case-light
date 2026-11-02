// Owns: the LEAF check for the brief's "End" rule (result hides after the approved 5 s or on a Start press; X/Y counts the whole session) and the hint staying hidden for the session.
// Talks to: CaseLightLeafSupport (real SIK/UIKit input and assertions), CaseLightMain read-only getters, ResultText and StartHint by name.
// Must not: call CaseLightMain's test hooks or commands, or change product state except through real input.

/**
 * Extra (not a numbered done criterion; from the brief's "End" rule):
 * "after the last piece of the recall pass, the top of the case shows "Unaided: X/Y this
 * session", then gets out of the way after about 5 seconds or when a Start button is pressed",
 * and X/Y counts the whole session, not only the last pass. Also: the one-time hint shows while
 * idle, hides on the opening Start press, and stays hidden.
 * The card must read the approved default wording "From memory: X of Y this session", written in
 * the test (not read from the product's resultTemplate input). The timeout is the approved default
 * of 5 s, also written in the test (not read from main.resultSeconds).
 *
 * Input: REAL (LEAF SIK interactor). Two full recall passes, all placed right at once.
 * Positive controls: the hint is seen shown before it is asserted hidden; the result is seen
 * shown before each "hidden" check.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {CaseLightMain} from "../CaseLightMain"
import {hideLeafOverlay, APPROVED_RESULT_SECONDS, CaseLightLeafInteractor, dropSlotFor, expectedResult, expectHint, expectResult, log, mustFind, waitForReady, waitForTopGrabbable} from "./CaseLightLeafSupport"

@component
export class CaseLightExtraResultHideScenario extends Scenario {
  private async recallPassAllRight(main: CaseLightMain, ix: CaseLightLeafInteractor): Promise<void> {
    await ix.pressButton("StartRecallButton")
    expect(main.mode, "recall started").toBe("recall")
    const order = main.bundleOrder
    for (let k = 0; k < order.length; k++) {
      const p = await waitForTopGrabbable(main)
      await ix.dropTopPieceAtSlot(main, dropSlotFor(main, p))
      expect(main.lastDropResult, `piece ${p} placed`).toBe("correct")
    }
    expect(main.mode, "pass over").toBe("idle")
  }

  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    const u0 = main.unaidedCount
    const t0 = main.totalCount
    const resultText = () => (mustFind("ResultText").getComponent("Component.Text") as Text).text

    // Hint: shown while idle (positive control), then hidden from the opening Start press on.
    expect(main.mode, "idle at start").toBe("idle")
    expectHint(main, true, "idle, before any Start press")

    // Pass 1, then wait: the result hides on its own after the approved 5 s.
    await this.recallPassAllRight(main, ix)
    expectHint(main, false, "after pass 1 (the opening Start was Start recall)")
    const n = main.pieceCount
    expectResult(main, true, "after pass 1 (positive control)")
    expect(resultText(), "pass 1 result").toBe(expectedResult(u0 + n, t0 + n))
    const secs = APPROVED_RESULT_SECONDS
    await sleep(secs * 1000 - 1000)
    expectResult(main, true, `1 s before ${secs} s`)
    await sleep(2000)
    expectResult(main, false, `1 s after ${secs} s`)

    // Pass 2 (new order): totals carry over the session; a Start press hides the result at once.
    const order1 = main.bundleOrder
    await this.recallPassAllRight(main, ix)
    expect(JSON.stringify(main.bundleOrder) !== JSON.stringify(order1), "pass 2 uses a new order").toBe(true)
    expectResult(main, true, "after pass 2")
    expect(resultText(), "pass 2 result counts the whole session").toBe(expectedResult(u0 + 2 * n, t0 + 2 * n))
    log(`EXTRA result after pass 2: "${resultText()}"`)
    await ix.pressButton("StartPracticeButton")
    expectResult(main, false, "after pressing Start practice")
    expect(main.mode, "practice started").toBe("practice")
    expectHint(main, false, "hint stays hidden after later Start presses")
    log("EXTRA result-hide done")
    await hideLeafOverlay()
  }
}
