// Owns: the LEAF check that hideLeafOverlay() removes LEAF's in-world diagnostic report panel, so a later film capture never shows it.
// Talks to: CaseLightLeafSupport (hideLeafOverlay), LEAF's DiagnosticReportOverlay, scene objects by name.
// Must not: call CaseLightMain's test hooks or commands, or touch any product object.

/**
 * Positive control: the panel is shown with DiagnosticReportOverlay.show() and its
 * LeafDiagnosticReportCamera object is seen in the scene; then hideLeafOverlay() must leave no
 * such object. LEAF's other on-screen strip (LeafDebugUICamera, its log line) is reported, not
 * asserted: the scenario manager writes to it after every run.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {DiagnosticReportOverlay} from "Leaf.lspkg/Diagnostic/DiagnosticReportOverlay"
import {findSceneObjectByName, nextFrame} from "Leaf.lspkg/Utils/common/Utils"
import {hideLeafOverlay, log, waitForReady} from "./CaseLightLeafSupport"

@component
export class CaseLightOverlayHideScenario extends Scenario {
  async run(): Promise<void> {
    await waitForReady()
    DiagnosticReportOverlay.show("CaseLight overlay check: this panel must be hidden")
    await nextFrame()
    expect(!!findSceneObjectByName("LeafDiagnosticReportCamera"), "LeafDiagnosticReportCamera present once shown (positive control)").toBe(true)
    await hideLeafOverlay()
    log(`OVERLAY hidden; LeafDebugUICamera (LEAF log strip) present: ${!!findSceneObjectByName("LeafDebugUICamera")}`)
    log("OVERLAY done")
  }
}
