// Owns: the LEAF test interactor (real SIK grab, drag, release and UIKit press) and the shared helpers and assertions every CaseLight scenario uses.
// Talks to: LEAF (DefaultLeafInteractor, expect, Utils), SIK (Interactable, WorldCameraFinderProvider), CaseLightMain (read-only getters and pure helpers only).
// Must not: call CaseLightMain's test hooks or commands, change product state directly, or edit anything outside the test interactor.

/**
 * CaseLightLeafSupport: shared helpers and the LEAF interactor for the CaseLight scenarios.
 *
 * Input used by the scenarios is REAL SIK input driven by LEAF: a DefaultLeafInteractor
 * (a SIK CustomController interactor) hovers, selects and drags the Piece_n Interactable, so
 * SIK's InteractableManipulation moves the letter and the Lens's own onManipulationStart /
 * onManipulationEnd handlers decide the grab and the drop. UIKit buttons are pressed with
 * LEAF trigger(). Nothing here calls the Lens's test hooks.
 *
 * dragTo() moves the interactor ray origin and end point together by a clamped step each frame
 * (no rotation of the ray), so SIK translates the held letter by exactly that offset. The step
 * stays in the camera's x/y plane so SIK's z-stretch does not kick in. After the commanded move
 * it keeps holding until SIK's translation filter has settled on the destination, then lets go.
 */

import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {awaitEventOnce, findSceneObjectByName, nextFrame, sleep, withTimeout} from "Leaf.lspkg/Utils/common/Utils"
import {DiagnosticReportOverlay} from "Leaf.lspkg/Diagnostic/DiagnosticReportOverlay"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {CaseLightMain} from "../CaseLightMain"

/** The orchestrator on the "CaseLight" scene object. */
export function getMain(): CaseLightMain {
  const so = findSceneObjectByName("CaseLight")
  if (!so) throw new Error("Scene object 'CaseLight' not found")
  const main = so.getComponent(CaseLightMain.getTypeName()) as CaseLightMain
  if (!main) throw new Error("CaseLightMain component not found on 'CaseLight'")
  return main
}

/** Scene object by exact name, or throw. */
export function mustFind(name: string): SceneObject {
  const so = findSceneObjectByName(name)
  if (!so) throw new Error(`Scene object '${name}' not found`)
  return so
}

/** Poll a condition every frame until true, or throw after timeoutMs. */
export async function waitUntil(cond: () => boolean, timeoutMs: number, label: string): Promise<void> {
  const end = getTime() * 1000 + timeoutMs
  while (!cond()) {
    if (getTime() * 1000 > end) throw new Error(`Timed out after ${timeoutMs} ms waiting for: ${label}`)
    await nextFrame()
  }
}

/** Wait until the Lens is initialised (CaseLightMain.onStart finished). */
export async function waitForReady(): Promise<CaseLightMain> {
  await waitUntil(() => {
    const so = findSceneObjectByName("CaseLight")
    if (!so) return false
    const m = so.getComponent(CaseLightMain.getTypeName()) as CaseLightMain
    return !!m && m.isReady
  }, 10000, "CaseLightMain.isReady")
  const main = getMain()
  expect(main.litLabelSlot, "nothing lit when the label colour baseline is taken").toBe(-1)
  recordLabelBaseline()
  return main
}

/** The enabled Interactable of Piece_<index>, or undefined if that letter cannot be grabbed now. */
export function pieceInteractable(index: number): Interactable | undefined {
  return findInteractableByName(`Piece_${index}`, undefined, true)
}

/** Wait until the top letter of the bundle is grabbable (after a pass starts or a letter returns). */
export async function waitForTopGrabbable(main: CaseLightMain, timeoutMs: number = 4000): Promise<number> {
  await waitUntil(() => {
    const top = main.topPieceIndex
    return top >= 0 && main.heldPieceIndex < 0 && main.bundle.activePieceIndex === top && !!pieceInteractable(top)
  }, timeoutMs, "top letter grabbable")
  return main.topPieceIndex
}

/**
 * A point on the eye ray toward `targetWorld`, at the same camera-space depth as `fromWorld`.
 * Dropping a letter there means the user sees it over `targetWorld` (the Lens's drop rule).
 */
export function eyeRayPointAtDepthOf(targetWorld: vec3, fromWorld: vec3): vec3 {
  const cam = WorldCameraFinderProvider.getInstance()
  const inv = cam.getInvertedWorldTransform()
  const eye = cam.getWorldPosition()
  const depthFrom = -inv.multiplyPoint(fromWorld).z
  const depthTarget = -inv.multiplyPoint(targetWorld).z
  if (depthTarget <= 1e-3) throw new Error("Target is not in front of the camera")
  return eye.add(targetWorld.sub(eye).uniformScale(depthFrom / depthTarget))
}

export function fmt(v: vec3): string {
  return `(${v.x.toFixed(2)}, ${v.y.toFixed(2)}, ${v.z.toFixed(2)})`
}

/** Log line with a fixed prefix so results are easy to pull from the Lens Studio log. */
export function log(msg: string): void {
  print(`LEAFT ${msg}`)
}

/** The answer glow is on, on `slot` (0..79 or -2 for the HOLD block), in state and in the scene. */
export function expectGlowAt(main: CaseLightMain, slot: number, ctx: string): void {
  expect(main.litSlotIndex, `${ctx}: litSlotIndex`).toBe(slot)
  expect(main.isGlowVisible, `${ctx}: isGlowVisible`).toBe(true)
  const g = mustFind("SlotGlow")
  expect(g.enabled, `${ctx}: SlotGlow scene object enabled`).toBe(true)
  const d = g.getTransform().getWorldPosition().distance(main.slotWorldPosition(slot))
  expect(d < 0.5, `${ctx}: SlotGlow sits on target ${slot} (off by ${d.toFixed(2)} cm)`).toBe(true)
}

/** Nothing glows, in state and in the scene. */
export function expectNoGlow(main: CaseLightMain, ctx: string): void {
  expect(main.litSlotIndex, `${ctx}: litSlotIndex`).toBe(-1)
  expect(main.isGlowVisible, `${ctx}: isGlowVisible`).toBe(false)
  expect(mustFind("SlotGlow").enabled, `${ctx}: SlotGlow scene object enabled`).toBe(false)
}

/** Edge arrow shown or hidden, in state and in the scene. */
export function expectArrow(main: CaseLightMain, visible: boolean, ctx: string): void {
  expect(main.isEdgeArrowVisible, `${ctx}: isEdgeArrowVisible`).toBe(visible)
  expect(mustFind("EdgeArrow").enabled, `${ctx}: EdgeArrow scene object enabled`).toBe(visible)
}

/**
 * Head-relative (yaw, pitch) in degrees of a world point, computed here from the camera pose
 * (independent of the product's own angle code): yaw = atan2(x, -z), pitch = atan2(y, -z).
 */
export function headAngles(world: vec3): vec2 {
  const l = WorldCameraFinderProvider.getInstance().getInvertedWorldTransform().multiplyPoint(world)
  const ahead = -l.z
  return new vec2((Math.atan2(l.x, ahead) * 180) / Math.PI, (Math.atan2(l.y, ahead) * 180) / Math.PI)
}

export interface DisplayFit {
  /** The cell's centre point is outside the display rectangle. */
  centerOutside: boolean
  /** Any part of the cell (centre or any of its four corners) is outside the display rectangle. */
  cellOutside: boolean
}

/**
 * Where a target sits against the display rectangle from the current head pose, worked out in the
 * test from the cell's four world corners and the display's half-size. It does NOT call the
 * product's step(), so a regression in step() cannot agree with itself here.
 */
