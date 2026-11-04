// Owns: the LEAF check of item L1, the learning curve per route: at a Lens start with saved progress and a saved curve it draws the saved points (the test's own JSON reading), stands in the opening view inside the display, clear of every button, panel plate, the welcome panel, the start hint, the version tag, the case caption and every cell and row label (drawn bounds), takes no pinch, and rides under the route picker in CaseControls; Reset progress removes it and draws nothing, caption included; then two recall passes with real input (one letter missed once, then none missed) draw exactly 2 points, oldest left, with the right values, labels and heights.
// Talks to: CaseLightLeafSupport (real UIKit presses, angle boxes, the display and preview still rectangles, drawn vertices), CaseLightRecallSupport (the test's own recall model and pass player), CaseLightProgressSupport (the test's own store reading and JSON parse), CaseLightSpacingSupport (the pinchable census, the case's cells and row labels as drawn, Text corners), CaseLightTargetSpacing (the pure gap rule), CaseLightMain read-only getters (learningCurveShown, learningCurvePoints, learningCurveLabels, progressWelcomeShown, placementLogLines, pieceCount, isHoldPiece, bundleOrder, mode, routeId), drawn objects by name (LearningCurve, LearningCurveLine, LearningCurveCaption, LearningCurveLabel_n, WelcomeProgress, RoutePicker, CaseControls).
// Must not: import CaseLightHistory, CaseLightHistoryView, CaseLightProgress, CaseLightProgressStore or CaseLightLog, write to or clear the store, call product commands or test hooks, or change product state except through real input.

/**
 * Runs in the progress chain, right after extra-progress-welcome: the store then holds the progress
 * and the one-point curve extra-progress-save left (its recall pass) and the welcome is up at open;
 * without them it fails at once with "run right after extra-progress-welcome". It ends with saved
 * progress and a two-point curve, which extra-progress-reset (next) needs: its welcome is up at open
 * and Reset progress removes our keys, the curve's key among them.
 * "Nothing saved" before the two passes is made by real input: the Reset progress press at open.
 * Expected values come from the test's own tally of each pass (playRecallPass): a point is that
 * pass's letters placed from memory of letters placed; its label is "x/y". The caption reads
 * "Recall passes". Left to right is oldest to newest, by each label's yaw from the eye; the line's
 * leftmost and rightmost dots stand at heights in the order of their scores' shares.
 * Controls: the curve is drawn at open from the saved key (so its absence after Reset is the
 * reset's doing); a box reads as overlapping itself; Reset progress leaves no key of ours.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {nextFrame} from "Leaf.lspkg/Utils/common/Utils"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {CaseLightMain} from "../CaseLightMain"
import {NamedBox, angularGap} from "../CaseLightTargetSpacing"
import {AngleBox, CaseLightLeafInteractor, angleBox, anglesOverlap, displaySpare, fmtBox, headAngles, hideLeafOverlay, insideDisplay, insidePreviewStill, log, mustFind, roundedRectCornersOf, waitForReady, waitUntil} from "./CaseLightLeafSupport"
import {HISTORY1_KEY, HISTORY2_KEY, ROUTE1_KEY, logStore, ourStoreKeys, shown, shownText, storeHas, storeJson} from "./CaseLightProgressSupport"
import {OwnModel, PassTally, playRecallPass} from "./CaseLightRecallSupport"
import {caseItemBoxes, census, textCorners} from "./CaseLightSpacingSupport"

/** The caption, written out here (not read from the product). */
const CAPTION = "Recall passes"
/** Label slots the view draws (the newest five kept). */
const LABEL_SLOTS = 5

interface Point {
  x: number
  y: number
}

function label(p: Point): string {
  return `${p.x}/${p.y}`
}

function pointOf(t: PassTally): Point {
  return {x: t.fromMemory, y: t.fromMemory + t.helped}
}

/** The test's own reading of a saved curve: a list of whole-number {x, y}, or null. */
function savedCurve(key: string): Point[] | null {
  const v = storeJson(key)
  if (v === null || v === "bad" || !Array.isArray(v)) return null
  const out: Point[] = []
  for (const it of v) {
    if (!it || typeof it.x !== "number" || typeof it.y !== "number") return null
    out.push({x: it.x, y: it.y})
  }
  return out
}

