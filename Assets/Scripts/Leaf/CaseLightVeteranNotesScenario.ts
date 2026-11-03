// Owns: the LEAF check of v0.6 feature 3, part 1 (outside a pass): Veteran mode is off by default and its toggle fits the display once the head turns to it; a real SIK pinch on a slot opens the reminder chooser for that slot with exactly the three reminders (Remove note only when the slot has one); a pick pins it (drawn card at the slot, clear of its label), a re-pick replaces it, Remove note clears it; a pinch that does not start and end on the slot opens nothing; Veteran mode off keeps the notes; no note text names a house number.
// Talks to: CaseLightLeafSupport (real UIKit presses, the LEAF SIK interactor's pinchAt), CaseLightNotesSupport (the test's own reminder texts and drawn-card checks), CaseLightMain read-only getters, CaseLightVeteranUI read-only getters (isVeteranToggleOn), scene objects VeteranModeButton / SlotPinchTarget / NoteOption_n / Note_<slot>.
// Must not: import CaseLightNotes, call product commands or test hooks, or change product state except through real input.

/**
 * Input: REAL. The toggle and the chooser buttons are pressed through the UIKit path (LEAF
 * trigger). A slot pinch is the LEAF SIK interactor's pinch along the eye ray toward the slot: a
 * physics probe from the eye must meet the product's slot-pinch target, and that hit is what the
 * interactor reports as its target hit (CaseLightLeafSupport.pinchAt).
 * Expectations come from research/packets/CASELIGHT-QUEUE.md item 3 and the printed labels.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {CaseLightVeteranUI} from "../CaseLightVeteranUI"
import {CaseLightLeafInteractor, displaySpare, angleBox, fmtBox, hideLeafOverlay, log, mustFind, roundedRectWorldCorners, waitForReady, waitUntil} from "./CaseLightLeafSupport"
import {REMINDERS, REMOVE, boxFromTurnedHead, drawnChooserLabels, expectCard, expectChooser, expectNoHouseNumbers, pick, pinchSlotOpens, slotTarget, spareInDisplay} from "./CaseLightNotesSupport"

/** A lower-row and an upper-row slot with printed labels. */
const SLOT_A = 20
const SLOT_B = 61