export function displayFit(main: CaseLightMain, slot: number): DisplayFit {
  const hw = main.viewCue.halfWidthDeg
  const hh = main.viewCue.halfHeightDeg
  const out = (a: vec2) => Math.abs(a.x) > hw || Math.abs(a.y) > hh
  const centerOutside = out(headAngles(main.slotWorldPosition(slot)))
  const corners = main.targetCornersWorld(slot)
  if (corners.length !== 4) throw new Error(`targetCornersWorld(${slot}) returned ${corners.length} corners`)
  let cellOutside = centerOutside
  for (const c of corners) if (out(headAngles(c))) cellOutside = true
  return {centerOutside, cellOutside}
}

/** True when any part of the lit cell is outside the display rectangle (the arrow should show). */
export function targetOutsideDisplay(main: CaseLightMain, slot: number): boolean {
  return displayFit(main, slot).cellOutside
}

/** Distance of the head-locked overlay plane the arrow is drawn on (CaseLightViewCue: 50 cm). */
const CUE_PLANE_CM = 50

/**
 * The arrow points the way the target lies and sits on the rectangle that is the display edge
 * pulled in by the product's arrowInsetCm (so it stays inside the binocular overlap).
 * The expected position is derived from viewCue.arrowInsetCm, not a fixed number.
 * Returns the cosine between the arrow's on-screen position and the target's on-screen
 * direction (1 = exactly toward it).
 */
export function expectArrowPointsAt(main: CaseLightMain, slot: number, ctx: string): number {
  const vc = main.viewCue
  const a = headAngles(main.slotWorldPosition(slot))
  const toTarget = new vec2(Math.tan((a.x * Math.PI) / 180), Math.tan((a.y * Math.PI) / 180)).normalize()
  const p = mustFind("EdgeArrow").getTransform().getLocalPosition()
  const onScreen = new vec2(p.x, p.y)
  const cos = onScreen.normalize().dot(toTarget)
  expect(cos > 0.995, `${ctx}: arrow sits on the side of the target (cos ${cos.toFixed(4)})`).toBe(true)
  // The arrow mesh's tip points along its local +X (tip at the origin, tail at -X); turn that by
  // the arrow's own rotation and check the tip points toward the target, not just sits beside it.
  const tip = mustFind("EdgeArrow").getTransform().getLocalRotation().multiplyVec3(vec3.right())
  const tipCos = new vec2(tip.x, tip.y).normalize().dot(toTarget)
  expect(tipCos > 0.995, `${ctx}: arrow tip points toward the target (cos ${tipCos.toFixed(4)})`).toBe(true)
  const fullX = CUE_PLANE_CM * Math.tan((vc.halfWidthDeg * Math.PI) / 180)
  const fullY = CUE_PLANE_CM * Math.tan((vc.halfHeightDeg * Math.PI) / 180)
  const inset = vc.arrowInsetCm
  expect(inset > 0 && inset < Math.min(fullX, fullY), `${ctx}: arrowInsetCm ${inset} is a sensible inset`).toBe(true)
  const hx = fullX - inset
  const hy = fullY - inset
  const ratio = Math.max(Math.abs(p.x) / hx, Math.abs(p.y) / hy)
  expect(Math.abs(ratio - 1) < 0.02, `${ctx}: arrow sits ${inset} cm inside the display edge (inset-edge ratio ${ratio.toFixed(3)})`).toBe(true)
  expect(Math.abs(p.x) <= hx + 0.05 && Math.abs(p.y) <= hy + 0.05, `${ctx}: arrow inside the display by the inset (x ${p.x.toFixed(2)}, y ${p.y.toFixed(2)})`).toBe(true)
  return cos
}

/** A wrong separation next to `target` on the same shelf, never in the HOLD block. */
export function neighbourSlot(target: number): number {
  const col = target % 40
  return col < 35 ? target + 1 : target - 1
}

/** The one-time hint is shown (or hidden), in state and in the scene. */
export function expectHint(main: CaseLightMain, visible: boolean, ctx: string): void {
  expect(main.isHintVisible, `${ctx}: isHintVisible`).toBe(visible)
  expect(mustFind("StartHint").enabled, `${ctx}: StartHint scene object enabled`).toBe(visible)
}

/** The end-of-recall result is shown (or hidden), in state and in the scene. */
export function expectResult(main: CaseLightMain, visible: boolean, ctx: string): void {
  expect(main.isResultVisible, `${ctx}: isResultVisible`).toBe(visible)
  expect(mustFind("ResultText").enabled, `${ctx}: ResultText scene object enabled`).toBe(visible)
}

/**
 * The approved default score card wording, written here in the test (not read from the product's
 * resultTemplate input, so the product cannot redefine its own oracle). X = from memory, Y = placed.
 */
export function expectedResult(x: number, y: number): string {
  return `From memory: ${x} of ${y} this session`
}

/** Parse the shown card text against the approved wording into [X, Y], or throw. */
export function parseResult(text: string): number[] {
  const m = text.match(/^From memory: (\d+) of (\d+) this session$/)
  if (!m) throw new Error(`Result text "${text}" is not the approved "From memory: X of Y this session"`)
  return [parseInt(m[1], 10), parseInt(m[2], 10)]
}

/** The approved default for how long the score card stays up (brief: "about 5 seconds"). */
export const APPROVED_RESULT_SECONDS = 5

/** Second hint line shown (or hidden), in state and in the scene. */
export function expectHintLine2(main: CaseLightMain, visible: boolean, ctx: string): void {
  expect(main.isHintLine2Visible, `${ctx}: isHintLine2Visible`).toBe(visible)
  expect(mustFind("StartHintLine2").enabled, `${ctx}: StartHintLine2 scene object enabled`).toBe(visible)
}

function isWhite(c: vec4): boolean {
  return c.x > 0.99 && c.y > 0.99 && c.z > 0.99
}

/** The Text of a cell's number label (Label_<slot>), or null when the cell has no label (HOLD cells). */
export function labelText(slot: number): Text | null {
  const so = findSceneObjectByName(`Label_${slot}`)
  return so ? (so.getComponent("Component.Text") as Text) : null
}

/**
 * The lit cell's own label is lit (state, white text, highlight behind it) and its neighbours are
 * not. slot = -2 means the HOLD label.
 */
export function expectLabelLit(main: CaseLightMain, slot: number, ctx: string): void {
  expect(main.litLabelSlot, `${ctx}: litLabelSlot`).toBe(slot)
  expect(main.isLabelLit(slot), `${ctx}: isLabelLit(${slot})`).toBe(true)
  const hl = mustFind("LabelHighlight")
  expect(hl.enabled, `${ctx}: LabelHighlight shown`).toBe(true)
  const target = main.slotWorldPosition(slot)
  const dx = Math.abs(hl.getTransform().getWorldPosition().x - target.x)
  expect(dx < 0.3, `${ctx}: LabelHighlight under target ${slot} (dx ${dx.toFixed(2)} cm)`).toBe(true)
  if (slot === -2) {
    const hold = mustFind("HoldLabel").getComponent("Component.Text") as Text
    expect(isWhite(hold.textFill.color), `${ctx}: HoldLabel text lit (white)`).toBe(true)
    for (const n of [35, 36, 37, 38, 39]) expect(main.isLabelLit(n), `${ctx}: isLabelLit(${n}) next to HOLD`).toBe(false)
    const l35 = labelText(35)
    if (!l35) throw new Error("Label_35 missing")
    expect(isWhite(l35.textFill.color), `${ctx}: Label_35 next to HOLD keeps its street colour`).toBe(false)
    return
  }
  const own = labelText(slot)
  if (!own) throw new Error(`Label_${slot} missing`)
  expect(isWhite(own.textFill.color), `${ctx}: Label_${slot} text lit (white)`).toBe(true)
  let neighbours = 0
  for (const n of [slot - 1, slot + 1]) {
    expect(main.isLabelLit(n), `${ctx}: neighbour isLabelLit(${n})`).toBe(false)
    const t = labelText(n)
    if (t) {
      neighbours++
      expect(isWhite(t.textFill.color), `${ctx}: neighbour Label_${n} keeps its street colour`).toBe(false)
    }
  }
  expect(neighbours > 0, `${ctx}: at least one labelled neighbour checked`).toBe(true)
}

