// Owns: the LEAF check of item A1 (the mastery map): the Show my case toggle sits inside the display and wholly inside a preview still at open, clear of its neighbours (Options, the places of Drill pace and Hide stand-in case in the Options panel, the top letter, and the places of the score card, Again, Done and Case check included); pressed before any recall the map shows both rows "Not tried" with one mark per letter; a press during a recall pass is ignored and logged; after a recall pass with every row-0 letter (the hold letter too) from memory and one row-1 letter missed once and placed when it came back, the map shows row 0 learned and row 1 weak ("Review 1"), that letter weak and every other letter learned; a Start press hides it.
// Talks to: CaseLightLeafSupport (real UIKit presses and SIK drops, independent answers from the printed case, angle boxes), CaseLightRecallSupport (the test's own recall model and pass player), CaseLightMain read-only getters (masteryLetterState, masteryRowState, masteryRowCounts, masteryMapShown, masteryMarkCount, masteryRowLabels, masteryIgnoredPressCount, isShowMyCaseOn, placementLogLines, mode), drawn objects by name (ShowMyCaseButton, MasteryRowLabel_n, MasteryMarks and the opening view's neighbours).
// Must not: import CaseLightMastery or CaseLightLog, call product commands or test hooks (toggleMasteryMap is never called; the button is pressed), or change product state except through real input.

/**
 * Every expected row comes from the printed case: a letter's row is the row of the label that
 * carries its house number (the hold letter, whose number no label carries, is the HOLD block in
 * row 0). Expected states follow the rule as written (latest recall event: a miss or a helped
 * placement is weak, a placement from memory is learned; a row is weak if any letter is weak,
 * else unseen if any is unseen, else learned), never the product's own map.
 * Controls: the map is hidden at open (it shows only on a press); row 1 is "unseen" before the
 * pass and must NOT read "learned" after it (one of its letters was missed); the overlap test
 * reports a box overlapping itself.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {CaseLightMain} from "../CaseLightMain"
import {AngleBox, CaseLightLeafInteractor, angleBox, anglesOverlap, displaySpare, drawnWorldBox, fmtBox, hideLeafOverlay, insideDisplay, insidePreviewStill, log, mustFind, roundedRectWorldCorners, rowOfTarget, targetOf, textWorldCorners, waitForReady} from "./CaseLightLeafSupport"
import {OwnModel, playRecallPass} from "./CaseLightRecallSupport"

const HOLD = -2

interface Counts {
  learned: number
  weak: number
  unseen: number
}

function countsKey(c: Counts): string {
  return `learned ${c.learned}, weak ${c.weak}, unseen ${c.unseen}`
}

/** The drawn word of a row, or "" when its text object is missing or hidden. */
function drawnRowWord(row: number): string {
  const so = mustFindOptional(`MasteryRowLabel_${row}`)
  if (!so || !so.isEnabledInHierarchy) return ""
  const t = so.getComponent("Component.Text") as Text
  return t ? t.text : ""
}

function mustFindOptional(name: string): SceneObject | null {
  try {
    return mustFind(name)
  } catch (e) {
    return null
  }
}

function lastLogLine(main: CaseLightMain): string {
  const lines = main.placementLogLines
  return lines.length > 0 ? lines[lines.length - 1] : ""
}

/** The map as the product shows it, checked against our expectation for each row and letter. */
function expectMap(main: CaseLightMain, rows: number[], expectRow: string[], expectCounts: Counts[], expectLetter: string[], ctx: string): void {
  expect(main.masteryMapShown, `${ctx}: the map is shown`).toBe(true)
  expect(main.isShowMyCaseOn, `${ctx}: the Show my case toggle reads on`).toBe(true)
  const words = [0, 1].map((r) => drawnRowWord(r))
  log(`MASTERY ${ctx}: rows ${main.masteryRowState(0)} / ${main.masteryRowState(1)}, counts [${countsKey(main.masteryRowCounts(0))}] [${countsKey(main.masteryRowCounts(1))}], words "${words[0]}" / "${words[1]}", marks ${main.masteryMarkCount}`)
  for (let r = 0; r < 2; r++) {
    expect(main.masteryRowState(r), `${ctx}: row ${r} state`).toBe(expectRow[r])
    expect(countsKey(main.masteryRowCounts(r)), `${ctx}: row ${r} counts`).toBe(countsKey(expectCounts[r]))
    const word = expectRow[r] === "learned" ? "Learned" : expectRow[r] === "weak" ? `Review ${expectCounts[r].weak}` : `Not tried ${expectCounts[r].unseen}`
    expect(words[r], `${ctx}: row ${r} word drawn on the case`).toBe(word)
    expect(main.masteryRowLabels[r], `${ctx}: row ${r} word read-out`).toBe(word)
  }
  for (let i = 0; i < rows.length; i++) expect(main.masteryLetterState(i), `${ctx}: letter ${i} (row ${rows[i]}) state`).toBe(expectLetter[i])
  expect(main.masteryMarkCount, `${ctx}: one mark per letter`).toBe(rows.length)
  expect(mustFind("MasteryMarks").isEnabledInHierarchy, `${ctx}: the cell marks are drawn`).toBe(true)
}

