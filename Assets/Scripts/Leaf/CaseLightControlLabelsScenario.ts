// Owns: the LEAF check of the U2 button pass: every button label in the Lens uses one type size and never shrinks to fit; each label on screen at open (and in the Options panel) fits its button, Route 1 and Route 2 on one line; every such label's capitals are at least Snap's Specs "Button" type size as seen from the eye; and exactly one Start button is drawn as the next step: Start practice at open, neither during a pass, Start recall after a practice pass, Start practice again after a route switch.
// Talks to: CaseLightLeafSupport (real SIK presses and drops, waits, logs), CaseLightMain read-only getters (mode, primaryAction, pieceCount), SIK WorldCameraFinderProvider (the eye).
// Must not: call product commands or test hooks, import the product's label module (its numbers are written out here), or change product state except through real input.

/**
 * Snap's Specs type scale gives "Button" text size 39 at 110 cm; Text.size is the em height in
 * 1/43.886 cm and capitals are about 0.7 em, so its capitals are 0.622 cm at 110 cm, about 0.324 deg.
 * A label passes legibility when its own capitals, through its world scale and at its distance
 * from the eye, are at least that angle.
 * The primary look is Case Light's label-yellow (1, 0.92, 0.6); every other label is white.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {nextFrame} from "Leaf.lspkg/Utils/common/Utils"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {CaseLightLeafInteractor, dropSlotFor, hideLeafOverlay, log, mustFind, waitForReady, waitForTopGrabbable, waitUntil} from "./CaseLightLeafSupport"

const EM_PER_CM = 43.886
const CAP_PER_EM = 0.7
const SNAP_BUTTON_CAP_DEG = (2 * Math.atan((39 / EM_PER_CM) * CAP_PER_EM / 2 / 110) * 180) / Math.PI
const PRIMARY = new vec4(1, 0.92, 0.6, 1)
const SECONDARY = new vec4(1, 1, 1, 1)
/** Labels a viewer sees at open, then the Options panel's two toggles. */
const OPEN_BUTTONS = ["OptionsButton", "StartPracticeButton", "StartRecallButton", "ShowMyCaseButton", "RouteButton_1", "RouteButton_2", "PlaceOnWallButton", "PlaceInFrontButton", "VeteranModeButton", "ShareNotesButton"]
const OPTIONS_BUTTONS = ["DrillPaceButton", "HideStandInButton"]
/** Every Case Light button has a label: Start row, Options panel, Route, placement, Veteran mode, Share notes, the reminder chooser, Again, Done, Case check, Reset progress. */
const MIN_LABELS = 19
const FIT_EPS_CM = 0.01

function findUnder(root: SceneObject, name: string): SceneObject | null {
  for (let i = 0; i < root.getChildrenCount(); i++) {
    const c = root.getChild(i)
    if (c.name === name) return c
    const deep = findUnder(c, name)
    if (deep) return deep
  }
  return null
}

function allLabels(): {owner: string; t: Text}[] {
  const out: {owner: string; t: Text}[] = []
  const walk = (so: SceneObject) => {
    if (so.name === "ButtonLabel") {
      const t = so.getComponent("Component.Text") as Text
      if (t) out.push({owner: so.getParent() ? so.getParent().name : "(root)", t})
    }
    for (let i = 0; i < so.getChildrenCount(); i++) walk(so.getChild(i))
  }
  // Case Light's own buttons only: everything under the CaseLight object (package UI such as Sync Kit's start menu is not ours).
  walk(mustFind("CaseLight"))
  return out
}

function labelOf(button: string): Text {
  const so = findUnder(mustFind(button), "ButtonLabel")
  if (!so) throw new Error(`${button} has no ButtonLabel`)
  return so.getComponent("Component.Text") as Text
}

function sameColor(a: vec4, b: vec4): boolean {
  return Math.abs(a.r - b.r) < 0.01 && Math.abs(a.g - b.g) < 0.01 && Math.abs(a.b - b.b) < 0.01
}

function colorName(c: vec4): string {
  return sameColor(c, PRIMARY) ? "primary" : sameColor(c, SECONDARY) ? "secondary" : `(${c.r.toFixed(2)}, ${c.g.toFixed(2)}, ${c.b.toFixed(2)})`
}

async function frames(n: number): Promise<void> {
  for (let i = 0; i < n; i++) await nextFrame()
}

