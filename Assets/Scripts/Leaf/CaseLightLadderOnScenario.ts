// Owns: the LEAF check for the practice cue ladder switched ON: rung changes (right practice placement +1 up to 2, practice miss or refused hold -1 down to 0, off-case release unchanged), the cue each rung shows, and recall with the ladder on (no cue before a drop, rungs unchanged).
// Talks to: CaseLightLeafSupport (real SIK/UIKit input, independent answers, ladder and glow assertions), CaseLightMain read-only getters (cueKind, ladderRungOf, glow, label, arrow), LadderGlow / SlotGlow by name.
// Must not: call CaseLightMain's test hooks or commands, or change product state except through real input; the one exception is practiceLadder, switched on here and put back to false in a finally.

/**
 * Builder feature (verified in CaseLightMain.ts / CaseLightHighlight.ts): with practiceLadder on,
 * each address has a rung (0 slot glow, 1 its playable row glows, 2 a band over both playable
 * rows). A right placement in practice moves it up one (top 2); a practice miss or a refused hold
 * drop moves it down one (bottom 0); an off-case release leaves it. Rungs 1 and 2 show no exact
 * slot glow, no label highlight and no edge arrow. Recall never shows a ladder cue.
 *
 * Input: REAL (LEAF SIK interactor). Three practice passes, then one recall pass, all with real
 * grabs, drags and drops. Expected rungs are counted here from the actions, not read back.
 * Positive controls: rung 0 shows the slot glow, its lit label and (slot 9 is partly outside the
 * display) the edge arrow for piece 0 before rung 1 is asserted to show none of them for the same
 * piece; the row and band cues are seen ON (LadderGlow enabled, covering the target) before recall
 * asserts LadderGlow off.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {CaseLightMain} from "../CaseLightMain"
import {hideLeafOverlay, 
  CaseLightLeafInteractor,
  dropSlotFor,
  expectArrow,
  expectGlowAt,
  expectLabelLit,
  expectNoGlow,
  expectNoLabelLit,
  expectNoRegion,
  expectRowCue,
  expectShelfCue,
  log,
  mustFind,
  neighbourSlot,
  rungs,
  targetOf,
  targetOutsideDisplay,
  waitForReady,
  waitForTopGrabbable,
} from "./CaseLightLeafSupport"

type Act = "right" | "miss" | "off" | "hold-wrong"

interface Step {
  piece: number
  rung: number
  act: Act
}

const RESULT: Record<Act, string> = {right: "correct", miss: "miss", off: "off-case", "hold-wrong": "refused-hold"}

/** The rung after an action, counted by the test from the ladder rule (not read from the Lens). */
function nextRung(r: number, act: Act): number {
  if (act === "right") return Math.min(2, r + 1)
  if (act === "miss" || act === "hold-wrong") return Math.max(0, r - 1)
  return r
}

/** The practice cue for this rung is on the case, and nothing that gives the exact cell away is on for rungs 1 and 2. */
function expectCueForRung(main: CaseLightMain, target: number, rung: number, ctx: string): void {
  if (rung === 0) {
    expectGlowAt(main, target, ctx)
    expect(main.cueKind, `${ctx}: cueKind`).toBe("slot")
    expectLabelLit(main, target, ctx)
    expectArrow(main, targetOutsideDisplay(main, target), ctx)
    expectNoRegion(main, ctx)
  } else if (rung === 1) {
    expectRowCue(main, target, ctx)
  } else {
    expectShelfCue(main, target, ctx)
  }
}

