// Owns: the LEAF check of Snap's spacing guidance for pinch targets: at Lens start with nothing saved and the default camera, every enabled pinchable button is at least 1 deg from every other (overlaps fail) and at least 2 deg each way; then a real press opens the Options panel and the same holds with its two toggles included.
// Talks to: CaseLightSpacingSupport (the shared census and view check), CaseLightTargetSpacing (the pure gap rule, also tested in plain node), CaseLightLeafSupport (real UIKit presses), CaseLightMain read-only getters (progressWelcomeShown, pinchHintShown, optionsOpen, mode), every SceneObject carrying an SIK Interactable (walked from the scene roots).
// Must not: call CaseLightMain's test hooks or commands, or change product state except through real input (the Options toggle, pressed twice).

/**
 * What counts, and the named exemptions (panel backplates, letters, cells and the slot-pinch
 * target, the pinch hint), are written down once in CaseLightSpacingSupport. The other views a
 * person reaches are checked the same way in extra-button-spacing-exit (mid-pass, the exit view,
 * the Case check), extra-button-spacing-veteran (the reminder chooser) and extra-progress-welcome
 * (the welcome with Reset progress).
 * Gap (CaseLightTargetSpacing.angularGap): apart along one axis, that axis's gap; apart along both,
 * the straight line between the nearest corners; overlapping, negative.
 * Controls that can fail: a real button's box against itself overlaps (gap < 0); two known boxes
 * give their known gaps (1 deg side by side, 5 deg off the corner); a planted pair 0.14 deg apart is
 * reported by the same sweep; Start practice and Start recall (one row) give exactly the yaw gap
 * between their facing edges. Options closed at open: its two toggles must not be pinchable.
 * Run order: needs nothing saved (the welcome and Reset progress would change the opening view);
 * extra-stand-in-hidden leaves the store empty, so this runs after it.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {nextFrame} from "Leaf.lspkg/Utils/common/Utils"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {MIN_TARGET_GAP_DEG, angularGap, pairsCloserThan} from "../CaseLightTargetSpacing"
import {CaseLightLeafInteractor, fmt, hideLeafOverlay, log, mustFind, waitForReady, waitUntil} from "./CaseLightLeafSupport"
import {checkView, fmtGap} from "./CaseLightSpacingSupport"

/** The opening view keeps these (Options added by the spacing pass). */
const OPEN_REQUIRED = ["OptionsButton", "StartPracticeButton", "StartRecallButton", "ShowMyCaseButton", "RouteButton_1", "RouteButton_2"]
/** In the Options panel: pinchable only while it is open. */
const PANEL = ["DrillPaceButton", "HideStandInButton"]

@component
export class CaseLightButtonSpacingScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    if (main.progressWelcomeShown) throw new Error("needs nothing saved at Lens start: run after extra-stand-in-hidden, which empties the store")
    expect(main.pinchHintShown, "nothing saved at Lens start: the opening pinch hint is up (precondition control)").toBe(true)
    expect(main.mode, "idle at open").toBe("idle")
    const cam = WorldCameraFinderProvider.getInstance()
    log(`SPACING camera at ${fmt(cam.getWorldPosition())}, forward ${fmt(cam.forward())}`)
    // Built enabled so UIKit initialises, then settled closed on the opening LateUpdate.
    await waitUntil(() => !mustFind("OptionsPanel").isEnabledInHierarchy, 2000, "the Options panel settled closed at open")
    expect(main.optionsOpen, "Options closed at open").toBe(false)

    // ── Controls: the gap rule can say "overlap", gives known gaps, and the sweep can fail ──
    const known = angularGap({minYaw: 0, maxYaw: 1, minPitch: 0, maxPitch: 1}, {minYaw: 2, maxYaw: 3, minPitch: 0, maxPitch: 1})
    const corner = angularGap({minYaw: 0, maxYaw: 1, minPitch: 0, maxPitch: 1}, {minYaw: 4, maxYaw: 5, minPitch: 5, maxPitch: 6})
    expect(Math.abs(known - 1) < 1e-9 && Math.abs(corner - 5) < 1e-9, `known boxes give known gaps (side by side ${known}, off the corner ${corner}) (control)`).toBe(true)
    const planted = pairsCloserThan([{name: "P", box: {minYaw: 0, maxYaw: 2, minPitch: 0, maxPitch: 2}}, {name: "Q", box: {minYaw: 2.14, maxYaw: 4, minPitch: 0, maxPitch: 2}}], MIN_TARGET_GAP_DEG)
    expect(planted.length === 1 && Math.abs(planted[0].gap - 0.14) < 1e-9, `the sweep reports a planted pair 0.14 deg apart (${planted.map(fmtGap).join("; ") || "nothing"}) (control)`).toBe(true)

    // ── The opening view ───────────────────────────────────────────────────────────────
    const open = checkView("opening view", {required: OPEN_REQUIRED, absent: PANEL}).targets
    const practice = open.filter((t) => t.name === "StartPracticeButton")[0]
    const recall = open.filter((t) => t.name === "StartRecallButton")[0]
    const self = angularGap(practice.box, practice.box)
    expect(self < 0, `a button's box against itself overlaps (gap ${self.toFixed(2)} deg) (control)`).toBe(true)
    const rowGap = angularGap(practice.box, recall.box)
    const yawGap = recall.box.minYaw - practice.box.maxYaw
    expect(Math.abs(rowGap - yawGap) < 1e-6, `Start practice to Start recall: the gap is the yaw gap between their edges (${rowGap.toFixed(3)} vs ${yawGap.toFixed(3)} deg) (control)`).toBe(true)

    // ── Options open (real press): its two toggles included ─────────────────────────────
    await ix.pressButton("OptionsButton")
    await nextFrame()
    expect(main.optionsOpen, "Options opened by the press").toBe(true)
    expect(mustFind("OptionsPanel").isEnabledInHierarchy, "the Options panel is drawn").toBe(true)
    expect(main.mode, "still idle with Options open").toBe("idle")
    checkView("Options open", {required: OPEN_REQUIRED.concat(PANEL), absent: []})

    // ── Options closed again (real press): back to the opening set ────────────────────
    await ix.pressButton("OptionsButton")
    await nextFrame()
    expect(main.optionsOpen, "Options closed by the second press").toBe(false)
    expect(mustFind("OptionsPanel").isEnabledInHierarchy, "the Options panel is off, colliders included").toBe(false)
    checkView("Options closed again", {required: OPEN_REQUIRED, absent: PANEL})
    log("SPACING done")
    await hideLeafOverlay()
  }
}
