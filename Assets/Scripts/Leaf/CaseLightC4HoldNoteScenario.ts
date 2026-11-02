// Owns: the LEAF check for done criterion 4 (the hold note and its plain gloss show only while the hold piece is in hand; the hold piece is accepted only in the HOLD block, whose label lights as -2).
// Talks to: CaseLightLeafSupport (real SIK/UIKit input and assertions), CaseLightMain read-only getters, Piece_n / HoldNoteText / HoldGlossText / HoldLabel / LabelHighlight scene objects by name.
// Must not: call CaseLightMain's test hooks or commands, or change product state except through real input.

/**
 * Done criterion 4 (devpost/design-brief.md):
 * "The held address shows "Hold: set this piece aside" only while that piece is in hand, and it
 * is only accepted in the HOLD block."
 * Product addition (builder, verified in CaseLightPieceCardUI.ts): a plain gloss "HOLD: mail kept
 * at the office" under the note, on the same show/hide rule as the note.
 *
 * Input: REAL (LEAF SIK interactor). Practice pass: pieces before the hold piece are placed for
 * real, the hold piece is dropped in an ordinary cell (refused) and in the HOLD block (accepted),
 * then the pieces after it are placed.
 * Positive control: every "note / gloss hidden" assertion is evaluated only after the same
 * detector has seen the note AND the gloss SHOWN on the hold piece. Pieces 0..4 come before the
 * hold piece in the practice order, so their in-hand state is recorded live and asserted after
 * the positive control; pieces 6 and 7 are asserted live, after it. Note and gloss are checked
 * together at every observation. The HOLD label is seen lit (-2) before "no label lit" is checked.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {CaseLightMain} from "../CaseLightMain"
import {hideLeafOverlay, CaseLightLeafInteractor, targetOf, expectGlowAt, expectLabelLit, expectNoLabelLit, fmt, log, mustFind, waitForReady, waitForTopGrabbable} from "./CaseLightLeafSupport"

const HOLD_TEXT = "Hold: set this piece aside"
const GLOSS_TEXT = "HOLD: mail kept at the office"

function cardText(piece: number, name: string): Text {
  const card = mustFind(`Piece_${piece}`).getChild(0)
  for (let i = 0; i < card.getChildrenCount(); i++) {
    const c = card.getChild(i)
    if (c.name === name) return c.getComponent("Component.Text") as Text
  }
  throw new Error(`${name} not found under Piece_${piece}`)
}

function noteText(piece: number): Text {
  return cardText(piece, "HoldNoteText")
}

function glossText(piece: number): Text {
  return cardText(piece, "HoldGlossText")
}

function holdIndex(main: CaseLightMain): number {
  for (let i = 0; i < main.pieceCount; i++) if (main.isHoldPiece(i)) return i
  return -1
}

interface NoteObservation {
  piece: number
  held: number
  noteGetter: boolean
  glossGetter: boolean
  ownNote: boolean
  ownGloss: boolean
  holdNote: boolean
  holdGloss: boolean
}

@component
export class CaseLightC4HoldNoteScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    const hold = holdIndex(main)
    expect(hold, "hold piece index in the sample bundle").toBe(5)
    expect(main.addressOf(hold), "hold piece address").toBe("238 ELM AVE")
    expect(targetOf(main, hold), "hold piece target is the HOLD block").toBe(-2)

    await ix.pressButton("StartPracticeButton")
    expect(main.mode, "practice started").toBe("practice")

    const observe = (p: number): NoteObservation => ({
      piece: p,
      held: main.heldPieceIndex,
      noteGetter: main.isHoldNoteVisible,
      glossGetter: main.isHoldGlossVisible,
      ownNote: noteText(p).getSceneObject().enabled,
      ownGloss: glossText(p).getSceneObject().enabled,
      holdNote: noteText(hold).getSceneObject().enabled,
      holdGloss: glossText(hold).getSceneObject().enabled,
    })

    // Pieces before the hold piece: placed for real; note and gloss state recorded while each is in hand.
    const before: NoteObservation[] = []
    let guard = 0
    while (main.topPieceIndex !== hold && guard++ < 12) {
      const p = await waitForTopGrabbable(main)
      await ix.dropTopPieceAtSlot(main, targetOf(main, p), {onHeld: () => before.push(observe(p))})
      expect(main.lastDropResult, `piece ${p} placed`).toBe("correct")
      expect(main.isPiecePlaced(p), `piece ${p} placed (placed detector)`).toBe(true)
    }
    expect(main.topPieceIndex, "hold piece reached the top").toBe(hold)
    await waitForTopGrabbable(main)
    const holdNoteBeforePickup = noteText(hold).getSceneObject().enabled
    const holdGlossBeforePickup = glossText(hold).getSceneObject().enabled

    // POSITIVE CONTROL: in hand, the note and the gloss show with the exact text, and (practice)
    // the HOLD block and its label light. Dropped in an ordinary cell: refused.
    const ordinary = 23
    let inHand: NoteObservation | null = null
    let noteStr = ""
    let glossStr = ""
    let litInHand = -9
    let noteAfter = true
    let glossAfter = true
    await ix.dropTopPieceAtSlot(main, ordinary, {
      onHeld: () => {
        inHand = observe(hold)
        noteStr = noteText(hold).text
        glossStr = glossText(hold).text
        litInHand = main.litLabelSlot
        expectLabelLit(main, -2, "hold piece in hand (practice lights the HOLD block)")
      },
      afterRelease: () => {
        noteAfter = noteText(hold).getSceneObject().enabled
        glossAfter = glossText(hold).getSceneObject().enabled
      },
    })
    const h = inHand as NoteObservation | null
    if (!h) throw new Error("in-hand observation of the hold piece missing")
    log(`C4 in hand: note=${h.ownNote} "${noteStr}" gloss=${h.ownGloss} "${glossStr}" litLabel=${litInHand}; ordinary drop result=${main.lastDropResult}`)
    expect(h.held, "hold piece in hand when observed").toBe(hold)
    expect(h.ownNote, "HoldNoteText enabled while the hold piece is in hand").toBe(true)
    expect(h.noteGetter, "isHoldNoteVisible while in hand").toBe(true)
    expect(noteStr, "hold note text").toBe(HOLD_TEXT)
    expect(h.ownGloss, "HoldGlossText enabled while the hold piece is in hand").toBe(true)
    expect(h.glossGetter, "isHoldGlossVisible while in hand").toBe(true)
    expect(glossStr, "hold gloss text").toBe(GLOSS_TEXT)

    // Negative checks, now that the detectors have seen the note and the gloss shown.
    expect(holdNoteBeforePickup, "hold note hidden while the hold piece sat on the bundle").toBe(false)
    expect(holdGlossBeforePickup, "hold gloss hidden while the hold piece sat on the bundle").toBe(false)
    expect(before.length, "pieces placed before the hold piece").toBe(hold)
    for (const o of before) {
      expect(o.held, `piece ${o.piece} was in hand when observed`).toBe(o.piece)
      expect(o.noteGetter, `no hold note while piece ${o.piece} was in hand (getter)`).toBe(false)
      expect(o.glossGetter, `no hold gloss while piece ${o.piece} was in hand (getter)`).toBe(false)
      expect(o.ownNote, `Piece_${o.piece} HoldNoteText disabled while in hand`).toBe(false)
      expect(o.ownGloss, `Piece_${o.piece} HoldGlossText disabled while in hand`).toBe(false)
      expect(o.holdNote, `Piece_${hold} HoldNoteText disabled while piece ${o.piece} was in hand`).toBe(false)
      expect(o.holdGloss, `Piece_${hold} HoldGlossText disabled while piece ${o.piece} was in hand`).toBe(false)
    }
    expect(noteAfter, "note hidden as soon as it is let go").toBe(false)
    expect(glossAfter, "gloss hidden as soon as it is let go").toBe(false)
    expect(main.isHoldNoteVisible, "isHoldNoteVisible after letting go").toBe(false)
    expect(main.isHoldGlossVisible, "isHoldGlossVisible after letting go").toBe(false)
    expect(main.lastDropSlot, "dropped over ordinary cell").toBe(ordinary)
    expect(main.lastDropResult, "hold piece refused in an ordinary cell").toBe("refused-hold")
    expect(main.isPiecePlaced(hold), "hold piece not accepted in an ordinary cell").toBe(false)
    expectGlowAt(main, -2, "HOLD block glows after the refusal")
    expectLabelLit(main, -2, "HOLD label lit after the refusal")

    // It comes back; note and gloss show again in hand; dropped in the HOLD block: accepted.
    const back = await waitForTopGrabbable(main)
    expect(back, "hold piece back on top").toBe(hold)
    expect(noteText(hold).getSceneObject().enabled, "note hidden while back in the bundle").toBe(false)
    expect(glossText(hold).getSceneObject().enabled, "gloss hidden while back in the bundle").toBe(false)
    const holdCell = 37
    let again: NoteObservation | null = null
    let pos = vec3.zero()
    await ix.dropTopPieceAtSlot(main, holdCell, {
      onHeld: () => {
        again = observe(hold)
      },
      afterRelease: () => {
        pos = mustFind(`Piece_${hold}`).getTransform().getWorldPosition()
      },
    })
    const a = again as NoteObservation | null
    if (!a) throw new Error("second in-hand observation missing")
    expect(a.ownNote && a.ownGloss, "note and gloss show again on the 2nd pick-up").toBe(true)
    expect(main.lastDropSlot, "dropped over HOLD cell").toBe(holdCell)
    expect(main.lastDropResult, "hold piece accepted in the HOLD block").toBe("correct")
    expect(main.isPiecePlaced(hold), "hold piece placed").toBe(true)
    expect(noteText(hold).getSceneObject().enabled, "note hidden once placed").toBe(false)
    expect(glossText(hold).getSceneObject().enabled, "gloss hidden once placed").toBe(false)
    expectNoLabelLit(main, "after the hold piece is accepted")
    const left = main.slotWorldPosition(36).x - 1.27
    const right = main.slotWorldPosition(39).x + 1.27
    log(`C4 hold piece placed at ${fmt(pos)}; HOLD block x ${left.toFixed(2)}..${right.toFixed(2)}`)
    expect(pos.x > left && pos.x < right, "placed inside the HOLD block").toBe(true)

    // Pieces after the hold piece: asserted live (after the positive control).
    while (main.mode === "practice") {
      const p = await waitForTopGrabbable(main)
      let o: NoteObservation | null = null
      await ix.dropTopPieceAtSlot(main, targetOf(main, p), {onHeld: () => (o = observe(p))})
      const ob = o as NoteObservation | null
      if (!ob) throw new Error(`observation for piece ${p} missing`)
      expect(ob.noteGetter || ob.glossGetter, `no hold note or gloss while piece ${p} is in hand (getters)`).toBe(false)
      expect(ob.ownNote || ob.ownGloss, `Piece_${p} note and gloss disabled while in hand`).toBe(false)
      expect(ob.holdNote || ob.holdGloss, `placed hold piece's note and gloss stay hidden while piece ${p} is in hand`).toBe(false)
      expect(main.lastDropResult, `piece ${p} placed`).toBe("correct")
    }
    log("C4 done")
    await hideLeafOverlay()
  }
}