function expectHidden(main: CaseLightMain, ctx: string): void {
  expect(main.masteryMapShown, `${ctx}: the map is hidden`).toBe(false)
  expect(main.masteryMarkCount, `${ctx}: no cell marks`).toBe(0)
  expect(drawnRowWord(0) + drawnRowWord(1), `${ctx}: no row words drawn`).toBe("")
  expect(main.isShowMyCaseOn, `${ctx}: the Show my case toggle reads off`).toBe(false)
}

@component
export class CaseLightMasteryMapScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    const n = main.pieceCount
    const model = new OwnModel(n)

    // Each letter's row, from the printed case (the hold letter's HOLD block is row 0).
    const rows: number[] = []
    let hold = -1
    for (let i = 0; i < n; i++) {
      const t = targetOf(main, i)
      if (t === HOLD) hold = i
      rows.push(rowOfTarget(t))
    }
    const inRow = (r: number) => rows.filter((x) => x === r).length
    log(`MASTERY rows of letters ${JSON.stringify(rows)}, hold letter ${hold}`)
    expect(hold >= 0 && rows[hold] === 0, "the hold letter is in row 0").toBe(true)
    expect(inRow(0) + inRow(1), "every letter is in a playable row").toBe(n)
    expect(inRow(1) >= 2, "row 1 has at least two letters (one to miss, one from memory)").toBe(true)

    // ── Layout at open: the toggle is inside the display and clear of its neighbours ───────
    const show = angleBox(roundedRectWorldCorners("ShowMyCaseButton"))
    const spare = displaySpare(show)
    log(`MASTERY Show my case at open: ${fmtBox(show)}, spare ${spare.toFixed(2)} deg`)
    expect(insideDisplay(show), `Show my case inside the display at open (${fmtBox(show)})`).toBe(true)
    expect(insidePreviewStill(show), `Show my case wholly inside a preview still at open (${fmtBox(show)})`).toBe(true)
    expect(anglesOverlap(show, show), "control: a box overlaps itself").toBe(true)
    const neighbours: {name: string; box: AngleBox}[] = [
      {name: "start hint (both lines and backing)", box: angleBox([...textWorldCorners("StartHint"), ...textWorldCorners("StartHintLine2"), ...roundedRectWorldCorners("StartHintBacking")])},
      {name: "Options button", box: angleBox(roundedRectWorldCorners("OptionsButton"))},
      {name: "Start practice button", box: angleBox(roundedRectWorldCorners("StartPracticeButton"))},
      {name: "Start recall button", box: angleBox(roundedRectWorldCorners("StartRecallButton"))},
      // Drill pace and Hide stand-in case: their places in the Options panel (drawn while it is open).
      {name: "Drill pace button", box: angleBox(roundedRectWorldCorners("DrillPaceButton"))},
      // The caption's place is its backing (its Text is switched off while the pace is off, and an off Text has no usable box).
      {name: "drill pace caption's place (shown only while the pace is on)", box: angleBox(roundedRectWorldCorners("PaceLabelBacking"))},
      {name: "Route 1 button", box: angleBox(roundedRectWorldCorners("RouteButton_1"))},
      {name: "Route 2 button", box: angleBox(roundedRectWorldCorners("RouteButton_2"))},
      {name: "Hide stand-in case toggle", box: angleBox(roundedRectWorldCorners("HideStandInButton"))},
      {name: "top letter", box: angleBox(drawnWorldBox(`Piece_${main.bundleOrder[0]}`).pts)},
      // Shown only after a recall pass (when Show my case is mostly used): their places at open.
      {name: "score card's place", box: angleBox(roundedRectWorldCorners("ResultBacking"))},
      {name: "Again button's place", box: angleBox(roundedRectWorldCorners("AgainButton"))},
      {name: "Done button's place", box: angleBox(roundedRectWorldCorners("DoneButton"))},
      {name: "Case check button's place", box: angleBox(roundedRectWorldCorners("CaseCheckButton"))},
    ]
    for (const nb of neighbours) {
      log(`MASTERY neighbour ${nb.name}: ${fmtBox(nb.box)}`)
      expect(anglesOverlap(show, nb.box), `Show my case clear of the ${nb.name}`).toBe(false)
    }

    // ── (a) Before any recall: a press shows both rows not tried ──────────────────────────
    expectHidden(main, "control at open")
    await ix.pressButton("ShowMyCaseButton")
    const unseenAll = rows.map(() => "unseen")
    expectMap(main, rows, ["unseen", "unseen"], [{learned: 0, weak: 0, unseen: inRow(0)}, {learned: 0, weak: 0, unseen: inRow(1)}], unseenAll, "a. before any recall")
    const shownLine = lastLogLine(main)
    log(`MASTERY log: ${shownLine}`)
    expect(shownLine.indexOf("event=mastery-map") >= 0 && shownLine.indexOf(`row0=unseen row0_learned=0 row0_weak=0 row0_unseen=${inRow(0)}`) >= 0 && shownLine.indexOf(`row1=unseen row1_learned=0 row1_weak=0 row1_unseen=${inRow(1)}`) >= 0, "a. one log line with each row's state and counts").toBe(true)

    // ── Start recall hides it ───────────────────────────────────────────────────────────
    await ix.pressButton("StartRecallButton")
    model.startPass()
    expect(main.mode, "a recall pass is running").toBe("recall")
    expectHidden(main, "d. Start recall pressed with the map shown")

    // ── (b) A press during the recall pass is ignored, and logged ─────────────────────────
    const ignoredBefore = main.masteryIgnoredPressCount
    await ix.pressButton("ShowMyCaseButton")
    expectHidden(main, "b. press during a recall pass")
    expect(main.masteryIgnoredPressCount, "b. the press is counted as ignored").toBe(ignoredBefore + 1)
    const ignoredLine = lastLogLine(main)
    log(`MASTERY log: ${ignoredLine}`)
    expect(ignoredLine.indexOf("mode=recall event=mastery-ignored reason=pass") >= 0, "b. the ignored press is logged").toBe(true)
    expect(main.mode, "b. the pass goes on").toBe("recall")

    // ── (c) One recall pass: every row-0 letter (the hold letter too) from memory; the row-1
    //        letter presented earliest is missed once and placed when it comes back; the rest
    //        of row 1 from memory ───────────────────────────────────────────────────────────
    let weak = -1
    const tally = await playRecallPass(ix, main, model, "mastery pass", (p, k) => {
      if (weak < 0 && k === 0 && rows[p] === 1) {
        weak = p
        return true
      }
      return false
    })
    expect(weak >= 0, "c. a row-1 letter was missed").toBe(true)
    expect(tally.helpedSet.size === 1 && tally.helpedSet.has(weak), `c. only letter ${weak} was helped in the pass`).toBe(true)
    expect(tally.fromMemory, "c. every other letter placed from memory").toBe(n - 1)
    expect(main.masteryMapShown, "c. control: the map does not show by itself after the pass").toBe(false)
    await ix.pressButton("ShowMyCaseButton")
    const letters = rows.map((_, i) => (i === weak ? "weak" : "learned"))
    expectMap(main, rows, ["learned", "weak"], [{learned: inRow(0), weak: 0, unseen: 0}, {learned: inRow(1) - 1, weak: 1, unseen: 0}], letters, "c. after the pass")
    expect(main.masteryLetterState(hold), "c. the hold letter, placed from memory, is learned").toBe("learned")
    expect(main.masteryRowState(1) !== "learned", "c. control: row 1 does not read learned (one of its letters was missed)").toBe(true)
    const afterLine = lastLogLine(main)
    log(`MASTERY log: ${afterLine}`)
    expect(afterLine.indexOf(`row0=learned row0_learned=${inRow(0)} row0_weak=0 row0_unseen=0`) >= 0 && afterLine.indexOf(`row1=weak row1_learned=${inRow(1) - 1} row1_weak=1 row1_unseen=0`) >= 0, "c. the log line carries both rows").toBe(true)

    // ── (d) A Start press hides it ─────────────────────────────────────────────────────────
    await ix.pressButton("StartRecallButton")
    model.startPass()
    expectHidden(main, "d. Start recall pressed after the pass")
    expect(main.masteryLetterState(weak), "d. hiding the map keeps the states").toBe("weak")
    await hideLeafOverlay()
  }
}
