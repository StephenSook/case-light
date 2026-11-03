// Owns: the test's own expectations for v0.6 feature 3 (sorting reminders): the three reminder texts as written in the build queue, real slot pinches and chooser picks, and the drawn-card measurements (text, at its slot, clear of the slot's label).
// Talks to: CaseLightLeafSupport (the LEAF SIK interactor's pinchAt and pressButton, angle maths, drawn-object helpers), CaseLightMain read-only getters (veteranMode, noteForSlot, isNoteShown, noteSlots, noteChooserOptions, isNoteChooserOpen, noteChooserSlot, slotPinchCount, slotWorldPosition, targetCornersWorld), scene objects SlotPinchTarget / NoteOption_n / Note_<slot> / Label_<slot>.
// Must not: import CaseLightNotes (the rules are written here independently), call product commands or test hooks, or change product state except through real input.

/**
 * The reminder texts are copied from research/packets/CASELIGHT-QUEUE.md item 3 ("Check the
 * street name", "Odd side up, even side back", "Read the whole number"), not from the product.
 */
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {findSceneObjectByName, nextFrame} from "Leaf.lspkg/Utils/common/Utils"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {CaseLightMain} from "../CaseLightMain"
import {AngleBox, CaseLightLeafInteractor, DISPLAY_HALF_H_DEG, DISPLAY_HALF_W_DEG, angleBox, anglesOverlap, charWorldCorners, fmtBox, log, mustFind, roundedRectWorldCorners, waitUntil} from "./CaseLightLeafSupport"

export const REMINDERS = ["Check the street name", "Odd side up, even side back", "Read the whole number"]
export const REMOVE = "Remove note"

/** The drawn labels on the chooser's buttons, top to bottom (only the enabled ones). */
export function drawnChooserLabels(): string[] {
  const out: string[] = []
  for (let i = 0; i < 4; i++) {
    const so = findSceneObjectByName(`NoteOption_${i}`)
    if (!so || !so.isEnabledInHierarchy) continue
    let label = ""
    for (let k = 0; k < so.getChildrenCount(); k++) {
      const c = so.getChild(k)
      if (c.name === "ButtonLabel") label = (c.getComponent("Component.Text") as Text).text
    }
    out.push(label)
  }
  return out
}

/** The slot-pinch target's Interactable, or undefined while it is off. */
export function slotTarget(): Interactable | undefined {
  return findInteractableByName("SlotPinchTarget", undefined, true)
}

/** A real pinch on a slot (aimed at its opening centre) through the LEAF SIK interactor; the chooser must open for it. */
export async function pinchSlotOpens(ix: CaseLightLeafInteractor, main: CaseLightMain, slot: number, ctx: string): Promise<void> {
  const target = slotTarget()
  expect(!!target, `${ctx}: the slot-pinch target takes pinches (Veteran mode on)`).toBe(true)
  const before = main.slotPinchCount
  const r = await ix.pinchAt(target!, main.slotWorldPosition(slot))
  expect(r.hitOnTarget, `${ctx}: the eye ray toward slot ${slot} meets the slot-pinch target (hit ${r.hitName})`).toBe(true)
  expect(r.startFired && r.endFired, `${ctx}: the pinch started and ended on the target (start ${r.startFired}, end ${r.endFired})`).toBe(true)
  await waitUntil(() => main.isNoteChooserOpen, 1000, `${ctx}: chooser opens after the pinch on slot ${slot}`)
  expect(main.noteChooserSlot, `${ctx}: chooser is for slot ${slot}`).toBe(slot)
  expect(main.slotPinchCount - before, `${ctx}: one slot pinch counted`).toBe(1)
}

/** The chooser offers exactly the three reminders (verbatim, in order), plus Remove note only when the slot has a note. */
export function expectChooser(main: CaseLightMain, hasNote: boolean, ctx: string): void {
  const want = hasNote ? REMINDERS.concat([REMOVE]) : REMINDERS.slice()
  const drawn = drawnChooserLabels()
  log(`NOTES ${ctx}: chooser getter ${JSON.stringify(main.noteChooserOptions)}, drawn ${JSON.stringify(drawn)}`)
  expect(JSON.stringify(drawn), `${ctx}: drawn chooser buttons`).toBe(JSON.stringify(want))
  expect(JSON.stringify(main.noteChooserOptions), `${ctx}: noteChooserOptions`).toBe(JSON.stringify(want))
}

/** Press the chooser button that reads `label` (real UIKit press), and wait for the chooser to close. */
export async function pick(ix: CaseLightLeafInteractor, main: CaseLightMain, label: string, ctx: string): Promise<void> {
  const i = drawnChooserLabels().indexOf(label)
  expect(i >= 0, `${ctx}: "${label}" is on the chooser`).toBe(true)
  await ix.pressButton(`NoteOption_${i}`)
  await waitUntil(() => !main.isNoteChooserOpen, 1000, `${ctx}: chooser closes after the pick`)
  await nextFrame()
}

function cellBox(main: CaseLightMain, slot: number): AngleBox {
  return angleBox(main.targetCornersWorld(slot))
}

