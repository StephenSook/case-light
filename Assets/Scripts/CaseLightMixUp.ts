// Owns: the mix-up marks on the score view: per missed address a thin line and an outline on both end cells, and where each end's label goes.
// Talks to: CaseLightMain (build, show, clear, read-outs), CaseLightGeometry (cell positions), CaseLightMeshUtil (mesh); CaseLightCaseLabelsUI draws the label text at the spots returned here.
// Must not: decide which drops were misses, show anything during a pass, or create text itself.

/**
 * After a recall pass ends, CaseLightMain hands over the pairs it recorded for that pass (one per
 * address: the address's opening wrong drop, plus the address). Each pair gets, in one light
 * magenta, a thin straight line between the two cell centres and an outline on both end cells (a
 * refused hold piece's right end is the whole HOLD block). show() also lays out the two end
 * labels and returns their spots; CaseLightCaseLabelsUI prints them:
 *   at the cell it was dropped in: "<address> was put here" (two lines, in the top of the opening)
 *   at the right cell: "goes here" (one line, in the bottom of the opening)
 * Labels stay inside the cell openings (allowing for parallax: they stand in front of the letters),
 * so they never cover the number labels under the cells; a simple level search keeps them from
 * covering each other; and the line and outlines leave a gap wherever a label falls, so no mark
 * crosses a label. All marks are flat (one layer), so the additive pink stays pink.
 * Cleared by Again, Done or any Start press (CaseLightMain calls clear()).
 */

import { CaseGeometry, HOLD_BLOCK_SLOT, HOLD_CELLS, SEP_PITCH_CM } from "./CaseLightGeometry"
import { addMeshObject, MeshAccumulator, RGBA } from "./CaseLightMeshUtil"

export interface MixUpPair {
  /** Separation the letter was dropped in (0..79). */
  dropped: number
  /** Its right place: a separation 0..79, or -2 for the HOLD block. */
  right: number
  /** The letter's address (for the label at the dropped end). */
  address?: string
}

/** Where one end label goes (case-local cm) and what it says. */
export interface MixUpLabelSpot {
  pair: number
  end: "dropped" | "right"
  /** Displayed text (the dropped label breaks the line after the address). */
  text: string
  /** The same words on one line, for read-outs. */
  words: string
  x: number
  y: number
  z: number
  width: number
  height: number
}

/** Just in front of the answer glow's outline (z 0.1) and the pace light (z 0.14). */
const LINE_Z_CM = 0.22
/** Labels sit in front of the letters standing in the cells (they stick out 3 cm). */
const LABEL_Z_CM = 3.4
/** Label text capitals (cm): at least the case's own cell labels (0.74). */
export const MIXUP_LABEL_CAP_CM = 0.8
/** Rendered width per character per cm of capital height (measured on this font). */
const WIDTH_PER_CHAR_PER_CAP = 0.78
const LABEL_PAD_CM = 0.7
const TOP_LABEL_H_CM = 2.3
const BOTTOM_LABEL_H_CM = 1.3
const LABEL_GAP_CM = 0.3
/** Clear space kept between a label and the edge of its band (cm, on the case face). */
const BAND_MARGIN_CM = 0.3
/** Clear space kept around each label where no line or outline is drawn (cm). */
const KEEP_OUT_PAD_CM = 0.2
const OUTLINE_THICKNESS_CM = 0.2
const OUTLINE_INSET_CM = 0.22
/** Shortest piece of line or outline worth drawing after the label gaps (cm). */
const MIN_PIECE_CM = 0.05