/** Rendered text colour of every numbered label and the HOLD label, captured with nothing lit. */
let labelBaseline: Map<string, vec4> | null = null

/** Capture the normal (unlit) label colours. Called by waitForReady at the start of every scenario. */
export function recordLabelBaseline(): void {
  const m = new Map<string, vec4>()
  for (let s = 0; s < 80; s++) {
    const t = labelText(s)
    if (t) m.set(`Label_${s}`, t.textFill.color)
  }
  const hold = findSceneObjectByName("HoldLabel")
  if (hold) m.set("HoldLabel", (hold.getComponent("Component.Text") as Text).textFill.color)
  labelBaseline = m
}

function sameColour(a: vec4, b: vec4): boolean {
  return Math.abs(a.x - b.x) < 1e-3 && Math.abs(a.y - b.y) < 1e-3 && Math.abs(a.z - b.z) < 1e-3 && Math.abs(a.w - b.w) < 1e-3
}

/**
 * No label is lit: state, highlight, AND the rendered text colour of every numbered label and the
 * HOLD label is back to its normal colour (the product restores colours separately from the state).
 */
export function expectNoLabelLit(main: CaseLightMain, ctx: string): void {
  expect(main.litLabelSlot, `${ctx}: litLabelSlot`).toBe(-1)
  expect(mustFind("LabelHighlight").enabled, `${ctx}: LabelHighlight shown`).toBe(false)
  if (!labelBaseline) throw new Error("label colour baseline not recorded")
  expect(labelBaseline.size, `${ctx}: label baseline covers the labelled cells and HOLD`).toBe(77)
  labelBaseline.forEach((normal, name) => {
    const t = mustFind(name).getComponent("Component.Text") as Text
    expect(sameColour(t.textFill.color, normal), `${ctx}: ${name} back to its normal colour`).toBe(true)
  })
}

export interface Answer {
  /** The separation whose printed label carries this house number on this street, or -2 when none does. */
  slot: number
  /** 0 = left number on the label, 1 = right number, -1 for the HOLD block. */
  side: number
}

/**
 * Independent answer for piece i, read from what is printed in the scene and not from the
 * product's answer key: the address on the letter (its AddressText), and the case's own labels
 * (Label_<slot> prints "left\nright" house numbers, coloured by street like the street names).
 * A house number that no label on its street carries is a hold piece: answer -2 (HOLD block).
 * Asserts the product's targetSlotOf(i) agrees, then returns the independent answer.
 */
export function answerFor(main: CaseLightMain, i: number): Answer {
  if (!labelBaseline) throw new Error("label colour baseline not recorded")
  const card = mustFind(`Piece_${i}`).getChild(0)
  let address = ""
  for (let k = 0; k < card.getChildrenCount(); k++) {
    const c = card.getChild(k)
    if (c.name === "AddressText") address = (c.getComponent("Component.Text") as Text).text
  }
  const m = address.match(/^(\d+) (.+)$/)
  if (!m) throw new Error(`Piece_${i} address not readable: "${address}"`)
  const house = m[1]
  const street = m[2]
  // Street colour from the printed street names (StreetName_n) that read this street.
  let streetColour: vec4 | null = null
  for (let n = 0; n < 12; n++) {
    const so = findSceneObjectByName(`StreetName_${n}`)
    if (!so) continue
    const t = so.getComponent("Component.Text") as Text
    if (t.text === street) streetColour = t.textFill.color
  }
  if (!streetColour) throw new Error(`no printed street name reads "${street}"`)
  const hits: Answer[] = []
  for (let s = 0; s < 80; s++) {
    const t = labelText(s)
    const normal = labelBaseline.get(`Label_${s}`)
    if (!t || !normal || !sameColour(normal, streetColour)) continue
    const nums = t.text.split("\n")
    const side = nums.indexOf(house)
    if (side >= 0) hits.push({slot: s, side})
  }
  expect(hits.length <= 1, `"${address}" printed on at most one label (found ${hits.length})`).toBe(true)
  const answer: Answer = hits.length === 1 ? hits[0] : {slot: -2, side: -1}
  expect(main.targetSlotOf(i), `product answer for "${address}" matches the printed case (independent ${answer.slot})`).toBe(answer.slot)
  return answer
}

/** Where piece `i` belongs, from the independent answer: its separation, or HOLD cell 37 for the hold piece. */
export function dropSlotFor(main: CaseLightMain, i: number): number {
  const a = answerFor(main, i)
  return a.slot === -2 ? 37 : a.slot
}

/** The independent answer slot (separation, or -2 for the HOLD block) of piece i. */
export function targetOf(main: CaseLightMain, i: number): number {
  return answerFor(main, i).slot
}

/** Playable row of a target, from the slot numbering alone (0..39 lower, 40..79 upper; HOLD is lower). */
export function rowOfTarget(slot: number): number {
  return slot === -2 ? 0 : Math.floor(slot / 40)
}

/** A separation in the other playable row, same column (for "the other row is not lit"). */
function otherRowSlot(slot: number): number {
  const s = slot === -2 ? 37 : slot
  return s < 40 ? s + 40 : s - 40
}

/**
 * World box of the vertices a RenderMeshVisual actually draws: its mesh's position data, put
 * through the object's world transform. (The engine's worldAabbMin/Max for these built meshes
 * reaches y = 0 even for a row mesh that sits wholly below it, so it is not used for coverage.)
 * extractVerticesForAttribute is deprecated in Lens Studio, so real vertex data is required.
 */
export function drawnWorldBox(name: string): {lo: vec3; hi: vec3; n: number; pts: vec3[]} {
  const so = mustFind(name)
  const rmv = so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
  const pts = rmv.mesh.extractVerticesForAttribute("position")
  expect(pts.length >= 9, `${name}: vertex positions readable (${pts.length} values)`).toBe(true)
  const m = so.getTransform().getWorldTransform()
  let lo = new vec3(1e9, 1e9, 1e9)
  let hi = new vec3(-1e9, -1e9, -1e9)
  const world: vec3[] = []
  for (let k = 0; k + 2 < pts.length; k += 3) {
    const w = m.multiplyPoint(new vec3(pts[k], pts[k + 1], pts[k + 2]))
    world.push(w)
    lo = new vec3(Math.min(lo.x, w.x), Math.min(lo.y, w.y), Math.min(lo.z, w.z))
    hi = new vec3(Math.max(hi.x, w.x), Math.max(hi.y, w.y), Math.max(hi.z, w.z))
  }
  return {lo, hi, n: pts.length / 3, pts: world}
}

/** The LadderGlow drawn box, as text (for failure messages and logs). */
function ladderBox(): string {
  const b = drawnWorldBox("LadderGlow")
  return `${fmt(b.lo)}..${fmt(b.hi)}`
}

/** True when the LadderGlow mesh's drawn vertices cover this point (x and y, 0.2 cm slack). */
function ladderCovers(world: vec3): boolean {
  const {lo, hi} = drawnWorldBox("LadderGlow")
  return world.x >= lo.x - 0.2 && world.x <= hi.x + 0.2 && world.y >= lo.y - 0.2 && world.y <= hi.y + 0.2
}

/** The Text of a named child of Piece_<i>'s card (AddressText, HoldNoteText, HoldGlossText). */
export function cardText(piece: number, name: string): Text {
  const card = mustFind(`Piece_${piece}`).getChild(0)
  for (let k = 0; k < card.getChildrenCount(); k++) if (card.getChild(k).name === name) return card.getChild(k).getComponent("Component.Text") as Text
  throw new Error(`${name} not found under Piece_${piece}`)
}

/**
 * A card text's rendered box in its letter's own frame (cm, letter centred on its origin).
 * lo/hi: the characters' box (Text.getBoundingBox() of every character, in the Text's local cm)
 * put through the Text's transform into Piece_<i>'s space. meshLo/meshHi: the same for the
 * Text mesh's local box, which is wider by a padding that grows with the font size (about 0.29 cm
 * a side at 1.25 cm capitals, the same for every string: the glyph quads' margin, not ink), so it
 * is logged but not used for fit. The letter turns to face the eye, so a world axis-aligned box
 * would mix in its depth.
 */
