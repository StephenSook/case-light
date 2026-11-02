// Owns: the moving answer glow (SlotGlow + its SlotGlowFill), the thin snap outline (SnapOutline) and the dimmer practice-ladder cues (LadderGlow) on the case.
// Talks to: CaseLightMain (build, showGlow, hideGlow, showSnapOutline, hideSnapOutline), CaseLightGeometry (positions).
// Must not: decide which slot is right (CaseLightMain owns that).

/**
 * SlotGlow: one object that moves to the lit separation, or widens to cover the HOLD block. It
 * draws a bright outline and, as its child SlotGlowFill, ONE fill plane in the separation's front
 * opening. There is deliberately no second plane deeper in the cell: seen at an angle a rear
 * plane shows as a second bar beside the lit cell and reads as two lit cells.
 *
 * The fill uses the CaseLightGlow shader graph (additive, bright soft rim easing into a lighter
 * fill, gentle pulse; never dark, since dark renders transparent on Specs). Turn useShaderGlow off
 * (or leave glowMaterial empty) to fall back to the plain vertex-colour fill.
 * SnapOutline: thin outline on the separation the dragged piece would snap to. It is not the answer.
 * LadderGlow: the practice cue ladder's broader cues (only when CaseLightMain.practiceLadder is on):
 * "row" lights the whole playable row that holds the cell, dimmer than the slot glow; "shelf"
 * lights a broad band over both playable rows, dimmer still. Additive, never dark.
 */

import { CaseGeometry, HOLD_BLOCK_SLOT, HOLD_CELLS, NO_SLOT, PLAYABLE_ROWS, SEP_PITCH_CM } from "./CaseLightGeometry"
import { addMeshObject, MeshAccumulator, RGBA } from "./CaseLightMeshUtil"

/** Fill plane depth: just inside the front of the separation, behind the divider lines. */
const FILL_Z = -0.3
const FILL_INSET = 0.2
/** Ladder cue brightness, as a fraction of the glow colour (fill, outline). */
const ROW_FILL_LEVEL = 0.16
const ROW_EDGE_LEVEL = 0.6
const BAND_FILL_LEVEL = 0.07
const BAND_EDGE_LEVEL = 0.34

export type RegionCue = "row" | "shelf" | "none"

