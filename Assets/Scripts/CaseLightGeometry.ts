// Owns: the real-scale case dimensions (cm) and every slot index <-> case-local position mapping, including snap math.
// Talks to: nothing (pure); read by CaseLightMain, CaseLightCaseMesh, CaseLightCaseLabelsUI and CaseLightHighlight.
// Must not: touch SceneObjects or hold session state.

/**
 * One source for the label under a cell, the cell outline and the snap target, so they never
 * drift apart.
 *
 * Case-local frame (the CaseRoot SceneObject): +X right, +Y up, +Z toward the user.
 * The front face of the separations is the plane z = 0; separations run back to
 * z = -SHELF_DEPTH_CM. The ledge sticks out toward the user (z > 0). y = 0 is the user's eye
 * height at the start position (CaseRoot sits at eye height).
 *
 * Slot indexing (delivery order, left to right along each shelf):
 *   0..39  = lower playable shelf, columns 0..39 (cells 36..39 are the HOLD block)
 *   40..79 = upper playable shelf, columns 0..39
 * Sources: one-inch separations and 40 per shelf (M-41 221.2); shelf pitch 15 cm and depth
 * 30 cm are the brief's values (depth reported, not verified).
 */

export const SEP_PITCH_CM = 2.54
export const SEPS_PER_SHELF = 40
export const SHELF_PITCH_CM = 15
export const SHELF_DEPTH_CM = 30
/** Label strip under each cell: two house numbers plus the street-name line, sized for video. */
export const LABEL_STRIP_CM = 3.4
export const CASE_WIDTH_CM = 122
export const CASE_HEIGHT_CM = 190
export const LEDGE_DEPTH_CM = 26
export const LEDGE_THICKNESS_CM = 2
export const TOP_CAP_CM = 3
export const SIDE_WALL_CM = 1.2
export const HOLD_CELLS = 4
export const PLAYABLE_ROWS = 2
export const SLOT_COUNT = PLAYABLE_ROWS * SEPS_PER_SHELF
/** Upper playable row's opening centre, relative to eye height: "a little below eye level". */
export const TOP_ROW_CENTER_Y_CM = -4
/** Left/right address position inside a one-inch separation. */
export const SIDE_OFFSET_CM = 0.6
/** Extra reach (cm) around the playable shelves that still counts as "over a separation". */
export const SNAP_TOLERANCE_CM = 3

/** Sentinel slot index meaning "the HOLD block" (the hold piece's target). */
export const HOLD_BLOCK_SLOT = -2
/** Sentinel slot index meaning "no slot". */
export const NO_SLOT = -1

export class CaseGeometry {
  readonly shelfCount: number
  readonly lowerPlayableShelf: number
  readonly upperPlayableShelf: number
  private readonly baseY: number

  constructor(shelfCount: number) {
    this.shelfCount = Math.max(2, Math.min(8, Math.round(shelfCount)))
    this.lowerPlayableShelf = Math.floor((this.shelfCount - 2) / 2)
    this.upperPlayableShelf = this.lowerPlayableShelf + 1
    const openingHalf = (SHELF_PITCH_CM - LABEL_STRIP_CM) / 2
    this.baseY = TOP_ROW_CENTER_Y_CM - openingHalf - SHELF_PITCH_CM * this.upperPlayableShelf
  }

  get shelfWidth(): number {
    return SEPS_PER_SHELF * SEP_PITCH_CM
  }

  get leftX(): number {
    return -this.shelfWidth / 2
  }

  get openingHeight(): number {
    return SHELF_PITCH_CM - LABEL_STRIP_CM
  }

  /** Top surface of board k (k = 0 bottom shelf board ... shelfCount = top cap). */
  boardTopY(k: number): number {
    return this.baseY + SHELF_PITCH_CM * k
  }

  /** Bottom of the label strip on the front edge of board k. */
  stripBottomY(k: number): number {
    return this.boardTopY(k) - LABEL_STRIP_CM
  }

  /** Top of shelf k's cell opening (underside of the next board's label strip). */
  openingTopY(k: number): number {
    return this.boardTopY(k + 1) - LABEL_STRIP_CM
  }

  openingCenterY(k: number): number {
    return (this.boardTopY(k) + this.openingTopY(k)) / 2
  }

  ledgeTopY(): number {
    return this.stripBottomY(0)
  }

  caseTopY(): number {
    return this.boardTopY(this.shelfCount) + TOP_CAP_CM
  }

  floorY(): number {
    return this.caseTopY() - CASE_HEIGHT_CM
  }

