// Owns: the LEAF check of v0.6 feature 3, part 2 (in passes): in recall a pinned note stays hidden while its letter is in play until a miss on it, shows (drawn at its slot) while that slot is lit as the answer, and hides when the light goes off; Veteran mode mid-pass pauses the letters (none can be grabbed, no count changes) and shows every note; Done keeps the notes; in practice a note shows while its slot is the lit target.
// Talks to: CaseLightLeafSupport (real SIK grabs, drops and pinches, real UIKit presses, independent answers), CaseLightNotesSupport (reminder texts, slot pinches, drawn-card checks), CaseLightRoute.recallOrder and practiceOrder (the pass orders the brief defines), CaseLightMain read-only getters, Piece_n / Note_<slot> by name.
// Must not: import CaseLightNotes, call product commands or test hooks, or change product state except through real input.

/**
 * Notes are pinned with real slot pinches and chooser presses on the answers (from the printed
 * case) of: the opening recall letter L (it is missed), the next recall letter M (never missed),
 * and the opening practice letter P. Every "hidden" check has its positive control: the same card
 * is seen drawn in Veteran mode before the pass, and L's card is seen drawn after its miss.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {CaseLightMain} from "../CaseLightMain"
import {practiceOrder, recallOrder} from "../CaseLightRoute"
import {CaseLightLeafInteractor, dropSlotFor, hideLeafOverlay, log, mustFind, pieceInteractable, targetOf, waitForReady, waitForTopGrabbable, waitUntil} from "./CaseLightLeafSupport"
import {REMINDERS, expectCard, pick, pinchSlotOpens} from "./CaseLightNotesSupport"
import {wrongCellFor} from "./CaseLightRecallSupport"

function hidden(main: CaseLightMain, slot: number): boolean {
  return !main.isNoteShown(slot) && !mustFind(`Note_${slot}`).isEnabledInHierarchy
}

@component
export class CaseLightVeteranPassScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    const n = main.pieceCount
    const rOrder = recallOrder(n, 0)
    const nonHold = rOrder.filter((p) => targetOf(main, p) !== -2)
    const L = nonHold[0]
    const M = rOrder[1] !== L && targetOf(main, rOrder[1]) !== -2 ? rOrder[1] : nonHold[1]
    const P = practiceOrder(n).filter((p) => targetOf(main, p) !== -2)[0]
    const tL = targetOf(main, L)
    const tM = targetOf(main, M)
    const tP = targetOf(main, P)
    log(`VETPASS recall order ${JSON.stringify(rOrder)}: L ${L} (slot ${tL}), M ${M} (slot ${tM}); practice P ${P} (slot ${tP})`)
    expect(L === rOrder[0], "the opening recall letter is a normal letter (missed below)").toBe(true)
    expect(new Set([tL, tM, tP]).size, "three different slots").toBe(3)

    // Pin the three notes (real slot pinches and chooser presses), seen drawn in Veteran mode.
    await ix.pressButton("VeteranModeButton")
    await waitUntil(() => main.veteranMode, 1000, "Veteran mode on")
    const pins: [number, string][] = [[tL, REMINDERS[0]], [tM, REMINDERS[1]], [tP, REMINDERS[2]]]
    for (const [slot, text] of pins) {
      await pinchSlotOpens(ix, main, slot, `pin on slot ${slot}`)
      await pick(ix, main, text, `pin on slot ${slot}`)
      expectCard(main, slot, text, `control: Veteran mode shows the note on slot ${slot}`)
    }
    await ix.pressButton("VeteranModeButton")
    await waitUntil(() => !main.veteranMode, 1000, "Veteran mode off")

    // ── f. Recall ─────────────────────────────────────────────────────────────────────────
    await ix.pressButton("StartRecallButton")
    expect(main.mode, "recall started").toBe("recall")
    expect(JSON.stringify(main.bundleOrder), "recall order = the brief's recallOrder for pass 0").toBe(JSON.stringify(rOrder))
    const c0 = {u: main.unaidedCount, h: main.helpedCount, t: main.totalCount}
    expect(await waitForTopGrabbable(main), "L on top").toBe(L)
    expect(hidden(main, tL) && hidden(main, tM) && hidden(main, tP), "f. recall start: every note hidden").toBe(true)
    let heldChecks = 0
    await ix.dropTopPieceAtSlot(main, wrongCellFor(main, L), {
      onHeld: () => {
        expect(hidden(main, tL), `f. L in hand before any miss: its note on slot ${tL} hidden`).toBe(true)
        heldChecks++
      },
      beforeRelease: () => {
        expect(hidden(main, tL), "f. L over a wrong cell, before the drop: note hidden").toBe(true)
        heldChecks++
      },
    })
    expect(main.lastDropResult, "L missed").toBe("miss")
    expect(main.litSlotIndex, "f. L's answer lit after the miss").toBe(tL)
    expectCard(main, tL, REMINDERS[0], "f. after the miss on L (its answer lit)")
    const next = await waitForTopGrabbable(main)
    expect(next, "M is the next letter").toBe(M)
    expectCard(main, tL, REMINDERS[0], "f. still lit before another letter is picked up")
    await ix.dropTopPieceAtSlot(main, dropSlotFor(main, M), {
      onHeld: () => {
        expect(main.litSlotIndex, "f. M picked up: the answer light is off").toBe(-1)
        expect(hidden(main, tL), "f. M picked up: L's note hidden again").toBe(true)
        expect(hidden(main, tM), `f. M in hand (never missed): its note on slot ${tM} hidden`).toBe(true)
        heldChecks++
      },
    })
    expect(main.lastDropResult, "M placed").toBe("correct")
    expect(hidden(main, tM) && hidden(main, tL), "f. after M is placed: notes hidden").toBe(true)
    expect(heldChecks, "f. in-hand checks ran").toBe(3)

    // ── d. Veteran mode mid-pass: letters paused, every note shown, no count changes ─────
    const cMid = {u: main.unaidedCount, h: main.helpedCount, t: main.totalCount}
    const top = await waitForTopGrabbable(main)
    const topSo = mustFind(`Piece_${top}`)
    const topIt = topSo.getComponent(Interactable.getTypeName()) as Interactable
    await ix.pressButton("VeteranModeButton")
    await waitUntil(() => main.veteranMode, 1000, "Veteran mode on mid-pass")
    expect(main.mode, "d. the pass stays (recall)").toBe("recall")
    expect(!!pieceInteractable(top), `d. top letter ${top} cannot be grabbed in Veteran mode`).toBe(false)
    expect(main.bundle.activePieceIndex, "d. no active letter").toBe(-1)
    const grab = await ix.pinchAt(topIt, topSo.getTransform().getWorldPosition())
    await sleep(300)
    log(`VETPASS d. pinch at top letter ${top} in Veteran mode: ray met it ${grab.hitOnTarget} (hit ${grab.hitName}), held ${main.heldPieceIndex}`)
    expect(grab.hitOnTarget, "d. a pinch aimed at the top letter cannot reach it").toBe(false)
    expect(main.heldPieceIndex, "d. nothing in hand").toBe(-1)
    for (const [slot, text] of pins) expectCard(main, slot, text, `d. Veteran mode mid-pass shows the note on slot ${slot}`)
    await pinchSlotOpens(ix, main, tM, "d. a slot pinch mid-pass")
    expect(main.unaidedCount === cMid.u && main.helpedCount === cMid.h && main.totalCount === cMid.t, "d. no count changed in Veteran mode").toBe(true)
    await ix.pressButton("VeteranModeButton")
    await waitUntil(() => !main.veteranMode, 1000, "Veteran mode off mid-pass")
    expect(main.isNoteChooserOpen, "d. Veteran mode off closes the chooser").toBe(false)
    await waitForTopGrabbable(main)
    const grab2 = await ix.pinchAt(topIt, topSo.getTransform().getWorldPosition())
    log(`VETPASS d. control: pinch at the top letter after Veteran mode off: ray met it ${grab2.hitOnTarget}`)
    expect(grab2.hitOnTarget, "d. control: with Veteran mode off the same pinch reaches the letter").toBe(true)

    // Finish the pass; L comes back unlit with its note hidden.
    while (main.mode === "recall") {
      const p = await waitForTopGrabbable(main)
      if (p === L) expect(hidden(main, tL) && main.litSlotIndex !== tL, "f. L back on top: unlit, note hidden").toBe(true)
      await ix.dropTopPieceAtSlot(main, dropSlotFor(main, p), {
        onHeld: () => {
          if (p === L) expect(hidden(main, tL), "f. L in hand again: note hidden").toBe(true)
        },
      })
      expect(main.lastDropResult, `letter ${p} placed`).toBe("correct")
    }
    expect(main.helpedCount - c0.h, "the missed letter counted helped").toBe(1)
    expect(main.unaidedCount - c0.u, "the others from memory").toBe(n - 1)

    // ── h. Done keeps the notes ───────────────────────────────────────────────────────────
    await waitUntil(() => main.isExitVisible, 2000, "exit after the pass")
    await ix.pressButton("DoneButton")
    for (const [slot, text] of pins) expect(main.noteForSlot(slot), `h. Done keeps the note on slot ${slot}`).toBe(text)
    expect(hidden(main, tL) && hidden(main, tM) && hidden(main, tP), "h. idle after Done: notes hidden").toBe(true)

    // ── g. Practice: the note shows while its slot is the lit target ─────────────────────
    await waitUntil(() => getTime() - main.lastExitPressTime > main.startGuardSeconds + 0.15, 3000, "Start guard passed after Done")
    await ix.pressButton("StartPracticeButton")
    expect(main.mode, "practice started").toBe("practice")
    expect(await waitForTopGrabbable(main), "P on top").toBe(P)
    expect(hidden(main, tP), "g. P not in hand yet: its slot is not lit, note hidden").toBe(true)
    let shownInHand = false
    await ix.dropTopPieceAtSlot(main, dropSlotFor(main, P), {
      onHeld: () => {
        expect(main.litSlotIndex, "g. P in hand: its slot is the lit target").toBe(tP)
        expectCard(main, tP, REMINDERS[2], "g. P in hand (its slot lit)")
        shownInHand = true
      },
    })
    expect(shownInHand, "g. in-hand check ran").toBe(true)
    expect(main.lastDropResult, "P placed").toBe("correct")
    expect(hidden(main, tP), "g. P placed, slot no longer lit: note hidden").toBe(true)
    log("VETPASS done")
    await hideLeafOverlay()
  }
}
