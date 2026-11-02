// Owns: the LEAF check that the practice cue ladder is OFF by default (the exact separation glows on every grab across two practice passes) and that practice never changes the score or shows the card.
// Talks to: CaseLightLeafSupport (real SIK/UIKit input, independent answers, assertions), CaseLightMain read-only getters (cueKind, ladderRungOf, counts, result, exit).
// Must not: call CaseLightMain's test hooks or commands, write any product setting, or change product state except through real input.

/**
 * Builder feature (verified in CaseLightMain.ts): practiceLadder is an Inspector toggle, default
 * false. Off means criterion 2 as written: in practice the exact separation (or the HOLD block)
 * glows on every grab.
 *
 * Input: REAL (LEAF SIK interactor). Two full practice passes (16 grabs), then one scored recall pass.
 * Positive controls: the slot glow is asserted ON at every grab; the "no score, no card after
 * practice" observation is recorded after the practice passes and asserted only after a recall
 * pass has been seen to change the counts and show the card (same detectors).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {CaseLightLeafInteractor, dropSlotFor, expectGlowAt, expectResult, hideLeafOverlay, log, mustFind, targetOf, waitForReady, waitForTopGrabbable} from "./CaseLightLeafSupport"

@component
export class CaseLightLadderDefaultScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    expect(main.isPracticeLadderOn, "practice ladder off by default").toBe(false)
    const c0 = {u: main.unaidedCount, h: main.helpedCount, t: main.totalCount}

    // Two full practice passes: the exact separation glows on every grab; rungs never move.
    let grabs = 0
    for (let pass = 1; pass <= 2; pass++) {
      await ix.pressButton("StartPracticeButton")
      expect(main.mode, `practice pass ${pass} started`).toBe("practice")
      while (main.mode === "practice") {
        const p = await waitForTopGrabbable(main)
        const t = targetOf(main, p)
        await ix.dropTopPieceAtSlot(main, dropSlotFor(main, p), {
          onHeld: () => {
            const c = `pass ${pass}, piece ${p} in hand`
            expectGlowAt(main, t, c)
            expect(main.cueKind, `${c}: cueKind`).toBe("slot")
            expect(main.ladderRungOf(p), `${c}: rung`).toBe(0)
            grabs++
          },
        })
        expect(main.lastDropResult, `pass ${pass}, piece ${p} placed`).toBe("correct")
        expect(main.ladderRungOf(p), `pass ${pass}, piece ${p} rung after a right placement (ladder off)`).toBe(0)
      }
    }
    expect(grabs, "exact-slot glow checked on every grab of both passes").toBe(2 * main.pieceCount)

    // Recorded now, asserted after the positive control below.
    const afterPractice = {
      u: main.unaidedCount,
      h: main.helpedCount,
      t: main.totalCount,
      result: main.isResultVisible,
      resultObj: mustFind("ResultText").enabled,
      exit: main.isExitVisible,
    }

    // Scored recall pass: positive control for the count and card detectors.
    await ix.pressButton("StartRecallButton")
    while (main.mode === "recall") {
      const p = await waitForTopGrabbable(main)
      await ix.dropTopPieceAtSlot(main, dropSlotFor(main, p))
      expect(main.lastDropResult, `recall piece ${p} placed`).toBe("correct")
    }
    const n = main.pieceCount
    expect(main.totalCount - afterPractice.t, "recall pass counted every piece (positive control)").toBe(n)
    expect(main.unaidedCount - afterPractice.u, "recall pass counted every piece as unaided").toBe(n)
    expectResult(main, true, "card after the recall pass (positive control)")
    expect(main.isExitVisible, "exit after the recall pass (positive control)").toBe(true)

    log(`LADDER-DEFAULT counts before ${JSON.stringify(c0)} after practice ${JSON.stringify(afterPractice)}`)
    expect(afterPractice.u, "practice changed no unaided count").toBe(c0.u)
    expect(afterPractice.h, "practice changed no helped count").toBe(c0.h)
    expect(afterPractice.t, "practice changed no total").toBe(c0.t)
    expect(afterPractice.result || afterPractice.resultObj, "no card after the practice passes").toBe(false)
    expect(afterPractice.exit, "no exit after the practice passes").toBe(false)
    log("LADDER-DEFAULT done")
    await hideLeafOverlay()
  }
}
