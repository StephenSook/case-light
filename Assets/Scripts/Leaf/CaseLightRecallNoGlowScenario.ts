// Owns: the LEAF per-frame invariant of recall (queue item 8): sampled on every frame from just before Start recall to the pass end, nothing is drawn as a cue (answer glow, ladder glow, lit cell label, label highlight, edge arrow, reminder card) until a miss; on a miss exactly the right cell glows (with its note card when it has one); from the next pick-up on (the missed letter's own return included) nothing is drawn again until the next miss.
// Talks to: CaseLightLeafSupport (real SIK grabs and drops, real UIKit presses and slot pinches, independent printed-label answers), CaseLightNotesSupport (pin a note), SIK InteractableManipulation events on the letters (pick-up frames), the drawn objects SlotGlow / LadderGlow / LabelHighlight / EdgeArrow / Label_n / HoldLabel / Note_<slot>; CaseLightMain getters only for orchestration (mode, topPieceIndex, isResultVisible, slotWorldPosition geometry).
// Must not: read litSlotIndex, cueKind or any other product state for the invariant, call product commands or test hooks, or change product state except through real input.

/**
 * Sampler: this scenario's own LateUpdateEvent records, on every frame, what is DRAWN: SlotGlow
 * enabled and the cell it sits on (nearest cell centre within 0.5 cm), LadderGlow enabled, every
 * cell label's and the HOLD label's rendered colour against the colour recorded before the pass,
 * LabelHighlight, EdgeArrow, and the reminder card on the answer slot. Frame marks: the frame the
 * test lets go of a letter over a wrong cell (miss), and the frame SIK starts manipulating a
 * letter (pick-up). Rules per frame:
 *   before the earliest miss, and from any pick-up after a miss until the next miss: nothing drawn;
 *   from a miss release until the next pick-up: either still dark for at most 3 frames while the
 *     release is processed, then exactly the right cell glowing, only its label lit, the ladder
 *     glow off, and the card shown exactly when that slot carries the note.
 * The pass (pass 0, order from the brief): the opening letter is missed (it carries the note), the
 * last letter left is missed too (it comes straight back: option A, its own pick-up must put the
 * light out). Floor: at least 300 frames sampled.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {InteractableManipulation} from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import {recallOrder} from "../CaseLightRoute"
import {CaseLightLeafInteractor, answerFor, dropSlotFor, hideLeafOverlay, labelText, log, mustFind, neighbourSlot, waitForReady, waitForTopGrabbable, waitUntil} from "./CaseLightLeafSupport"
import {REMINDERS, pick, pinchSlotOpens} from "./CaseLightNotesSupport"

const MIN_FRAMES = 300
const SETTLE_FRAMES = 3
/** Drags move at most this far per frame, so every drag spans many sampled frames. */
const SLOW_STEP_CM = 1.2

interface Drawn {
  frame: number
  glow: boolean
  glowCell: number
  region: boolean
  lit: string[]
  highlight: boolean
  arrow: boolean
  card: boolean
}

function sameColour(a: vec4, b: vec4): boolean {
  return Math.abs(a.x - b.x) < 1e-3 && Math.abs(a.y - b.y) < 1e-3 && Math.abs(a.z - b.z) < 1e-3 && Math.abs(a.w - b.w) < 1e-3
}

