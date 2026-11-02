// Owns: the LEAF check for done criterion 2 (practice glow and its lit label while in hand; edge arrow while any part of the lit cell is outside the display, hidden once the whole cell is inside).
// Talks to: CaseLightLeafSupport (real SIK/UIKit input, independent display-fit maths, assertions), CaseLightMain read-only getters and its pure step() / stepPadDeg / targetCornersWorld, Label_n / LabelHighlight by name.
// Must not: call CaseLightMain's test hooks or commands, or derive its expected arrow state from the product's own step().

/**
 * Done criterion 2 (devpost/design-brief.md):
 * "In practice, the right separation glows while the piece is in hand; when it is outside the
 * display rectangle, an edge arrow points to it and hides once it is inside."
 * Product rule (builder, verified in CaseLightViewCue.ts): the arrow waits for the WHOLE lit cell.
 *
 * Input: REAL (LEAF SIK interactor) for the button and every grab and drop. The expected arrow
 * state is worked out in the test from the cell's four corners (displayFit), not from step().
 * The head turn cannot be done in LEAF, so step() is also checked directly: default-pad
 * boundaries, the 0,0 point test, and synthetic head sweeps.
 * Positive controls: glow, lit label and arrow are seen ON before any "off" check.
 * Lit label: when a cell lights, its own number label lights (white text, highlight behind it)
 * and both neighbouring labels keep their street colour.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {hideLeafOverlay, 
  CaseLightLeafInteractor,
  targetOf,
  displayFit,
  dropSlotFor,
  expectArrow,
  expectArrowPointsAt,
  expectGlowAt,
  expectLabelLit,
  expectNoGlow,
  expectNoLabelLit,
  headAngles,
  log,
  mustFind,
  waitForReady,
  waitForTopGrabbable,
} from "./CaseLightLeafSupport"

const RAD2DEG = 180 / Math.PI

@component
export class CaseLightC2PracticeGlowArrowScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()

    await ix.pressButton("StartPracticeButton")
    expect(main.mode, "practice started").toBe("practice")
    const p0 = await waitForTopGrabbable(main)
    const t0 = targetOf(main, p0)
    expect(t0, "piece 0 target").toBe(9)
    const fit0 = displayFit(main, t0)
    expect(fit0.cellOutside, "slot 9 is not fully inside the display at the start pose").toBe(true)

    // Positive controls: glow and arrow ON while piece 0 is in hand. Then let go over the tray.
    await ix.releaseTopPieceInPlace(main, {
      onHeld: () => {
        expectGlowAt(main, t0, "piece 0 in hand (1st grab)")
        expectLabelLit(main, t0, "piece 0 in hand (1st grab)")
        expectArrow(main, true, "piece 0 in hand, slot 9 not fully in view")
        expectArrowPointsAt(main, t0, "piece 0 in hand")
      },
    })
    expect(main.lastDropResult, "released over the tray").toBe("off-case")
    expectNoGlow(main, "piece 0 let go off the case")
    expectNoLabelLit(main, "piece 0 let go off the case")
    expectArrow(main, false, "piece 0 let go off the case")
    await waitForTopGrabbable(main)
    expectNoGlow(main, "piece 0 back in the bundle, nothing in hand")

    // Grab again and place it: glow on while held, off once placed.
    await ix.dropTopPieceAtSlot(main, t0, {
      onHeld: () => {
        expectGlowAt(main, t0, "piece 0 in hand (2nd grab)")
        expectArrow(main, true, "piece 0 in hand (2nd grab)")
      },
    })
    expect(main.lastDropResult, "piece 0 placed").toBe("correct")
    expectNoGlow(main, "after placing piece 0")
    expectArrow(main, false, "after placing piece 0")

    // Live whole-cell rule: keep placing pieces until we have seen a cell fully inside (arrow off)
    // and a cell whose CENTRE is inside but whose edge is outside (arrow must still be on).
    let sawFullyInside = false
    let sawCentreInEdgeOut = false
    while (main.mode === "practice" && !(sawFullyInside && sawCentreInEdgeOut)) {
      const p = await waitForTopGrabbable(main)
      const t = targetOf(main, p)
      const fit = displayFit(main, t)
      let pad = vec2.zero()
      await ix.dropTopPieceAtSlot(main, dropSlotFor(main, p), {
        onHeld: () => {
          expectGlowAt(main, t, `piece ${p} in hand`)
          expectLabelLit(main, t, `piece ${p} in hand`)
          expectArrow(main, fit.cellOutside, `piece ${p} in hand, target ${t} centreOut=${fit.centerOutside} cellOut=${fit.cellOutside}`)
          if (fit.cellOutside) expectArrowPointsAt(main, t, `piece ${p} in hand`)
          pad = main.litTargetPadDeg
        },
      })
      expect(main.lastDropResult, `piece ${p} placed`).toBe("correct")
      expectNoGlow(main, `after placing piece ${p}`)
      expectNoLabelLit(main, `after placing piece ${p}`)
      expectArrow(main, false, `after placing piece ${p}`)
      expect(pad.x > 0 && pad.y > 0, `piece ${p}: lit cell measured as an area (pads ${pad.x.toFixed(3)}, ${pad.y.toFixed(3)})`).toBe(true)
      log(`C2 piece ${p} target ${t} centreOutside=${fit.centerOutside} cellOutside=${fit.cellOutside} measuredPad=(${pad.x.toFixed(3)}, ${pad.y.toFixed(3)})`)
      if (!fit.cellOutside) sawFullyInside = true
      if (!fit.centerOutside && fit.cellOutside) sawCentreInEdgeOut = true
    }
    expect(sawFullyInside, "saw a lit cell fully inside the display (arrow off)").toBe(true)
    expect(sawCentreInEdgeOut, "saw a lit cell with its centre inside but an edge outside (arrow on)").toBe(true)

    // --- step(): default pads equal one separation seen from the start position. ---
    const vc = main.viewCue
    const hw = vc.halfWidthDeg
    const hh = vc.halfHeightDeg
    const pad = main.stepPadDeg
    const corners = main.targetCornersWorld(56)
    const cellHalfW = corners[0].distance(corners[1]) / 2
    const cellHalfH = corners[1].distance(corners[2]) / 2
    const caseRoot = mustFind("CaseRoot").getTransform().getWorldPosition()
    const depth = -WorldCameraFinderProvider.getInstance().getInvertedWorldTransform().multiplyPoint(caseRoot).z
    const expYaw = Math.atan(cellHalfW / depth) * RAD2DEG
    const expPitch = Math.atan(cellHalfH / depth) * RAD2DEG
    log(`C2 stepPadDeg=(${pad.x.toFixed(4)}, ${pad.y.toFixed(4)}) independent=(${expYaw.toFixed(4)}, ${expPitch.toFixed(4)}) cell half ${cellHalfW.toFixed(2)} x ${cellHalfH.toFixed(2)} cm at ${depth.toFixed(2)} cm; boundaries |yaw|>${(hw - pad.x).toFixed(4)} |pitch|>${(hh - pad.y).toFixed(4)}`)
    expect(Math.abs(pad.x - expYaw) < 0.01, `default yaw pad ${pad.x.toFixed(4)} = one half separation from the start (${expYaw.toFixed(4)})`).toBe(true)
    expect(Math.abs(pad.y - expPitch) < 0.01, `default pitch pad ${pad.y.toFixed(4)} = one half opening from the start (${expPitch.toFixed(4)})`).toBe(true)

    // Default-pad boundaries: outside (true) checks, then inside (false).
    const bx = hw - pad.x
    const by = hh - pad.y
    expect(main.step(bx + 0.01, 0), "default pads: just outside right edge").toBe(true)
    expect(main.step(-bx - 0.01, 0), "default pads: just outside left edge").toBe(true)
    expect(main.step(0, by + 0.01), "default pads: just outside top edge").toBe(true)
    expect(main.step(0, -by - 0.01), "default pads: just outside bottom edge").toBe(true)
    expect(main.step(120, 0), "default pads: behind the head").toBe(true)
    expect(main.step(bx - 0.01, 0), "default pads: just inside right edge").toBe(false)
    expect(main.step(-bx + 0.01, 0), "default pads: just inside left edge").toBe(false)
    expect(main.step(0, by - 0.01), "default pads: just inside top edge").toBe(false)
    expect(main.step(0, -by + 0.01), "default pads: just inside bottom edge").toBe(false)
    expect(main.step(0, 0), "default pads: centre").toBe(false)
    // The padded test is stricter than the point test right at the old boundary.
    expect(main.step(hw - 0.01, 0), "default pads: old point boundary now counts as outside").toBe(true)

    // Point test step(y, p, 0, 0): the display edge itself.
    expect(main.step(hw + 0.01, 0, 0, 0), "point: just outside right edge").toBe(true)
    expect(main.step(0, -hh - 0.01, 0, 0), "point: just outside bottom edge").toBe(true)
    expect(main.step(hw - 0.01, 0, 0, 0), "point: just inside right edge").toBe(false)
    expect(main.step(-hw + 0.01, 0, 0, 0), "point: just inside left edge").toBe(false)
    expect(main.step(0, hh - 0.01, 0, 0), "point: just inside top edge").toBe(false)

    // --- Synthetic head sweeps (default pads). ---
    // Slot 46 (upper row): turning toward it hides the arrow once the whole cell is inside.
    const a46 = headAngles(main.slotWorldPosition(46))
    const sgn = a46.x < 0 ? -1 : 1
    expect(main.step(a46.x, a46.y), "slot 46 shows the arrow at the start pose").toBe(true)
    let hideTurn = -1
    for (let turn = 0; turn <= Math.abs(a46.x); turn += 0.25) {
      const out = main.step(a46.x - sgn * turn, a46.y)
      if (!out && hideTurn < 0) hideTurn = turn
      if (hideTurn >= 0) expect(out, `slot 46, head turned ${turn} deg toward it: stays hidden`).toBe(false)
    }
    const expectedHide = Math.abs(a46.x) - bx
    log(`C2 slot 46 at yaw ${a46.x.toFixed(2)} pitch ${a46.y.toFixed(2)}; arrow hides after ${hideTurn} deg (whole-cell boundary at ${expectedHide.toFixed(2)})`)
    expect(hideTurn > 0, "slot 46 arrow hides partway through the turn").toBe(true)
    expect(Math.abs(hideTurn - expectedHide) <= 0.25, "slot 46 hides at the whole-cell boundary").toBe(true)

    // Slot 9 (lower row): its cell bottom is out of view, so a yaw-only turn never hides it...
    const a9 = headAngles(main.slotWorldPosition(9))
    expect(Math.abs(a9.y) + pad.y > hh, "slot 9 cell bottom below the display at the start pose").toBe(true)
    for (let turn = 0; turn <= Math.abs(a9.x); turn += 0.5) {
      expect(main.step(a9.x - Math.sign(a9.x) * turn, a9.y), `slot 9 yaw-only turn ${turn} deg: arrow stays`).toBe(true)
    }
    // ...but turning toward it in yaw AND pitch does.
    let hideAt = -1
    for (let s = 0; s <= 1.0001; s += 0.02) {
      const out = main.step(a9.x * (1 - s), a9.y * (1 - s))
      if (!out && hideAt < 0) hideAt = s
      if (hideAt >= 0) expect(out, `slot 9 yaw+pitch turn ${(s * 100).toFixed(0)}%: stays hidden`).toBe(false)
    }
    log(`C2 slot 9 at yaw ${a9.x.toFixed(2)} pitch ${a9.y.toFixed(2)}; yaw+pitch turn hides the arrow at ${(hideAt * 100).toFixed(0)}% of the way`)
    expect(hideAt > 0 && hideAt < 1, "slot 9 arrow hides partway through a yaw+pitch turn").toBe(true)
    log("C2 done")
    await hideLeafOverlay()
  }
}