export function textBoxOnLetter(piece: number, name: string): {lo: vec3; hi: vec3; meshLo: vec3; meshHi: vec3; textLocal: string} {
  const t = cardText(piece, name)
  const toWorld = t.getSceneObject().getTransform().getWorldTransform()
  const toPiece = mustFind(`Piece_${piece}`).getTransform().getInvertedWorldTransform()
  const boxOf = (xs: number[], ys: number[], zs: number[]) => {
    let lo = new vec3(1e9, 1e9, 1e9)
    let hi = new vec3(-1e9, -1e9, -1e9)
    for (const x of xs)
      for (const y of ys)
        for (const z of zs) {
          const q = toPiece.multiplyPoint(toWorld.multiplyPoint(new vec3(x, y, z)))
          lo = new vec3(Math.min(lo.x, q.x), Math.min(lo.y, q.y), Math.min(lo.z, q.z))
          hi = new vec3(Math.max(hi.x, q.x), Math.max(hi.y, q.y), Math.max(hi.z, q.z))
        }
    return {lo, hi}
  }
  const r = t.getBoundingBox()
  const chars = boxOf([r.left, r.right], [r.bottom, r.top], [0])
  const lmin = t.localAabbMin()
  const lmax = t.localAabbMax()
  const mesh = boxOf([lmin.x, lmax.x], [lmin.y, lmax.y], [lmin.z, lmax.z])
  return {lo: chars.lo, hi: chars.hi, meshLo: mesh.lo, meshHi: mesh.hi, textLocal: `characters ${r.left.toFixed(2)}..${r.right.toFixed(2)} x ${r.bottom.toFixed(2)}..${r.top.toFixed(2)}, mesh ${fmt(lmin)}..${fmt(lmax)}`}
}

/** The held address's rendered box in its letter's own frame. */
export function addressBoxOnLetter(piece: number): {lo: vec3; hi: vec3; meshLo: vec3; meshHi: vec3; textLocal: string} {
  return textBoxOnLetter(piece, "AddressText")
}

export interface LetterDims {
  /** Letter width and height, cm (product getters, checked against the drawn letter). */
  w: number
  h: number
  /** Print width the card's texts must stay inside, cm (product getter). */
  print: number
}

/**
 * Letter size and print width. The sizes come from CaseLightMain's getters (allowed by the
 * brief for this round), and the getters are checked against what is actually drawn: Piece_0's
 * own mesh vertices, in its local frame, span the width and height the getters report plus at
 * most 0.3 cm (the letter's edge outline straddles its border: 0.22 cm thick, half outside).
 */
export function letterDims(main: CaseLightMain): LetterDims {
  const w = main.letterWidthCm
  const h = main.letterHeightCm
  const print = main.printWidthCm
  const rmv = mustFind("Piece_0").getComponent("Component.RenderMeshVisual") as RenderMeshVisual
  const pts = rmv.mesh.extractVerticesForAttribute("position")
  expect(pts.length >= 9, `Piece_0 vertex positions readable (${pts.length} values)`).toBe(true)
  let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9
  for (let k = 0; k + 2 < pts.length; k += 3) {
    minX = Math.min(minX, pts[k]); maxX = Math.max(maxX, pts[k])
    minY = Math.min(minY, pts[k + 1]); maxY = Math.max(maxY, pts[k + 1])
  }
  const dw = maxX - minX - w
  const dh = maxY - minY - h
  expect(dw >= -0.01 && dw <= 0.3, `drawn letter width ${(maxX - minX).toFixed(2)} cm = letterWidthCm ${w} plus its outline`).toBe(true)
  expect(dh >= -0.01 && dh <= 0.3, `drawn letter height ${(maxY - minY).toFixed(2)} cm = letterHeightCm ${h} plus its outline`).toBe(true)
  expect(print > 0 && print < w, `print width ${print} cm is inside the ${w} cm letter`).toBe(true)
  return {w, h, print}
}

/**
 * Display rectangle for the fit checks, from the design brief, not from the product's view cue:
 * "about 23 cm wide by 38 cm tall at 55 cm, which is about 23.6 degrees wide".
 */
export const DISPLAY_HALF_W_DEG = 23.6 / 2
export const DISPLAY_HALF_H_DEG = (Math.atan(19 / 55) * 180) / Math.PI

/** Head-relative angle box (deg) of a set of world points. */
export interface AngleBox {
  minYaw: number
  maxYaw: number
  minPitch: number
  maxPitch: number
}

export function angleBox(points: vec3[]): AngleBox {
  const b: AngleBox = {minYaw: 1e9, maxYaw: -1e9, minPitch: 1e9, maxPitch: -1e9}
  for (const p of points) {
    const a = headAngles(p)
    b.minYaw = Math.min(b.minYaw, a.x); b.maxYaw = Math.max(b.maxYaw, a.x)
    b.minPitch = Math.min(b.minPitch, a.y); b.maxPitch = Math.max(b.maxPitch, a.y)
  }
  return b
}

export function fmtBox(b: AngleBox): string {
  return `yaw ${b.minYaw.toFixed(2)}..${b.maxYaw.toFixed(2)}, pitch ${b.minPitch.toFixed(2)}..${b.maxPitch.toFixed(2)} deg`
}

/** Every corner of the angle box is inside the brief's display rectangle. */
export function insideDisplay(b: AngleBox): boolean {
  return Math.max(Math.abs(b.minYaw), Math.abs(b.maxYaw)) <= DISPLAY_HALF_W_DEG && Math.max(Math.abs(b.minPitch), Math.abs(b.maxPitch)) <= DISPLAY_HALF_H_DEG
}

/** Degrees to spare between the angle box and the edge of the brief's display rectangle (negative: outside). */
export function displaySpare(b: AngleBox): number {
  return Math.min(DISPLAY_HALF_W_DEG - Math.max(Math.abs(b.minYaw), Math.abs(b.maxYaw)), DISPLAY_HALF_H_DEG - Math.max(Math.abs(b.minPitch), Math.abs(b.maxPitch)))
}

/** The two angle boxes overlap (as seen from the eye). */
export function anglesOverlap(a: AngleBox, b: AngleBox): boolean {
  return a.minYaw < b.maxYaw && b.minYaw < a.maxYaw && a.minPitch < b.maxPitch && b.minPitch < a.maxPitch
}

/** World corners of a Text's rendered local box (8 corners). */
export function textWorldCorners(name: string): vec3[] {
  const t = mustFind(name).getComponent("Component.Text") as Text
  const lmin = t.localAabbMin()
  const lmax = t.localAabbMax()
  const m = t.getSceneObject().getTransform().getWorldTransform()
  const out: vec3[] = []
  for (const x of [lmin.x, lmax.x]) for (const y of [lmin.y, lmax.y]) for (const z of [lmin.z, lmax.z]) out.push(m.multiplyPoint(new vec3(x, y, z)))
  return out
}

/**
 * World corners of a UIKit RoundedRectangle as drawn. Its RenderMeshVisual shares one unit mesh
 * and the shader draws the rectangle at mainPass.size (local cm, centred on the object), so the
 * mesh vertices do not show the drawn size; the pass's size does.
 */
export function roundedRectWorldCorners(name: string): vec3[] {
  const so = mustFind(name)
  const rmv = so.getComponent("Component.RenderMeshVisual") as RenderMeshVisual
  const size = (rmv.mainPass as any).size as vec2
  if (!size || !(size.x > 0) || !(size.y > 0)) throw new Error(`${name}: no drawn size on its pass`)
  const m = so.getTransform().getWorldTransform()
  const hx = size.x / 2
  const hy = size.y / 2
  return [new vec3(-hx, -hy, 0), new vec3(hx, -hy, 0), new vec3(hx, hy, 0), new vec3(-hx, hy, 0)].map((c) => m.multiplyPoint(c))
}

