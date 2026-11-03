// Owns: the LEAF check for done criterion 3 (recall: dark before the drop while the snap outline follows the letter across cells; a miss lights the right separation and its label, with the arrow if needed, and counts that piece as helped).
// Talks to: CaseLightLeafSupport (real SIK/UIKit input, independent display-fit maths, assertions), CaseLightMain read-only getters, SnapOutline / LabelHighlight by name.
// Must not: call CaseLightMain's test hooks or commands, or change product state except through real input.

/**
 * Done criterion 3 (devpost/design-brief.md):
 * "In recall, nothing glows before the drop; a wrong drop lights the right separation (with the
 * arrow if needed) and that piece is counted as helped."
 *
 * Input: REAL (LEAF SIK interactor) for Start practice, Start recall and every grab and drop.
 * Counts are checked as deltas from the values read at the start.
 * Positive control: the scenario opens by proving, in practice, that the glow and the arrow DO show
 * for a held piece, then switches to recall and asserts the case stays dark.
 * Snap outline: each missed letter is held over a wrong cell, then the CORRECT cell, then the
 * adjacent wrong cell, and let go there. On every in-hand frame the answer glow, its label
 * (including every label's rendered colour) and the arrow stay off. At each cell
 * snapPreviewSlotIndex names that cell and SnapOutline sits on it (positive control: it shows and
 * moves), with the same mesh, vertex colours, size and scale over the correct cell as over a wrong one.
 * Answers come from the printed case (targetOf), checked against the product's targetSlotOf.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {CaseLightMain} from "../CaseLightMain"
import {hideLeafOverlay, 
  CaseLightLeafInteractor,
  targetOf,
  expectArrow,
  expectArrowPointsAt,
  expectGlowAt,
  expectLabelLit,
  expectNoGlow,
  expectNoLabelLit,
  log,
  mustFind,
  neighbourSlot,
  targetOutsideDisplay,
  waitForReady,
  waitForTopGrabbable,
} from "./CaseLightLeafSupport"
import {OwnModel, modelComeBack} from "./CaseLightRecallSupport"

interface Counts {
  unaided: number
  helped: number
  total: number
}

function counts(main: CaseLightMain): Counts {
  return {unaided: main.unaidedCount, helped: main.helpedCount, total: main.totalCount}
}

@component
export class CaseLightC3RecallMissScenario extends Scenario {
  private ix: CaseLightLeafInteractor | null = null

  /** The top recall letter dropped in a wrong cell, with every dark / outline / lit check. Returns the letter, its answer and whether the arrow showed. */
  private async missWithChecks(main: CaseLightMain, ctx: string): Promise<{p: number; target: number; outside: boolean}> {
    const ix = this.ix!
    const p = await waitForTopGrabbable(main)
    expect(main.isHoldPiece(p), `${ctx}: test picked a non-hold piece`).toBe(false)
    const target = targetOf(main, p)
    const wrong = neighbourSlot(target)
    // Another wrong cell one further away on the same shelf. The letter is held over that wrong
    // cell, then over the CORRECT cell, then over the adjacent wrong cell, and let go there.
    const startCell = wrong + (wrong - target)
    expect(Math.floor(startCell / 40), `${ctx}: all three cells on one shelf`).toBe(Math.floor(target / 40))
    const path = [startCell, target, wrong]
    const outside = targetOutsideDisplay(main, target)

    // Every frame in hand: no answer glow, no label lit (incl. rendered colours), no arrow.
    // At each waypoint: the outline names and sits on that cell (positive control: it shows and
    // moves) and looks exactly the same over the correct cell as over the wrong ones.
    let waypointsChecked = 0
    let framesChecked = 0
    let look: {mesh: RenderMesh; colours: string; size: string; scale: string} | null = null
    const positions: vec3[] = []
    const dark = (c: string) => {
      expectNoGlow(main, c)
      expectNoLabelLit(main, c)
      expectArrow(main, false, c)
    }
    await ix.dropTopPieceThroughSlots(main, path, {
      onHeld: () => dark(`${ctx}: in hand before the drop`),
      onFrame: () => {
        dark(`${ctx}: in hand, dragging (frame ${framesChecked + 1})`)
        framesChecked++
      },
      onWaypoint: (i) => {
        const s = path[i]
        const c = `${ctx}: held over ${s === target ? "the CORRECT" : "a wrong"} cell ${s} (waypoint ${i + 1}/${path.length}), not yet let go`
        expect(main.snapPreviewSlotIndex, `${c}: snapPreviewSlotIndex`).toBe(s)
        const outline = mustFind("SnapOutline")
        expect(outline.enabled, `${c}: SnapOutline shown`).toBe(true)
        const pos = outline.getTransform().getWorldPosition()
        const d = pos.distance(main.slotWorldPosition(s))
        expect(d < 0.5, `${c}: SnapOutline on cell ${s} (off by ${d.toFixed(2)} cm)`).toBe(true)
        positions.push(pos)
        const rmv = outline.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
        const mesh = rmv.mesh
        // extractVerticesForAttribute is deprecated in Lens Studio; if it ever returns nothing the
        // look comparison below would pass on empty data, so require real vertex data.
        const cols = mesh.extractVerticesForAttribute("color")
        const pts = mesh.extractVerticesForAttribute("position")
        expect(cols.length > 0 && pts.length > 0, `${c}: outline vertex data readable (colours ${cols.length}, positions ${pts.length})`).toBe(true)
        let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9
        for (let k = 0; k + 2 < pts.length; k += 3) {
          minX = Math.min(minX, pts[k]); maxX = Math.max(maxX, pts[k])
          minY = Math.min(minY, pts[k + 1]); maxY = Math.max(maxY, pts[k + 1])
        }
        const now = {
          mesh,
          colours: cols.map((v) => v.toFixed(3)).join(","),
          size: `${(maxX - minX).toFixed(3)}x${(maxY - minY).toFixed(3)}`,
          scale: `${outline.getTransform().getWorldScale().x.toFixed(4)},${outline.getTransform().getWorldScale().y.toFixed(4)}`,
        }
        if (!look) {
          look = now
          log(`${ctx}: outline look ${now.size} cm, scale ${now.scale}, ${cols.length / 4} vertex colours`)
        } else {
          expect(now.mesh.isSame(look.mesh), `${c}: same outline mesh`).toBe(true)
          expect(now.colours, `${c}: outline colours unchanged`).toBe(look.colours)
          expect(now.size, `${c}: outline size unchanged`).toBe(look.size)
          expect(now.scale, `${c}: outline scale unchanged`).toBe(look.scale)
        }
        dark(c)
        waypointsChecked++
      },
    })
    expect(waypointsChecked, `${ctx}: outline checked at all three cells`).toBe(3)
    expect(framesChecked > 10, `${ctx}: dark checked on every in-hand frame (${framesChecked})`).toBe(true)
    expect(positions[0].distance(positions[1]) > 1 && positions[1].distance(positions[2]) > 1, `${ctx}: the outline moved with the letter`).toBe(true)
    expect(main.snapPreviewSlotIndex, `${ctx}: snapPreviewSlotIndex after letting go`).toBe(-1)
    expect(mustFind("SnapOutline").enabled, `${ctx}: SnapOutline after letting go`).toBe(false)
    expect(main.lastDropResult, `${ctx}: wrong drop`).toBe("miss")
    expect(main.lastDropSlot, `${ctx}: dropped over`).toBe(wrong)
    expectGlowAt(main, target, `${ctx}: after the miss`)
    expectLabelLit(main, target, `${ctx}: after the miss`)
    expectArrow(main, outside, `${ctx}: after the miss (target ${target} outside=${outside})`)
    if (outside) expectArrowPointsAt(main, target, `${ctx}: after the miss`)
    expect(main.isPiecePlaced(p), `${ctx}: missed piece not placed`).toBe(false)

    expect(main.isHelpedThisPass(p), `${ctx}: the missed letter is helped for the rest of the pass`).toBe(true)
    log(`${ctx}: piece ${p} target ${target} wrong ${wrong} outside=${outside}`)
    return {p, target, outside}
  }

  async run(): Promise<void> {
    const main = await waitForReady()
    this.ix = new CaseLightLeafInteractor()
    const ix = this.ix

    // Positive control (practice): the glow and the arrow DO show for a held piece.
    await ix.pressButton("StartPracticeButton")
    expect(main.mode, "practice started (positive control)").toBe("practice")
    const pc = await waitForTopGrabbable(main)
    const pcTarget = targetOf(main, pc)
    expect(targetOutsideDisplay(main, pcTarget), `control target ${pcTarget} not fully in view`).toBe(true)
    let controlSeen = false
    await ix.releaseTopPieceInPlace(main, {
      onHeld: () => {
        expectGlowAt(main, pcTarget, "control: practice piece in hand")
        expectLabelLit(main, pcTarget, "control: practice piece in hand")
        expectArrow(main, true, "control: practice piece in hand")
        controlSeen = true
      },
    })
    expect(controlSeen, "positive control ran").toBe(true)
    await waitForTopGrabbable(main)

    await ix.pressButton("StartRecallButton")
    expect(main.mode, "recall started").toBe("recall")
    const order = main.bundleOrder
    log(`C3 recall order ${JSON.stringify(order)}`)
    await waitForTopGrabbable(main)
    expectNoGlow(main, "recall start")
    expectNoLabelLit(main, "recall start")
    expectArrow(main, false, "recall start")

    // v0.6 feature 2 replaces the old "same letter back on top, still lit, placed at once" step:
    // the missed letter goes back with exactly two letters before it (our own model), the answer
    // stays lit until a different letter is picked up, and the letter comes back unlit; its right
    // placement counts as helped. Criterion 3 (the wrong drop lights the right separation, with
    // the arrow if needed, and counts as helped) is checked in missWithChecks and below.
    const model = new OwnModel(main.pieceCount)
    expect(JSON.stringify(order), "recall order = the brief's recallOrder for pass 0 (our model)").toBe(JSON.stringify(model.startPass()))
    let queue = order.slice()
    const expectQueue = (c: string) => expect(JSON.stringify(main.currentPassOrder), `${c}: live queue = our model`).toBe(JSON.stringify(queue))

    /** Place the top letter right; returns it. `inHand` runs while it is held. */
    const placeTop = async (c: string, inHand?: () => void): Promise<number> => {
      const p = await waitForTopGrabbable(main)
      expect(p, `${c}: top letter = our model`).toBe(queue[0])
      await ix.dropTopPieceAtSlot(main, targetOf(main, p) === -2 ? 37 : targetOf(main, p), {onHeld: inHand})
      expect(main.lastDropResult, `${c}: letter ${p} placed`).toBe("correct")
      queue.shift()
      return p
    }

    // Miss #1 on the top letter.
    const c1 = counts(main)
    const m1 = await this.missWithChecks(main, "C3 miss #1")
    expect(counts(main).total - c1.total, "C3 miss #1: a miss places nothing").toBe(0)
    queue = modelComeBack(queue)
    expectQueue("C3 after miss #1")
    expect(main.currentPassOrder.indexOf(m1.p), `C3 miss #1: letter ${m1.p} has exactly 2 letters before it`).toBe(2)

    // The answer stays lit while nothing else is picked up (positive control for "comes back unlit").
    const q = await waitForTopGrabbable(main)
    expect(q !== m1.p, `C3: the next top letter (${q}) is another letter`).toBe(true)
    expectGlowAt(main, m1.target, "C3: answer still lit before a different letter is picked up")
    expectLabelLit(main, m1.target, "C3: answer label still lit before a different letter is picked up")
    expect(main.isHelpedThisPass(q), `C3: letter ${q} not helped (control)`).toBe(false)

    // Until the missed letter is back on top: each letter is placed right at once (picking it up
    // clears the light; it counts unaided), except that one letter whose answer is on the other
    // side of the display edge is missed too (miss #2), so both arrow branches are covered.
    const out = (p: number) => targetOutsideDisplay(main, targetOf(main, p))
    const otherBranch = (p: number) => !main.isHoldPiece(p) && out(p) !== m1.outside
    let m2: {p: number; target: number; outside: boolean} | null = null
    let between = 0
    const missSecond = async (): Promise<void> => {
      const m = await this.missWithChecks(main, "C3 miss #2")
      queue = modelComeBack(queue)
      expectQueue("C3 after miss #2")
      expect(main.currentPassOrder.indexOf(m.p), `C3 miss #2: letter ${m.p} has min(2, others left) letters before it`).toBe(Math.min(2, queue.length - 1))
      m2 = m
    }
    const placeFresh = async (c: string): Promise<void> => {
      const b = counts(main)
      const p = await placeTop(c, () => {
        expectNoGlow(main, `${c}: a different letter in hand, the answer light cleared`)
        expectNoLabelLit(main, `${c}: a different letter in hand`)
        expectArrow(main, false, `${c}: a different letter in hand`)
      })
      const a = counts(main)
      expect(a.unaided - b.unaided === 1 && a.helped === b.helped && a.total - b.total === 1, `${c}: letter ${p} right at once counts unaided +1, helped +0, total +1`).toBe(true)
    }
    while (queue[0] !== m1.p) {
      between++
      if (!m2 && otherBranch(queue[0])) await missSecond()
      else await placeFresh("C3 letter before the missed one comes back")
    }
    expect(between, `C3: exactly 2 letters were on top before the missed letter came back`).toBe(2)

    // The missed letter is back on top: its own answer is unlit (asked from memory again), nothing
    // glows once it is in hand, and its right drop is helped.
    const back = await waitForTopGrabbable(main)
    expect(back, `C3: missed letter ${m1.p} back on top`).toBe(m1.p)
    expect(main.litSlotIndex !== m1.target, `C3 missed letter back on top: its own answer is unlit (lit slot ${main.litSlotIndex})`).toBe(true)
    expect(main.isLabelLit(m1.target), "C3 missed letter back on top: its answer label is unlit").toBe(false)
    const mid = counts(main)
    await placeTop("C3 missed letter placed", () => {
      expectNoGlow(main, "C3 missed letter in hand again: unlit")
      expectNoLabelLit(main, "C3 missed letter in hand again")
      expectArrow(main, false, "C3 missed letter in hand again: no arrow")
    })
    const after1 = counts(main)
    expect(after1.helped - mid.helped, "C3 missed letter placed right: helped +1").toBe(1)
    expect(after1.unaided - mid.unaided, "C3 missed letter placed right: unaided +0").toBe(0)
    expect(after1.total - mid.total, "C3 missed letter placed right: total +1").toBe(1)
    expectNoGlow(main, "C3 after placing the missed letter")

    // Miss #2, if no letter for the other arrow branch came up before: place letters until one does.
    while (!m2 && queue.length > 0) {
      if (otherBranch(queue[0])) await missSecond()
      else await placeFresh("C3 letter before miss #2")
    }
    const m2v = m2 as {p: number; target: number; outside: boolean} | null
    if (!m2v) throw new Error(`C3: no letter whose answer is ${m1.outside ? "inside" : "outside"} the display`)
    expect(m1.outside !== m2v.outside, `covered a target outside and one inside the rectangle (miss #1 ${m1.outside}, miss #2 ${m2v.outside})`).toBe(true)

    // 4th piece: miss and leave its answer lit, then start a new recall pass: every label (and
    // the HOLD label) must be back to its normal colour at the start of the pass.
    const p4 = await waitForTopGrabbable(main)
    const t4 = targetOf(main, p4)
    const w4 = t4 === -2 ? 23 : neighbourSlot(t4)
    await ix.dropTopPieceAtSlot(main, w4)
    await waitForTopGrabbable(main)
    expectLabelLit(main, t4, "C3 piece #4 answer lit before the new pass (positive control)")
    await ix.pressButton("StartRecallButton")
    expect(main.mode, "new recall pass").toBe("recall")
    expect(main.placedThisPass, "new recall pass: nothing placed yet").toBe(0)
    expectNoGlow(main, "start of a new recall pass after a lit answer")
    expectNoLabelLit(main, "start of a new recall pass after a lit answer")
    log("C3 done")
    await hideLeafOverlay()
  }
}
