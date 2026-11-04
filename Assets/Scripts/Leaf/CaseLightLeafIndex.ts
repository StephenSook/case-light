// Owns: the list of CaseLight LEAF scenario ids and the scenario classes they run.
// Talks to: LEAF's scenario manager (through @scenariosIndex) and the scenario classes in this folder.
// Must not: hold test logic or touch the Lens scene; it only registers scenarios.

import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {CaseLightC1PickUpSnapScenario} from "./CaseLightC1PickUpSnapScenario"
import {CaseLightC2PracticeGlowArrowScenario} from "./CaseLightC2PracticeGlowArrowScenario"
import {CaseLightC3RecallMissScenario} from "./CaseLightC3RecallMissScenario"
import {CaseLightC4HoldNoteScenario} from "./CaseLightC4HoldNoteScenario"
import {CaseLightC5RecallScoreScenario} from "./CaseLightC5RecallScoreScenario"
import {CaseLightDrillPaceScenario} from "./CaseLightDrillPaceScenario"
import {CaseLightExitScenario} from "./CaseLightExitScenario"
import {CaseLightExtraResultHideScenario} from "./CaseLightExtraResultHideScenario"
import {CaseLightHoldCellsScenario} from "./CaseLightHoldCellsScenario"
import {CaseLightLadderDefaultScenario} from "./CaseLightLadderDefaultScenario"
import {CaseLightLadderOnScenario} from "./CaseLightLadderOnScenario"
import {CaseLightLayoutReachScenario} from "./CaseLightLayoutReachScenario"
import {CaseLightMixUpScenario} from "./CaseLightMixUpScenario"
import {CaseLightOnePressScenario} from "./CaseLightOnePressScenario"
import {CaseLightOverlayHideScenario} from "./CaseLightOverlayHideScenario"
import {CaseLightPrintFitScenario} from "./CaseLightPrintFitScenario"
import {CaseLightSoundCueScenario} from "./CaseLightSoundCueScenario"
import {CaseLightWallPlacementScenario} from "./CaseLightWallPlacementScenario"
import {CaseLightWallRefusalScenario} from "./CaseLightWallRefusalScenario"
import {CaseLightReplaceMidPassScenario} from "./CaseLightReplaceMidPassScenario"
import {CaseLightComeBackRetireScenario} from "./CaseLightComeBackRetireScenario"
import {CaseLightVeteranNotesScenario} from "./CaseLightVeteranNotesScenario"
import {CaseLightVeteranPassScenario} from "./CaseLightVeteranPassScenario"
import {CaseLightVeteranStrayScenario} from "./CaseLightVeteranStrayScenario"
import {CaseLightRouteLabelsScenario} from "./CaseLightRouteLabelsScenario"
import {CaseLightRouteLettersScenario} from "./CaseLightRouteLettersScenario"
import {CaseLightRouteResetScenario} from "./CaseLightRouteResetScenario"
import {CaseLightLastLetterDarkScenario} from "./CaseLightLastLetterDarkScenario"
import {CaseLightRoutePickerInViewScenario} from "./CaseLightRoutePickerInViewScenario"
import {CaseLightPlacementLogScenario} from "./CaseLightPlacementLogScenario"
import {CaseLightRecallNoGlowScenario} from "./CaseLightRecallNoGlowScenario"
import {CaseLightDemoOffScenario} from "./CaseLightDemoOffScenario"
import {CaseLightDemoReplayScenario} from "./CaseLightDemoReplayScenario"
import {CaseLightCaseCheckScenario} from "./CaseLightCaseCheckScenario"
import {CaseLightRealScaleScenario} from "./CaseLightRealScaleScenario"
import {CaseLightMasteryMapScenario} from "./CaseLightMasteryMapScenario"
import {CaseLightProgressSaveScenario} from "./CaseLightProgressSaveScenario"
import {CaseLightProgressWelcomeScenario} from "./CaseLightProgressWelcomeScenario"
import {CaseLightLearningCurveScenario} from "./CaseLightLearningCurveScenario"
import {CaseLightProgressResetScenario} from "./CaseLightProgressResetScenario"
import {CaseLightPinchHintScenario} from "./CaseLightPinchHintScenario"
import {CaseLightStandInScenario} from "./CaseLightStandInScenario"
import {CaseLightButtonSpacingScenario} from "./CaseLightButtonSpacingScenario"
import {CaseLightButtonSpacingExitScenario} from "./CaseLightButtonSpacingExitScenario"
import {CaseLightButtonSpacingVeteranScenario} from "./CaseLightButtonSpacingVeteranScenario"
import {CaseLightIkLoopScenario} from "./CaseLightIkLoopScenario"
import {CaseLightControlLabelsScenario} from "./CaseLightControlLabelsScenario"

/**
 * LEAF's diagnostic report panel hides at once after each run (0 ms), so a film captured after a
 * test run never shows it. Run arguments can still override this per run.
 */
const NO_REPORT_PANEL: Record<string, string> = {__leaf__diagnostic_report_duration_ms: "0"}