function union(boxes: AngleBox[]): AngleBox {
  const b: AngleBox = {minYaw: 1e9, maxYaw: -1e9, minPitch: 1e9, maxPitch: -1e9}
  for (const x of boxes) {
    b.minYaw = Math.min(b.minYaw, x.minYaw)
    b.maxYaw = Math.max(b.maxYaw, x.maxYaw)
    b.minPitch = Math.min(b.minPitch, x.minPitch)
    b.maxPitch = Math.max(b.maxPitch, x.maxPitch)
  }
  return b
}

/** World vertices the line mesh draws. */
function lineWorldPoints(): vec3[] {
  const so = mustFind("LearningCurveLine")
  const rmv = so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
  const raw = rmv.mesh.extractVerticesForAttribute("position")
  const m = so.getTransform().getWorldTransform()
  const out: vec3[] = []
  for (let k = 0; k + 2 < raw.length; k += 3) out.push(m.multiplyPoint(new vec3(raw[k], raw[k + 1], raw[k + 2])))
  return out
}

/** The line's leftmost and rightmost dots: each the mean height (pitch, deg) of the vertices on its outer edge. */
function endDotPitches(): {left: number; right: number; n: number} {
  const a = lineWorldPoints().map((p) => headAngles(p))
  let minYaw = 1e9
  let maxYaw = -1e9
  for (const v of a) {
    minYaw = Math.min(minYaw, v.x)
    maxYaw = Math.max(maxYaw, v.x)
  }
  const mean = (f: (v: vec2) => boolean) => {
    const s = a.filter(f)
    return s.reduce((t, v) => t + v.y, 0) / Math.max(1, s.length)
  }
  return {left: mean((v) => v.x < minYaw + 0.01), right: mean((v) => v.x > maxYaw - 0.01), n: a.length}
}

/** The drawn labels, in index order: text and yaw (from the eye) of each one shown. */
function drawnLabels(): {i: number; text: string; yaw: number}[] {
  const out: {i: number; text: string; yaw: number}[] = []
  for (let i = 0; i < LABEL_SLOTS; i++) {
    const name = `LearningCurveLabel_${i}`
    if (!shown(name)) continue
    const c = textCorners(mustFind(name))
    if (!c) continue
    out.push({i, text: shownText(name), yaw: (angleBox(c).minYaw + angleBox(c).maxYaw) / 2})
  }
  return out
}

/** Text bounds settle one frame after a Text is shown or changed (they read as the whole sphere in that frame). */
async function settle(): Promise<void> {
  await nextFrame()
  await nextFrame()
}

/** Each drawn part of the curve as an angle box: the caption, every shown label, the line. */
function curveParts(): NamedBox[] {
  const parts: NamedBox[] = []
  const cap = textCorners(mustFind("LearningCurveCaption"))
  if (!cap) throw new Error("LearningCurveCaption has no Text")
  parts.push({name: "caption", box: angleBox(cap)})
  for (let i = 0; i < LABEL_SLOTS; i++) {
    const name = `LearningCurveLabel_${i}`
    if (!shown(name)) continue
    const c = textCorners(mustFind(name))
    if (c) parts.push({name: `label ${i}`, box: angleBox(c)})
  }
  parts.push({name: "line", box: angleBox(lineWorldPoints())})
  return parts
}

/** The welcome panel as drawn: every rounded rectangle and Text under WelcomeProgress, as one box. */
function welcomeBox(): {box: AngleBox; rects: number; texts: number} {
  const boxes: AngleBox[] = []
  let rects = 0
  let texts = 0
  const walk = (so: SceneObject) => {
    if (!so.isEnabledInHierarchy) return
    try {
      boxes.push(angleBox(roundedRectCornersOf(so)))
      rects++
    } catch (e) {
      // Not a rounded rectangle.
    }
    // An empty Text has no usable box (its bounds read as the whole sphere); it draws nothing.
    const tc = so.getComponent("Component.Text") as Text
    const t = tc && tc.text.trim().length > 0 ? textCorners(so) : null
    if (t) {
      boxes.push(angleBox(t))
      texts++
    }
    for (let i = 0; i < so.getChildrenCount(); i++) walk(so.getChild(i))
  }
  walk(mustFind("WelcomeProgress"))
  return {box: union(boxes), rects, texts}
}

function optionalBox(label: string, make: () => vec3[]): NamedBox | null {
  try {
    return {name: label, box: angleBox(make())}
  } catch (e) {
    log(`CURVE neighbour ${label}: not measurable (${e})`)
    return null
  }
}

