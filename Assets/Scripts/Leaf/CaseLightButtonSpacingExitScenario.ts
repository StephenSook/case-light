// Owns: the LEAF spacing check of the views a recall pass leads to: mid-pass with the Options panel open, the exit view with the score card up and after it times out, and a running Case check; every pinchable button at least 1 deg apart and 2 deg each way, nothing pinchable over the score card, and an Options press at the exit view ignored (logged, the panel stays closed), still ignored while the Case check's card stays up after Done, and the same press opens it once that card times out.
// Talks to: CaseLightSpacingSupport (the shared census and view check), CaseLightLeafSupport (real UIKit presses, real SIK drops, independent answers, angle boxes), CaseLightMain read-only getters (mode, optionsOpen, optionsIgnoredPressCount, isExitVisible, isResultVisible, resultSeconds, caseCheckOffered, isCaseCheckButtonVisible, caseCheckActive, placementLogLines), drawn objects by name (ResultBacking, OptionsPanel and the buttons).
// Must not: call CaseLightMain's test hooks or commands, or change product state except through real input (Options, Start recall, the drops, Case check, Done); it leaves saved progress behind (its recall pass saves).

/**
 * Views, each reached by real input and checked by CaseLightSpacingSupport.checkView:
 * 1. Mid-pass (recall), Options opened by a real press: the row, both Options toggles.
 * 2. The exit view straight after the pass ends (score card up): the row, Again, Done and Case
 *    check; the Options toggles are not pinchable; no pinchable object (counted or exempt, measured
 *    by what it draws) overlaps the score card's backing; the slot-pinch target is not live.
 * 3. An Options press there: nothing opens (optionsOpen false, the panel object off), one
 *    options-ignored line with reason=score-card, and view 2's checks again.
 * 4. After the score card times out (Again and Done still up): a press is ignored with reason=exit.
 * 5. Case check running (its button pressed): the row, Again and Done, the slot-pinch target live.
 * 6. After Done: an Options press opens the panel (control: the ignore belongs to the exit view
 *    only), and a second press closes it.
 * This restores, in a stronger form, extra-layout-fit-and-reach's earlier intent that nothing
 * pinchable stands behind the score card.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {nextFrame} from "Leaf.lspkg/Utils/common/Utils"
import {CaseLightMain} from "../CaseLightMain"
import {CaseLightLeafInteractor, angleBox, anglesOverlap, dropSlotFor, expectResult, fmtBox, hideLeafOverlay, log, mustFind, roundedRectWorldCorners, waitForReady, waitForTopGrabbable, waitUntil} from "./CaseLightLeafSupport"
import {Census, checkView} from "./CaseLightSpacingSupport"

const ROW = ["OptionsButton", "StartPracticeButton", "StartRecallButton", "ShowMyCaseButton"]
const PANEL = ["DrillPaceButton", "HideStandInButton"]

function lastLogLine(main: CaseLightMain): string {
  const lines = main.placementLogLines
  return lines.length > 0 ? lines[lines.length - 1] : ""
}

/** No pinchable object, counted or exempt (measured by what it draws), overlaps the score card. */
function expectNothingOverScoreCard(c: Census, ctx: string): void {
  const card = angleBox(roundedRectWorldCorners("ResultBacking"))
  const all = c.targets.concat(c.exemptBoxes)
  const over = all.filter((t) => anglesOverlap(t.box, card)).map((t) => t.name)
  log(`SPACING ${ctx}: score card ${fmtBox(card)}; ${all.length} pinchable objects measured, over the card: ${over.join(", ") || "none"}`)
  expect(over.length, `${ctx}: nothing pinchable over the score card (${over.join(", ") || "none"})`).toBe(0)
  expect(c.exempt["slot-pinch target"] === undefined, `${ctx}: the slot-pinch target is not live`).toBe(true)
}

async function pressOptionsIgnored(main: CaseLightMain, ix: CaseLightLeafInteractor, reason: string, ctx: string): Promise<void> {
  const before = main.optionsIgnoredPressCount
  await ix.pressButton("OptionsButton")
  await nextFrame()
  log(`SPACING ${ctx}: Options press: open ${main.optionsOpen}, panel drawn ${mustFind("OptionsPanel").isEnabledInHierarchy}, ignored +${main.optionsIgnoredPressCount - before}; log: ${lastLogLine(main)}`)
  expect(main.optionsOpen, `${ctx}: the Options press opens nothing`).toBe(false)
  expect(mustFind("OptionsPanel").isEnabledInHierarchy, `${ctx}: the Options panel stays off, colliders included`).toBe(false)
  expect(main.optionsIgnoredPressCount - before, `${ctx}: one ignored Options press counted`).toBe(1)
  expect(lastLogLine(main).indexOf(`event=options-ignored reason=${reason}`) >= 0, `${ctx}: the press is logged (options-ignored, reason=${reason})`).toBe(true)
}