/** LEAF scenario index for CaseLight. One or more scenarios per done criterion in devpost/design-brief.md. */
@component
export class CaseLightLeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "c1-pickup-and-snap", typename: CaseLightC1PickUpSnapScenario.getTypeName()},
    {id: "c2-practice-glow-and-arrow", typename: CaseLightC2PracticeGlowArrowScenario.getTypeName()},
    {id: "c3-recall-miss-lights-answer", typename: CaseLightC3RecallMissScenario.getTypeName()},
    {id: "c4-hold-note-and-hold-block", typename: CaseLightC4HoldNoteScenario.getTypeName()},
    {id: "c5-recall-unaided-score", typename: CaseLightC5RecallScoreScenario.getTypeName()},
    {id: "extra-result-hides-and-session-total", typename: CaseLightExtraResultHideScenario.getTypeName()},
    {id: "extra-sound-cues", typename: CaseLightSoundCueScenario.getTypeName()},
    {id: "extra-drill-pace", typename: CaseLightDrillPaceScenario.getTypeName()},
    {id: "extra-exit-again-done", typename: CaseLightExitScenario.getTypeName()},
    {id: "extra-ladder-default-off", typename: CaseLightLadderDefaultScenario.getTypeName()},
    {id: "extra-ladder-on", typename: CaseLightLadderOnScenario.getTypeName()},
    {id: "extra-mixup-lines", typename: CaseLightMixUpScenario.getTypeName()},
    {id: "extra-hold-cells", typename: CaseLightHoldCellsScenario.getTypeName()},
    {id: "extra-print-fit", typename: CaseLightPrintFitScenario.getTypeName()},
    {id: "extra-layout-fit-and-reach", typename: CaseLightLayoutReachScenario.getTypeName()},
    {id: "extra-leaf-overlay-hidden", typename: CaseLightOverlayHideScenario.getTypeName()},
    {id: "extra-one-pinch-one-press", typename: CaseLightOnePressScenario.getTypeName()},
    {id: "extra-wall-placement", typename: CaseLightWallPlacementScenario.getTypeName()},
    {id: "extra-wall-refusals", typename: CaseLightWallRefusalScenario.getTypeName()},
    {id: "extra-replace-mid-pass", typename: CaseLightReplaceMidPassScenario.getTypeName()},
    {id: "extra-come-back-and-retire", typename: CaseLightComeBackRetireScenario.getTypeName()},
    {id: "extra-veteran-notes", typename: CaseLightVeteranNotesScenario.getTypeName()},
    {id: "extra-veteran-notes-in-pass", typename: CaseLightVeteranPassScenario.getTypeName()},
    {id: "extra-veteran-stray-after-abort", typename: CaseLightVeteranStrayScenario.getTypeName()},
    {id: "extra-route-labels", typename: CaseLightRouteLabelsScenario.getTypeName()},
    {id: "extra-route-letters", typename: CaseLightRouteLettersScenario.getTypeName()},
    {id: "extra-route-switch-resets", typename: CaseLightRouteResetScenario.getTypeName()},
    {id: "extra-last-letter-dark", typename: CaseLightLastLetterDarkScenario.getTypeName()},
    {id: "extra-route-picker-in-view", typename: CaseLightRoutePickerInViewScenario.getTypeName()},
    {id: "extra-placement-log", typename: CaseLightPlacementLogScenario.getTypeName()},
    {id: "extra-recall-no-glow-per-frame", typename: CaseLightRecallNoGlowScenario.getTypeName()},
    {id: "extra-demo-replay-off-by-default", typename: CaseLightDemoOffScenario.getTypeName()},
    {id: "extra-demo-replay", typename: CaseLightDemoReplayScenario.getTypeName()},
    {id: "extra-case-check", typename: CaseLightCaseCheckScenario.getTypeName()},
    {id: "extra-case-real-scale", typename: CaseLightRealScaleScenario.getTypeName()},
    {id: "extra-mastery-map", typename: CaseLightMasteryMapScenario.getTypeName()},
    // A chain, in this order: save leaves progress (and a one-point learning curve) in the store; welcome
    // reads it at the next Lens start (route redraw, Start hides it) and leaves the keys; learning-curve
    // draws the saved curve at the start after that, presses Reset progress and saves two recall passes;
    // reset removes our keys (the curve's among them) at the start after that.
    {id: "extra-progress-save", typename: CaseLightProgressSaveScenario.getTypeName()},
    {id: "extra-progress-welcome", typename: CaseLightProgressWelcomeScenario.getTypeName()},
    {id: "extra-learning-curve", typename: CaseLightLearningCurveScenario.getTypeName()},
    {id: "extra-progress-reset", typename: CaseLightProgressResetScenario.getTypeName()},
    // Needs the empty store extra-progress-reset leaves: the opening pinch hint shows only with no saved progress.
    // Its recall pass (to reach Again) saves progress; extra-stand-in-hidden presses Reset progress to empty the store.
    {id: "extra-pinch-hint", typename: CaseLightPinchHintScenario.getTypeName()},
    {id: "extra-stand-in-hidden", typename: CaseLightStandInScenario.getTypeName()},
    // Needs nothing saved at Lens start: extra-stand-in-hidden presses Reset progress, leaving the store empty.
    {id: "extra-button-spacing", typename: CaseLightButtonSpacingScenario.getTypeName()},
    // Its recall pass saves progress (run it after extra-button-spacing, which needs the empty store).
    {id: "extra-button-spacing-exit", typename: CaseLightButtonSpacingExitScenario.getTypeName()},
    {id: "extra-button-spacing-veteran", typename: CaseLightButtonSpacingVeteranScenario.getTypeName()},
    // Needs nothing saved at Lens start (the opening pinch hint is up), like extra-button-spacing; extra-button-spacing-exit
    // leaves saved progress, so run it after a Reset progress. It ends no recall pass, so it saves nothing.
    {id: "extra-ik-loop", typename: CaseLightIkLoopScenario.getTypeName()},
    // Any store: the next step at open is Start practice either way; its practice pass and route switches save nothing.
    {id: "extra-control-labels", typename: CaseLightControlLabelsScenario.getTypeName()},
  ].map((m) => ({...m, parameters: NO_REPORT_PANEL}))
}