function textOf(name: string): vec3[] {
  const c = textCorners(mustFind(name))
  if (!c) throw new Error(`${name} has no Text`)
  return c
}

/** No Interactable or collider anywhere under the curve, and the census counts nothing of it. */
function expectNotPinchable(ctx: string): void {
  const takers: string[] = []
  const walk = (so: SceneObject) => {
    if (so.getComponent(Interactable.getTypeName())) takers.push(`${so.name} (Interactable)`)
    if ((so.getComponents("Physics.ColliderComponent") as ColliderComponent[]).length > 0) takers.push(`${so.name} (collider)`)
    for (let i = 0; i < so.getChildrenCount(); i++) walk(so.getChild(i))
  }
  walk(mustFind("LearningCurve"))
  const c = census()
  const counted = c.targets.map((t) => t.name).concat(c.exemptBoxes.map((t) => t.name), c.unclassified).filter((n) => n.indexOf("LearningCurve") === 0)
  log(`CURVE ${ctx}: pinch takers under the curve ${JSON.stringify(takers)}; census entries of it ${JSON.stringify(counted)}`)
  expect(takers.length + counted.length, `${ctx}: the curve takes no pinch (no Interactable, no collider, not in the pinchable census)`).toBe(0)
}

/** Placement: inside the display (and the still), clear of every button, plate, the welcome (when up), the hint, the tag, the caption, and every cell and row label. */
function expectPlacement(main: CaseLightMain, ctx: string, welcomeUp: boolean): void {
  const parts = curveParts()
  const all = union(parts.map((p) => p.box))
  log(`CURVE ${ctx}: ${parts.map((p) => `${p.name} ${fmtBox(p.box)}`).join("; ")}`)
  log(`CURVE ${ctx}: whole curve ${fmtBox(all)}; display spare ${displaySpare(all).toFixed(2)} deg; inside the preview still ${insidePreviewStill(all)}`)
  expect(insideDisplay(all), `${ctx}: the curve inside the display (${fmtBox(all)})`).toBe(true)
  expect(insidePreviewStill(all), `${ctx}: the curve inside a preview still (${fmtBox(all)})`).toBe(true)
  expect(anglesOverlap(all, all), "control: a box overlaps itself").toBe(true)

  // Every pinchable object now (buttons, panel plates, letters), the welcome, and the named neighbours.
  const c = census()
  const neighbours: NamedBox[] = c.targets.concat(c.exemptBoxes)
  if (welcomeUp) {
    const w = welcomeBox()
    log(`CURVE ${ctx}: welcome panel ${fmtBox(w.box)} (${w.rects} rounded rectangles, ${w.texts} Texts)`)
    expect(w.rects >= 1 && w.texts >= 2, `${ctx}: the welcome panel was measured (its plate and lines)`).toBe(true)
    neighbours.push({name: "welcome panel", box: w.box})
  }
  // Named neighbours, each while it is on screen.
  const named: [string, string, () => vec3[]][] = [
    ["start hint", "StartHint", () => [...textOf("StartHint"), ...textOf("StartHintLine2"), ...roundedRectCornersOf(mustFind("StartHintBacking"))]],
    ["version tag", "VersionLabel", () => [...textOf("VersionLabel"), ...roundedRectCornersOf(mustFind("VersionBacking"))]],
    ["case caption", "Caption", () => [...textOf("Caption"), ...roundedRectCornersOf(mustFind("CaptionBacking"))]],
  ]
  for (const [nm, obj, make] of named) {
    if (!shown(obj)) continue
    const nb = optionalBox(nm, make)
    if (nb) neighbours.push(nb)
  }
  let near = {gap: 1e9, pair: ""}
  for (const p of parts)
    for (const nb of neighbours) {
      const g = angularGap(p.box, nb.box)
      if (g < near.gap) near = {gap: g, pair: `${p.name} ~ ${nb.name}`}
      expect(anglesOverlap(p.box, nb.box), `${ctx}: curve ${p.name} clear of ${nb.name} (${fmtBox(nb.box)})`).toBe(false)
    }
  log(`CURVE ${ctx}: ${neighbours.length} neighbours checked (${neighbours.map((n) => n.name).join(", ")}); nearest ${near.pair} ${near.gap.toFixed(2)} deg`)

  // The case's cells and row labels, from drawn bounds (as controlsClearOfCase reads them).
  const items = caseItemBoxes(main)
  expect(angularGap(items[0].box, items[0].box) < 0, "control: the gap rule reads a cell against itself as covering").toBe(true)
  let smallest = 1e9
  let pair = ""
  for (const p of parts)
    for (const it of items) {
      const g = angularGap(p.box, it.box)
      if (g < smallest) {
        smallest = g
        pair = `${p.name} ~ ${it.name}`
      }
    }
  log(`CURVE ${ctx}: ${items.length} cells and row labels; nearest ${pair} ${smallest.toFixed(2)} deg`)
  expect(items.length >= 80, `${ctx}: every cell measured (${items.length} items)`).toBe(true)
  expect(smallest > 0, `${ctx}: the curve covers no cell or row label (nearest ${pair} ${smallest.toFixed(2)} deg)`).toBe(true)
}

