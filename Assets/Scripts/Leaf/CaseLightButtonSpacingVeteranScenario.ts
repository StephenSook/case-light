// Owns: the LEAF spacing check of Veteran mode: with Veteran mode on, and with the reminder chooser opened by a real slot pinch at four slots across both playable rows (near and far corners of the case), every pinchable button the person sees is at least 1 deg from every other and at least 2 deg each way.
// Talks to: CaseLightSpacingSupport (the shared census and view check, from a head turned toward the chooser), CaseLightNotesSupport (the real slot pinch that opens the chooser, the chooser's labels), CaseLightLeafSupport (real UIKit presses, log), CaseLightMain read-only getters (veteranMode, isNoteChooserOpen, noteChooserSlot), drawn objects by name (NoteChooser, NoteOption_n, VeteranModeButton).
// Must not: call CaseLightMain's or CaseLightVeteran's commands or test hooks, pick a reminder (no note is pinned, so nothing is left behind), or change product state except through real input (the Veteran toggle and slot pinches).

/**
 * A person who pinches a slot looks at the chooser, so each chooser view is measured from a head
 * turned toward the chooser's centre (the turned-head box the Veteran scenarios use), and only the
 * buttons that reach into the display from that head are checked. The chooser is closed between
 * slots by turning Veteran mode off and on again (no reminder is picked).
 * Slots: 2 and 20 (lower row, the far left and the middle), 61 (upper row, the slot behind the
 * welcome) and 78 (upper row, the far right); the far slots are the farthest from the eye, where a
 * chooser of fixed size would look smallest.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {CaseLightLeafInteractor, hideLeafOverlay, log, mustFind, waitForReady, waitUntil} from "./CaseLightLeafSupport"
import {REMINDERS, drawnChooserLabels, pinchSlotOpens} from "./CaseLightNotesSupport"
import {checkView} from "./CaseLightSpacingSupport"

const SLOTS = [2, 20, 61, 78]
const ROW = ["OptionsButton", "StartPracticeButton", "StartRecallButton", "ShowMyCaseButton"]

@component
export class CaseLightButtonSpacingVeteranScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    expect(main.mode, "idle at open").toBe("idle")

    await ix.pressButton("VeteranModeButton")
    await waitUntil(() => main.veteranMode, 1000, "Veteran mode on")
    checkView("Veteran mode on", {required: ROW.concat(["VeteranModeButton"]), absent: ["NoteOption_0"]})

    const eye = WorldCameraFinderProvider.getInstance().getWorldPosition()
    for (let k = 0; k < SLOTS.length; k++) {
      const slot = SLOTS[k]
      if (k > 0) {
        // Close the chooser without picking: Veteran mode off, then on again.
        await ix.pressButton("VeteranModeButton")
        await waitUntil(() => !main.veteranMode && !main.isNoteChooserOpen, 1000, "Veteran mode off closes the chooser")
        await ix.pressButton("VeteranModeButton")
        await waitUntil(() => main.veteranMode, 1000, "Veteran mode on again")
      }
      await pinchSlotOpens(ix, main, slot, `chooser at slot ${slot}`)
      const labels = drawnChooserLabels()
      expect(JSON.stringify(labels), `chooser at slot ${slot}: the three reminders`).toBe(JSON.stringify(REMINDERS))
      const centre = mustFind("NoteChooser").getTransform().getWorldPosition()
      log(`SPACING chooser at slot ${slot}: ${centre.distance(eye).toFixed(1)} cm from the eye`)
      checkView(`chooser at slot ${slot}`, {required: ["NoteOption_0", "NoteOption_1", "NoteOption_2"], absent: ["NoteOption_3"], turnTo: centre})
    }

    await ix.pressButton("VeteranModeButton")
    await waitUntil(() => !main.veteranMode && !main.isNoteChooserOpen, 1000, "Veteran mode off at the end")
    log("SPACING Veteran views done")
    await hideLeafOverlay()
  }
}
