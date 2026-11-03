// Owns: the case line art as one MeshBuilder mesh (shelves, dividers, heavy street/HOLD lines, ledge, frame).
// Talks to: CaseLightMain (build(geometry, material), setRoute(route)), CaseLightGeometry and CaseLightRoute (sizes, street breaks).
// Must not: hold session state or create text (labels live in CaseLightCaseLabelsUI).

/**
 * Thin light bars in one draw call, so the case stays visible on the additive display while
 * "dark" (no slot lit). Playable shelves get all 41 dividers; the other shelves are faint
 * unlabelled outlines.
 */

import { CaseGeometry, CASE_WIDTH_CM, HOLD_CELLS, LEDGE_DEPTH_CM, LEDGE_THICKNESS_CM, SEPS_PER_SHELF, SHELF_DEPTH_CM, SIDE_WALL_CM } from "./CaseLightGeometry"
import { addMeshObject, MeshAccumulator, RGBA } from "./CaseLightMeshUtil"
import { DEFAULT_ROUTE, RouteId, streetBoundaryColumns } from "./CaseLightRoute"

@component
export class CaseLightCaseMesh extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">CaseLightCaseMesh - line-art practice case (MeshBuilder)</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input("vec4", "{0.72,0.76,0.84,1}")
  @widget(new ColorWidget())
  @hint("Colour of the playable shelves' lines (keep light: dark shades vanish on the additive display)")
  playableLineColor: vec4

  @input("vec4", "{0.26,0.28,0.32,1}")
  @widget(new ColorWidget())
  @hint("Colour of the faint, unplayable shelves and the case frame")
  faintLineColor: vec4

  @input("vec4", "{0.95,0.96,1,1}")
  @widget(new ColorWidget())
  @hint("Colour of the heavy lines: shelf ends and the line between two streets")
  heavyLineColor: vec4

  @input("vec4", "{1,0.7,0.35,1}")
  @widget(new ColorWidget())
  @hint("Colour of the HOLD block outline")
  holdLineColor: vec4

  @input
  @widget(new SliderWidget(0.05, 0.5, 0.01))
  @hint("Thickness of a normal line, in cm")
  lineThicknessCm: number = 0.15
  @ui.group_end

  private built = false
  private vertexCount = 0
  private geo: CaseGeometry | null = null
  private visual: RenderMeshVisual | null = null
  private route: RouteId = DEFAULT_ROUTE

  /** Number of vertices in the built case mesh (0 before build). */
  get builtVertexCount(): number {
    return this.vertexCount
  }

  build(geo: CaseGeometry, material: Material): void {
    if (this.built) return
    this.built = true
    this.geo = geo
    this.visual = addMeshObject(this.sceneObject, "CaseLines", this.makeMesh(geo), material)
  }

  /** Redraw for another route: only the heavy lines between streets move (same geometry, same slots). */
  setRoute(route: RouteId): void {
    if (this.route === route) return
    this.route = route
    if (this.geo && this.visual) this.visual.mesh = this.makeMesh(this.geo)
  }

  private makeMesh(geo: CaseGeometry): RenderMesh {
    const play = this.rgba(this.playableLineColor)
    const faint = this.rgba(this.faintLineColor)
    const hold = this.rgba(this.holdLineColor)
    const heavy = this.rgba(this.heavyLineColor)
    const t = this.lineThicknessCm
    const tHeavy = t * 2.6
    const m = new MeshAccumulator()
    const xL = geo.leftX
    const xR = -geo.leftX
    const back = -SHELF_DEPTH_CM

    // Boards: label-strip edges on the front, depth edges, back edge. k = shelfCount is the top cap.
    for (let k = 0; k <= geo.shelfCount; k++) {
      const playableBoard = geo.isPlayableShelf(k) || geo.isPlayableShelf(k - 1)
      const c = playableBoard ? play : faint
      m.lineX(xL, xR, geo.boardTopY(k), 0, t, c)
      m.lineX(xL, xR, geo.stripBottomY(k), 0, t, c)
      m.lineX(xL, xR, geo.boardTopY(k), back, t, faint)
      m.lineZ(xL, geo.boardTopY(k), back, 0, t, faint)
      m.lineZ(xR, geo.boardTopY(k), back, 0, t, faint)
    }
    m.lineX(xL, xR, geo.caseTopY(), 0, t, faint)

    // Side walls of the separation section, front and back verticals.
    const top = geo.caseTopY()
    const ledgeTop = geo.ledgeTopY()
    for (const x of [xL - SIDE_WALL_CM / 2, xR + SIDE_WALL_CM / 2]) {
      m.lineY(x, ledgeTop, top, 0, t, play)
      m.lineY(x, ledgeTop, top, back, t, faint)
    }

    // Dividers on the two playable shelves (front edges), heavy at the ends and between streets.
    for (let row = 0; row < 2; row++) {
      const shelf = geo.lowerPlayableShelf + row
      const boundaries = streetBoundaryColumns(row, this.route)
      const y0 = geo.stripBottomY(shelf)
      const y1 = geo.openingTopY(shelf)
      for (let i = 0; i <= SEPS_PER_SHELF; i++) {
        const isEnd = i === 0 || i === SEPS_PER_SHELF
        const isStreet = boundaries.indexOf(i) >= 0
        const isHoldEdge = row === 0 && i === SEPS_PER_SHELF - HOLD_CELLS
        if (isHoldEdge) continue // drawn with the HOLD outline below
        if (isEnd || isStreet) m.lineY(geo.dividerX(i), y0, y1, 0, tHeavy, heavy)
        else m.lineY(geo.dividerX(i), y0, y1, 0, t, play)
      }
    }

    // HOLD block outline: right end of the lower playable shelf.
    const hs = geo.lowerPlayableShelf
    const hx0 = geo.dividerX(SEPS_PER_SHELF - HOLD_CELLS)
    const hx1 = geo.dividerX(SEPS_PER_SHELF)
    m.rectOutline(hx0, geo.stripBottomY(hs), hx1, geo.openingTopY(hs), 0.05, tHeavy, hold)
    for (let i = SEPS_PER_SHELF - HOLD_CELLS + 1; i < SEPS_PER_SHELF; i++) {
      m.lineY(geo.dividerX(i), geo.boardTopY(hs), geo.openingTopY(hs), 0, t, hold)
    }

    // Ledge: work surface under the bottom shelf, full case width, sticking out toward the user.
    const halfW = CASE_WIDTH_CM / 2
    const ledgeBottom = ledgeTop - LEDGE_THICKNESS_CM
    m.lineX(-halfW, halfW, ledgeTop, LEDGE_DEPTH_CM, t, play)
    m.lineX(-halfW, halfW, ledgeBottom, LEDGE_DEPTH_CM, t, faint)
    m.lineX(-halfW, halfW, ledgeTop, 0, t, faint)
    for (const x of [-halfW, halfW]) {
      m.lineZ(x, ledgeTop, 0, LEDGE_DEPTH_CM, t, play)
      m.lineY(x, ledgeBottom, ledgeTop, LEDGE_DEPTH_CM, t, faint)
    }

    // Faint base down to the floor so the whole case reads as about 190 cm tall.
    const floor = geo.floorY()
    for (const x of [-halfW, halfW]) {
      m.lineY(x, floor, ledgeBottom, LEDGE_DEPTH_CM - 4, t, faint)
      m.lineY(x, floor, ledgeBottom, back, t, faint)
    }
    m.lineX(-halfW, halfW, floor, LEDGE_DEPTH_CM - 4, t, faint)

    this.vertexCount = m.vertexCount
    return m.finish()
  }

  private rgba(c: vec4): RGBA {
    return [c.x, c.y, c.z, c.w]
  }
}
