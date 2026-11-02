// Owns: the LEAF check that every sample address, and the hold piece's note and gloss, fit inside the letter's print width as rendered, measured in the letter's own frame.
// Talks to: CaseLightLeafSupport (real SIK/UIKit input, letterDims, textBoxOnLetter, independent answers), CaseLightMain read-only getters (letter size, print width, addresses, hold piece).
// Must not: call CaseLightMain's test hooks or commands, or change product state except through real input.

/**
 * Builder change (verified in CaseLightBundle.ts / CaseLightPieceCardUI.ts): the letter is a scaled
 * envelope with a print width (letter minus a margin each side), and every card text is laid out
 * in that width with Overflow (it never shrinks), so a long address can run past it.
 *
 * Input: REAL (LEAF SIK interactor). One practice pass; each letter is measured while in hand,
 * when its texts are shown. The rendered box is each Text's characters box (getBoundingBox) put
 * through its transform into the letter's frame (not Text.size, not the layout rectangle). The
 * Text mesh box is logged too: it is wider by the glyph quads' margin, a fixed padding per font
 * size that is the same for every string, so it is not ink.
 * Positive controls: the fit test is shown up front to REJECT something known to be too wide (the
 * drawn letter itself is wider than the print width), and every measured box must be non-empty.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {CaseLightLeafInteractor, cardText, dropSlotFor, fmt, hideLeafOverlay, letterDims, log, textBoxOnLetter, waitForReady, waitForTopGrabbable} from "./CaseLightLeafSupport"

interface Measured {
  piece: number
  text: string
  name: string
  lo: vec3
  hi: vec3
  shown: boolean
  /** The Text mesh's box in the letter frame (wider than the ink by the glyph quads' margin). */
  mesh: string
}

@component
export class CaseLightPrintFitScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    const dims = letterDims(main)
    const half = dims.print / 2
    const fits = (lo: vec3, hi: vec3) => lo.x >= -half && hi.x <= half && lo.y >= -dims.h / 2 && hi.y <= dims.h / 2

    // Positive control: the same test rejects the drawn letter (dims.w is the letter's drawn width).
    const letterLo = new vec3(-dims.w / 2, -dims.h / 2, 0)
    const letterHi = new vec3(dims.w / 2, dims.h / 2, 0)
    expect(fits(letterLo, letterHi), `fit test rejects the ${dims.w} cm letter against the ${dims.print} cm print width (positive control)`).toBe(false)

    const seen: Measured[] = []
    await ix.pressButton("StartPracticeButton")
    expect(main.mode, "practice started").toBe("practice")
    while (main.mode === "practice") {
      const p = await waitForTopGrabbable(main)
      const names = main.isHoldPiece(p) ? ["AddressText", "HoldNoteText", "HoldGlossText"] : ["AddressText"]
      await ix.dropTopPieceAtSlot(main, dropSlotFor(main, p), {
        onHeld: () => {
          for (const name of names) {
            const b = textBoxOnLetter(p, name)
            const t = cardText(p, name)
            seen.push({piece: p, text: t.text, name, lo: b.lo, hi: b.hi, shown: t.getSceneObject().isEnabledInHierarchy, mesh: `${b.meshLo.x.toFixed(2)}..${b.meshHi.x.toFixed(2)} (w ${(b.meshHi.x - b.meshLo.x).toFixed(2)})`})
          }
        },
      })
      expect(main.lastDropResult, `piece ${p} placed`).toBe("correct")
    }

    let widest = 0
    for (const m of seen) {
      const w = m.hi.x - m.lo.x
      widest = Math.max(widest, w)
      log(`PRINT-FIT piece ${m.piece} ${m.name} "${m.text}" box ${fmt(m.lo)}..${fmt(m.hi)} (w ${w.toFixed(2)} of ${dims.print} cm)${fits(m.lo, m.hi) ? "" : " OUTSIDE"}; mesh box x ${m.mesh}`)
    }
    log(`PRINT-FIT widest ${widest.toFixed(2)} cm against ${dims.print} cm (letter ${dims.w} x ${dims.h} cm, capitals requested ${main.addressCapHeightCm} cm)`)
    for (const m of seen) {
      const w = m.hi.x - m.lo.x
      expect(m.shown, `piece ${m.piece} ${m.name} shown while in hand`).toBe(true)
      expect(m.text.length > 0 && w > 0.5, `piece ${m.piece} ${m.name} has a real rendered box (w ${w.toFixed(2)} cm)`).toBe(true)
      expect(fits(m.lo, m.hi), `piece ${m.piece} ${m.name} "${m.text}" inside the ${dims.print} cm print width (x ${m.lo.x.toFixed(2)}..${m.hi.x.toFixed(2)}, y ${m.lo.y.toFixed(2)}..${m.hi.y.toFixed(2)})`).toBe(true)
    }
    expect(seen.filter((m) => m.name === "AddressText").length, "all 8 sample addresses measured").toBe(main.pieceCount)
    expect(seen.filter((m) => m.name !== "AddressText").length, "hold note and gloss measured").toBe(2)
    log(`PRINT-FIT done: widest ${widest.toFixed(2)} cm inside ${dims.print} cm (letter ${dims.w} x ${dims.h} cm)`)
    await hideLeafOverlay()
  }
}