@component
export class CaseLightLadderOnScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    expect(main.isPracticeLadderOn, "ladder off before the test switches it on").toBe(false)
    const expected = rungs(main).map(() => 0)
    expect(JSON.stringify(rungs(main)), "every rung starts at 0").toBe(JSON.stringify(expected))

    let arrowSeenAtRung0 = false
    let rowSeen = 0
    let shelfSeen = 0

    const play = async (pass: string, step: Step): Promise<void> => {
      const p = await waitForTopGrabbable(main)
      expect(p, `${pass}: piece on top`).toBe(step.piece)
      const t = targetOf(main, p)
      const ctx = `${pass}, piece ${p} (target ${t}) at rung ${step.rung}, ${step.act}`
      expect(main.ladderRungOf(p), `${ctx}: rung before the grab`).toBe(expected[p])
      expect(expected[p], `${ctx}: planned rung`).toBe(step.rung)
      const onHeld = () => {
        expectCueForRung(main, t, step.rung, ctx)
        if (step.rung === 0 && main.isEdgeArrowVisible) arrowSeenAtRung0 = true
        if (step.rung === 1) rowSeen++
        if (step.rung === 2) shelfSeen++
      }
      // The rung cue holds for the whole time the letter is in hand.
      const onFrame = () => {
        const want = step.rung === 0 ? "slot" : step.rung === 1 ? "row" : "shelf"
        expect(main.cueKind, `${ctx}: cueKind while in hand`).toBe(want)
        expect(mustFind("LadderGlow").enabled, `${ctx}: LadderGlow while in hand`).toBe(step.rung > 0)
        expect(mustFind("SlotGlow").enabled, `${ctx}: SlotGlow while in hand`).toBe(step.rung === 0)
        if (step.rung > 0) expect(main.isEdgeArrowVisible, `${ctx}: no edge arrow while in hand`).toBe(false)
      }
      if (step.act === "off") {
        await ix.releaseTopPieceInPlace(main, {onHeld, onFrame})
      } else {
        const slot = step.act === "right" ? dropSlotFor(main, p) : step.act === "miss" ? neighbourSlot(t) : 23
        await ix.dropTopPieceAtSlot(main, slot, {onHeld, onFrame})
      }
      expect(main.lastDropResult, `${ctx}: drop result`).toBe(RESULT[step.act])
      expected[p] = nextRung(step.rung, step.act)
      expect(JSON.stringify(rungs(main)), `${ctx}: rungs after (only piece ${p} may change)`).toBe(JSON.stringify(expected))
      expectNoRegion(main, `${ctx}: after letting go`)
    }

    try {
      main.practiceLadder = true
      expect(main.isPracticeLadderOn, "ladder on").toBe(true)
      expect(targetOutsideDisplay(main, 9), "slot 9 partly outside the display (arrow positive control)").toBe(true)

      // Pass 1: everything at rung 0. A miss and a refused hold at rung 0 stay at 0 (bottom).
      await ix.pressButton("StartPracticeButton")
      const pass1: Step[] = [
        {piece: 0, rung: 0, act: "right"},
        {piece: 1, rung: 0, act: "miss"},
        {piece: 1, rung: 0, act: "right"},
        {piece: 2, rung: 0, act: "right"},
        {piece: 3, rung: 0, act: "right"},
        {piece: 4, rung: 0, act: "right"},
        {piece: 5, rung: 0, act: "hold-wrong"},
        {piece: 5, rung: 0, act: "right"},
        {piece: 6, rung: 0, act: "right"},
        {piece: 7, rung: 0, act: "right"},
      ]
      for (const s of pass1) await play("practice pass 1", s)
      expect(main.mode, "pass 1 finished").toBe("idle")
      expect(arrowSeenAtRung0, "rung 0 showed the edge arrow for piece 0 (positive control)").toBe(true)
      log(`LADDER-ON after pass 1 rungs ${JSON.stringify(rungs(main))}`)

      // Pass 2: rung 1 row cue. Off-case leaves it; a miss and a refused hold drop it to 0.
      await ix.pressButton("StartPracticeButton")
      const pass2: Step[] = [
        {piece: 0, rung: 1, act: "off"},
        {piece: 0, rung: 1, act: "right"},
        {piece: 1, rung: 1, act: "right"},
        {piece: 2, rung: 1, act: "miss"},
        {piece: 2, rung: 0, act: "right"},
        {piece: 3, rung: 1, act: "right"},
        {piece: 4, rung: 1, act: "right"},
        {piece: 5, rung: 1, act: "hold-wrong"},
        {piece: 5, rung: 0, act: "right"},
        {piece: 6, rung: 1, act: "right"},
        {piece: 7, rung: 1, act: "right"},
      ]
      for (const s of pass2) await play("practice pass 2", s)
      log(`LADDER-ON after pass 2 rungs ${JSON.stringify(rungs(main))}`)

      // Pass 3: rung 2 band cue; a right placement at 2 stays at 2 (top); a miss at 2 drops to 1.
      await ix.pressButton("StartPracticeButton")
      const pass3: Step[] = [
        {piece: 0, rung: 2, act: "right"},
        {piece: 1, rung: 2, act: "miss"},
        {piece: 1, rung: 1, act: "right"},
        {piece: 2, rung: 1, act: "right"},
        {piece: 3, rung: 2, act: "right"},
        {piece: 4, rung: 2, act: "right"},
        {piece: 5, rung: 1, act: "right"},
        {piece: 6, rung: 2, act: "right"},
        {piece: 7, rung: 2, act: "right"},
      ]
      for (const s of pass3) await play("practice pass 3", s)
      expect(rowSeen > 0 && shelfSeen > 0, `row cue (${rowSeen}) and band cue (${shelfSeen}) both seen ON (positive control)`).toBe(true)
      log(`LADDER-ON after pass 3 rungs ${JSON.stringify(rungs(main))}, row cues ${rowSeen}, band cues ${shelfSeen}`)

      // Recall with the ladder still on: no cue of any kind before a drop; rungs do not move.
      const before = JSON.stringify(rungs(main))
      await ix.pressButton("StartRecallButton")
      expect(main.mode, "recall started").toBe("recall")
      let opening = true
      while (main.mode === "recall") {
        const p = await waitForTopGrabbable(main)
        const t = targetOf(main, p)
        const ctx = `recall, piece ${p} (target ${t})`
        const noCue = (where: string) => {
          expect(main.cueKind, `${ctx} ${where}: cueKind`).toBe("none")
          expect(main.highlights.regionCue, `${ctx} ${where}: regionCue`).toBe("none")
          expect(mustFind("LadderGlow").enabled, `${ctx} ${where}: LadderGlow`).toBe(false)
          expect(mustFind("SlotGlow").enabled, `${ctx} ${where}: SlotGlow`).toBe(false)
          expect(main.isEdgeArrowVisible, `${ctx} ${where}: edge arrow`).toBe(false)
        }
        // Opening recall drop: a wrong cell (cell 23 for the hold piece), so a miss happens with the ladder on.
        const drop = opening ? (t === -2 ? 23 : neighbourSlot(t)) : dropSlotFor(main, p)
        await ix.dropTopPieceAtSlot(main, drop, {
          onHeld: () => {
            noCue("in hand")
            expectNoGlow(main, `${ctx} in hand`)
            expectNoLabelLit(main, `${ctx} in hand`)
            expectArrow(main, false, `${ctx} in hand`)
          },
          onFrame: () => noCue("moving"),
          beforeRelease: () => noCue("just before the drop"),
        })
        expect(JSON.stringify(rungs(main)), `${ctx}: rungs unchanged by a recall drop (${main.lastDropResult})`).toBe(before)
        if (opening) {
          opening = false
          expect(main.lastDropResult === "miss" || main.lastDropResult === "refused-hold", `${ctx}: opening drop is a miss`).toBe(true)
          // After a recall miss the answer lights (criterion 3); still no ladder cue on the next grab.
          await ix.dropTopPieceAtSlot(main, dropSlotFor(main, p), {
            onHeld: () => {
              expectGlowAt(main, t, `${ctx} re-grab after the miss`)
              expectNoRegion(main, `${ctx} re-grab after the miss`)
            },
          })
          expect(main.lastDropResult, `${ctx}: placed after the miss`).toBe("correct")
          expect(JSON.stringify(rungs(main)), `${ctx}: rungs unchanged after the recall placement`).toBe(before)
        } else {
          expect(main.lastDropResult, `${ctx}: placed`).toBe("correct")
        }
      }
      expect(JSON.stringify(rungs(main)), "rungs unchanged across the recall pass").toBe(before)
      log(`LADDER-ON recall done, rungs ${JSON.stringify(rungs(main))}`)
    } finally {
      main.practiceLadder = false
    }
    expect(main.isPracticeLadderOn, "ladder restored to off").toBe(false)
    log("LADDER-ON done")
    await hideLeafOverlay()
  }
}
