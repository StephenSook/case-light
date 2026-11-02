// Owns: the LEAF check for the exit shown after each recall pass: "Again" starts a clean new recall pass; "Done" returns to idle with glow, label highlight, edge arrow, pace light and ripples off, counts kept and the hint still hidden.
// Talks to: CaseLightLeafSupport (real SIK/UIKit input and assertions), CaseLightMain read-only getters, AgainButton / DoneButton / DrillPaceButton / ExitControls / Ripple_n / Piece_n / BundleTray by name.
// Must not: call CaseLightMain's test hooks or commands (exitAgain / exitDone included), or change product state except through real input.

/**
 * Input: REAL (LEAF SIK interactor). Two recall passes. Pass 1 ends; Again is pressed. Pass 2:
 * the Drill pace toggle is pressed early, and the last letter goes to a wrong cell before its own, so
 * the glow, its label and (if the answer is out of view) the edge arrow are on just before the end;
 * then it is placed (its ripple is seen on), the exit shows, and Done is pressed.
 * Positive controls: the exit is seen shown before it is asserted hidden; the hint is seen shown
 * while idle; glow, label, arrow, pace light and a ripple are each seen ON before Done is asserted
 * to leave them off. The glow, label and arrow are already turned off by the pass ending itself;
 * the pace light is the one Done itself has to switch off, and it is seen on immediately before.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {nextFrame} from "Leaf.lspkg/Utils/common/Utils"
import {CaseLightMain} from "../CaseLightMain"
import {hideLeafOverlay, 
  CaseLightLeafInteractor,
  targetOf,
  dropSlotFor,
  expectArrow,
  expectGlowAt,
  expectHint,
  expectHintLine2,
  expectLabelLit,
  expectNoGlow,
  expectNoLabelLit,
  expectResult,
  log,
  mustFind,
  neighbourSlot,
  targetOutsideDisplay,
  waitForReady,
  waitForTopGrabbable,
  waitUntil,
} from "./CaseLightLeafSupport"

function rippleObjectsOn(): number {
  let on = 0
  for (let i = 0; i < 3; i++) if (mustFind(`Ripple_${i}`).enabled) on++
  return on
}

@component
export class CaseLightExitScenario extends Scenario {
  private async placeAll(main: CaseLightMain, ix: CaseLightLeafInteractor): Promise<void> {
    while (main.mode === "recall") {
      const p = await waitForTopGrabbable(main)
      await ix.dropTopPieceAtSlot(main, dropSlotFor(main, p))
      expect(main.lastDropResult, `piece ${p} placed`).toBe("correct")
    }
  }

  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    expect(main.mode, "idle at start").toBe("idle")
    expectHint(main, true, "idle at start (positive control)")
    expectHintLine2(main, true, "idle at start (positive control)")
    expect(main.isExitVisible, "no exit before any pass").toBe(false)

    // ---------------- Pass 1, then Again. ----------------
    await ix.pressButton("StartRecallButton")
    expect(main.mode, "pass 1 recall").toBe("recall")
    const order1 = main.bundleOrder
    await this.placeAll(main, ix)
    expect(main.mode, "pass 1 over").toBe("idle")
    await waitUntil(() => main.isExitVisible, 2000, "exit shown after pass 1")
    expect(mustFind("ExitControls").enabled, "ExitControls shown after pass 1 (positive control)").toBe(true)
    expectResult(main, true, "score card after pass 1")

    await ix.pressButton("AgainButton")
    await nextFrame()
    expect(main.mode, "Again: mode").toBe("recall")
    expect(main.heldPieceIndex, "Again: nothing held").toBe(-1)
    expect(main.placedThisPass, "Again: placedThisPass").toBe(0)
    const order2 = main.bundleOrder
    expect(JSON.stringify(order2) !== JSON.stringify(order1), `Again: new order (${JSON.stringify(order1)} -> ${JSON.stringify(order2)})`).toBe(true)
    expect(main.isExitVisible, "Again: exit hidden").toBe(false)
    expect(mustFind("ExitControls").enabled, "Again: ExitControls hidden").toBe(false)
    expectResult(main, false, "Again: score card hidden")
    const trayPos = mustFind("BundleTray").getTransform().getWorldPosition()
    for (let i = 0; i < main.pieceCount; i++) {
      expect(main.isPiecePlaced(i), `Again: Piece_${i} back out of the case`).toBe(false)
      const d = mustFind(`Piece_${i}`).getTransform().getWorldPosition().distance(trayPos)
      expect(d < 20, `Again: Piece_${i} back in the tray (${d.toFixed(1)} cm from it)`).toBe(true)
    }
    const top = await waitForTopGrabbable(main)
    expect(top, "Again: top of the bundle is the new order's top piece").toBe(order2[0])

    // ---------------- Pass 2: pace on early; last letter missed once. ----------------
    await ix.pressButton("DrillPaceButton")
    await nextFrame()
    expect(main.isPaceOn, "pace on during pass 2").toBe(true)
    const lastPiece = order2[order2.length - 1]
    let rippleSeen = 0
    let rippleObjsSeen = 0
    let arrowWasOn = false
    while (main.mode === "recall") {
      const p = await waitForTopGrabbable(main)
      if (p === lastPiece) {
        const target = targetOf(main, p)
        const wrong = main.isHoldPiece(p) ? 23 : neighbourSlot(target)
        await ix.dropTopPieceAtSlot(main, wrong)
        expect(main.lastDropResult === "miss" || main.lastDropResult === "refused-hold", `last piece ${p} missed once`).toBe(true)
        await waitForTopGrabbable(main)
        // Positive controls just before the end: glow and its label on, arrow on if out of view.
        expectGlowAt(main, target, "last piece after its miss")
        expectLabelLit(main, target, "last piece after its miss")
        const outside = targetOutsideDisplay(main, target)
        expectArrow(main, outside, `last piece after its miss (target ${target} outside=${outside})`)
        arrowWasOn = outside
        await ix.dropTopPieceAtSlot(main, dropSlotFor(main, p), {
          afterRelease: () => {
            rippleSeen = main.ripples.activeRipples
            rippleObjsSeen = rippleObjectsOn()
          },
        })
        expect(main.lastDropResult, `last piece ${p} placed`).toBe("correct")
      } else {
        await ix.dropTopPieceAtSlot(main, dropSlotFor(main, p))
        expect(main.lastDropResult, `piece ${p} placed`).toBe("correct")
      }
    }
    expect(rippleSeen > 0 && rippleObjsSeen > 0, `a ripple was on at the last snap (active ${rippleSeen}, objects ${rippleObjsSeen})`).toBe(true)
    await waitUntil(() => main.isExitVisible, 2000, "exit shown after pass 2")
    expect(main.isPaceOn && main.isPaceLightVisible && mustFind("PaceLight").enabled, "pace light on just before Done (positive control)").toBe(true)
    const kept = {unaided: main.unaidedCount, helped: main.helpedCount, total: main.totalCount}
    log(`EXIT before Done: counts ${JSON.stringify(kept)} arrowWasOn=${arrowWasOn} ripple=${rippleSeen}/${rippleObjsSeen}`)

    // ---------------- Done. ----------------
    await ix.pressButton("DoneButton")
    await nextFrame()
    expect(main.mode, "Done: mode").toBe("idle")
    expect(main.isExitVisible, "Done: exit hidden").toBe(false)
    expectResult(main, false, "Done: score card hidden")
    expectNoGlow(main, "Done")
    expectNoLabelLit(main, "Done")
    expectArrow(main, false, "Done")
    expect(main.snapPreviewSlotIndex, "Done: snap outline off").toBe(-1)
    expect(main.isPaceOn, "Done: pace off").toBe(false)
    expect(main.isPaceLightVisible, "Done: isPaceLightVisible").toBe(false)
    expect(mustFind("PaceLight").enabled, "Done: PaceLight scene object").toBe(false)
    expect(main.isPaceLabelVisible, "Done: pace caption hidden").toBe(false)
    expect(main.ripples.activeRipples, "Done: active ripples").toBe(0)
    expect(rippleObjectsOn(), "Done: Ripple_n objects on").toBe(0)
    expect(main.unaidedCount, "Done: unaided kept").toBe(kept.unaided)
    expect(main.helpedCount, "Done: helped kept").toBe(kept.helped)
    expect(main.totalCount, "Done: total kept").toBe(kept.total)
    expect(main.heldPieceIndex, "Done: nothing held").toBe(-1)
    expectHint(main, false, "Done: hint stays hidden")
    expectHintLine2(main, false, "Done: hint line 2 stays hidden")
    log("EXIT done")
    await hideLeafOverlay()
  }
}