@component
export class CaseLightMixUp extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">CaseLightMixUp - lines from a wrong cell to the right one, after recall</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input("vec4", "{1,0.5,0.92,1}")
  @widget(new ColorWidget())
  @hint("Colour of the mix-up lines and end outlines (light and bright; distinct from the cyan target and the white snap outline)")
  lineColor: vec4

  @input
  @widget(new SliderWidget(0.1, 0.8, 0.05))
  @hint("Line thickness, in cm")
  lineThicknessCm: number = 0.25
  @ui.group_end

  private geo: CaseGeometry | null = null
  private material: Material | null = null
  private lineObj: SceneObject | null = null
  private visual: RenderMeshVisual | null = null
  private pairs: MixUpPair[] = []
  private spots: MixUpLabelSpot[] = []
  private breaks = 0

  /** Lines on screen right now. */
  get lineCount(): number {
    return this.isVisible ? this.pairs.length : 0
  }

  /** The (dropped, right) pairs drawn right now (empty while hidden). */
  get shownPairs(): MixUpPair[] {
    return this.isVisible ? this.pairs.map((p) => ({ dropped: p.dropped, right: p.right })) : []
  }

  /** Outlined cells per shown pair: [dropped, right] (right is -2 for the HOLD block). */
  get outlineCells(): number[][] {
    return this.isVisible ? this.pairs.map((p) => [p.dropped, p.right]) : []
  }

  /** The label spots laid out for the shown pairs (empty while hidden). */
  get labelSpots(): MixUpLabelSpot[] {
    return this.isVisible ? this.spots.slice() : []
  }

  get isVisible(): boolean {
    return !!this.lineObj && this.lineObj.enabled && this.pairs.length > 0
  }

  build(geo: CaseGeometry, material: Material): void {
    if (this.geo) return
    this.geo = geo
    const mat = material.clone()
    mat.mainPass.blendMode = BlendMode.Add
    mat.mainPass.depthWrite = false
    mat.mainPass.twoSided = true
    this.material = mat
  }

  /** Gaps cut into the drawn line and outlines so no mark crosses a label (last show). */
  get lineBreaksForLabels(): number {
    return this.isVisible ? this.breaks : 0
  }

  /**
   * Draw lines and end outlines for the pairs (replacing any shown) and return the label spots.
   * eyeLocal is the viewer's eye in case-local cm (default: the start position, 57 cm in front).
   */
  show(pairs: MixUpPair[], eyeLocal: vec3 = new vec3(0, 0, 57)): MixUpLabelSpot[] {
    this.clear()
    if (!this.geo || !this.material || pairs.length === 0) return []
    const geo = this.geo
    const kept = pairs.filter((p) => {
      const a = geo.slotCenterLocal(p.dropped)
      const b = p.right === HOLD_BLOCK_SLOT ? geo.holdBlockCenterLocal() : geo.slotCenterLocal(p.right)
      return Math.abs(b.x - a.x) + Math.abs(b.y - a.y) > 1e-3
    }).map((p) => ({ dropped: p.dropped, right: p.right, address: p.address }))
    if (kept.length === 0) return []
    const spots = this.layoutLabels(kept, eyeLocal)
    // Where each label falls on the line plane, seen from the eye, plus a small margin: no mark is
    // drawn inside these boxes, so the labels always read clean.
    const keepOut = spots.map((s) => shadowBox(s, eyeLocal, LINE_Z_CM, KEEP_OUT_PAD_CM))
    const c = this.lineColor
    const color: RGBA = [c.x, c.y, c.z, c.w]
    const t = Math.max(0.05, this.lineThicknessCm)
    const m = new MeshAccumulator()
    this.breaks = 0
    for (const p of kept) {
      const a = geo.slotCenterLocal(p.dropped)
      const b = p.right === HOLD_BLOCK_SLOT ? geo.holdBlockCenterLocal() : geo.slotCenterLocal(p.right)
      this.drawSegment(m, a.x, a.y, b.x, b.y, t, keepOut, color)
      this.outlineCell(m, p.dropped, keepOut, color)
      this.outlineCell(m, p.right, keepOut, color)
    }
    if (!this.lineObj) {
      this.visual = addMeshObject(this.sceneObject, "MixUpLineMesh", m.finish(), this.material)
      this.lineObj = this.visual.getSceneObject()
    } else if (this.visual) {
      this.visual.mesh = m.finish()
    }
    this.pairs = kept
    this.spots = spots
    this.lineObj.enabled = true
    return this.spots.slice()
  }

  clear(): void {
    this.pairs = []
    this.spots = []
    this.breaks = 0
    if (this.lineObj) this.lineObj.enabled = false
  }

  /**
   * Outline a separation's opening, or the whole HOLD block for HOLD_BLOCK_SLOT, as four flat bars
   * (flat, not boxes: an additive box would add its front and back and wash the pink out to white).
   */
  private outlineCell(m: MeshAccumulator, slotOrHold: number, keepOut: Box[], color: RGBA): void {
    const geo = this.geo!
    const c = geo.targetCenterLocal(slotOrHold)
    if (!c) return
    const w = slotOrHold === HOLD_BLOCK_SLOT ? SEP_PITCH_CM * HOLD_CELLS : SEP_PITCH_CM
    const h = geo.openingHeight
    const t = OUTLINE_THICKNESS_CM
    const x0 = c.x - w / 2 + OUTLINE_INSET_CM
    const x1 = c.x + w / 2 - OUTLINE_INSET_CM
    const y0 = c.y - h / 2 + OUTLINE_INSET_CM
    const y1 = c.y + h / 2 - OUTLINE_INSET_CM
    this.drawBar(m, { x0, y0, x1, y1: y0 + t }, "x", keepOut, color)
    this.drawBar(m, { x0, y0: y1 - t, x1, y1 }, "x", keepOut, color)
    this.drawBar(m, { x0, y0: y0 + t, x1: x0 + t, y1: y1 - t }, "y", keepOut, color)
    this.drawBar(m, { x0: x1 - t, y0: y0 + t, x1, y1: y1 - t }, "y", keepOut, color)
  }

  /** A flat axis-aligned bar, with the parts inside any keep-out box left out. */
  private drawBar(m: MeshAccumulator, bar: Box, along: "x" | "y", keepOut: Box[], color: RGBA): void {
    const lo = along === "x" ? bar.x0 : bar.y0
    const hi = along === "x" ? bar.x1 : bar.y1
    const cuts: Array<[number, number]> = []
    for (const k of keepOut) {
      const across = along === "x" ? k.y0 < bar.y1 && k.y1 > bar.y0 : k.x0 < bar.x1 && k.x1 > bar.x0
      if (!across) continue
      const a = Math.max(lo, along === "x" ? k.x0 : k.y0)
      const b = Math.min(hi, along === "x" ? k.x1 : k.y1)
      if (b > a) cuts.push([a, b])
    }
    for (const [a, b] of subtract(lo, hi, cuts, MIN_PIECE_CM)) {
      if (along === "x") m.addQuadZ(a, bar.y0, b, bar.y1, LINE_Z_CM, color)
      else m.addQuadZ(bar.x0, a, bar.x1, b, LINE_Z_CM, color)
    }
    this.breaks += cuts.length
  }

  /** A flat straight line of thickness t from (ax, ay) to (bx, by), left out inside keep-out boxes. */
  private drawSegment(m: MeshAccumulator, ax: number, ay: number, bx: number, by: number, t: number, keepOut: Box[], color: RGBA): void {
    const dx = bx - ax
    const dy = by - ay
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 1e-3) return
    const cuts: Array<[number, number]> = []
    for (const k of keepOut) {
      // Grow the box by half the thickness so the line's edges stay out too.
      const span = clipSegment(ax, ay, dx, dy, { x0: k.x0 - t / 2, y0: k.y0 - t / 2, x1: k.x1 + t / 2, y1: k.y1 + t / 2 })
      if (span) cuts.push(span)
    }
    const nx = (-dy / len) * (t / 2)
    const ny = (dx / len) * (t / 2)
    for (const [u0, u1] of subtract(0, 1, cuts, MIN_PIECE_CM / len)) {
      const px = ax + dx * u0
      const py = ay + dy * u0
      const qx = ax + dx * u1
      const qy = ay + dy * u1
      m.addTriangleZ([px + nx, py + ny], [px - nx, py - ny], [qx - nx, qy - ny], LINE_Z_CM, color)
      m.addTriangleZ([px + nx, py + ny], [qx - nx, qy - ny], [qx + nx, qy + ny], LINE_Z_CM, color)
    }
    this.breaks += cuts.length
  }

  /**
   * Labels go inside the end cell's opening: the dropped label in the top band, the right label in
   * the bottom band, centred on the cell (or the HOLD block). Within a row and band, a label that
   * would overlap one already placed moves to the next level (down from the top, up from the bottom).
   * Labels stand 3.4 cm in front of the case (in front of the letters), so each band edge is moved
   * in by the parallax seen from the eye: a label never appears over the cell labels below the
   * opening or the strip above it.
   */
  private layoutLabels(pairs: MixUpPair[], eye: vec3): MixUpLabelSpot[] {
    const geo = this.geo!
    const used = new Map<string, Array<{ x0: number; x1: number; level: number }>>()
    const spots: MixUpLabelSpot[] = []
    // Case-face point (z 0) seen from the eye -> the label-plane point that covers it.
    const k = (eye.z - LABEL_Z_CM) / eye.z
    const toLabelPlane = (v: number, e: number) => e + (v - e) * k
    const place = (pairIndex: number, end: "dropped" | "right", slotOrHold: number, text: string, words: string, lines: number, longest: number) => {
      const c = geo.targetCenterLocal(slotOrHold)
      if (!c) return
      const row = slotOrHold === HOLD_BLOCK_SLOT ? 0 : geo.rowOfSlot(slotOrHold)
      const shelf = geo.lowerPlayableShelf + row
      const width = longest * WIDTH_PER_CHAR_PER_CAP * MIXUP_LABEL_CAP_CM + LABEL_PAD_CM
      const height = lines === 2 ? TOP_LABEL_H_CM : BOTTOM_LABEL_H_CM
      // Keep the label on the case: clamp its centre so it stays within the playable width.
      const minX = toLabelPlane(geo.leftX, eye.x) + width / 2
      const maxX = toLabelPlane(-geo.leftX, eye.x) - width / 2
      const x = Math.max(minX, Math.min(maxX, toLabelPlane(c.x, eye.x)))
      const band = end === "dropped" ? "top" : "bottom"
      const key = `${row}:${band}`
      const taken = used.get(key) ?? []
      const maxLevels = band === "top" ? 2 : 3
      let level = 0
      for (; level < maxLevels; level++) {
        const clash = taken.some((tk) => tk.level === level && tk.x0 < x + width / 2 + LABEL_GAP_CM && tk.x1 > x - width / 2 - LABEL_GAP_CM)
        if (!clash) break
      }
      if (level >= maxLevels) level = maxLevels - 1
      taken.push({ x0: x - width / 2, x1: x + width / 2, level })
      used.set(key, taken)
      const top = toLabelPlane(geo.openingTopY(shelf) - BAND_MARGIN_CM, eye.y)
      const bottom = toLabelPlane(geo.boardTopY(shelf) + BAND_MARGIN_CM, eye.y)
      const y = band === "top"
        ? top - height / 2 - level * (TOP_LABEL_H_CM + LABEL_GAP_CM)
        : bottom + height / 2 + level * (BOTTOM_LABEL_H_CM + LABEL_GAP_CM)
      spots.push({ pair: pairIndex, end, text, words, x, y, z: LABEL_Z_CM, width, height })
    }
    pairs.forEach((p, i) => {
      const address = p.address ?? ""
      const droppedText = address.length > 0 ? `${address}\nwas put here` : "was put here"
      const droppedWords = address.length > 0 ? `${address} was put here` : "was put here"
      place(i, "dropped", p.dropped, droppedText, droppedWords, 2, Math.max(address.length, 12))
      place(i, "right", p.right, "goes here", "goes here", 1, 9)
    })
    return spots
  }
}

