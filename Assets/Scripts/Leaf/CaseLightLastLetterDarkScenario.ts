// Owns: the LEAF check of option A: in recall, when the last letter left is missed it comes straight back (nothing else to pick up), its answer is lit right after the miss, and picking it up again puts the light out (glow and label); placing it then counts as placed but not from memory, and came-back goes up by one.
// Talks to: CaseLightLeafSupport (real SIK drops and UIKit presses, glow and label assertions, independent answers), CaseLightRecallSupport (the test's own model), CaseLightMain read-only getters (currentPassOrder, litSlotIndex, counts, comeBackCount, cameBackText, isHelpedThisPass).
// Must not: call product commands or test hooks, import CaseLightPassLogic, or change product state except through real input.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {CaseLightLeafInteractor, dropSlotFor, expectGlowAt, expectLabelLit, expectNoGlow, expectNoLabelLit, expectedResult, hideLeafOverlay, log, mustFind, targetOf, waitForReady, waitForTopGrabbable, waitUntil} from "./CaseLightLeafSupport"
import {OwnModel, modelComeBack, wrongCellFor} from "./CaseLightRecallSupport"

@component
export class CaseLightLastLetterDarkScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    const n = main.pieceCount
    const model = new OwnModel(n)
    await ix.pressButton("StartRecallButton")
    let queue = model.startPass()
    expect(JSON.stringify(main.bundleOrder), "recall order = our model").toBe(JSON.stringify(queue))

    // Every letter but the last, right at once.
    while (queue.length > 1) {
      const p = await waitForTopGrabbable(main)
      expect(p, "top letter = our model").toBe(queue[0])
      await ix.dropTopPieceAtSlot(main, dropSlotFor(main, p))
      expect(main.lastDropResult, `letter ${p} placed`).toBe("correct")
      queue.shift()
    }
    const last = await waitForTopGrabbable(main)
    expect(last, "the last letter").toBe(queue[0])
    const target = targetOf(main, last)
    const c0 = {u: main.unaidedCount, h: main.helpedCount, t: main.totalCount, cb: main.comeBackCount}

    // The last letter missed: nothing else left, so it comes straight back; its answer is lit (control).
    await ix.dropTopPieceAtSlot(main, wrongCellFor(main, last))
    expect(main.lastDropResult === "miss" || main.lastDropResult === "refused-hold", `the last letter ${last} missed (${main.lastDropResult})`).toBe(true)
    queue = modelComeBack(queue)
    expect(JSON.stringify(main.currentPassOrder), "it is the only letter left (our model)").toBe(JSON.stringify(queue))
    expect(main.comeBackCount - c0.cb, "came back +1").toBe(1)
    const back = await waitForTopGrabbable(main)
    expect(back, "it comes straight back on top").toBe(last)
    expectGlowAt(main, target, "control: right after the miss, before the pick-up, the answer is lit")
    expectLabelLit(main, target, "control: right after the miss, its label is lit")
    expect(main.isHelpedThisPass(last), "the missed letter is helped for the pass").toBe(true)

    // Picked up again: the light goes out, glow and label, and stays out while it is in hand.
    let inHand = 0
    await ix.dropTopPieceAtSlot(main, dropSlotFor(main, last), {
      onHeld: () => {
        expectNoGlow(main, "option A: the missed letter picked up again, answer unlit")
        expectNoLabelLit(main, "option A: picked up again, label unlit")
        inHand++
      },
      onFrame: () => {
        expect(main.litSlotIndex, "option A: still unlit while in hand").toBe(-1)
      },
    })
    expect(inHand, "in-hand check ran").toBe(1)
    expect(main.lastDropResult, "placed right").toBe("correct")
    expect(main.helpedCount - c0.h, "counts as placed with help (helped +1)").toBe(1)
    expect(main.unaidedCount - c0.u, "not from memory (unaided +0)").toBe(0)
    expect(main.totalCount - c0.t, "placed once (total +1)").toBe(1)
    await waitUntil(() => main.isResultVisible, 2000, "card after the pass")
    const card = (mustFind("ResultText").getComponent("Component.Text") as Text).text
    log(`LASTDARK letter ${last} (slot ${target}): card "${card}" / "${main.cameBackText}"`)
    expect(card, "card: every letter but the last from memory").toBe(expectedResult(n - 1, n))
    expect(main.cameBackText, "card: came back line").toBe("Came back: 1")
    await hideLeafOverlay()
  }
}
