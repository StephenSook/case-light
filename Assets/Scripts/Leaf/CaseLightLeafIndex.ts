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
  ].map((m) => ({...m, parameters: NO_REPORT_PANEL}))
}
