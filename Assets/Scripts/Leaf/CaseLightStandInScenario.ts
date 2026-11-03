// Owns: the LEAF check of item A3's Hide stand-in case toggle (reached through the Options panel): pressed, the case lines and everything a real case already has printed (cell numbers, street names, HOLD) are hidden while the letters, controls, caption and version stay; a practice grab still lights the right cell and a drop there still counts "correct" (the answer taken from the printed labels before hiding); pressed again mid-pass (Options reopened), everything is back.
// Talks to: CaseLightLeafSupport (real UIKit presses, real SIK grab and drop, independent answers from the printed case, glow checks), CaseLightMain read-only getters (progressWelcomeShown, standInHidden, isHideStandInOn, optionsOpen, mode, lastDropResult, lastDropSlot, placementLogLines, slotWorldPosition for the label check), drawn objects by name (CaseLines, Label_n, StreetName_n, StreetNameRepeat_n, HoldLabel, Piece_n, the buttons, Caption, VersionLabel, TrayLines, SlotGlow).
// Must not: import CaseLightCaseMesh, CaseLightCaseLabelsUI or CaseLightLog, call product commands or test hooks (toggleStandIn is never called; the toggle is pressed), or change product state except through real input.

/**
 * Expected answers come from the printed case (answerFor reads the label texts and street colours)
 * and are taken before anything is hidden; each answer's label must sit under its cell (same x as
 * the cell, within 0.5 cm), so the drop target is where the printed number was.
 * Runs after extra-pinch-hint, whose recall pass saves progress: when the welcome is up at open,
 * it presses Reset progress before anything else, so the store is left empty again.
 * Controls: everything is drawn before the press (a test that cannot see the labels fails here);
 * after the press, the letters and controls must still read as drawn (a test that reads everything
 * as hidden fails there).
 * The toggle is in the Options panel: Options is pressed (real input) before each press, and the
 * panel's two toggles are checked as drawn whenever it is open (a Start press closes it).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {CaseLightMain} from "../CaseLightMain"
import {CaseLightLeafInteractor, answerFor, expectGlowAt, hideLeafOverlay, labelText, log, mustFind, waitForReady} from "./CaseLightLeafSupport"

/** What a real case already has printed (names as drawn), plus the stand-in's own lines. */
const STAND_IN_ONLY = ["CaseLines", "HoldLabel"]
/** What the glasses still draw over a real case (the row, the routes, caption, version, tray). */
const KEPT = ["OptionsButton", "StartPracticeButton", "StartRecallButton", "ShowMyCaseButton", "RouteButton_1", "RouteButton_2", "Caption", "CreditText", "VersionLabel", "TrayLines"]
/** Also kept, drawn while the Options panel is open (it is open at every check below). */
const KEPT_IN_OPTIONS = ["DrillPaceButton", "HideStandInButton"]

function shown(name: string): boolean {
  return mustFind(name).isEnabledInHierarchy
}

/** Cell number labels drawn right now, of those that exist. */
function labelsShown(): {shown: number; total: number} {
  let n = 0
  let total = 0
  for (let s = 0; s < 80; s++) {
    const t = labelText(s)
    if (!t) continue
    total++
    if (t.getSceneObject().isEnabledInHierarchy) n++
  }
  return {shown: n, total}
}

/** Street names (block starts and repeats) drawn right now, of those that exist. */
function streetNamesShown(): {shown: number; total: number} {
  let n = 0
  let total = 0
  const walk = (o: SceneObject) => {
    if (o.name.indexOf("StreetName") === 0) {
      total++
      if (o.isEnabledInHierarchy) n++
    }
    for (let i = 0; i < o.getChildrenCount(); i++) walk(o.getChild(i))
  }
  walk(mustFind("RouteLabels"))
  return {shown: n, total}
}

function lastLogLine(main: CaseLightMain): string {
  const lines = main.placementLogLines
  return lines.length > 0 ? lines[lines.length - 1] : ""
}

function expectAllDrawn(main: CaseLightMain, top: number, ctx: string): void {
  const l = labelsShown()
  const st = streetNamesShown()
  expect(main.standInHidden || main.isHideStandInOn, `${ctx}: Hide stand-in case reads off`).toBe(false)
  for (const n of STAND_IN_ONLY) expect(shown(n), `${ctx}: ${n} drawn`).toBe(true)
  expect(l.total > 0 && l.shown === l.total, `${ctx}: every cell number label drawn (${l.shown} of ${l.total})`).toBe(true)
  expect(st.total > 0 && st.shown === st.total, `${ctx}: every street name drawn (${st.shown} of ${st.total})`).toBe(true)
  for (const n of KEPT.concat(KEPT_IN_OPTIONS)) expect(shown(n), `${ctx}: ${n} drawn`).toBe(true)
  expect(shown(`Piece_${top}`), `${ctx}: the top letter drawn`).toBe(true)
}