@component
export class CaseLightButtonSpacingExitScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    expect(main.mode, "idle at open").toBe("idle")

    // ── 1. Mid-pass, Options open ─────────────────────────────────────────────────────
    await ix.pressButton("StartRecallButton")
    expect(main.mode, "a recall pass is running").toBe("recall")
    await waitForTopGrabbable(main)
    await ix.pressButton("OptionsButton")
    expect(main.optionsOpen, "mid-pass: Options opened by a real press").toBe(true)
    checkView("mid-pass, Options open", {required: ROW.concat(PANEL), absent: []})
    await ix.pressButton("OptionsButton")
    expect(main.optionsOpen, "mid-pass: Options closed by a second press").toBe(false)

    while (main.mode === "recall") {
      const p = await waitForTopGrabbable(main)
      await ix.dropTopPieceAtSlot(main, dropSlotFor(main, p))
      expect(main.lastDropResult, `piece ${p} placed`).toBe("correct")
    }

    // ── 2. The exit view, score card up ─────────────────────────────────────────────────
    await waitUntil(() => main.isExitVisible, 2000, "exit shown after the pass")
    expectResult(main, true, "exit view: score card shown")
    expect(main.caseCheckOffered && main.isCaseCheckButtonVisible, "exit view: Case check offered and drawn").toBe(true)
    expect(main.optionsOpen, "exit view: the Options panel is closed").toBe(false)
    const exitRequired = ROW.concat(["AgainButton", "DoneButton", "CaseCheckButton"])
    expectNothingOverScoreCard(checkView("exit view, score card up", {required: exitRequired, absent: PANEL}), "exit view, score card up")

    // ── 3. An Options press with the score card up is ignored ─────────────────────────
    expect(main.isResultVisible, "precondition: the score card is still up for the press").toBe(true)
    await pressOptionsIgnored(main, ix, "score-card", "exit view, score card up")
    expectNothingOverScoreCard(checkView("exit view after an Options press", {required: exitRequired, absent: PANEL}), "exit view after an Options press")

    // ── 4. Score card timed out, Again and Done still up: still ignored ─────────────────
    await waitUntil(() => !main.isResultVisible, (main.resultSeconds + 3) * 1000, "the score card times out")
    expect(main.isExitVisible, "Again and Done stay up after the score card times out").toBe(true)
    await pressOptionsIgnored(main, ix, "exit", "exit view, score card timed out")
    checkView("exit view, score card timed out", {required: exitRequired, absent: PANEL})

    // ── 5. Case check running ───────────────────────────────────────────────────────────
    await ix.pressButton("CaseCheckButton")
    await waitUntil(() => main.caseCheckActive, 2000, "the Case check starts")
    const check = checkView("Case check running", {required: ROW.concat(["AgainButton", "DoneButton"]), absent: PANEL.concat(["CaseCheckButton"])})
    expect((check.exempt["slot-pinch target"] || 0) >= 1, "Case check running: the slot-pinch target is live (exempt, counted by kind)").toBe(true)

    // ── 6. After Done the Case check's card stays up for resultSeconds (still ignored); once it
    //       times out, Options opens again (control) ─────────────────────────────────────────
    await ix.pressButton("DoneButton")
    await waitUntil(() => !main.isExitVisible && !main.caseCheckActive, 2000, "Done closes the exit and ends the Case check")
    expect(main.isResultVisible, "after Done: the Case check's card is up").toBe(true)
    await pressOptionsIgnored(main, ix, "score-card", "after Done, the Case check's card up")
    await waitUntil(() => !main.isResultVisible, (main.resultSeconds + 3) * 1000, "the Case check's card times out")
    const before = main.optionsIgnoredPressCount
    await ix.pressButton("OptionsButton")
    expect(main.optionsOpen && mustFind("OptionsPanel").isEnabledInHierarchy, "after Done: Options opens the panel (control)").toBe(true)
    expect(main.optionsIgnoredPressCount, "after Done: the press is not ignored").toBe(before)
    await ix.pressButton("OptionsButton")
    expect(main.optionsOpen, "after Done: a second press closes it").toBe(false)
    log("SPACING exit views done")
    await hideLeafOverlay()
  }
}