@component
export class CaseLightRecallNoGlowScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    const n = main.pieceCount

    // The opening letter of recall pass 0 (the brief's order) gets a reminder note on its answer
    // (real slot pinch and chooser press, between passes).
    const opener = recallOrder(n, 0)[0]
    const noteSlot = answerFor(main, opener).slot
    expect(noteSlot >= 0, `the opening letter ${opener} has a separation (${noteSlot}), so it can carry a note`).toBe(true)
    await ix.pressButton("VeteranModeButton")
    await waitUntil(() => main.veteranMode, 1000, "Veteran mode on")
    await pinchSlotOpens(ix, main, noteSlot, "note on the opening letter's answer")
    await pick(ix, main, REMINDERS[0], "note on the opening letter's answer")
    await ix.pressButton("VeteranModeButton")
    await waitUntil(() => !main.veteranMode, 1000, "Veteran mode off")
    await sleep(200)

    // Drawn objects, found once.
    const glow = mustFind("SlotGlow")
    const region = mustFind("LadderGlow")
    const highlight = mustFind("LabelHighlight")
    const arrow = mustFind("EdgeArrow")
    const card = mustFind(`Note_${noteSlot}`)
    const labels: {name: string; t: Text; base: vec4}[] = []
    for (let s = 0; s < 80; s++) {
      const t = labelText(s)
      if (t) labels.push({name: `Label_${s}`, t, base: t.textFill.color})
    }
    const hold = findSceneObjectByName("HoldLabel")
    if (hold) {
      const t = hold.getComponent("Component.Text") as Text
      labels.push({name: "HoldLabel", t, base: t.textFill.color})
    }
    expect(labels.length, "76 labels watched (75 cells and HOLD)").toBe(76)
    const centres: {cell: number; p: vec3}[] = []
    for (let s = 0; s < 80; s++) centres.push({cell: s, p: main.slotWorldPosition(s)})
    centres.push({cell: -2, p: main.slotWorldPosition(-2)})
    const labelOf = (cell: number) => (cell === -2 ? "HoldLabel" : `Label_${cell}`)

    // Frame marks: pick-ups (SIK manipulation start on any letter) and miss releases. Both happen
    // in a frame's update, before that frame's LateUpdate sample, so they belong to frame + 1.
    let frame = 0
    const pickups: number[] = []
    const misses: {frame: number; cell: number}[] = []
    const offs: (() => void)[] = []
    for (let i = 0; i < n; i++) {
      const m = mustFind(`Piece_${i}`).getComponent(InteractableManipulation.getTypeName()) as InteractableManipulation
      const cb = () => pickups.push(frame + 1)
      m.onManipulationStart.add(cb)
      offs.push(() => m.onManipulationStart.remove(cb))
    }

    // The sampler.
    const samples: Drawn[] = []
    let sampling = false
    const ev = this.createEvent("LateUpdateEvent")
    ev.bind(() => {
      frame++
      if (!sampling) return
      let glowCell = -1
      const on = glow.isEnabledInHierarchy
      if (on) {
        const gp = glow.getTransform().getWorldPosition()
        let best = 1e9
        for (const c of centres) {
          const d = c.p.distance(gp)
          if (d < best) {
            best = d
            glowCell = d < 0.5 ? c.cell : -99
          }
        }
      }
      const lit: string[] = []
      for (const l of labels) if (!sameColour(l.t.textFill.color, l.base)) lit.push(l.name)
      samples.push({frame, glow: on, glowCell, region: region.isEnabledInHierarchy, lit, highlight: highlight.isEnabledInHierarchy, arrow: arrow.isEnabledInHierarchy, card: card.isEnabledInHierarchy})
    })

    try {
      // Recall pass 0, sampled from the frame before Start recall is pressed.
      sampling = true
      const startFrame = frame
      await ix.pressButton("StartRecallButton")
      expect(main.mode, "recall pass running").toBe("recall")
      const pOpen = main.topPieceIndex
      const missPlan = new Set<number>()
      let lastMissed = false
      while (main.mode === "recall") {
        const p = await waitForTopGrabbable(main)
        const a = answerFor(main, p)
        const remaining = main.currentPassOrder.length
        const missNow = (p === pOpen && !missPlan.has(p)) || (remaining === 1 && !lastMissed && !missPlan.has(p))
        if (missNow) {
          const wrong = a.slot === -2 ? 23 : neighbourSlot(a.slot)
          await ix.dropTopPieceAtSlot(main, wrong, {maxStepCm: SLOW_STEP_CM, beforeRelease: () => misses.push({frame: frame + 1, cell: a.slot})})
          expect(main.lastDropResult === "miss" || main.lastDropResult === "refused-hold", `letter ${p} missed`).toBe(true)
          missPlan.add(p)
          if (remaining === 1) lastMissed = true
          continue
        }
        await ix.dropTopPieceAtSlot(main, dropSlotFor(main, p), {maxStepCm: SLOW_STEP_CM})
        expect(main.lastDropResult, `letter ${p} placed`).toBe("correct")
      }
      await waitUntil(() => main.isResultVisible, 2000, "pass end: card shown")
      sampling = false
      expect(lastMissed && misses.length === 2, `two misses: the opening letter and the last letter left (${misses.length})`).toBe(true)
      expect(pOpen === opener, `the noted letter ${opener} opened this pass too`).toBe(true)

      // ── Evaluate every frame ────────────────────────────────────────────────────────────
      const bad: string[] = []
      let glowSeen = [0, 0]
      let cardSeen = 0
      let darkFrames = 0
      for (const s of samples) {
        let lastMiss = -1
        for (let k = 0; k < misses.length; k++) if (misses[k].frame <= s.frame) lastMiss = k
        const missFrame = lastMiss >= 0 ? misses[lastMiss].frame : -1
        const pickedAfter = lastMiss >= 0 && pickups.some((f) => f > missFrame && f <= s.frame)
        const dark = !s.glow && !s.region && s.lit.length === 0 && !s.highlight && !s.arrow && !s.card
        if (lastMiss < 0 || pickedAfter) {
          if (dark) darkFrames++
          else bad.push(`frame ${s.frame - startFrame}: drawn with no miss to answer (${lastMiss < 0 ? "before the earliest miss" : `after the pick-up that followed miss ${lastMiss + 1}`}): glow ${s.glow} (cell ${s.glowCell}), ladder ${s.region}, labels lit [${s.lit}], highlight ${s.highlight}, arrow ${s.arrow}, card ${s.card}`)
          continue
        }
        const cell = misses[lastMiss].cell
        if (dark && s.frame - missFrame <= SETTLE_FRAMES) continue
        const want = s.glow && s.glowCell === cell && !s.region && s.lit.length === 1 && s.lit[0] === labelOf(cell) && s.card === (cell === noteSlot)
        if (want) {
          glowSeen[lastMiss]++
          if (s.card) cardSeen++
        } else bad.push(`frame ${s.frame - startFrame}: after miss ${lastMiss + 1} (answer ${cell}): glow ${s.glow} (cell ${s.glowCell}), ladder ${s.region}, labels lit [${s.lit}], card ${s.card}`)
      }
      log(`NOGLOW sampled ${samples.length} frames (pass frames ${samples.length ? samples[samples.length - 1].frame - startFrame : 0}); dark frames ${darkFrames}; miss 1 (cell ${misses[0]?.cell}) glow on ${glowSeen[0]} frames, card on ${cardSeen}; miss 2 (cell ${misses[1]?.cell}) glow on ${glowSeen[1]} frames; pick-ups ${pickups.length}; violations ${bad.length}${bad.length ? `: ${bad.slice(0, 3).join(" | ")}` : ""}`)
      expect(samples.length >= MIN_FRAMES, `d. at least ${MIN_FRAMES} frames sampled (${samples.length})`).toBe(true)
      expect(pickups.length >= n + 2, `pick-up frames recorded for every grab (${pickups.length})`).toBe(true)
      expect(bad.length, `a/c. frames drawn outside a miss window${bad.length ? `, the earliest: ${bad[0]}` : ""}`).toBe(0)
      expect(glowSeen[0] > 0 && glowSeen[1] > 0, `b. control: the right cell seen glowing after each miss (${glowSeen[0]}, ${glowSeen[1]} frames)`).toBe(true)
      expect(cardSeen > 0, `b. control: the note card seen on the noted answer after its miss (${cardSeen} frames)`).toBe(true)
    } finally {
      sampling = false
      ev.enabled = false
      offs.forEach((o) => o())
    }
    await hideLeafOverlay()
  }
}