/**
 * Hide LEAF's in-world diagnostic report panel and check none of it remains, so a later film
 * capture never shows LEAF's log panel. Called at the end of every scenario.
 * Note: LEAF's manager shows the report panel AFTER run() returns when a run has diagnostics, so
 * this clears any panel up to the end of the run; the manager's own post-run panel is not ours.
 */
export async function hideLeafOverlay(): Promise<void> {
  DiagnosticReportOverlay.hide()
  await nextFrame()
  expect(!!findSceneObjectByName("LeafDiagnosticReportCamera"), "no LeafDiagnosticReportCamera left in the scene").toBe(false)
}

/** Every piece's current practice-ladder rung. */
export function rungs(main: CaseLightMain): number[] {
  const out: number[] = []
  for (let i = 0; i < main.pieceCount; i++) out.push(main.ladderRungOf(i))
  return out
}

/**
 * Ladder rung 1 cue: the playable row holding the target lights (LadderGlow covers the target and
 * not the other row), and NO slot glow, label highlight or arrow gives the cell away.
 */
export function expectRowCue(main: CaseLightMain, target: number, ctx: string): void {
  expect(main.cueKind, `${ctx}: cueKind`).toBe("row")
  expect(main.highlights.regionCue, `${ctx}: regionCue`).toBe("row")
  expect(main.highlights.regionCueRow, `${ctx}: regionCueRow`).toBe(rowOfTarget(target))
  expect(mustFind("LadderGlow").enabled, `${ctx}: LadderGlow shown`).toBe(true)
  expect(ladderCovers(main.slotWorldPosition(target)), `${ctx}: row cue covers target ${target} at ${fmt(main.slotWorldPosition(target))} (box ${ladderBox()})`).toBe(true)
  expect(ladderCovers(main.slotWorldPosition(otherRowSlot(target))), `${ctx}: row cue does not cover the other row at ${fmt(main.slotWorldPosition(otherRowSlot(target)))} (box ${ladderBox()})`).toBe(false)
  expectNoGlow(main, ctx)
  expectNoLabelLit(main, ctx)
  expectArrow(main, false, ctx)
}

/** Ladder rung 2 cue: a band over both playable rows; still no slot glow, label or arrow. */
export function expectShelfCue(main: CaseLightMain, target: number, ctx: string): void {
  expect(main.cueKind, `${ctx}: cueKind`).toBe("shelf")
  expect(main.highlights.regionCue, `${ctx}: regionCue`).toBe("shelf")
  expect(mustFind("LadderGlow").enabled, `${ctx}: LadderGlow shown`).toBe(true)
  expect(ladderCovers(main.slotWorldPosition(target)), `${ctx}: shelf cue covers target ${target} (box ${ladderBox()})`).toBe(true)
  expect(ladderCovers(main.slotWorldPosition(otherRowSlot(target))), `${ctx}: shelf cue covers the other row too at ${fmt(main.slotWorldPosition(otherRowSlot(target)))} (box ${ladderBox()})`).toBe(true)
  expectNoGlow(main, ctx)
  expectNoLabelLit(main, ctx)
  expectArrow(main, false, ctx)
}

/** No ladder region cue is shown. */
export function expectNoRegion(main: CaseLightMain, ctx: string): void {
  expect(main.highlights.regionCue, `${ctx}: regionCue`).toBe("none")
  expect(mustFind("LadderGlow").enabled, `${ctx}: LadderGlow shown`).toBe(false)
}

/** Order-free key for a set of mix-up pairs. */
export function pairsKey(pairs: {dropped: number; right: number}[]): string {
  return pairs
    .map((p) => `${p.dropped}->${p.right}`)
    .sort()
    .join(",")
}

/** No mix-up line is shown: read-outs and the MixUpLineMesh object (absent or disabled). */
export function expectNoMixUp(main: CaseLightMain, ctx: string): void {
  expect(main.mixUpLineCount, `${ctx}: mixUpLineCount`).toBe(0)
  expect(main.isMixUpVisible, `${ctx}: isMixUpVisible`).toBe(false)
  expect(main.mixUpPairs.length, `${ctx}: mixUpPairs`).toBe(0)
  expect(main.mixUpDetails.length, `${ctx}: mixUpDetails`).toBe(0)
  expect(main.mixUpLabelCount, `${ctx}: mixUpLabelCount`).toBe(0)
  const mesh = findSceneObjectByName("MixUpLineMesh")
  expect(!!mesh && mesh.enabled, `${ctx}: MixUpLineMesh shown`).toBe(false)
  expect(mixUpLabelObjectsShown(), `${ctx}: mix-up label objects shown`).toBe(0)
}

/** Mix-up label Text objects (MixUpLabel_<pair>_<end>) enabled in the scene right now. */
export function mixUpLabelObjectsShown(): number {
  const root = findSceneObjectByName("MixUpLabels")
  if (!root) return 0
  let n = 0
  for (let i = 0; i < root.getChildrenCount(); i++) {
    const c = root.getChild(i)
    if (c.name.indexOf("MixUpLabel_") === 0 && c.name.indexOf("_Backing") < 0 && c.isEnabledInHierarchy) n++
  }
  return n
}

/** Mix-up lines shown for exactly these pairs, and the drawn mesh spans every pair's two cells. */
export function expectMixUp(main: CaseLightMain, pairs: {dropped: number; right: number}[], ctx: string): void {
  expect(main.isMixUpVisible, `${ctx}: isMixUpVisible`).toBe(true)
  expect(main.mixUpLineCount, `${ctx}: mixUpLineCount`).toBe(pairs.length)
  expect(pairsKey(main.mixUpPairs), `${ctx}: mixUpPairs`).toBe(pairsKey(pairs))
  const mesh = mustFind("MixUpLineMesh")
  expect(mesh.enabled, `${ctx}: MixUpLineMesh shown`).toBe(true)
  const {pts} = drawnWorldBox("MixUpLineMesh")
  // Each line's two ends sit on its two cells: some drawn vertex within half a line width (+ slack) of each cell centre.
  for (const p of pairs) {
    for (const s of [p.dropped, p.right]) {
      const w = main.slotWorldPosition(s)
      let best = 1e9
      for (const v of pts) best = Math.min(best, Math.sqrt((v.x - w.x) * (v.x - w.x) + (v.y - w.y) * (v.y - w.y)))
      expect(best < 0.3, `${ctx}: a drawn line ends on cell ${s} (pair ${p.dropped}->${p.right}, nearest vertex ${best.toFixed(2)} cm)`).toBe(true)
    }
  }
}

/** World corners of a Text's characters box (getBoundingBox, its local cm) through its transform. */
export function charWorldCorners(t: Text): vec3[] {
  const r = t.getBoundingBox()
  const m = t.getSceneObject().getTransform().getWorldTransform()
  return [new vec3(r.left, r.bottom, 0), new vec3(r.right, r.bottom, 0), new vec3(r.right, r.top, 0), new vec3(r.left, r.top, 0)].map((c) => m.multiplyPoint(c))
}

/** A cell's (or the HOLD block's) opening as a case-local rectangle, from CaseLightMain's cell corners. */
function cellRectLocal(main: CaseLightMain, slotOrHold: number): {x0: number; x1: number; y0: number; y1: number} {
  const inv = main.caseRoot.getTransform().getInvertedWorldTransform()
  const cs = main.targetCornersWorld(slotOrHold).map((c) => inv.multiplyPoint(c))
  return {x0: Math.min(...cs.map((c) => c.x)), x1: Math.max(...cs.map((c) => c.x)), y0: Math.min(...cs.map((c) => c.y)), y1: Math.max(...cs.map((c) => c.y))}
}

/**
 * Which sides of a cell (or the HOLD block) carry drawn mix-up outline, as "L", "R", "B", "T"
 * (left, right, bottom, top; "-" for a missing side): a side counts when at least two
 * MixUpLineMesh vertices lie in a 0.6 cm strip just inside that edge of the opening.
 */