/** The curve draws exactly these points: the getters, the drawn labels left to right, the dots' heights. */
function expectCurve(main: CaseLightMain, ctx: string, want: Point[]): void {
  const labels = want.map(label)
  const drawn = drawnLabels()
  log(`CURVE ${ctx}: points ${JSON.stringify(main.learningCurvePoints)}; labels ${JSON.stringify(main.learningCurveLabels)}; drawn ${drawn.map((d) => `${d.i}:"${d.text}"@${d.yaw.toFixed(2)}`).join(" ")}; caption "${shownText("LearningCurveCaption")}"`)
  expect(main.learningCurveShown && shown("LearningCurve") && shown("LearningCurveLine"), `${ctx}: the curve is drawn`).toBe(true)
  expect(shownText("LearningCurveCaption"), `${ctx}: the caption`).toBe(CAPTION)
  expect(JSON.stringify(main.learningCurvePoints), `${ctx}: the points kept`).toBe(JSON.stringify(want))
  expect(JSON.stringify(main.learningCurveLabels), `${ctx}: the labels read out`).toBe(JSON.stringify(labels))
  expect(drawn.length, `${ctx}: ${want.length} labels drawn`).toBe(want.length)
  for (let k = 1; k < drawn.length; k++) expect(drawn[k].yaw > drawn[k - 1].yaw, `${ctx}: label ${k} right of label ${k - 1} (oldest left)`).toBe(true)
  const byYaw = drawn.slice().sort((a, b) => a.yaw - b.yaw).map((d) => d.text)
  expect(JSON.stringify(byYaw), `${ctx}: the labels left to right, oldest to newest`).toBe(JSON.stringify(labels))
  if (want.length >= 2) {
    const d = endDotPitches()
    const leftShare = want[0].x / want[0].y
    const rightShare = want[want.length - 1].x / want[want.length - 1].y
    log(`CURVE ${ctx}: line ${d.n} vertices; leftmost dot at pitch ${d.left.toFixed(3)} deg (share ${leftShare.toFixed(3)}), rightmost at ${d.right.toFixed(3)} deg (share ${rightShare.toFixed(3)})`)
    expect(leftShare !== rightShare, `${ctx}: control: the end points' shares differ (${label(want[0])}, ${label(want[want.length - 1])})`).toBe(true)
    expect((d.right > d.left) === (rightShare > leftShare), `${ctx}: the higher dot is the higher score (left ${label(want[0])}, right ${label(want[want.length - 1])})`).toBe(true)
  }
}

function linesWith(main: CaseLightMain, needle: string): string[] {
  return main.placementLogLines.filter((l) => l.indexOf(needle) >= 0)
}

@component
export class CaseLightLearningCurveScenario extends Scenario {
  /** The second letter presented that is not the hold letter (as extra c5 picks it). */
  private missPiece(main: CaseLightMain, order: number[]): number {
    let seen = 0
    for (const p of order) if (!main.isHoldPiece(p) && ++seen === 2) return p
    return -1
  }

  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    const n = main.pieceCount
    logStore("at open")
    expect(main.routeId, "the Lens opens on route 1").toBe(1)
    const saved = savedCurve(HISTORY1_KEY)
    if (!storeHas(ROUTE1_KEY) || !saved || saved.length === 0 || !main.progressWelcomeShown) throw new Error("run right after extra-progress-welcome (needs the saved progress and learning curve extra-progress-save leaves)")
    await waitUntil(() => !shown("OptionsPanel"), 2000, "the Options panel settled closed at open")
    await settle()

