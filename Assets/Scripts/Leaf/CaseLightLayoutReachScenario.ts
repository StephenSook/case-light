// Owns: the LEAF check of the layout: at open, the top letter is within a stated reach envelope with a short throw to the case, and all four of its corners, the start hint, both Start buttons and the case caption are inside the display rectangle without overlapping the letter; after a recall pass, the score card backing, Again and Done are inside it with 0.5 deg to spare and overlap neither each other, the Start row, nor the tray.
// Talks to: CaseLightLeafSupport (display rectangle from the brief, angle boxes, drawn vertex boxes, Text boxes), CaseLightMain read-only getters (slot positions, cell corners), WorldCameraFinderProvider, scene objects by name.
// Must not: call CaseLightMain's test hooks or commands, or change product state except through real input (one recall pass, for the exit view).

/**
 * Display fit uses the design brief's rectangle (23.6 deg wide; 38 cm tall at 55 cm, about 38.1
 * deg tall), computed here from head angles of world points, not from the product's view cue.
 * Each item is the box of what it actually draws: the letter's mesh vertices, each UIKit
 * rounded rectangle's drawn size (its pass's size; their shared mesh is a unit quad), and each
 * Text's local box through its transform.
 *
 * Reach envelope (test assumptions, stated so they can be argued with, not measured on people):
 * - Distance from the eye 30 to 55 cm. Below 30 cm the letter crowds the face and the hand would
 *   come back toward the body; 55 cm keeps the pinch inside an adult forward grip reach (about
 *   65 to 70 cm from the shoulder, which sits roughly beside and below the eye) with the elbow
 *   still bent, so the pinch does not need a locked arm.
 * - Height from 25 cm below to 10 cm above eye level. Above +10 cm the hand rises over the
 *   forehead line; below -25 cm (about chest height at this distance) the letter would sit low
 *   in or under the display.
 * - Throw: the letter's lowest point is at most 10 cm above the top of the upper playable row's
 *   opening, and the letter is at most 20 cm in front of the case face, so the move from the
 *   tray to the case is a short reach down and forward rather than a walk or a long swing.
 *
 * Positive controls: the inside test REJECTS slot 9's cell (partly outside at the start pose, as
 * criterion 2 needs), and the overlap test REPORTS the top letter overlapping the letter stacked
 * under it, and the score card's text overlapping its own backing.
 * Exit view: after one recall pass (real input, all right), at the default head pose (camera at
 * the origin, looking down -Z), measured by drawn sizes (UIKit pass sizes), against the same
 * rectangle with at least 0.5 deg to spare; "the tray" is the drawn tray lines (TrayLines). At
 * the exit view every letter is in a cell, so the stack's place at open is empty; its overlap with
 * the exit items is logged, not asserted.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {
  AngleBox,
  CaseLightLeafInteractor,
  DISPLAY_HALF_H_DEG,
  DISPLAY_HALF_W_DEG,
  angleBox,
  anglesOverlap,
  charWorldCorners,
  displaySpare,
  dropSlotFor,
  expectResult,
  drawnWorldBox,
  fmt,
  fmtBox,
  hideLeafOverlay,
  insideDisplay,
  log,
  mustFind,
  roundedRectWorldCorners,
  targetOf,
  textWorldCorners,
  waitForReady,
  waitForTopGrabbable,
} from "./CaseLightLeafSupport"

const REACH_MIN_CM = 30
const REACH_MAX_CM = 55
const HEIGHT_MIN_CM = -25
const HEIGHT_MAX_CM = 10
const THROW_DROP_MAX_CM = 10
const THROW_DEPTH_MAX_CM = 20

@component
export class CaseLightLayoutReachScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    expect(main.mode, "idle at open").toBe("idle")
    expect(main.topPieceIndex, "nothing to grab before Start (letters stacked in the tray)").toBe(-1)
    expect(mustFind("Piece_0").enabled, "top letter Piece_0 shown at open").toBe(true)

    const eye = WorldCameraFinderProvider.getInstance().getWorldPosition()
    const letter = drawnWorldBox("Piece_0")
    const centre = mustFind("Piece_0").getTransform().getWorldPosition()

    // --- (c) Reach and throw. ---
    const dist = centre.distance(eye)
    const dy = centre.y - eye.y
    const rowTop = Math.max(...main.targetCornersWorld(40).map((c) => c.y))
    const drop = letter.lo.y - rowTop
    const faceZ = main.slotWorldPosition(40).z
    const depth = letter.lo.z - faceZ
    let maxThrow = 0
    for (let i = 0; i < main.pieceCount; i++) maxThrow = Math.max(maxThrow, centre.distance(main.slotWorldPosition(targetOf(main, i))))
    log(`LAYOUT reach: letter centre ${fmt(centre)}, eye ${fmt(eye)}, distance ${dist.toFixed(1)} cm, height ${dy.toFixed(1)} cm (pitch ${((Math.atan2(dy, -(centre.z - eye.z)) * 180) / Math.PI).toFixed(1)} deg); letter bottom ${letter.lo.y.toFixed(2)} vs upper row top ${rowTop.toFixed(2)} (drop ${drop.toFixed(2)} cm), ${depth.toFixed(1)} cm in front of the face; longest move to a sample answer ${maxThrow.toFixed(1)} cm`)
    expect(dist >= REACH_MIN_CM && dist <= REACH_MAX_CM, `top letter ${dist.toFixed(1)} cm from the eye, inside ${REACH_MIN_CM}..${REACH_MAX_CM} cm`).toBe(true)
    expect(dy >= HEIGHT_MIN_CM && dy <= HEIGHT_MAX_CM, `top letter ${dy.toFixed(1)} cm from eye level, inside ${HEIGHT_MIN_CM}..+${HEIGHT_MAX_CM} cm`).toBe(true)
    expect(drop >= 0 && drop <= THROW_DROP_MAX_CM, `letter bottom ${drop.toFixed(2)} cm above the upper row's opening (0..${THROW_DROP_MAX_CM} cm)`).toBe(true)
    expect(depth >= 0 && depth <= THROW_DEPTH_MAX_CM, `letter ${depth.toFixed(1)} cm in front of the case face (0..${THROW_DEPTH_MAX_CM} cm)`).toBe(true)

    // --- (b) Display fit at open. ---
    // Positive controls up front: the detectors can say "outside" and "overlap".
    const slot9 = angleBox(main.targetCornersWorld(9))
    expect(insideDisplay(slot9), `inside test rejects slot 9's cell (${fmtBox(slot9)}) (positive control)`).toBe(false)
    const under = angleBox(drawnWorldBox("Piece_1").pts)
    const top = angleBox(letter.pts)
    expect(anglesOverlap(top, under), "overlap test reports the top letter over the letter under it (positive control)").toBe(true)

    log(`LAYOUT display rectangle +-${DISPLAY_HALF_W_DEG.toFixed(2)} x +-${DISPLAY_HALF_H_DEG.toFixed(2)} deg; top letter ${fmtBox(top)}`)
    // All four corners of the top letter's face (drawn vertices) inside the display.
    expect(insideDisplay(top), `all corners of the top letter inside the display (${fmtBox(top)})`).toBe(true)

    const items: {name: string; box: AngleBox}[] = [
      {name: "start hint (both lines and backing)", box: angleBox([...textWorldCorners("StartHint"), ...textWorldCorners("StartHintLine2"), ...roundedRectWorldCorners("StartHintBacking")])},
      {name: "Start practice button", box: angleBox(roundedRectWorldCorners("StartPracticeButton"))},
      {name: "Start recall button", box: angleBox(roundedRectWorldCorners("StartRecallButton"))},
      {name: "case caption (text and backing)", box: angleBox([...textWorldCorners("Caption"), ...roundedRectWorldCorners("CaptionBacking")])},
    ]
    for (const it of items) {
      log(`LAYOUT ${it.name}: ${fmtBox(it.box)}`)
      expect(insideDisplay(it.box), `${it.name} inside the display (${fmtBox(it.box)})`).toBe(true)
      expect(anglesOverlap(it.box, top), `${it.name} does not overlap the top letter (${fmtBox(it.box)} vs ${fmtBox(top)})`).toBe(false)
    }
    // --- Exit view after a recall pass (score card, Again, Done). ---
    const ix = new CaseLightLeafInteractor()
    const trayBox = angleBox(drawnWorldBox("TrayLines").pts)
    const stackAtOpen = top
    const startRow = ["StartPracticeButton", "StartRecallButton", "DrillPaceButton"].map((n) => ({name: n, box: angleBox(roundedRectWorldCorners(n))}))
    await ix.pressButton("StartRecallButton")
    expect(main.mode, "recall started for the exit view").toBe("recall")
    while (main.mode === "recall") {
      const p = await waitForTopGrabbable(main)
      await ix.dropTopPieceAtSlot(main, dropSlotFor(main, p))
      expect(main.lastDropResult, `exit view: piece ${p} placed`).toBe("correct")
    }
    expectResult(main, true, "exit view: score card shown")
    expect(main.isExitVisible, "exit view: Again / Done shown").toBe(true)
    let inTray = 0
    for (let i = 0; i < main.pieceCount; i++) if (!main.isPiecePlaced(i)) inTray++
    expect(inTray, "exit view: every letter is in a cell (the tray is empty)").toBe(0)
    const card = mustFind("ResultText").getComponent("Component.Text") as Text
    expect(anglesOverlap(angleBox(charWorldCorners(card)), angleBox(roundedRectWorldCorners("ResultBacking"))), "overlap test reports the score text over its own backing (positive control)").toBe(true)
    const exitItems = [
      {name: "score card backing", box: angleBox(roundedRectWorldCorners("ResultBacking"))},
      {name: "Again button", box: angleBox(roundedRectWorldCorners("AgainButton"))},
      {name: "Done button", box: angleBox(roundedRectWorldCorners("DoneButton"))},
    ]
    for (const it of exitItems) {
      const spare = displaySpare(it.box)
      log(`LAYOUT exit ${it.name}: ${fmtBox(it.box)}, ${spare.toFixed(2)} deg to spare`)
      expect(spare >= 0.5, `${it.name} inside the display with at least 0.5 deg to spare (${spare.toFixed(2)} deg; ${fmtBox(it.box)})`).toBe(true)
      for (const s of startRow) expect(anglesOverlap(it.box, s.box), `${it.name} does not overlap ${s.name} (${fmtBox(it.box)} vs ${fmtBox(s.box)})`).toBe(false)
      expect(anglesOverlap(it.box, trayBox), `${it.name} does not overlap the tray (${fmtBox(it.box)} vs ${fmtBox(trayBox)})`).toBe(false)
      log(`LAYOUT exit ${it.name} over the (now empty) stack place at open: ${anglesOverlap(it.box, stackAtOpen)}`)
    }
    for (let a = 0; a < exitItems.length; a++)
      for (let b = a + 1; b < exitItems.length; b++)
        expect(anglesOverlap(exitItems[a].box, exitItems[b].box), `${exitItems[a].name} does not overlap ${exitItems[b].name} (${fmtBox(exitItems[a].box)} vs ${fmtBox(exitItems[b].box)})`).toBe(false)
    log(`LAYOUT tray ${fmtBox(trayBox)}; start row ${startRow.map((r) => `${r.name} ${fmtBox(r.box)}`).join("; ")}`)
    log("LAYOUT done")
    await hideLeafOverlay()
  }
}