/** Open the Options panel with a real press (Hide stand-in case is in it). */
async function openOptions(main: CaseLightMain, ix: CaseLightLeafInteractor, ctx: string): Promise<void> {
  expect(main.optionsOpen, `${ctx}: Options closed before the press`).toBe(false)
  expect(shown("HideStandInButton"), `${ctx}: Hide stand-in case not drawn while Options is closed`).toBe(false)
  await ix.pressButton("OptionsButton")
  expect(main.optionsOpen, `${ctx}: Options opened by the press`).toBe(true)
}

@component
export class CaseLightStandInScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    const top = main.bundleOrder[0]
    if (main.progressWelcomeShown) {
      log("STANDIN welcome up at open: pressing Reset progress to leave the store empty")
      await ix.pressButton("ResetProgressButton")
      expect(main.progressWelcomeShown, "Reset progress hides the welcome").toBe(false)
    }

    // ── Before hiding: the answer from the printed labels, and where its label is ─────────
    const answer = answerFor(main, top)
    const dropSlot = answer.slot === -2 ? 37 : answer.slot
    if (answer.slot >= 0) {
      const labelX = (labelText(answer.slot) as Text).getSceneObject().getTransform().getWorldPosition().x
      const cellX = main.slotWorldPosition(answer.slot).x
      log(`STANDIN top letter ${top}: answer cell ${answer.slot}, its label at x ${labelX.toFixed(2)}, the cell at x ${cellX.toFixed(2)}`)
      expect(Math.abs(labelX - cellX) < 0.5, `the answer's printed label sits under cell ${answer.slot}`).toBe(true)
    } else log(`STANDIN top letter ${top} is the hold letter: answer the HOLD block (drop cell 37)`)
    await openOptions(main, ix, "at open")
    expectAllDrawn(main, top, "control at open")

    // ── Press: only what the glasses would draw over a real case is left ───────────────────
    await ix.pressButton("HideStandInButton")
    const l = labelsShown()
    const st = streetNamesShown()
    log(`STANDIN on: hidden ${main.standInHidden}, toggle ${main.isHideStandInOn}, CaseLines ${shown("CaseLines")}, labels ${l.shown}/${l.total}, street names ${st.shown}/${st.total}, HOLD ${shown("HoldLabel")}; log: ${lastLogLine(main)}`)
    expect(main.standInHidden && main.isHideStandInOn, "Hide stand-in case reads on").toBe(true)
    for (const n of STAND_IN_ONLY) expect(shown(n), `${n} hidden`).toBe(false)
    expect(l.shown, "no cell number label drawn").toBe(0)
    expect(st.shown, "no street name drawn").toBe(0)
    for (const n of KEPT.concat(KEPT_IN_OPTIONS)) expect(shown(n), `control: ${n} still drawn`).toBe(true)
    expect(shown(`Piece_${top}`), "control: the top letter still drawn").toBe(true)
    expect(lastLogLine(main).indexOf("event=stand-in hidden=1") >= 0, "the press is logged (hidden=1)").toBe(true)

    // ── A practice drop still counts the same ───────────────────────────────────────────
    await ix.pressButton("StartPracticeButton")
    expect(main.mode, "a practice pass is running").toBe("practice")
    expect(main.optionsOpen, "the Start press closed the Options panel").toBe(false)
    expect(main.standInHidden, "still hidden in the pass").toBe(true)
    const held = await ix.grabTopPieceAndHold(main)
    expect(held.piece, "the top letter is in hand").toBe(top)
    expectGlowAt(main, answer.slot, "practice grab with the stand-in hidden")
    await ix.dropHeldPieceAtSlot(main, held.it, dropSlot)
    held.off()
    log(`STANDIN drop: cell ${main.lastDropSlot}, result ${main.lastDropResult}; log: ${lastLogLine(main)}`)
    expect(main.lastDropSlot, `dropped in cell ${dropSlot}`).toBe(dropSlot)
    expect(main.lastDropResult, "counted correct").toBe("correct")
    const placed = main.placementLogLines.filter((x) => x.indexOf(`piece=${top} `) >= 0 && x.indexOf("result=") >= 0)
    expect(placed.length === 1 && placed[0].indexOf("result=correct") >= 0, "one placement line, result=correct").toBe(true)

    // ── Press again, mid-pass (Options reopened): everything is back ───────────────────────
    await openOptions(main, ix, "mid-pass")
    await ix.pressButton("HideStandInButton")
    expect(main.mode, "still in the practice pass").toBe("practice")
    expect(lastLogLine(main).indexOf("event=stand-in hidden=0") >= 0, "the second press is logged (hidden=0)").toBe(true)
    expectAllDrawn(main, top, "after the second press")
    await hideLeafOverlay()
  }
}