interface Box {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** A label's box as it falls on the plane z = planeZ, seen from the eye, grown by pad. */
function shadowBox(s: MixUpLabelSpot, eye: vec3, planeZ: number, pad: number): Box {
  const k = (eye.z - planeZ) / (eye.z - s.z)
  const px = (v: number) => eye.x + (v - eye.x) * k
  const py = (v: number) => eye.y + (v - eye.y) * k
  return { x0: px(s.x - s.width / 2) - pad, x1: px(s.x + s.width / 2) + pad, y0: py(s.y - s.height / 2) - pad, y1: py(s.y + s.height / 2) + pad }
}

/** The parameter range [u0, u1] within 0..1 where a + u*d lies inside the box, or null. */
function clipSegment(ax: number, ay: number, dx: number, dy: number, b: Box): [number, number] | null {
  let u0 = 0
  let u1 = 1
  const tests: Array<[number, number]> = [[-dx, ax - b.x0], [dx, b.x1 - ax], [-dy, ay - b.y0], [dy, b.y1 - ay]]
  for (const [p, q] of tests) {
    if (Math.abs(p) < 1e-9) {
      if (q < 0) return null
      continue
    }
    const r = q / p
    if (p < 0) u0 = Math.max(u0, r)
    else u1 = Math.min(u1, r)
    if (u0 > u1) return null
  }
  return [u0, u1]
}

/** [lo, hi] with every cut removed, as the pieces that remain (pieces shorter than minPiece dropped). */
function subtract(lo: number, hi: number, cuts: Array<[number, number]>, minPiece: number): Array<[number, number]> {
  const sorted = cuts.slice().sort((p, q) => p[0] - q[0])
  const out: Array<[number, number]> = []
  let at = lo
  for (const [a, b] of sorted) {
    if (a > at) out.push([at, a])
    at = Math.max(at, b)
  }
  if (hi > at) out.push([at, hi])
  return out.filter(([a, b]) => b - a > minPiece)
}
