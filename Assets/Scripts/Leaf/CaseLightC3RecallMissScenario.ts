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

  /** One recall piece: a wrong drop, then the right one. Returns whether the arrow showed. */
  private async missThenPlace(main: CaseLightMain, ctx: string): Promise<boolean> {
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
    const before = counts(main)

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

    // The piece comes back to the hand; the right separation stays lit.
    const back = await waitForTopGrabbable(main)
    expect(back, `${ctx}: same piece back on top`).toBe(p)
    expectGlowAt(main, target, `${ctx}: piece back in the bundle, still lit`)

    await ix.dropTopPieceAtSlot(main, target, {
      onHeld: () => expectGlowAt(main, target, `${ctx}: in hand again, still lit`),
    })
    expect(main.lastDropResult, `${ctx}: right drop`).toBe("correct")
    expect(main.isPiecePlaced(p), `${ctx}: placed`).toBe(true)
    expectNoGlow(main, `${ctx}: after placing`)
    expectNoLabelLit(main, `${ctx}: after placing`)
    expectArrow(main, false, `${ctx}: after placing`)
    const after = counts(main)
    expect(after.helped - before.helped, `${ctx}: helped +1`).toBe(1)
    expect(after.unaided - before.unaided, `${ctx}: unaided +0`).toBe(0)
    expect(after.total - before.total, `${ctx}: total +1`).toBe(1)
    log(`${ctx}: piece ${p} target ${target} wrong ${wrong} outside=${outside} counts ${JSON.stringify(after)}`)
    return outside
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

    // 1st piece: miss, then place (helped).
    const out1 = await this.missThenPlace(main, "C3 piece #1")

    // 2nd piece: placed right at once, nothing ever glows (unaided).
    const before = counts(main)
    const p2 = await waitForTopGrabbable(main)
    expect(main.isHoldPiece(p2), "2nd piece is a normal piece").toBe(false)
    await ix.dropTopPieceAtSlot(main, targetOf(main, p2), {
      onHeld: () => {
        expectNoGlow(main, "C3 piece #2 in hand")
        expectArrow(main, false, "C3 piece #2 in hand")
      },
    })
    expect(main.lastDropResult, "C3 piece #2 placed").toBe("correct")
    expectNoGlow(main, "C3 piece #2 placed")
    const after = counts(main)
    expect(after.unaided - before.unaided, "C3 piece #2 unaided +1").toBe(1)
    expect(after.helped - before.helped, "C3 piece #2 helped +0").toBe(0)
    expect(after.total - before.total, "C3 piece #2 total +1").toBe(1)

    // 3rd piece: miss again, so the other arrow branch is covered too.
    const out3 = await this.missThenPlace(main, "C3 piece #3")
    expect(out1 !== out3, `covered a target outside and one inside the rectangle (out1=${out1}, out3=${out3})`).toBe(true)

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
