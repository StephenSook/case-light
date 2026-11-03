// Owns: the LEAF check that today's route picker can be found when the Lens opens: both Route buttons inside the brief's display rectangle with 0.5 deg to spare, at the Start row's reach, labelled "Route 1" / "Route 2", and clear of the hint, the Start row, the caption, the credit, the version tag, the top letter and the tray.
// Talks to: CaseLightLeafSupport (angle boxes from the eye, the brief's display rectangle, drawn boxes), CaseLightMain read-only getters (mode, routeId).
// Must not: move, press or change anything; it only measures what is drawn at open.

/**
 * Why: the picker was first placed just past the left display edge (yaw -23.2..-12.7 deg at open),
 * so a viewer had to turn about 18 deg to find it. It now sits next to the Start buttons.
 * The display rectangle is the brief's (DISPLAY_HALF_W_DEG / DISPLAY_HALF_H_DEG in the support
 * file), not the product's own view cue. Positive controls: the Place on wall button, outside the
 * opening view by design, must read as outside; a box must read as overlapping itself.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {
  AngleBox,
  angleBox,
  anglesOverlap,
  displaySpare,
  drawnWorldBox,
  fmtBox,
  hideLeafOverlay,
  insideDisplay,
  log,
  mustFind,
  roundedRectWorldCorners,
  textWorldCorners,
  waitForReady,
} from "./CaseLightLeafSupport"

const MIN_SPARE_DEG = 0.5
const SAME_REACH_CM = 5

function findUnder(root: SceneObject, name: string): SceneObject | null {
  for (let i = 0; i < root.getChildrenCount(); i++) {
    const c = root.getChild(i)
    if (c.name === name) return c
    const deeper = findUnder(c, name)
    if (deeper) return deeper
  }
  return null
}

function centreOf(points: vec3[]): vec3 {
  let s = vec3.zero()
  for (const p of points) s = s.add(p)
  return s.uniformScale(1 / points.length)
}

@component
export class CaseLightRoutePickerInViewScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    expect(main.mode, "idle at open").toBe("idle")
    expect(main.routeId, "Route 1 at open").toBe(1)
    const eye = WorldCameraFinderProvider.getInstance().getWorldPosition()

    // Positive controls for the detectors.
    const outsideControl = angleBox(roundedRectWorldCorners("PlaceOnWallButton"))
    log(`PICKER control: Place on wall at open ${fmtBox(outsideControl)}`)
    expect(insideDisplay(outsideControl), "control: the Place on wall button (outside the opening view by design) reads as outside").toBe(false)

    const startRecall = roundedRectWorldCorners("StartRecallButton")
    const startReach = centreOf(startRecall).distance(eye)
    const neighbours: {name: string; box: AngleBox}[] = [
      {name: "start hint (both lines and backing)", box: angleBox([...textWorldCorners("StartHint"), ...textWorldCorners("StartHintLine2"), ...roundedRectWorldCorners("StartHintBacking")])},
      {name: "Start practice button", box: angleBox(roundedRectWorldCorners("StartPracticeButton"))},
      {name: "Start recall button", box: angleBox(startRecall)},
      {name: "Drill pace button", box: angleBox(roundedRectWorldCorners("DrillPaceButton"))},
      {name: "case caption (text and backing)", box: angleBox([...textWorldCorners("Caption"), ...roundedRectWorldCorners("CaptionBacking")])},
      {name: "small print under the caption", box: angleBox(textWorldCorners("CreditText"))},
      {name: "version tag", box: angleBox([...textWorldCorners("VersionLabel"), ...roundedRectWorldCorners("VersionBacking")])},
      {name: "top letter", box: angleBox(drawnWorldBox("Piece_0").pts)},
      {name: "tray", box: angleBox(drawnWorldBox("TrayLines").pts)},
    ]
    expect(anglesOverlap(neighbours[2].box, neighbours[2].box), "control: a box overlaps itself").toBe(true)

    for (const r of [1, 2]) {
      const name = `RouteButton_${r}`
      const corners = roundedRectWorldCorners(name)
      const box = angleBox(corners)
      const spare = displaySpare(box)
      log(`PICKER ${name} at open ${fmtBox(box)}, ${spare.toFixed(2)} deg to spare`)
      expect(insideDisplay(box) && spare >= MIN_SPARE_DEG, `${name} inside the display at open with at least ${MIN_SPARE_DEG} deg to spare (${fmtBox(box)}, spare ${spare.toFixed(2)})`).toBe(true)

      const reach = centreOf(corners).distance(eye)
      expect(Math.abs(reach - startReach) <= SAME_REACH_CM, `${name} at the Start row's reach (${reach.toFixed(1)} vs ${startReach.toFixed(1)} cm)`).toBe(true)

      const labelSo = findUnder(mustFind(name), "ButtonLabel")
      const label = labelSo ? (labelSo.getComponent("Component.Text") as Text).text.replace(/\s+/g, " ").trim() : "(no label)"
      expect(label, `${name} label`).toBe(`Route ${r}`)
      expect(!!labelSo && labelSo.enabled && mustFind(name).enabled, `${name} and its label shown`).toBe(true)

      for (const n of neighbours) {
        expect(anglesOverlap(box, n.box), `${name} clear of the ${n.name}`).toBe(false)
      }
    }
    await hideLeafOverlay()
  }
}
