// Owns: the LEAF spacing census shared by every spacing check: every pinchable object now (counted UIKit buttons and the named exemptions), each one's angle box from the eye or from a head turned toward a point, one view's check (at least 1 deg apart, at least 2 deg each way) with its log lines, and the clearance between the scaled controls and the case's cells and row labels.
// Talks to: CaseLightTargetSpacing (the pure gap rule), CaseLightLeafSupport (angle boxes, drawn rounded rectangles and vertices, the display rectangle, log), CaseLightNotesSupport (the turned-head box), CaseLightMain read-only (targetCornersWorld, the cells' drawn corners), the SIK Interactable, UIKit Button and BackPlate types, the CaseControls group and the cell and row label Texts by name.
// Must not: press, move or change anything; it only measures and asserts.

/**
 * What counts: every SceneObject enabled in the hierarchy whose SIK Interactable is enabled (it
 * takes a pinch now), measured by what it draws: its UIKit RoundedRectangle (the pass's size
 * through its transform) as a head-relative angle box. Each must be a UIKit Button or one of these
 * named exemptions, or the check fails:
 * - Panel backplates (a UIKit BackPlate: the surface a row or column of buttons stands on). It
 *   takes the ray so a pinch between buttons does not fall through to what is behind, and a pinch
 *   on it does nothing; its buttons are counted.
 * - The letters (Piece_n): grabbed, not pressed, and stacked on purpose.
 * - The case's cells and the shared slot-pinch target (SlotPinchTarget): the cells take pinches
 *   only through that one target over the playable rows, and they touch on purpose, like a real case.
 * - The opening pinch hint (PinchHint and everything under it): a drawing of a hand, never a target.
 * From the eye as it is (the default head), every counted button is checked, in view or not. With a
 * head turned toward a point (a person looking at the Veteran chooser), only the buttons that reach
 * into the display rectangle from that head are checked: what that person sees and can pinch.
 */
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {CaseLightMain} from "../CaseLightMain"
import {MIN_TARGET_GAP_DEG, NamedBox, PairGap, angularGap, pairGaps, pairsCloserThan, smallestTarget} from "../CaseLightTargetSpacing"
import {AngleBox, DISPLAY_HALF_H_DEG, DISPLAY_HALF_W_DEG, angleBox, drawnWorldBox, log, mustFind, roundedRectCornersOf} from "./CaseLightLeafSupport"
import {boxFromTurnedHead} from "./CaseLightNotesSupport"

/** Snap's minimum target size, each way (deg). */
export const MIN_TARGET_DEG = 2.0

export interface Census {
  /** Counted buttons with their boxes. */
  targets: NamedBox[]
  /** Exempt objects by kind. */
  exempt: Record<string, number>
  /** Exempt objects whose drawn box could be measured (backplates, letters). */
  exemptBoxes: NamedBox[]
  /** Pinchable objects that are neither a UIKit Button nor a named exemption. */
  unclassified: string[]
  /** Counted buttons left out because they do not reach into the display from a turned head. */
  outOfView: string[]
}

export function exemptReason(so: SceneObject): string {
  if (so.getComponent(BackPlate.getTypeName())) return "panel backplate"
  if (/^Piece_\d+$/.test(so.name)) return "letter"
  if (so.name === "SlotPinchTarget") return "slot-pinch target"
  for (let p: SceneObject | null = so; p; p = p.getParent()) if (p.name === "PinchHint") return "pinch hint"
  return ""
}

function boxOf(points: vec3[], turnTo?: vec3): AngleBox {
  return turnTo ? boxFromTurnedHead(points, turnTo).box : angleBox(points)
}

function reachesDisplay(b: AngleBox): boolean {
  return b.maxYaw > -DISPLAY_HALF_W_DEG && b.minYaw < DISPLAY_HALF_W_DEG && b.maxPitch > -DISPLAY_HALF_H_DEG && b.minPitch < DISPLAY_HALF_H_DEG
}

/** Every pinchable object now, measured from the eye (or from a head turned toward `turnTo`). */
export function census(turnTo?: vec3): Census {
  const out: Census = {targets: [], exempt: {}, exemptBoxes: [], unclassified: [], outOfView: []}
  const walk = (so: SceneObject) => {
    // Nothing under a disabled object is enabled in the hierarchy.
    if (!so.enabled) return
    const it = so.getComponent(Interactable.getTypeName()) as Interactable
    if (it && it.enabled && so.isEnabledInHierarchy) {
      const why = exemptReason(so)
      if (why) {
        out.exempt[why] = (out.exempt[why] || 0) + 1
        try {
          const pts = why === "letter" ? drawnWorldBox(so.name).pts : roundedRectCornersOf(so)
          out.exemptBoxes.push({name: so.name, box: boxOf(pts, turnTo)})
        } catch (e) {
          // No drawn box to measure (a collider only): counted by kind, not measured.
        }
      } else if (so.getComponent(Button.getTypeName())) {
        const box = boxOf(roundedRectCornersOf(so), turnTo)
        if (!turnTo || reachesDisplay(box)) out.targets.push({name: so.name, box})
        else out.outOfView.push(so.name)
      } else out.unclassified.push(so.name)
    }
    for (let i = 0; i < so.getChildrenCount(); i++) walk(so.getChild(i))
  }
  for (let i = 0; i < global.scene.getRootObjectsCount(); i++) walk(global.scene.getRootObject(i))
  return out
}

export function fmtGap(g: PairGap): string {
  return `${g.a} ~ ${g.b} ${g.gap.toFixed(2)}`
}

export interface ViewSpec {
  /** Buttons that must be pinchable and counted in this view. */
  required: string[]
  /** Buttons that must not be pinchable in this view. */
  absent: string[]
  /** Measure from a head turned toward this world point (only buttons reaching into the display). */
  turnTo?: vec3
}

