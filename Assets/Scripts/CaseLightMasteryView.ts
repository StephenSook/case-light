// Owns: the mastery map's drawing on the case: per playable row a quiet strip (learned), an amber edge (weak) or a thin white outline (unseen), the row's icon (check, ring, hollow square) beside its word, and one small mark at each letter's target cell; and where each row's word goes.
// Talks to: CaseLightMain (makes it, show, hide, read-outs), CaseLightGeometry (row and cell positions), CaseLightMeshUtil (meshes); CaseLightCaseLabelsUI prints the words at the spots returned here.
// Must not: decide any state, create text, or do anything per frame (two pooled mesh objects, rebuilt only on show).

/**
 * Never colour alone: every state has its own shape and the word carries it too.
 *   learned: a near-transparent strip over the row, a check icon, the word "Learned"; per cell a check.
 *   weak:    an amber edge round the row, a ring icon, "Review N"; per cell an amber ring.
 *   unseen:  a thin white outline round the row, a hollow square icon, "Not tried N"; per cell a
 *            small hollow square.
 * Colours: amber (1.0, 0.75, 0.3); white outlines; green check (0.45, 1, 0.55). All marks are flat
 * (additive, one layer). Row words and icons sit in the top band of each row's opening, at the
 * case's centre across, in front of the letters; cell marks sit just above a standing letter.
 * SceneObject names (stable, for tests): MasteryMap (root under CaseRoot), MasteryRows, MasteryMarks.
 */

import { CaseGeometry, HOLD_BLOCK_SLOT, HOLD_CELLS, SEP_PITCH_CM } from "./CaseLightGeometry"
import { addMeshObject, MeshAccumulator, RGBA } from "./CaseLightMeshUtil"
import { MasteryState } from "./CaseLightMastery"

export const MASTERY_AMBER = new vec4(1.0, 0.75, 0.3, 1)
export const MASTERY_WHITE = new vec4(0.88, 0.9, 0.96, 1)
export const MASTERY_GREEN = new vec4(0.45, 1, 0.55, 1)

/** Row strip and outline just in front of the case face; icons and cell marks in front of the letters (they stick out 3 cm). */
const ROW_Z_CM = 0.2
const MARK_Z_CM = 3.3
const STRIP_LEVEL = 0.07
const WEAK_EDGE_CM = 0.35
const UNSEEN_EDGE_CM = 0.1
const MARK_SIZE_CM = 1.3
/** Cell marks sit this far above the shelf board (a standing letter is 5.4 cm tall, set 0.3 cm up). */
const MARK_Y_ABOVE_BOARD_CM = 6.6
/** Row word: capitals (cm), its box height, and the gap from the opening's top (cm). */
export const MASTERY_LABEL_CAP_CM = 0.8
const LABEL_H_CM = 1.6
const LABEL_TOP_GAP_CM = 0.35
const LABEL_PAD_CM = 0.7
const WIDTH_PER_CHAR_PER_CAP = 0.78
const ICON_SIZE_CM = 1.2
const ICON_GAP_CM = 0.3

export interface MasteryRowView {
  row: number
  state: MasteryState
  /** The row's word, e.g. "Review 1". */
  text: string
}

export interface MasteryCellMark {
  /** A separation 0..79, or -2 for the HOLD block. */
  target: number
  state: MasteryState
}

/** Where a row's word goes (case-local cm) and what it says. */
export interface MasteryLabelSpot {
  row: number
  state: MasteryState
  text: string
  x: number
  y: number
  z: number
  width: number
  height: number
}

export class CaseLightMasteryView {
  private readonly root: SceneObject
  private readonly geo: CaseGeometry
  private readonly material: Material
  private rows: RenderMeshVisual | null = null
  private marks: RenderMeshVisual | null = null
  private shown = false
  private markCount = 0
  private rowStates: MasteryState[] = []

  constructor(caseRoot: SceneObject, geo: CaseGeometry, lineMaterial: Material) {
    this.geo = geo
    const mat = lineMaterial.clone()
    mat.mainPass.blendMode = BlendMode.Add
    mat.mainPass.depthWrite = false
    mat.mainPass.twoSided = true
    this.material = mat
    this.root = global.scene.createSceneObject("MasteryMap")
    this.root.setParent(caseRoot)
    this.root.enabled = false
  }

  get isShown(): boolean {
    return this.shown && this.root.enabled
  }

  /** Cell marks drawn right now (0 while hidden). */
  get visibleMarkCount(): number {
    return this.isShown ? this.markCount : 0
  }

  /** Row states drawn right now (empty while hidden). */
  get drawnRowStates(): MasteryState[] {
    return this.isShown ? this.rowStates.slice() : []
  }