export function outlinedSides(main: CaseLightMain, slotOrHold: number): string {
  const r = cellRectLocal(main, slotOrHold)
  const inv = main.caseRoot.getTransform().getInvertedWorldTransform()
  const pts = drawnWorldBox("MixUpLineMesh").pts.map((p) => inv.multiplyPoint(p))
  const inX = (v: vec3) => v.x > r.x0 && v.x < r.x1
  const inY = (v: vec3) => v.y > r.y0 && v.y < r.y1
  const strip = 0.6
  const sides = [
    pts.filter((v) => v.x >= r.x0 && v.x <= r.x0 + strip && inY(v)).length,
    pts.filter((v) => v.x <= r.x1 && v.x >= r.x1 - strip && inY(v)).length,
    pts.filter((v) => v.y >= r.y0 && v.y <= r.y0 + strip && inX(v)).length,
    pts.filter((v) => v.y <= r.y1 && v.y >= r.y1 - strip && inX(v)).length,
  ]
  return ["L", "R", "B", "T"].map((c, i) => (sides[i] >= 2 ? c : "-")).join("")
}

/** A 0.6 cm strip just inside one side ("L", "R", "B", "T") of a cell's opening, as an angle box from the eye. */
export function sideStripBox(main: CaseLightMain, slotOrHold: number, side: string): AngleBox {
  const r = cellRectLocal(main, slotOrHold)
  const m = main.caseRoot.getTransform().getWorldTransform()
  const strip = 0.6
  const q = side === "L" ? [r.x0, r.y0, r.x0 + strip, r.y1] : side === "R" ? [r.x1 - strip, r.y0, r.x1, r.y1] : side === "B" ? [r.x0, r.y0, r.x1, r.y0 + strip] : [r.x0, r.y1 - strip, r.x1, r.y1]
  return angleBox([new vec3(q[0], q[1], 0), new vec3(q[2], q[1], 0), new vec3(q[2], q[3], 0), new vec3(q[0], q[3], 0)].map((c) => m.multiplyPoint(c)))
}

export interface MixUpEnd {
  dropped: number
  right: number
  /** The letter that was missed (its printed address is read from its own AddressText). */
  piece: number
}

/**
 * Mix-up ends after a recall pass, checked from what is drawn and printed:
 * - each pair's two end cells (the HOLD block for a refused hold piece) are outlined on all four
 *   sides in the drawn mesh, and every drawn vertex has the line's colour;
 * - the dropped-end label reads the address printed on that letter, then "was put here"; the
 *   right-end label reads "goes here";
 * - as seen from the eye, each label (its backing and characters) spans its end cell's centre
 *   across and stays inside that cell's opening up and down;
 * - no two labels overlap, and no label overlaps a case cell label (Label_n) or the HOLD label.
 * Positive controls: the side detector finds no outline on a cell that is not an end; the
 * overlap test reports a label over its own backing; the opening test rejects the other row.
 */
export function expectMixUpEnds(main: CaseLightMain, ends: MixUpEnd[], ctx: string): void {
  const details = main.mixUpDetails
  expect(details.length, `${ctx}: mixUpDetails`).toBe(ends.length)
  expect(main.mixUpLabelCount, `${ctx}: two labels per mix-up`).toBe(2 * ends.length)
  expect(mixUpLabelObjectsShown(), `${ctx}: label Text objects shown`).toBe(2 * ends.length)

  // Colour: every drawn vertex (line pieces and outline bars) has the line colour.
  const rmv = mustFind("MixUpLineMesh").getComponent("Component.RenderMeshVisual") as RenderMeshVisual
  const cols = rmv.mesh.extractVerticesForAttribute("color")
  const lc = main.mixUps.lineColor
  expect(cols.length >= 4, `${ctx}: vertex colours readable (${cols.length})`).toBe(true)
  let off = 0
  for (let k = 0; k + 3 < cols.length; k += 4) {
    if (Math.abs(cols[k] - lc.x) > 1e-3 || Math.abs(cols[k + 1] - lc.y) > 1e-3 || Math.abs(cols[k + 2] - lc.z) > 1e-3 || Math.abs(cols[k + 3] - lc.w) > 1e-3) off++
  }
  expect(off, `${ctx}: drawn vertices not in the line colour ${fmt(new vec3(lc.x, lc.y, lc.z))}`).toBe(0)

  // Outline positive control: a cell that is no end shows no outline.
  const endCells = new Set<number>()
  for (const e of ends) {
    endCells.add(e.dropped)
    endCells.add(e.right)
  }
  let quiet = -1
  for (const c of [0, 79, 20, 60]) if (!endCells.has(c)) { quiet = c; break }
  expect(outlinedSides(main, quiet), `${ctx}: no outline on cell ${quiet}, which is no end (positive control)`).toBe("----")

  const boxes: {name: string; box: AngleBox}[] = []
  const outlineChecks: {cell: number; pair: string}[] = []
  for (const e of ends) {
    const i = details.findIndex((d) => d.dropped === e.dropped && d.right === e.right)
    expect(i >= 0, `${ctx}: mix-up ${e.dropped}->${e.right} shown`).toBe(true)
    const d = details[i]
    expect(JSON.stringify(d.outlineCells), `${ctx}: outlineCells of ${e.dropped}->${e.right}`).toBe(JSON.stringify([e.dropped, e.right]))
    for (const cell of [e.dropped, e.right]) outlineChecks.push({cell, pair: `${e.dropped}->${e.right}`})

    const address = cardText(e.piece, "AddressText").text
    for (const end of ["dropped", "right"] as const) {
      const name = `MixUpLabel_${i}_${end}`
      const t = mustFind(name).getComponent("Component.Text") as Text
      const want = end === "dropped" ? `${address}\nwas put here` : "goes here"
      expect(t.text, `${ctx}: ${name} text (letter ${e.piece} reads "${address}")`).toBe(want)
      expect(t.getSceneObject().isEnabledInHierarchy, `${ctx}: ${name} shown`).toBe(true)
      const box = angleBox([...charWorldCorners(t), ...roundedRectWorldCorners(`${name}_Backing`)])
      const cell = end === "dropped" ? e.dropped : e.right
      const cellBox = angleBox(main.targetCornersWorld(cell))
      const centre = headAngles(main.slotWorldPosition(cell))
      log(`MIXUP-ENDS ${name} "${t.text.replace("\n", " / ")}" ${fmtBox(box)}; ${cell === -2 ? "HOLD block" : "cell " + cell} ${fmtBox(cellBox)}`)
      expect(centre.x >= box.minYaw && centre.x <= box.maxYaw, `${ctx}: ${name} spans the centre of ${cell === -2 ? "the HOLD block" : "cell " + cell} across (centre yaw ${centre.x.toFixed(2)}, label ${box.minYaw.toFixed(2)}..${box.maxYaw.toFixed(2)})`).toBe(true)
      const insideOpening = (b: AngleBox, c: AngleBox) => b.minPitch >= c.minPitch && b.maxPitch <= c.maxPitch
      expect(insideOpening(box, cellBox), `${ctx}: ${name} stays inside the opening of ${cell === -2 ? "the HOLD block" : "cell " + cell} up and down (label pitch ${box.minPitch.toFixed(2)}..${box.maxPitch.toFixed(2)}, opening ${cellBox.minPitch.toFixed(2)}..${cellBox.maxPitch.toFixed(2)})`).toBe(true)
      const otherRow = angleBox(main.targetCornersWorld(cell === -2 ? 77 : cell < 40 ? cell + 40 : cell - 40))
      expect(insideOpening(box, otherRow), `${ctx}: opening test rejects the other row for ${name} (positive control)`).toBe(false)
      const own = angleBox(charWorldCorners(t))
      expect(anglesOverlap(own, angleBox(roundedRectWorldCorners(`${name}_Backing`))), `${ctx}: overlap test reports ${name} over its own backing (positive control)`).toBe(true)
      boxes.push({name, box})
    }
  }
  // Each end cell is outlined: a side is drawn, or (by design) left as a gap where a label stands
  // in front of it; at least two sides must be drawn. "g" marks a side that is a gap under a label.
  for (const oc of outlineChecks) {
    const drawn = outlinedSides(main, oc.cell)
    const sides = ["L", "R", "B", "T"].map((c, k) => (drawn[k] === c ? c : boxes.some((b) => anglesOverlap(b.box, sideStripBox(main, oc.cell, c))) ? "g" : "-")).join("")
    const nDrawn = sides.split("").filter((c) => c !== "g" && c !== "-").length
    log(`MIXUP-ENDS outline of ${oc.cell === -2 ? "the HOLD block" : "cell " + oc.cell} (pair ${oc.pair}): ${sides}`)
    expect(sides.indexOf("-") < 0 && nDrawn >= 2, `${ctx}: ${oc.cell === -2 ? "the HOLD block" : "cell " + oc.cell} (pair ${oc.pair}) outlined on every side not under a label, at least 2 drawn (${sides})`).toBe(true)
  }
  for (let a = 0; a < boxes.length; a++)
    for (let b = a + 1; b < boxes.length; b++)
      expect(anglesOverlap(boxes[a].box, boxes[b].box), `${ctx}: ${boxes[a].name} and ${boxes[b].name} do not overlap (${fmtBox(boxes[a].box)} vs ${fmtBox(boxes[b].box)})`).toBe(false)
  let cellLabels = 0
  for (let n = 0; n < 80; n++) {
    const lt = labelText(n)
    if (!lt) continue
    cellLabels++
    const lb = angleBox(charWorldCorners(lt))
    for (const b of boxes) expect(anglesOverlap(b.box, lb), `${ctx}: ${b.name} does not cover cell label Label_${n} (${fmtBox(b.box)} vs ${fmtBox(lb)})`).toBe(false)
  }
  const hold = findSceneObjectByName("HoldLabel")
  if (hold) {
    const hb = angleBox(charWorldCorners(hold.getComponent("Component.Text") as Text))
    for (const b of boxes) expect(anglesOverlap(b.box, hb), `${ctx}: ${b.name} does not cover the HOLD label`).toBe(false)
  }
  expect(cellLabels >= 70, `${ctx}: ${cellLabels} cell labels checked`).toBe(true)
}

