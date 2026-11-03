// Owns: the LEAF check that a slot pinch counts only if it starts and ends on the slot with one hand, also right after an aborted pinch: a pinch that started on a slot and ended off it, then a pinch that starts off the slot and ends on it, must open no chooser.
// Talks to: CaseLightLeafSupport (real UIKit presses, the LEAF SIK interactor's pinchAt), CaseLightNotesSupport (slot target, chooser checks), CaseLightMain read-only getters (veteranMode, isNoteChooserOpen, noteChooserSlot, slotPinchCount).
// Must not: import CaseLightNotes, call product commands or test hooks, or change product state except through real input.

/**
 * CaseLightVeteran's own rule: "A slot pinch counts only if it starts and ends on the target with
 * the same interactor, and the slot is the one under the pinch where it started."
 * Sequence (all REAL SIK input): a stray release before any aborted pinch (positive control: it
 * opens nothing); a normal pinch (control: it opens the chooser), closed by turning Veteran mode
 * off and on; then an aborted pinch (starts on slot S, ends off the target), then a stray release
 * on slot S. The stray release must open nothing, exactly as the control did.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {CaseLightLeafInteractor, hideLeafOverlay, log, waitForReady, waitUntil} from "./CaseLightLeafSupport"
import {pinchSlotOpens, slotTarget} from "./CaseLightNotesSupport"

const SLOT = 24

@component
export class CaseLightVeteranStrayScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    await ix.pressButton("VeteranModeButton")
    await waitUntil(() => main.veteranMode, 1000, "Veteran mode on")
    const aim = main.slotWorldPosition(SLOT)

    // Positive control: a stray release with nothing armed opens nothing.
    const p0 = main.slotPinchCount
    const s0 = await ix.pinchAt(slotTarget()!, aim, {startOff: true})
    await sleep(300)
    log(`STRAY control (no aborted pinch before): start ${s0.startFired}, end ${s0.endFired}, chooser ${main.isNoteChooserOpen}`)
    expect(s0.hitOnTarget && !s0.startFired && s0.endFired, "control: the release landed on the slot with no pinch start there").toBe(true)
    expect(main.isNoteChooserOpen || main.slotPinchCount !== p0, "control: a stray release opens nothing").toBe(false)

    // Control: a normal pinch opens the chooser; Veteran mode off and on closes it.
    await pinchSlotOpens(ix, main, SLOT, "control: a normal pinch")
    await ix.pressButton("VeteranModeButton")
    await waitUntil(() => !main.veteranMode && !main.isNoteChooserOpen, 1000, "Veteran mode off closes the chooser")
    await ix.pressButton("VeteranModeButton")
    await waitUntil(() => main.veteranMode, 1000, "Veteran mode on again")

    // An aborted pinch, then a stray release on the same slot.
    const p1 = main.slotPinchCount
    const a = await ix.pinchAt(slotTarget()!, aim, {endOff: true})
    await sleep(300)
    expect(a.hitOnTarget && a.startFired && !a.endFired, `the aborted pinch started on slot ${SLOT} and ended off it (start ${a.startFired}, end ${a.endFired})`).toBe(true)
    expect(main.isNoteChooserOpen, "the aborted pinch opens nothing").toBe(false)
    const s1 = await ix.pinchAt(slotTarget()!, aim, {startOff: true})
    await sleep(300)
    log(`STRAY after the aborted pinch: start ${s1.startFired}, end ${s1.endFired}, chooser ${main.isNoteChooserOpen} (slot ${main.noteChooserSlot}), slot pinches +${main.slotPinchCount - p1}`)
    expect(!s1.startFired && s1.endFired, "the stray release landed on the slot with no pinch start there").toBe(true)
    expect(main.isNoteChooserOpen, "a stray release after an aborted pinch opens no chooser").toBe(false)
    expect(main.slotPinchCount, "and is not counted").toBe(p1)
    await ix.pressButton("VeteranModeButton")
    await waitUntil(() => !main.veteranMode, 1000, "Veteran mode off at the end")
    await hideLeafOverlay()
  }
}