  /** Draw the rows and the cell marks (replacing any shown); returns where each row's word goes. */
  show(rows: MasteryRowView[], cells: MasteryCellMark[]): MasteryLabelSpot[] {
    const geo = this.geo
    const r = new MeshAccumulator()
    const spots: MasteryLabelSpot[] = []
    for (const row of rows) {
      const shelf = geo.lowerPlayableShelf + row.row
      const x0 = geo.leftX
      const x1 = -geo.leftX
      const y0 = geo.boardTopY(shelf)
      const y1 = geo.openingTopY(shelf)
      if (row.state === "learned") {
        const g = MASTERY_GREEN
        r.addQuadZ(x0, y0, x1, y1, ROW_Z_CM, [g.x * STRIP_LEVEL, g.y * STRIP_LEVEL, g.z * STRIP_LEVEL, 1])
      } else if (row.state === "weak") {
        flatOutline(r, x0, y0, x1, y1, ROW_Z_CM, WEAK_EDGE_CM, rgba(MASTERY_AMBER))
      } else {
        flatOutline(r, x0, y0, x1, y1, ROW_Z_CM, UNSEEN_EDGE_CM, rgba(MASTERY_WHITE))
      }
      // The word and its icon, centred across at the case's centre, in the top band of the opening.
      const width = Math.max(row.text.length, 6) * WIDTH_PER_CHAR_PER_CAP * MASTERY_LABEL_CAP_CM + LABEL_PAD_CM
      const group = ICON_SIZE_CM + ICON_GAP_CM + width
      const left = -group / 2
      const y = y1 - LABEL_TOP_GAP_CM - LABEL_H_CM / 2
      drawShape(r, row.state, left + ICON_SIZE_CM / 2, y, MARK_Z_CM, ICON_SIZE_CM)
      spots.push({ row: row.row, state: row.state, text: row.text, x: left + ICON_SIZE_CM + ICON_GAP_CM + width / 2, y, z: MARK_Z_CM, width, height: LABEL_H_CM })
    }
    const m = new MeshAccumulator()
    let count = 0
    for (const c of cells) {
      const centre = geo.targetCenterLocal(c.target)
      if (!centre) continue
      const shelf = c.target === HOLD_BLOCK_SLOT ? geo.lowerPlayableShelf : geo.shelfOfSlot(c.target)
      const size = Math.min(MARK_SIZE_CM, (c.target === HOLD_BLOCK_SLOT ? SEP_PITCH_CM * HOLD_CELLS : SEP_PITCH_CM) - 0.6)
      drawShape(m, c.state, centre.x, geo.boardTopY(shelf) + MARK_Y_ABOVE_BOARD_CM, MARK_Z_CM, size)
      count++
    }
    // Never upload an empty mesh: a hidden mark object stands in for "no marks".
    if (r.vertexCount > 0) {
      if (!this.rows) this.rows = addMeshObject(this.root, "MasteryRows", r.finish(), this.material)
      else this.rows.mesh = r.finish()
    }
    if (this.rows) this.rows.getSceneObject().enabled = r.vertexCount > 0
    if (m.vertexCount > 0) {
      if (!this.marks) this.marks = addMeshObject(this.root, "MasteryMarks", m.finish(), this.material)
      else this.marks.mesh = m.finish()
    }
    if (this.marks) this.marks.getSceneObject().enabled = m.vertexCount > 0
    this.markCount = count
    this.rowStates = rows.map((x) => x.state)
    this.shown = true
    this.root.enabled = true
    return spots
  }

  hide(): void {
    this.shown = false
    this.root.enabled = false
  }
}

function rgba(c: vec4): RGBA {
  return [c.x, c.y, c.z, c.w]
}

/** A state's shape, centred at (cx, cy): check (learned), amber ring (weak), hollow square (unseen). */
function drawShape(m: MeshAccumulator, state: MasteryState, cx: number, cy: number, z: number, size: number): void {
  const h = size / 2
  if (state === "learned") {
    const t = size * 0.17
    segment(m, cx - h * 0.85, cy + h * 0.05, cx - h * 0.25, cy - h * 0.6, t, z, rgba(MASTERY_GREEN))
    segment(m, cx - h * 0.25, cy - h * 0.6, cx + h * 0.9, cy + h * 0.75, t, z, rgba(MASTERY_GREEN))
  } else if (state === "weak") {
    ring(m, cx, cy, h, h * 0.62, z, rgba(MASTERY_AMBER))
  } else {
    flatOutline(m, cx - h * 0.8, cy - h * 0.8, cx + h * 0.8, cy + h * 0.8, z, size * 0.09, rgba(MASTERY_WHITE))
  }
}

/** A rectangle outline of four flat bars of thickness t inside the box (flat, so additive colour stays true). */
function flatOutline(m: MeshAccumulator, x0: number, y0: number, x1: number, y1: number, z: number, t: number, color: RGBA): void {
  m.addQuadZ(x0, y0, x1, y0 + t, z, color)
  m.addQuadZ(x0, y1 - t, x1, y1, z, color)
  m.addQuadZ(x0, y0 + t, x0 + t, y1 - t, z, color)
  m.addQuadZ(x1 - t, y0 + t, x1, y1 - t, z, color)
}

/** A flat bar of thickness t from (ax, ay) to (bx, by), facing +Z. */
function segment(m: MeshAccumulator, ax: number, ay: number, bx: number, by: number, t: number, z: number, color: RGBA): void {
  const dx = bx - ax
  const dy = by - ay
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1e-4) return
  const nx = (-dy / len) * (t / 2)
  const ny = (dx / len) * (t / 2)
  m.addTriangleZ([ax + nx, ay + ny], [ax - nx, ay - ny], [bx - nx, by - ny], z, color)
  m.addTriangleZ([ax + nx, ay + ny], [bx - nx, by - ny], [bx + nx, by + ny], z, color)
}

/** A flat ring (outer radius ro, inner ri), facing +Z. */
function ring(m: MeshAccumulator, cx: number, cy: number, ro: number, ri: number, z: number, color: RGBA): void {
  const n = 24
  for (let i = 0; i < n; i++) {
    const a0 = (i / n) * Math.PI * 2
    const a1 = ((i + 1) / n) * Math.PI * 2
    const o0 = [cx + Math.cos(a0) * ro, cy + Math.sin(a0) * ro]
    const o1 = [cx + Math.cos(a1) * ro, cy + Math.sin(a1) * ro]
    const i0 = [cx + Math.cos(a0) * ri, cy + Math.sin(a0) * ri]
    const i1 = [cx + Math.cos(a1) * ri, cy + Math.sin(a1) * ri]
    m.addTriangleZ(i0, o0, o1, z, color)
    m.addTriangleZ(i0, o1, i1, z, color)
  }
}