  isPlayableShelf(k: number): boolean {
    return k === this.lowerPlayableShelf || k === this.upperPlayableShelf
  }

  isValidSlot(slot: number): boolean {
    return Number.isInteger(slot) && slot >= 0 && slot < SLOT_COUNT
  }

  /** 0 = lower playable row, 1 = upper playable row. */
  rowOfSlot(slot: number): number {
    return slot < SEPS_PER_SHELF ? 0 : 1
  }

  colOfSlot(slot: number): number {
    return slot % SEPS_PER_SHELF
  }

  shelfOfSlot(slot: number): number {
    return this.lowerPlayableShelf + this.rowOfSlot(slot)
  }

  slotIndex(row: number, col: number): number {
    return row * SEPS_PER_SHELF + col
  }

  /** x of divider i (i = 0..40) on a playable shelf. */
  dividerX(i: number): number {
    return this.leftX + i * SEP_PITCH_CM
  }

  /** Centre of a separation's opening on the front face (z = 0), case-local. */
  slotCenterLocal(slot: number): vec3 {
    const col = this.colOfSlot(slot)
    const shelf = this.shelfOfSlot(slot)
    return new vec3(this.dividerX(col) + SEP_PITCH_CM / 2, this.openingCenterY(shelf), 0)
  }

  /** Left (side 0) or right (side 1) address position inside a separation, case-local. */
  slotSideLocal(slot: number, side: number): vec3 {
    const c = this.slotCenterLocal(slot)
    return new vec3(c.x + (side === 0 ? -SIDE_OFFSET_CM : SIDE_OFFSET_CM), c.y, c.z)
  }

  isHoldSlot(slot: number): boolean {
    return this.isValidSlot(slot) && this.rowOfSlot(slot) === 0 && this.colOfSlot(slot) >= SEPS_PER_SHELF - HOLD_CELLS
  }

  holdSlots(): number[] {
    const out: number[] = []
    for (let c = SEPS_PER_SHELF - HOLD_CELLS; c < SEPS_PER_SHELF; c++) out.push(this.slotIndex(0, c))
    return out
  }

  holdBlockCenterLocal(): vec3 {
    const left = this.dividerX(SEPS_PER_SHELF - HOLD_CELLS)
    const right = this.dividerX(SEPS_PER_SHELF)
    return new vec3((left + right) / 2, this.openingCenterY(this.lowerPlayableShelf), 0)
  }

  /** Centre of a target: a separation index, or HOLD_BLOCK_SLOT for the HOLD block. */
  targetCenterLocal(slotOrHold: number): vec3 | null {
    if (slotOrHold === HOLD_BLOCK_SLOT) return this.holdBlockCenterLocal()
    if (this.isValidSlot(slotOrHold)) return this.slotCenterLocal(slotOrHold)
    return null
  }

  /**
   * The separation under a point on the front-face plane (case-local x, y), or NO_SLOT.
   * The label strip under a cell counts as "over" that cell. Rows are contiguous bands.
   */
  slotAtFacePoint(x: number, y: number, tolerance: number = SNAP_TOLERANCE_CM): number {
    const minX = this.leftX - tolerance
    const maxX = -this.leftX + tolerance
    if (x < minX || x > maxX) return NO_SLOT
    const col = Math.max(0, Math.min(SEPS_PER_SHELF - 1, Math.floor((x - this.leftX) / SEP_PITCH_CM)))
    for (let row = 0; row < PLAYABLE_ROWS; row++) {
      const shelf = this.lowerPlayableShelf + row
      let lo = this.stripBottomY(shelf)
      let hi = this.openingTopY(shelf)
      if (row === 0) lo -= tolerance
      if (row === PLAYABLE_ROWS - 1) hi += tolerance
      if (y >= lo && y < hi) return this.slotIndex(row, col)
    }
    return NO_SLOT
  }

  /**
   * Intersect the ray eye -> point (both case-local) with the front-face plane z = 0.
   * Returns the hit, or null when the ray does not travel toward the case face.
   * "Over a separation" means over it from where the user is looking, so a piece held a few cm
   * in front of (or, with a mouse, behind) the face still lands in the cell the user sees.
   */
  projectToFace(eyeLocal: vec3, pointLocal: vec3): vec3 | null {
    const dz = pointLocal.z - eyeLocal.z
    if (eyeLocal.z <= 0 || dz >= -1e-4) return null
    const t = -eyeLocal.z / dz
    if (t <= 0) return null
    return new vec3(eyeLocal.x + (pointLocal.x - eyeLocal.x) * t, eyeLocal.y + (pointLocal.y - eyeLocal.y) * t, 0)
  }
}