/**
 * One cue was played, of this kind, from this target (-2 = HOLD block), counted once, and its
 * audio source was moved to that place.
 */
export function expectCue(main: CaseLightMain, kind: "chime" | "miss", slot: number, countBefore: number, ctx: string): void {
  expect(main.soundPlayCount - countBefore, `${ctx}: soundPlayCount +1`).toBe(1)
  expect(main.lastSoundName, `${ctx}: lastSoundName`).toBe(kind)
  expect(main.lastSoundSlot, `${ctx}: lastSoundSlot`).toBe(slot)
  const src = mustFind(kind === "chime" ? "ChimeSource" : "MissSource").getTransform().getWorldPosition()
  const d = src.distance(main.slotWorldPosition(slot))
  expect(d < 0.5, `${ctx}: ${kind} source placed at target ${slot} (off by ${d.toFixed(2)} cm)`).toBe(true)
}

/** What the cue's AudioComponent is doing right now (read in afterRelease, the frame the Lens handled the drop). */
export interface Playback {
  /** Cues the Lens had issued when this was read (tells whether the drop was already handled). */
  cues: number
  playing: boolean
  duration: number
  position: number
  rightTrack: boolean
  volume: number
  spatial: boolean
  listener: boolean
}

/** Read the cue source's AudioComponent: playing, its track is the product's chime/miss asset, volume, spatial, camera listener. */
export function readPlayback(main: CaseLightMain, kind: "chime" | "miss"): Playback {
  const a = mustFind(kind === "chime" ? "ChimeSource" : "MissSource").getComponent("Component.AudioComponent") as AudioComponent
  const want = kind === "chime" ? main.sounds.chimeTrack : main.sounds.missTrack
  const cam = WorldCameraFinderProvider.getInstance().getComponent().getSceneObject()
  return {
    cues: main.soundPlayCount,
    playing: a.isPlaying(),
    duration: a.duration,
    position: a.position,
    rightTrack: !!a.audioTrack && !!want && a.audioTrack.isSame(want),
    volume: a.volume,
    spatial: a.spatialAudio.enabled,
    listener: !!cam.getComponent("Component.AudioListenerComponent"),
  }
}

/**
 * Poll the cue source every frame for up to `frames` frames, starting now (call it from
 * afterRelease, the frame the Lens handled the drop). Resolves with the read at the earliest frame
 * the source reports isPlaying(), or the last read if it never does, plus how many frames it took.
 */
export async function pollPlayback(main: CaseLightMain, kind: "chime" | "miss", frames: number): Promise<{p: Playback; frame: number; reads: string[]}> {
  const reads: string[] = []
  let p = readPlayback(main, kind)
  for (let f = 0; f <= frames; f++) {
    if (f > 0) {
      await nextFrame()
      p = readPlayback(main, kind)
    }
    if (reads.length < 6) reads.push(`f${f}:${p.playing ? "on" : "off"}@${p.position.toFixed(3)}`)
    if (p.playing) return {p, frame: f, reads}
  }
  return {p, frame: -1, reads}
}

/** The cue is actually playing from its source, with the right track, audible volume, spatial, and a listener on the camera. */
export function expectPlayback(p: Playback | null, kind: "chime" | "miss", ctx: string): void {
  if (!p) throw new Error(`${ctx}: playback not captured`)
  expect(p.playing, `${ctx}: ${kind} source isPlaying()`).toBe(true)
  expect(p.rightTrack, `${ctx}: ${kind} source plays the ${kind} track`).toBe(true)
  expect(p.volume > 0, `${ctx}: ${kind} volume ${p.volume} > 0`).toBe(true)
  expect(p.spatial, `${ctx}: ${kind} spatialAudio.enabled`).toBe(true)
  expect(p.listener, `${ctx}: AudioListenerComponent on the camera object`).toBe(true)
}

export interface DragOptions {
  /** Largest move per frame, cm. */
  maxStepCm?: number
  /** Distance from the destination at which the held letter counts as settled, cm. */
  settleToleranceCm?: number
  /** Extra frames to hold after settling. */
  holdFrames?: number
  /** Runs once while the letter is in hand, before it moves. */
  onHeld?: () => void
  /** Runs once at the destination, still in hand, just before letting go. */
  beforeRelease?: () => void
  /** Runs once right after SIK reports the drag ended (the Lens has handled the release). */
  afterRelease?: () => void
  /** dragPath only: runs at each waypoint once the letter has settled there, still in hand. */
  onWaypoint?: (index: number) => void
  /** Runs on every frame while the letter is in hand (moving and settling). */
  onFrame?: () => void
}

export interface DragReport {
  startPos: vec3
  releasePos: vec3
  moveFrames: number
  settleFrames: number
  dragStartFired: boolean
  dragEndFired: boolean
}

/** Far-field ray length of SIK's real HandInteractor / MouseInteractor (BaseInteractor default). */
const REAL_SIK_RAY_CM = 500

export class CaseLightLeafInteractor extends DefaultLeafInteractor {
  constructor() {
    super("CaseLightLeafInteractor")
    // LEAF's interactor reports maxRaycastDistance = 0. With that, SIK's InteractableManipulation
    // z-stretch clamp goes negative and pulls a held object to about 1 cm from the ray origin
    // (seen in the drag-units probe). Report the same ray length a real SIK hand has instead.
    Object.defineProperty(this.sikInteractor, "maxRaycastDistance", {
      get: () => REAL_SIK_RAY_CM,
      configurable: true,
    })
  }

  /** Real UIKit press: hover, select, release on the named button's Interactable. */
  async pressButton(name: string): Promise<void> {
    const button = findInteractableByName(name, undefined, true)
    if (!button) throw new Error(`Button "${name}" not found or not enabled`)
    await withTimeout(this.trigger(button), 5000, `trigger("${name}") did not complete`)
    await sleep(200)
  }