    // ── At open: the saved curve is drawn in the opening view, clear of everything ────────
    log(`CURVE saved at open (test's own reading): ${JSON.stringify(saved)}`)
    expect(storeHas(HISTORY2_KEY), "control: route 2 has no saved curve").toBe(false)
    expectCurve(main, "at open", saved)
    expectPlacement(main, "at open", true)
    expectNotPinchable("at open")
    const chain: string[] = []
    for (let p: SceneObject | null = mustFind("LearningCurve").getParent(); p; p = p.getParent()) chain.push(p.name)
    log(`CURVE parents: ${chain.join(" < ")}`)
    expect(chain[0] === "RoutePicker" && chain.indexOf("CaseControls") > 0, "the curve rides under the route picker in CaseControls (it moves and scales with them on a wall)").toBe(true)

    // ── Reset progress (real input): nothing saved, nothing drawn, caption included ───────
    await ix.pressButton("ResetProgressButton")
    await nextFrame()
    logStore("after Reset progress")
    expect(JSON.stringify(ourStoreKeys()), "Reset progress leaves no key of ours (the curve's key too)").toBe("[]")
    const hidden = ["LearningCurve", "LearningCurveLine", "LearningCurveCaption"].concat(Array.from({length: LABEL_SLOTS}, (_, i) => `LearningCurveLabel_${i}`)).filter((nm) => shown(nm))
    log(`CURVE after Reset progress: shown parts ${JSON.stringify(hidden)}; points ${JSON.stringify(main.learningCurvePoints)}; labels ${JSON.stringify(main.learningCurveLabels)}`)
    expect(main.learningCurveShown || hidden.length > 0, "nothing saved: nothing of the curve is drawn, caption included").toBe(false)
    expect(main.learningCurvePoints.length + main.learningCurveLabels.length, "nothing saved: no points, no labels").toBe(0)

    // ── Pass 1: one letter missed once (it comes back and is placed helped) ──────────────
    const model = new OwnModel(n)
    await ix.pressButton("StartRecallButton")
    model.startPass()
    const missOn = this.missPiece(main, main.bundleOrder)
    expect(missOn >= 0, "a letter that is not the hold letter to miss").toBe(true)
    const t1 = await playRecallPass(ix, main, model, "curve pass 1", (p, k) => p === missOn && k === 0)
    await settle()
    const p1 = pointOf(t1)
    log(`CURVE pass 1 tally: ${t1.fromMemory} from memory, ${t1.helped} helped (point ${label(p1)})`)
    expect(t1.helped === 1 && t1.helpedSet.has(missOn), `pass 1: only letter ${missOn} was helped`).toBe(true)
    expect(main.mode, "pass 1 over").toBe("idle")
    expectCurve(main, "after pass 1", [p1])

    // ── Pass 2: none missed ───────────────────────────────────────────────────────────────
    await ix.pressButton("StartRecallButton")
    model.startPass()
    const t2 = await playRecallPass(ix, main, model, "curve pass 2", () => false)
    await settle()
    const p2 = pointOf(t2)
    log(`CURVE pass 2 tally: ${t2.fromMemory} from memory, ${t2.helped} helped (point ${label(p2)})`)
    expect(t2.helped, "pass 2: no letter helped").toBe(0)
    expect(main.mode, "pass 2 over").toBe("idle")

    // ── Two points, in order, with the right values and labels ──────────────────────────
    const want = [p1, p2]
    expectCurve(main, "after pass 2", want)
    const stored = savedCurve(HISTORY1_KEY)
    log(`CURVE ${HISTORY1_KEY} after pass 2 (test's own reading): ${JSON.stringify(stored)}`)
    expect(JSON.stringify(stored), "the saved curve: the two passes, oldest at the start").toBe(JSON.stringify(want))
    expect(storeHas(HISTORY2_KEY), "per route: route 2's curve is not written").toBe(false)
    const saves = linesWith(main, "event=history-saved")
    log(`CURVE log: ${saves.join(" | ")}`)
    expect(saves.length, "one history-saved line per completed recall pass").toBe(2)
    expect(saves[0].indexOf(`event=history-saved x=${p1.x} y=${p1.y} passes=1`) >= 0 && saves[1].indexOf(`event=history-saved x=${p2.x} y=${p2.y} passes=2`) >= 0, "each save is logged with its point and the curve's length").toBe(true)
    expectPlacement(main, "after pass 2", false)
    expectNotPinchable("after pass 2")
    log(`CURVE done: ${label(p1)} then ${label(p2)}`)
    await hideLeafOverlay()
  }
}
