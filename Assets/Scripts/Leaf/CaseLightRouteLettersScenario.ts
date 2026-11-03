// Owns: the LEAF check that on both routes every practice letter is accepted in its own slot (from the data file and the printed labels), the hold letter is refused in a cell and accepted only in the HOLD block, and every Route 2 letter's print fits the 12.0 cm print width.
// Talks to: CaseLightLeafSupport (real SIK grabs and drops, real UIKit presses, independent printed-label answers, letter text boxes), CaseLightRouteSupport and CaseLightRouteFixture (the data files as expectations), CaseLightMain read-only getters.
// Must not: import CaseLightRoute's tables or functions, call product commands or test hooks, or change product state except through real input.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {CaseLightMain} from "../CaseLightMain"
import {CaseLightLeafInteractor, answerFor, cardText, fmt, hideLeafOverlay, letterDims, log, textBoxOnLetter, waitForReady, waitForTopGrabbable, waitUntil} from "./CaseLightLeafSupport"
import {fixtureAnswer, switchRoute} from "./CaseLightRouteSupport"

/** One practice pass on today's route with every letter dropped in the slot the data gives it; the hold letter refused in cell 23 before it is accepted in the HOLD block. */
async function practicePass(ix: CaseLightLeafInteractor, main: CaseLightMain, route: number, measure: boolean): Promise<{placed: number; holdRefused: boolean; widest: number}> {
  await ix.pressButton("StartPracticeButton")
  expect(main.mode, `Route ${route}: practice started`).toBe("practice")
  const half = letterDims(main).print / 2
  let placed = 0
  let holdRefused = false
  let widest = 0
  while (main.mode === "practice") {
    const p = await waitForTopGrabbable(main)
    const address = cardText(p, "AddressText").text
    const want = fixtureAnswer(route, address)
    const printed = answerFor(main, p)
    expect(printed.slot, `Route ${route}: "${address}" answer from the printed labels = the data's slot ${want.slot}`).toBe(want.slot)
    const onHeld = () => {
      if (!measure) return
      const names = want.slot === -2 ? ["AddressText", "HoldNoteText", "HoldGlossText"] : ["AddressText"]
      for (const name of names) {
        const b = textBoxOnLetter(p, name)
        widest = Math.max(widest, b.hi.x - b.lo.x)
        expect(b.lo.x >= -half && b.hi.x <= half, `Route ${route}: letter ${p} ${name} "${cardText(p, name).text}" inside the ${2 * half} cm print width (x ${b.lo.x.toFixed(2)}..${b.hi.x.toFixed(2)})`).toBe(true)
      }
    }
    if (want.slot === -2) {
      await ix.dropTopPieceAtSlot(main, 23, {onHeld})
      expect(main.lastDropResult, `Route ${route}: hold letter "${address}" refused in cell 23`).toBe("refused-hold")
      expect(main.isPiecePlaced(p), `Route ${route}: hold letter not placed in a cell`).toBe(false)
      holdRefused = true
      expect(await waitForTopGrabbable(main), `Route ${route}: hold letter back on top (practice)`).toBe(p)
      await ix.dropTopPieceAtSlot(main, 37)
      expect(main.lastDropResult, `Route ${route}: hold letter accepted in the HOLD block`).toBe("correct")
    } else {
      await ix.dropTopPieceAtSlot(main, want.slot, {onHeld})
      expect(main.lastDropResult, `Route ${route}: "${address}" accepted in slot ${want.slot}`).toBe("correct")
    }
    expect(main.isPiecePlaced(p), `Route ${route}: letter ${p} placed`).toBe(true)
    placed++
  }
  return {placed, holdRefused, widest}
}

@component
export class CaseLightRouteLettersScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    const n = main.pieceCount

    const r1 = await practicePass(ix, main, 1, false)
    expect(r1.placed === n && r1.holdRefused, `Route 1: all ${n} letters placed, the hold letter refused once`).toBe(true)
    await waitUntil(() => main.mode === "idle" && main.isRoutePickerEnabled, 2000, "idle after the Route 1 practice pass")

    await switchRoute(ix, main, 2, "to Route 2")
    // Control for the print-width test: it rejects the drawn letter itself.
    const dims = letterDims(main)
    expect(dims.w > dims.print, `control: the ${dims.w} cm letter is wider than the ${dims.print} cm print width`).toBe(true)
    expect(dims.print, "print width 12.0 cm").toBe(12)
    const r2 = await practicePass(ix, main, 2, true)
    expect(r2.placed === n && r2.holdRefused, `Route 2: all ${n} letters placed, the hold letter refused once`).toBe(true)
    log(`ROUTE letters: Route 1 ${r1.placed} placed, Route 2 ${r2.placed} placed; widest Route 2 print ${r2.widest.toFixed(2)} of ${dims.print} cm; hold ${main.holdAddress} at ${fmt(main.slotWorldPosition(-2))}`)
    await hideLeafOverlay()
  }
}