  /**
   * Real SIK grab, move and release of `target` so it is let go at world point `dest`.
   * The Lens decides the result from where the letter actually is at release.
   */
  async dragTo(target: Interactable, dest: vec3, opts: DragOptions = {}): Promise<DragReport> {
    return this.dragPath(target, [dest], opts)
  }

  /**
   * Real SIK grab, then move through each waypoint in turn (settling at each one, still in
   * hand), and let go at the last. opts.onWaypoint(i) runs at waypoint i.
   */
  async dragPath(target: Interactable, dests: vec3[], opts: DragOptions = {}): Promise<DragReport> {
    if (dests.length === 0) throw new Error("dragPath needs at least one waypoint")
    const dest = dests[dests.length - 1]
    const maxStep = opts.maxStepCm ?? 2.5
    const tol = opts.settleToleranceCm ?? 0.15
    const holdFrames = opts.holdFrames ?? 3
    const t = target.getSceneObject().getTransform()

    let dragStartFired = false
    let dragEndFired = false
    const offStart = target.onDragStart.add(() => (dragStartFired = true))
    const offEnd = target.onDragEnd.add(() => (dragEndFired = true))
    const dragStarted = awaitEventOnce(target.onDragStart)
    const dragEnded = awaitEventOnce(target.onDragEnd)

    try {
      await withTimeout(this.enterHover(target), 3000, `hover on "${target.getSceneObject().name}" never started`)
      await nextFrame()
      await nextFrame()
      this.startSelecting()
      await nextFrame()
      this.overrideDragVector = new vec3(0.01, 0, 0)
      await withTimeout(dragStarted, 3000, `drag on "${target.getSceneObject().name}" never started`)
      await nextFrame()

      if (opts.onHeld) opts.onHeld()

      const startPos = t.getWorldPosition()
      let commanded = vec3.zero()
      let moveFrames = 0
      let settleFrames = 0
      for (let w = 0; w < dests.length; w++) {
        const total = dests[w].sub(startPos)
        let frames = 0
        while (commanded.distance(total) > 1e-4 && frames < 600) {
          const remaining = total.sub(commanded)
          const step = remaining.length > maxStep ? remaining.normalize().uniformScale(maxStep) : remaining
          commanded = commanded.add(step)
          this.startPoint = this.startPoint.add(step)
          this.endPoint = this.endPoint.add(step)
          this.overrideDragVector = step.length > 1e-6 ? step : new vec3(0.01, 0, 0)
          await nextFrame()
          if (opts.onFrame) opts.onFrame()
          frames++
        }
        moveFrames += frames
        let settle = 0
        while (t.getWorldPosition().distance(dests[w]) > tol && settle < 180) {
          await nextFrame()
          if (opts.onFrame) opts.onFrame()
          settle++
        }
        settleFrames += settle
        for (let i = 0; i < holdFrames; i++) {
          await nextFrame()
          if (opts.onFrame) opts.onFrame()
        }
        if (opts.onWaypoint) opts.onWaypoint(w)
      }

      if (opts.beforeRelease) opts.beforeRelease()
      const releasePos = t.getWorldPosition()

      this.stopSelecting()
      try {
        await withTimeout(dragEnded, 2000, "drag end")
      } catch (e) {
        // Reported through dragEndFired; the Lens may disable the letter in the same frame.
      }
      if (opts.afterRelease) opts.afterRelease()
      this.resetStartEndPoint()
      this.overrideDragVector = undefined
      try {
        await withTimeout(this.exitHover(), 1500, "hover exit")
      } catch (e) {
        this.overrideInteractable = undefined
      }
      await nextFrame()
      return {startPos, releasePos, moveFrames, settleFrames, dragStartFired, dragEndFired}
    } catch (e) {
      // Leave SIK in a clean state before rethrowing.
      this.stopSelecting()
      this.overrideDragVector = undefined
      this.overrideInteractable = undefined
      this.resetStartEndPoint()
      throw e
    } finally {
      offStart()
      offEnd()
    }
  }

  /** Grab the top letter and let go so the user sees it over separation `slot` (0..79). */
  async dropTopPieceAtSlot(main: CaseLightMain, slot: number, opts: DragOptions = {}): Promise<DragReport> {
    const top = await waitForTopGrabbable(main)
    const it = pieceInteractable(top)
    if (!it) throw new Error(`Piece_${top} not grabbable`)
    const from = it.getSceneObject().getTransform().getWorldPosition()
    const dest = eyeRayPointAtDepthOf(main.slotWorldPosition(slot), from)
    // Sanity check of the test's own aim (pure helper, same math as a real drop).
    const seen = main.slotUnderWorldPoint(dest)
    if (seen !== slot) throw new Error(`Test aim error: drag target for slot ${slot} projects to slot ${seen}`)
    return this.dragTo(it, dest, opts)
  }

  /** Grab the top letter, hold it over each separation in `slots` in turn, and let go over the last. */
  async dropTopPieceThroughSlots(main: CaseLightMain, slots: number[], opts: DragOptions = {}): Promise<DragReport> {
    const top = await waitForTopGrabbable(main)
    const it = pieceInteractable(top)
    if (!it) throw new Error(`Piece_${top} not grabbable`)
    const from = it.getSceneObject().getTransform().getWorldPosition()
    const dests = slots.map((s) => {
      const d = eyeRayPointAtDepthOf(main.slotWorldPosition(s), from)
      const seen = main.slotUnderWorldPoint(d)
      if (seen !== s) throw new Error(`Test aim error: waypoint for slot ${s} projects to slot ${seen}`)
      return d
    })
    return this.dragPath(it, dests, opts)
  }

  /** pressButton, returning getTime() at the moment the button received its TriggerEnd (the press). */
  async pressButtonTimed(name: string): Promise<number> {
    const button = findInteractableByName(name, undefined, true)
    if (!button) throw new Error(`Button "${name}" not found or not enabled`)
    let at = -1
    const off = button.onTriggerEnd.add(() => (at = getTime()))
    try {
      await withTimeout(this.trigger(button), 5000, `trigger("${name}") did not complete`)
    } finally {
      off()
    }
    await sleep(200)
    return at
  }

  /**
   * A release on a button that did not see this pinch's trigger-down: the pinch starts while
   * aiming at nothing (no TriggerStart goes anywhere), the aim then moves onto the button while
   * still pinched, and the pinch ends there, so SIK sends the button TriggerEnd only. Reports which
   * of the button's trigger events actually fired.
   */
  async strayReleaseOn(name: string): Promise<{startFired: boolean; endFired: boolean}> {
    const button = findInteractableByName(name, undefined, true)
    if (!button) throw new Error(`Button "${name}" not found or not enabled`)
    let startFired = false
    let endFired = false
    const offS = button.onTriggerStart.add(() => (startFired = true))
    const offE = button.onTriggerEnd.add(() => (endFired = true))
    try {
      this.overrideInteractable = undefined
      await nextFrame()
      this.startSelecting()
      await nextFrame()
      await nextFrame()
      await this.setTarget(button)
      for (let i = 0; i < 4; i++) await nextFrame()
      this.stopSelecting()
      for (let i = 0; i < 4; i++) await nextFrame()
    } finally {
      this.stopSelecting()
      this.overrideInteractable = undefined
      this.resetStartEndPoint()
      offS()
      offE()
    }
    await nextFrame()
    return {startFired, endFired}
  }

  /** Grab the top letter and let go without moving it (released over the tray, off the case). */
  async releaseTopPieceInPlace(main: CaseLightMain, opts: DragOptions = {}): Promise<DragReport> {
    const top = await waitForTopGrabbable(main)
    const it = pieceInteractable(top)
    if (!it) throw new Error(`Piece_${top} not grabbable`)
    return this.dragTo(it, it.getSceneObject().getTransform().getWorldPosition(), opts)
  }
}