@component
export class CaseLightVeteranNotesScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    const ui = mustFind("VeteranControls").getComponent(CaseLightVeteranUI.getTypeName()) as CaseLightVeteranUI
    const counts0 = {u: main.unaidedCount, h: main.helpedCount, t: main.totalCount}

    // ── a. Off by default; the toggle fits the display once the head turns to it ─────────
    expect(main.veteranMode, "a. Veteran mode off by default").toBe(false)
    expect(ui.isVeteranToggleOn, "a. toggle shows off").toBe(false)
    expect(!!slotTarget(), "a. no slot-pinch target while Veteran mode is off").toBe(false)
    expect(main.noteSlots().length, "a. no notes at open").toBe(0)
    const corners = roundedRectWorldCorners("VeteranModeButton")
    const atOpen = angleBox(corners)
    const centre = corners[0].add(corners[1]).add(corners[2]).add(corners[3]).uniformScale(0.25)
    const turned = boxFromTurnedHead(corners, centre)
    log(`NOTES toggle at open ${fmtBox(atOpen)} (spare ${displaySpare(atOpen).toFixed(2)} deg); head turned yaw ${turned.yawDeg.toFixed(1)}, pitch ${turned.pitchDeg.toFixed(1)} deg: ${fmtBox(turned.box)} (spare ${spareInDisplay(turned.box).toFixed(2)} deg)`)
    expect(spareInDisplay(turned.box) >= 0.5, `a. toggle inside the display with 0.5 deg to spare once the head turns to it (${spareInDisplay(turned.box).toFixed(2)} deg)`).toBe(true)
    expect(Math.abs(turned.yawDeg) <= 45 && Math.abs(turned.pitchDeg) <= 30, `a. a head turn within reach (yaw ${turned.yawDeg.toFixed(1)}, pitch ${turned.pitchDeg.toFixed(1)} deg)`).toBe(true)

    // Control: with Veteran mode off a slot cannot be pinched (no live target).
    await ix.pressButton("VeteranModeButton")
    await waitUntil(() => main.veteranMode, 1000, "Veteran mode on after the toggle press")
    expect(ui.isVeteranToggleOn, "toggle shows on").toBe(true)
    expect(!!slotTarget(), "control: the slot-pinch target is live in Veteran mode").toBe(true)

    // ── b. A pinch on a slot opens the chooser for that slot; exactly the three reminders ─
    await pinchSlotOpens(ix, main, SLOT_A, `b. pinch on slot ${SLOT_A}`)
    expectChooser(main, false, `b. slot ${SLOT_A} without a note`)
    expectNoHouseNumbers(main, drawnChooserLabels(), "i. chooser labels")

    // ── c. Pick, re-pick, Remove note ─────────────────────────────────────────────────────
    await pick(ix, main, REMINDERS[0], "c. pick 1")
    expect(JSON.stringify(main.noteSlots()), "c. one note, on slot A").toBe(JSON.stringify([SLOT_A]))
    expectCard(main, SLOT_A, REMINDERS[0], "c. after pick 1")
    await pinchSlotOpens(ix, main, SLOT_A, `c. pinch again on slot ${SLOT_A}`)
    expectChooser(main, true, `b. slot ${SLOT_A} with a note (Remove note added)`)
    await pick(ix, main, REMINDERS[1], "c. re-pick")
    expect(main.noteForSlot(SLOT_A), "c. re-pick replaces the note").toBe(REMINDERS[1])
    expect(main.noteSlots().length, "c. still one note").toBe(1)
    expectCard(main, SLOT_A, REMINDERS[1], "c. after the re-pick")
    await pinchSlotOpens(ix, main, SLOT_A, `c. pinch to remove on slot ${SLOT_A}`)
    expectChooser(main, true, "c. before Remove note")
    await pick(ix, main, REMOVE, "c. Remove note")
    expect(main.noteForSlot(SLOT_A), "c. Remove note clears it").toBe(null)
    expect(main.isNoteShown(SLOT_A) || mustFind(`Note_${SLOT_A}`).enabled, "c. no card after Remove note").toBe(false)
    await pinchSlotOpens(ix, main, SLOT_A, `c. pinch after removing`)
    expectChooser(main, false, "b. no note again: no Remove note")
    await pick(ix, main, REMINDERS[2], "c. pick 3")
    expectCard(main, SLOT_A, REMINDERS[2], "c. after pick 3")
    await pinchSlotOpens(ix, main, SLOT_B, `c. pinch on slot ${SLOT_B} (upper row)`)
    expectChooser(main, false, `b. slot ${SLOT_B} without a note`)
    await pick(ix, main, REMINDERS[0], "c. pick on slot B")
    expectCard(main, SLOT_B, REMINDERS[0], "c. slot B")
    expectCard(main, SLOT_A, REMINDERS[2], "c. slot A kept beside slot B")
    expect(JSON.stringify(main.noteSlots()), "c. two notes").toBe(JSON.stringify([SLOT_A, SLOT_B]))
    expectNoHouseNumbers(main, [main.noteForSlot(SLOT_A) as string, main.noteForSlot(SLOT_B) as string], "i. pinned notes")

    // ── e. A pinch that does not start and end on the slot opens nothing ────────────────
    // (Stray release here comes before any aborted pinch; extra-veteran-stray-after-abort covers
    // the stray release that follows an aborted pinch.)
    const target = slotTarget()!
    const pinches = main.slotPinchCount
    const startOff = await ix.pinchAt(target, main.slotWorldPosition(SLOT_B), {startOff: true})
    await sleep(300)
    log(`NOTES start-off pinch: start ${startOff.startFired}, end ${startOff.endFired}, chooser ${main.isNoteChooserOpen}`)
    expect(startOff.hitOnTarget && startOff.endFired, "e. control: the release did land on slot B").toBe(true)
    expect(startOff.startFired, "e. the pinch did not start on the target").toBe(false)
    expect(main.isNoteChooserOpen, "e. a pinch that only ends on the slot opens no chooser").toBe(false)
    expect(main.slotPinchCount, "e. and is not counted").toBe(pinches)
    const endOff = await ix.pinchAt(target, main.slotWorldPosition(SLOT_B), {endOff: true})
    await sleep(300)
    log(`NOTES end-off pinch: on target ${endOff.hitOnTarget}, start ${endOff.startFired}, end ${endOff.endFired}, chooser ${main.isNoteChooserOpen}`)
    expect(endOff.hitOnTarget && endOff.startFired, "e. control: the pinch did start on slot B").toBe(true)
    expect(main.isNoteChooserOpen, "e. a pinch that starts on the slot and ends off it opens no chooser").toBe(false)
    expect(main.slotPinchCount, "e. and is not counted").toBe(pinches)
    expect(main.noteForSlot(SLOT_B), "e. the notes are unchanged").toBe(REMINDERS[0])

    // ── h. Veteran mode off keeps the notes (cards hide outside a pass); on again shows them ─
    await ix.pressButton("VeteranModeButton")
    await waitUntil(() => !main.veteranMode, 1000, "Veteran mode off")
    expect(main.noteForSlot(SLOT_A) === REMINDERS[2] && main.noteForSlot(SLOT_B) === REMINDERS[0], "h. Veteran mode off keeps both notes").toBe(true)
    expect(main.isNoteShown(SLOT_A) || main.isNoteShown(SLOT_B), "h. idle, Veteran mode off: no card shown").toBe(false)
    expect(!!slotTarget(), "h. no slot-pinch target with Veteran mode off").toBe(false)
    await ix.pressButton("VeteranModeButton")
    await waitUntil(() => main.veteranMode, 1000, "Veteran mode on again")
    expectCard(main, SLOT_A, REMINDERS[2], "h. Veteran mode on again: slot A card")
    expectCard(main, SLOT_B, REMINDERS[0], "h. Veteran mode on again: slot B card")
    await ix.pressButton("VeteranModeButton")
    await waitUntil(() => !main.veteranMode, 1000, "Veteran mode off at the end")
    expect(main.unaidedCount === counts0.u && main.helpedCount === counts0.h && main.totalCount === counts0.t, "no count changed").toBe(true)
    log("NOTES done")
    await hideLeafOverlay()
  }
}