/** Count, log and check one view; returns the census. */
export function checkView(label: string, spec: ViewSpec): Census {
  const c = census(spec.turnTo)
  const names = c.targets.map((t) => t.name)
  log(`SPACING ${label}: ${c.targets.length} buttons checked (${names.join(", ")}); exempt ${JSON.stringify(c.exempt)}; unclassified ${c.unclassified.length}${spec.turnTo ? `; out of view from the turned head ${c.outOfView.length}` : ""}`)
  expect(c.unclassified.length, `${label}: every pinchable object is a UIKit Button or a named exemption (unclassified: ${c.unclassified.join(", ") || "none"})`).toBe(0)
  expect(names.filter((n, i) => names.indexOf(n) !== i).length, `${label}: button names are unique (${names.join(", ")})`).toBe(0)
  for (const n of spec.required) expect(names.indexOf(n) >= 0, `${label}: ${n} is pinchable and counted`).toBe(true)
  for (const n of spec.absent) expect(names.indexOf(n) < 0 && c.outOfView.indexOf(n) < 0, `${label}: ${n} is not pinchable`).toBe(true)

  const small = smallestTarget(c.targets)
  if (!small) throw new Error(`${label}: no buttons to check`)
  log(`SPACING ${label} smallest target: ${small.width.toFixed(2)} x ${small.height.toFixed(2)} deg (${small.name})`)
  const gaps = pairGaps(c.targets)
  if (gaps.length > 0) {
    log(`SPACING ${label} smallest gap: ${gaps[0].gap.toFixed(2)} deg (${gaps[0].a} ~ ${gaps[0].b})`)
    log(`SPACING ${label} 5 smallest gaps: ${gaps.slice(0, 5).map(fmtGap).join("; ")}`)
  }
  const under = pairsCloserThan(c.targets, MIN_TARGET_GAP_DEG)
  log(`SPACING ${label} pairs under ${MIN_TARGET_GAP_DEG} deg: ${under.length === 0 ? "none" : under.map(fmtGap).join("; ")}`)

  for (const p of under) expect(p.gap >= MIN_TARGET_GAP_DEG, `${label}: ${p.a} and ${p.b} at least ${MIN_TARGET_GAP_DEG} deg apart (${p.gap.toFixed(2)} deg${p.gap < 0 ? ", overlapping" : ""})`).toBe(true)
  expect(under.length, `${label}: no two buttons closer than ${MIN_TARGET_GAP_DEG} deg`).toBe(0)
  for (const t of c.targets) {
    const w = t.box.maxYaw - t.box.minYaw
    const h = t.box.maxPitch - t.box.minPitch
    expect(w >= MIN_TARGET_DEG && h >= MIN_TARGET_DEG, `${label}: ${t.name} at least ${MIN_TARGET_DEG} deg each way (${w.toFixed(2)} x ${h.toFixed(2)} deg)`).toBe(true)
  }
  return c
}

/** World corners of a Text's rendered local box (4 corners on its plane). */
function textCorners(so: SceneObject): vec3[] | null {
  const t = so.getComponent("Component.Text") as Text
  if (!t) return null
  const lo = t.localAabbMin()
  const hi = t.localAabbMax()
  const m = so.getTransform().getWorldTransform()
  const out: vec3[] = []
  for (const x of [lo.x, hi.x]) for (const y of [lo.y, hi.y]) out.push(m.multiplyPoint(new vec3(x, y, 0)))
  return out
}

export interface CaseClearance {
  /** Drawn rectangles of the controls in the CaseControls group that are on now. */
  controls: number
  /** The case's cells (all 80 separations) and its row labels on now (cell numbers, street names, HOLD). */
  caseItems: number
  /** Smallest angular gap between any control rectangle and any cell or row label (negative: covering). */
  smallest: number
  pair: string
}

/**
 * How far the scaled controls stay from the case's cells and row labels, as seen from the eye:
 * every drawn rounded rectangle under CaseControls that is on (panel backplates, buttons, the score
 * card's backing, the hint and caption backings) against each cell's drawn corners
 * (CaseLightMain.targetCornersWorld, slots 0 to 79) and each row label's Text box (Label_n,
 * StreetName*, HoldLabel).
 */
export function controlsClearOfCase(main: CaseLightMain): CaseClearance {
  const controls: NamedBox[] = []
  const walk = (so: SceneObject) => {
    if (!so.isEnabledInHierarchy) return
    try {
      controls.push({name: so.name, box: angleBox(roundedRectCornersOf(so))})
    } catch (e) {
      // Not a rounded rectangle (a group, a Text, an empty transform).
    }
    for (let i = 0; i < so.getChildrenCount(); i++) walk(so.getChild(i))
  }
  walk(mustFind("CaseControls"))
  const items: NamedBox[] = []
  for (let slot = 0; slot < 80; slot++) items.push({name: `cell ${slot}`, box: angleBox(main.targetCornersWorld(slot))})
  const walkLabels = (so: SceneObject) => {
    const n = so.name
    if ((/^Label_\d+$/.test(n) || n.indexOf("StreetName") === 0 || n === "HoldLabel") && so.isEnabledInHierarchy) {
      const c = textCorners(so)
      if (c) items.push({name: n, box: angleBox(c)})
    }
    for (let i = 0; i < so.getChildrenCount(); i++) walkLabels(so.getChild(i))
  }
  walkLabels(main.caseRoot)
  let smallest = 1e9
  let pair = ""
  for (const c of controls)
    for (const it of items) {
      const g = angularGap(c.box, it.box)
      if (g < smallest) {
        smallest = g
        pair = `${c.name} ~ ${it.name}`
      }
    }
  return {controls: controls.length, caseItems: items.length, smallest, pair}
}