@component
export class CaseLightControlLabelsScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    // A Text's box reads wrong in the frame it is first shown: measure two frames later.
    await frames(2)

    // 1. One size, never shrunk, every button label in the Lens (hidden ones too).
    const labels = allLabels()
    log(`LABELS ${labels.length} button labels in the scene: ${labels.map((l) => l.owner).join(", ")}`)
    expect(labels.length >= MIN_LABELS, `every button's label found (${labels.length}, at least ${MIN_LABELS})`).toBe(true)
    const size0 = labels[0].t.size
    for (const l of labels) {
      expect(Math.abs(l.t.size - size0) < 0.001, `${l.owner} label "${l.t.text}" at the one button size (${l.t.size.toFixed(3)} vs ${size0.toFixed(3)})`).toBe(true)
      expect(l.t.horizontalOverflow !== HorizontalOverflow.Shrink && l.t.verticalOverflow !== VerticalOverflow.Shrink, `${l.owner} label "${l.t.text}" never shrinks to fit`).toBe(true)
    }

    // 2. Fit, one line for Route, legibility: the labels on screen at open, then in the Options panel.
    const eye = WorldCameraFinderProvider.getInstance().getWorldPosition()
    const oneLineH = labelOf("OptionsButton").getBoundingBox()
    const lineH = oneLineH.top - oneLineH.bottom
    expect(lineH > 0, `the one-line reference ("Options") has a measured height (${lineH.toFixed(3)} cm)`).toBe(true)
    const measure = (button: string) => {
      const t = labelOf(button)
      const box = t.getBoundingBox()
      const rect = t.layoutRect
      const w = box.right - box.left
      const h = box.top - box.bottom
      const rw = rect.right - rect.left
      const rh = rect.top - rect.bottom
      const tr = t.getSceneObject().getTransform()
      const capCm = (t.size / EM_PER_CM) * CAP_PER_EM * tr.getWorldScale().y
      const dist = tr.getWorldPosition().distance(eye)
      const capDeg = (2 * Math.atan(capCm / 2 / dist) * 180) / Math.PI
      log(`LABEL ${button} "${t.text.replace(/\n/g, " ")}": capitals ${capCm.toFixed(3)} cm at ${dist.toFixed(1)} cm = ${capDeg.toFixed(3)} deg (Snap Button ${SNAP_BUTTON_CAP_DEG.toFixed(3)} deg); text ${w.toFixed(2)} x ${h.toFixed(2)} cm in ${rw.toFixed(2)} x ${rh.toFixed(2)} cm; ${colorName(t.textFill.color)}`)
      expect(w > 0 && h > 0, `${button} label has a measured box`).toBe(true)
      expect(w <= rw + FIT_EPS_CM && h <= rh + FIT_EPS_CM, `${button} label "${t.text}" fits its button (${w.toFixed(2)} x ${h.toFixed(2)} in ${rw.toFixed(2)} x ${rh.toFixed(2)} cm)`).toBe(true)
      expect(capDeg >= SNAP_BUTTON_CAP_DEG, `${button} capitals at least Snap's Button size (${capDeg.toFixed(3)} >= ${SNAP_BUTTON_CAP_DEG.toFixed(3)} deg)`).toBe(true)
      return h
    }
    for (const b of OPEN_BUTTONS) {
      const h = measure(b)
      if (b.indexOf("RouteButton_") === 0) expect(h <= lineH * 1.25, `${b} label on one line (${h.toFixed(3)} vs one line ${lineH.toFixed(3)} cm)`).toBe(true)
    }
    await ix.pressButton("OptionsButton")
    await frames(2)
    for (const b of OPTIONS_BUTTONS) measure(b)
    await ix.pressButton("OptionsButton")
    await frames(1)

    // 3. One primary action per state, by real input.
    const practice = labelOf("StartPracticeButton")
    const recall = labelOf("StartRecallButton")
    const expectPrimary = (want: "practice" | "recall" | "none", ctx: string) => {
      log(`PRIMARY ${ctx}: ${main.primaryAction}; Start practice ${colorName(practice.textFill.color)}, Start recall ${colorName(recall.textFill.color)}`)
      expect(main.primaryAction, `${ctx}: next step`).toBe(want)
      expect(sameColor(practice.textFill.color, want === "practice" ? PRIMARY : SECONDARY), `${ctx}: Start practice drawn ${want === "practice" ? "primary" : "secondary"}`).toBe(true)
      expect(sameColor(recall.textFill.color, want === "recall" ? PRIMARY : SECONDARY), `${ctx}: Start recall drawn ${want === "recall" ? "primary" : "secondary"}`).toBe(true)
    }
    expectPrimary("practice", "at open")
    await ix.pressButton("StartPracticeButton")
    await waitUntil(() => main.mode === "practice", 2000, "the practice pass starts")
    expectPrimary("none", "during the practice pass")
    let guard = main.pieceCount + 2
    while (main.mode === "practice" && guard-- > 0) {
      const p = await waitForTopGrabbable(main)
      await ix.dropTopPieceAtSlot(main, dropSlotFor(main, p))
      expect(main.lastDropResult, `practice letter ${p} placed`).toBe("correct")
    }
    await waitUntil(() => main.mode === "idle", 3000, "the practice pass ends")
    expectPrimary("recall", "after the practice pass")
    await ix.pressButton("RouteButton_2")
    await waitUntil(() => main.routeId === 2, 2000, "Route 2 taken")
    expectPrimary("practice", "after a route switch")
    await ix.pressButton("RouteButton_1")
    await waitUntil(() => main.routeId === 1, 2000, "back on Route 1")
    expectPrimary("practice", "back on Route 1")
    await hideLeafOverlay()
  }
}