/**
 * The drawn card of `slot`: shown, reads `text`, sits at its slot as seen from the eye (it spans
 * the cell's centre across and stays within the cell's height), and does not cover the slot's
 * number label. Positive control: the overlap test finds the card over its own text.
 */
export function expectCard(main: CaseLightMain, slot: number, text: string, ctx: string): void {
  const root = mustFind(`Note_${slot}`)
  expect(root.isEnabledInHierarchy && main.isNoteShown(slot), `${ctx}: Note_${slot} drawn (isNoteShown ${main.isNoteShown(slot)})`).toBe(true)
  const t = mustFind(`Note_${slot}_Text`).getComponent("Component.Text") as Text
  expect(t.text, `${ctx}: card text on slot ${slot}`).toBe(text)
  expect(main.noteForSlot(slot), `${ctx}: noteForSlot(${slot})`).toBe(text)
  const plate = angleBox(roundedRectWorldCorners(`Note_${slot}_Plate`))
  const cell = cellBox(main, slot)
  const cx = (cell.minYaw + cell.maxYaw) / 2
  const label = angleBox(charWorldCorners(mustFind(`Label_${slot}`).getComponent("Component.Text") as Text))
  const ink = angleBox(charWorldCorners(t))
  log(`NOTES ${ctx}: card ${fmtBox(plate)}; cell ${fmtBox(cell)}; label ${fmtBox(label)}`)
  expect(plate.minYaw <= cx && plate.maxYaw >= cx, `${ctx}: card spans slot ${slot}'s centre across (centre yaw ${cx.toFixed(2)})`).toBe(true)
  expect(anglesOverlap(plate, ink), `${ctx}: control: the card overlaps its own text`).toBe(true)
  expect(anglesOverlap(plate, label), `${ctx}: card does not cover slot ${slot}'s label`).toBe(false)
  expect(plate.minPitch >= cell.minPitch && plate.maxPitch <= cell.maxPitch, `${ctx}: card within slot ${slot}'s height (card pitch ${plate.minPitch.toFixed(2)}..${plate.maxPitch.toFixed(2)}, cell ${cell.minPitch.toFixed(2)}..${cell.maxPitch.toFixed(2)})`).toBe(true)
}

/** No reminder or card text names a house number (no digits, no address number from the route). Positive control: the route's addresses do. */
export function expectNoHouseNumbers(main: CaseLightMain, texts: string[], ctx: string): void {
  const numbers: string[] = []
  for (let i = 0; i < main.pieceCount; i++) {
    const m = main.addressOf(i).match(/^\d+/)
    if (m) numbers.push(m[0])
  }
  expect(numbers.length, `${ctx}: control: every route address starts with a house number the detector sees`).toBe(main.pieceCount)
  for (const s of texts) {
    expect(/\d/.test(s), `${ctx}: "${s}" has no digit`).toBe(false)
    for (const n of numbers) expect(s.indexOf(n) < 0, `${ctx}: "${s}" does not name house number ${n}`).toBe(true)
  }
}

/** Angle box of an object's world corners seen from a head turned (yaw, then pitch) to face `centre`. */
export function boxFromTurnedHead(points: vec3[], centre: vec3): {box: AngleBox; yawDeg: number; pitchDeg: number} {
  const inv = WorldCameraFinderProvider.getInstance().getInvertedWorldTransform()
  const c = inv.multiplyPoint(centre)
  const yaw = Math.atan2(c.x, -c.z)
  const rotY = (v: vec3) => new vec3(v.x * Math.cos(yaw) + v.z * Math.sin(yaw), v.y, -v.x * Math.sin(yaw) + v.z * Math.cos(yaw))
  const cy = rotY(c)
  const pitch = Math.atan2(cy.y, -cy.z)
  const rotX = (v: vec3) => new vec3(v.x, v.y * Math.cos(pitch) + v.z * Math.sin(pitch), -v.y * Math.sin(pitch) + v.z * Math.cos(pitch))
  const b: AngleBox = {minYaw: 1e9, maxYaw: -1e9, minPitch: 1e9, maxPitch: -1e9}
  for (const p of points) {
    const l = rotX(rotY(inv.multiplyPoint(p)))
    const a = (Math.atan2(l.x, -l.z) * 180) / Math.PI
    const e = (Math.atan2(l.y, -l.z) * 180) / Math.PI
    b.minYaw = Math.min(b.minYaw, a)
    b.maxYaw = Math.max(b.maxYaw, a)
    b.minPitch = Math.min(b.minPitch, e)
    b.maxPitch = Math.max(b.maxPitch, e)
  }
  return {box: b, yawDeg: (yaw * 180) / Math.PI, pitchDeg: (pitch * 180) / Math.PI}
}

export function spareInDisplay(b: AngleBox): number {
  return Math.min(DISPLAY_HALF_W_DEG - Math.max(Math.abs(b.minYaw), Math.abs(b.maxYaw)), DISPLAY_HALF_H_DEG - Math.max(Math.abs(b.minPitch), Math.abs(b.maxPitch)))
}