@component
export class CaseLightHighlight extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">CaseLightHighlight - answer glow and snap outline</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @allowUndefined
  @hint("Glow material (CaseLightGlow shader graph). Empty = use the plain fallback fill")
  glowMaterial: Material
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Use the luminous pulsing shader glow; off = the plain vertex-colour fill (fallback)")
  useShaderGlow: boolean = true

  @input("vec4", "{0.6,0.88,1,1}")
  @widget(new ColorWidget())
  @hint("Colour of the answer glow on the right separation (keep it bright)")
  glowColor: vec4

  @input("vec4", "{0.2,0.4,0.66,1}")
  @widget(new ColorWidget())
  @hint("Fallback fill colour inside the glowing separation (used when the shader glow is off)")
  glowFillColor: vec4

  @input
  @widget(new SliderWidget(0, 3, 0.05))
  @hint("Shader glow: soft pulses per second (0 = steady)")
  pulseHz: number = 0.8

  @input
  @widget(new SliderWidget(0, 0.6, 0.01))
  @hint("Shader glow: how much it dims at the low point of a pulse")
  pulseAmount: number = 0.3

  @input("vec4", "{0.95,0.95,0.95,1}")
  @widget(new ColorWidget())
  @hint("Colour of the thin outline on the separation a dragged piece would snap to")
  snapOutlineColor: vec4
  @ui.group_end

  private geo: CaseGeometry | null = null
  private glowObj: SceneObject | null = null
  private outlineVisual: RenderMeshVisual | null = null
  private fillVisual: RenderMeshVisual | null = null
  private cellOutlineMesh: RenderMesh | null = null
  private holdOutlineMesh: RenderMesh | null = null
  private cellFillMesh: RenderMesh | null = null
  private holdFillMesh: RenderMesh | null = null
  private cellFillMat: Material | null = null
  private holdFillMat: Material | null = null
  private shaderGlow = false
  private outlineObj: SceneObject | null = null
  private glowSlot = NO_SLOT
  private outlineSlot = NO_SLOT
  private regionObj: SceneObject | null = null
  private regionVisual: RenderMeshVisual | null = null
  private rowMeshes: RenderMesh[] = []
  private bandMesh: RenderMesh | null = null
  private regionKind: RegionCue = "none"
  private regionRow = -1

  /** Slot the answer glow is on: NO_SLOT (-1), HOLD_BLOCK_SLOT (-2) or 0..79. */
  get glowSlotIndex(): number {
    return this.glowSlot
  }

  get isGlowVisible(): boolean {
    return this.glowSlot !== NO_SLOT
  }

  /** Slot the snap outline is on, or NO_SLOT. */
  get snapOutlineSlotIndex(): number {
    return this.outlineSlot
  }

  /** Ladder cue shown: "row", "shelf" (both playable rows) or "none". */
  get regionCue(): RegionCue {
    return this.regionKind
  }

  /** Playable row (0 lower, 1 upper) lit by a "row" cue, or -1. */
  get regionCueRow(): number {
    return this.regionKind === "row" ? this.regionRow : -1
  }

  /** True when the fill uses the CaseLightGlow shader; false when it uses the fallback fill. */
  get usingShaderGlow(): boolean {
    return this.shaderGlow
  }

  build(geo: CaseGeometry, material: Material): void {
    if (this.geo) return
    this.geo = geo
    const h = geo.openingHeight
    const cellW = SEP_PITCH_CM
    const holdW = SEP_PITCH_CM * HOLD_CELLS
    const edge = this.rgba(this.glowColor)
    const fill = this.rgba(this.glowFillColor)

    this.cellOutlineMesh = this.outlineMesh(cellW, h, edge)
    this.holdOutlineMesh = this.outlineMesh(holdW, h, edge)
    this.cellFillMesh = this.fillMesh(cellW, h, fill)
    this.holdFillMesh = this.fillMesh(holdW, h, fill)

    this.shaderGlow = this.useShaderGlow && !!this.glowMaterial
    if (this.shaderGlow) {
      this.cellFillMat = this.makeGlowMaterial((h - 2 * FILL_INSET) / (cellW - 2 * FILL_INSET))
      this.holdFillMat = this.makeGlowMaterial((h - 2 * FILL_INSET) / (holdW - 2 * FILL_INSET))
    } else {
      this.cellFillMat = material
      this.holdFillMat = material
    }

    this.outlineVisual = addMeshObject(this.sceneObject, "SlotGlow", this.cellOutlineMesh, material)
    this.glowObj = this.outlineVisual.getSceneObject()
    this.fillVisual = addMeshObject(this.glowObj, "SlotGlowFill", this.cellFillMesh, this.cellFillMat)
    this.glowObj.enabled = false

    const o = new MeshAccumulator()
    o.rectOutline(-SEP_PITCH_CM / 2 + 0.12, -h / 2 + 0.12, SEP_PITCH_CM / 2 - 0.12, h / 2 - 0.12, 0.15, 0.12, this.rgba(this.snapOutlineColor))
    this.outlineObj = addMeshObject(this.sceneObject, "SnapOutline", o.finish(), material).getSceneObject()
    this.outlineObj.enabled = false

    // Ladder cues: one mesh per playable row and one band over both rows, additive.
    const ladderMat = material.clone()
    ladderMat.mainPass.blendMode = BlendMode.Add
    ladderMat.mainPass.depthWrite = false
    ladderMat.mainPass.twoSided = true
    const x0 = geo.leftX + 0.15
    const x1 = -geo.leftX - 0.15
    for (let r = 0; r < PLAYABLE_ROWS; r++) {
      const shelf = geo.lowerPlayableShelf + r
      this.rowMeshes.push(this.regionMesh(x0, geo.boardTopY(shelf) + 0.15, x1, geo.openingTopY(shelf) - 0.15, ROW_FILL_LEVEL, ROW_EDGE_LEVEL))
    }
    this.bandMesh = this.regionMesh(x0, geo.boardTopY(geo.lowerPlayableShelf) + 0.15, x1, geo.openingTopY(geo.upperPlayableShelf) - 0.15, BAND_FILL_LEVEL, BAND_EDGE_LEVEL)
    this.regionVisual = addMeshObject(this.sceneObject, "LadderGlow", this.rowMeshes[0], ladderMat)
    this.regionObj = this.regionVisual.getSceneObject()
    this.regionObj.enabled = false
  }

  /**
   * Practice ladder cue for a target (separation or HOLD_BLOCK_SLOT): "row" lights the playable
   * row holding it (the HOLD block is in the lower row), "shelf" lights both playable rows.
   */
  showRegion(kind: "row" | "shelf", slotOrHold: number): void {
    if (!this.geo || !this.regionObj || !this.regionVisual || !this.bandMesh) return
    if (kind === "row") {
      const row = slotOrHold === HOLD_BLOCK_SLOT ? 0 : this.geo.isValidSlot(slotOrHold) ? this.geo.rowOfSlot(slotOrHold) : -1
      if (row < 0) {
        this.hideRegion()
        return
      }
      this.regionVisual.mesh = this.rowMeshes[row]
      this.regionRow = row
    } else {
      this.regionVisual.mesh = this.bandMesh
      this.regionRow = -1
    }
    this.regionObj.enabled = true
    this.regionKind = kind
  }

  hideRegion(): void {
    if (this.regionObj) this.regionObj.enabled = false
    this.regionKind = "none"
    this.regionRow = -1
  }

  /** Light a separation (0..79) or the HOLD block (HOLD_BLOCK_SLOT). */
  showGlow(slotOrHold: number): void {
    if (!this.geo || !this.glowObj || !this.outlineVisual || !this.fillVisual) return
    const c = this.geo.targetCenterLocal(slotOrHold)
    if (!c) {
      this.hideGlow()
      return
    }
    const hold = slotOrHold === HOLD_BLOCK_SLOT
    this.outlineVisual.mesh = hold ? this.holdOutlineMesh : this.cellOutlineMesh
    this.fillVisual.mesh = hold ? this.holdFillMesh : this.cellFillMesh
    const mat = hold ? this.holdFillMat : this.cellFillMat
    if (mat) this.fillVisual.mainMaterial = mat
    this.glowObj.getTransform().setLocalPosition(c)
    this.glowObj.enabled = true
    this.glowSlot = slotOrHold
  }

  hideGlow(): void {
    if (this.glowObj) this.glowObj.enabled = false
    this.glowSlot = NO_SLOT
  }

  showSnapOutline(slot: number): void {
    if (!this.geo || !this.outlineObj) return
    if (!this.geo.isValidSlot(slot)) {
      this.hideSnapOutline()
      return
    }
    this.outlineObj.getTransform().setLocalPosition(this.geo.slotCenterLocal(slot))
    this.outlineObj.enabled = true
    this.outlineSlot = slot
  }

  hideSnapOutline(): void {
    if (this.outlineObj) this.outlineObj.enabled = false
    this.outlineSlot = NO_SLOT
  }

  private makeGlowMaterial(aspect: number): Material {
    const m = this.glowMaterial.clone()
    const pass = m.mainPass as Pass & { [key: string]: any }
    pass.glowColor = this.glowColor
    pass.pulseHz = this.pulseHz
    pass.pulseAmount = this.pulseAmount
    pass.cellAspect = aspect
    pass.blendMode = BlendMode.Add
    pass.depthWrite = false
    pass.twoSided = true
    return m
  }

  /** A dim filled rectangle with a brighter edge, in the glow colour (case-local cm). */
  private regionMesh(x0: number, y0: number, x1: number, y1: number, fillLevel: number, edgeLevel: number): RenderMesh {
    const g = this.glowColor
    const m = new MeshAccumulator()
    m.addQuadZ(x0, y0, x1, y1, FILL_Z, [g.x * fillLevel, g.y * fillLevel, g.z * fillLevel, 1])
    m.rectOutline(x0, y0, x1, y1, 0.1, 0.22, [g.x * edgeLevel, g.y * edgeLevel, g.z * edgeLevel, 1])
    return m.finish()
  }

  private outlineMesh(w: number, h: number, edge: RGBA): RenderMesh {
    const m = new MeshAccumulator()
    m.rectOutline(-w / 2 + 0.18, -h / 2 + 0.18, w / 2 - 0.18, h / 2 - 0.18, 0.1, 0.32, edge)
    return m.finish()
  }

  /** One quad in the front opening, with UVs for the shader and a vertex colour for the fallback. */
  private fillMesh(w: number, h: number, color: RGBA): RenderMesh {
    const b = new MeshBuilder([
      { name: "position", components: 3 },
      { name: "normal", components: 3, normalized: true },
      { name: "texture0", components: 2 },
      { name: "color", components: 4 }
    ])
    b.topology = MeshTopology.Triangles
    b.indexType = MeshIndexType.UInt16
    const x0 = -w / 2 + FILL_INSET
    const x1 = w / 2 - FILL_INSET
    const y0 = -h / 2 + FILL_INSET
    const y1 = h / 2 - FILL_INSET
    const corners = [
      [x0, y0, 0, 0],
      [x1, y0, 1, 0],
      [x1, y1, 1, 1],
      [x0, y1, 0, 1]
    ]
    const verts: number[] = []
    for (const c of corners) verts.push(c[0], c[1], FILL_Z, 0, 0, 1, c[2], c[3], color[0], color[1], color[2], color[3])
    b.appendVerticesInterleaved(verts)
    // CCW seen from +Z (toward the user).
    b.appendIndices([0, 1, 2, 0, 2, 3])
    b.updateMesh()
    return b.getMesh()
  }

  private rgba(c: vec4): RGBA {
    return [c.x, c.y, c.z, c.w]
  }
}
