// Owns: the LEAF check that the HOLD block is exactly cells 36..39 of the lower playable row (each accepts the hold piece; 35 and the cells above it, 76..79, refuse it) and that a recall hold refusal then acceptance counts as helped, not unaided.
// Talks to: CaseLightLeafSupport (real SIK/UIKit input, independent answers, glow assertions), CaseLightMain read-only getters (lastDropResult, lastDropSlot, isPiecePlaced, counts).
// Must not: call CaseLightMain's test hooks or commands, or change product state except through real input.

/**
 * Product rule (builder, verified in CaseLightGeometry.ts isHoldSlot): the HOLD block is the last
 * HOLD_CELLS (4) separations of the lower playable row, 36..39. The hold piece placed in any of
 * them is correct; anywhere else it is refused (the HOLD block glows) and comes back.
 *
 * Input: REAL (LEAF SIK interactor). Two practice passes and two recall passes, so each of the four
 * HOLD cells takes the hold piece once (a placed piece cannot be placed twice in one pass).
 * Positive controls: an accepted drop (placed, "correct") is seen before the refused cells are
 * asserted to refuse with the same read-outs; the recall counts are seen to move (+1 unaided for
 * a right drop) before the hold refusal is asserted to add nothing to unaided.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {CaseLightMain} from "../CaseLightMain"
import {hideLeafOverlay, CaseLightLeafInteractor, dropSlotFor, expectGlowAt, log, targetOf, waitForReady, waitForTopGrabbable} from "./CaseLightLeafSupport"
import {modelComeBack} from "./CaseLightRecallSupport"

interface Counts {
  u: number
  h: number
  t: number
}

function counts(main: CaseLightMain): Counts {
  return {u: main.unaidedCount, h: main.helpedCount, t: main.totalCount}
}

@component
export class CaseLightHoldCellsScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    const refusedSeen: {slot: number; result: string; placed: boolean; drop: number}[] = []

    /** Sort the pass; `onHold` handles the hold piece. Every other piece goes to its own cell. */
    const pass = async (button: string, label: string, onHold: (p: number) => Promise<void>, perPiece?: (p: number, c: Counts) => void): Promise<void> => {
      await ix.pressButton(button)
      const mode = main.mode
      while (main.mode === mode) {
        const p = await waitForTopGrabbable(main)
        if (targetOf(main, p) === -2) {
          await onHold(p)
          continue
        }
        const c = counts(main)
        await ix.dropTopPieceAtSlot(main, dropSlotFor(main, p))
        expect(main.lastDropResult, `${label}: piece ${p} placed`).toBe("correct")
        if (perPiece) perPiece(p, c)
      }
    }

    const accept = async (p: number, cell: number, label: string): Promise<void> => {
      await ix.dropTopPieceAtSlot(main, cell)
      expect(main.lastDropSlot, `${label}: dropped in cell ${cell}`).toBe(cell)
      expect(main.lastDropResult, `${label}: hold piece accepted in cell ${cell}`).toBe("correct")
      expect(main.isPiecePlaced(p), `${label}: hold piece placed in cell ${cell}`).toBe(true)
    }

    const refuse = async (p: number, cell: number, label: string): Promise<void> => {
      await ix.dropTopPieceAtSlot(main, cell)
      refusedSeen.push({slot: cell, result: main.lastDropResult, placed: main.isPiecePlaced(p), drop: main.lastDropSlot})
      const back = await waitForTopGrabbable(main)
      expect(back, `${label}: hold piece back on top after cell ${cell}`).toBe(p)
      expectGlowAt(main, -2, `${label}: HOLD block lit after the refusal in cell ${cell}`)
    }

    // Practice 1: refuse 35 and 76..79, then accept 36 (the accept is asserted before them below).
    await pass("StartPracticeButton", "practice 1", async (p) => {
      for (const cell of [35, 76, 77, 78, 79]) await refuse(p, cell, "practice 1")
      await accept(p, 36, "practice 1")
    })
    log(`HOLD refusals ${JSON.stringify(refusedSeen)}`)
    for (const r of refusedSeen) {
      expect(r.drop, `cell ${r.slot}: the drop landed in cell ${r.slot}`).toBe(r.slot)
      expect(r.result, `cell ${r.slot} refuses the hold piece`).toBe("refused-hold")
      expect(r.placed, `cell ${r.slot} does not keep the hold piece`).toBe(false)
    }
    expect(refusedSeen.length, "five refusing cells checked").toBe(5)

    // Practice 2: accept 37.
    await pass("StartPracticeButton", "practice 2", async (p) => accept(p, 37, "practice 2"))

    // Recall 1: hold refused in 23 then accepted in 38 -> helped +1, unaided +0, total +1.
    const r0 = counts(main)
    let movedByRight = false
    let holdDelta = null as Counts | null
    let afterRefusal = null as Counts | null
    let holdSeen = 0
    await pass(
      "StartRecallButton",
      "recall 1",
      async (p) => {
        // v0.6 feature 2: a refused hold piece in recall goes back with exactly two letters before
        // it (our model), so it is accepted when it comes back, not at once (replaces the old
        // "refused, then accepted straight after" step).
        if (holdSeen++ === 0) {
          const c = counts(main)
          const q = main.currentPassOrder
          await ix.dropTopPieceAtSlot(main, 23)
          expect(main.lastDropResult, "recall 1: hold piece refused in 23").toBe("refused-hold")
          const a = counts(main)
          afterRefusal = {u: a.u - c.u, h: a.h - c.h, t: a.t - c.t}
          expect(JSON.stringify(main.currentPassOrder), "recall 1: refused hold piece back with exactly 2 letters before it (our model)").toBe(JSON.stringify(modelComeBack(q)))
          await waitForTopGrabbable(main)
          expectGlowAt(main, -2, "recall 1: HOLD block lit after the refusal")
          return
        }
        const c = counts(main)
        await accept(p, 38, "recall 1")
        const a = counts(main)
        holdDelta = {u: a.u - c.u, h: a.h - c.h, t: a.t - c.t}
      },
      (p, c) => {
        const a = counts(main)
        expect(a.u - c.u, `recall 1 piece ${p}: unaided +1`).toBe(1)
        expect(a.t - c.t, `recall 1 piece ${p}: total +1`).toBe(1)
        movedByRight = true
      },
    )
    expect(movedByRight, "recall counts seen to move on a right drop (positive control)").toBe(true)
    log(`HOLD recall 1 counts before ${JSON.stringify(r0)} after ${JSON.stringify(counts(main))}; refusal delta ${JSON.stringify(afterRefusal)}; hold piece delta ${JSON.stringify(holdDelta)}`)
    const ar = afterRefusal
    const hd = holdDelta
    if (!ar || !hd) throw new Error("hold piece not seen in recall 1")
    expect(ar.u === 0 && ar.h === 0 && ar.t === 0, "the refusal itself changes no count").toBe(true)
    expect(hd.h, "hold piece placed after a refusal counts as helped").toBe(1)
    expect(hd.u, "and not as unaided").toBe(0)
    expect(hd.t, "and once in the total").toBe(1)
    expect(main.totalCount - r0.t, "recall 1 placed every piece once").toBe(main.pieceCount)
    expect(holdSeen, "recall 1: the hold piece was on top twice (refused, then back and accepted)").toBe(2)

    // Recall 2 (Again): accept 39 at once -> unaided +1.
    let hold2 = null as Counts | null
    await pass("AgainButton", "recall 2", async (p) => {
      const c = counts(main)
      await accept(p, 39, "recall 2")
      const a = counts(main)
      hold2 = {u: a.u - c.u, h: a.h - c.h, t: a.t - c.t}
    })
    const h2 = hold2
    if (!h2) throw new Error("hold piece not seen in recall 2")
    expect(h2.u === 1 && h2.h === 0 && h2.t === 1, `hold piece placed at once in 39 counts as unaided (${JSON.stringify(h2)})`).toBe(true)
    log("HOLD done: 36, 37, 38, 39 accepted; 35, 76, 77, 78, 79 refused")
    await hideLeafOverlay()
  }
}
