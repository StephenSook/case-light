// Owns: all text printed on the case: cell label strips, street names (block start + repeats), HOLD label, caption, end result, mix-up end labels, and the lit label highlight.
// Talks to: CaseLightMain (build(geometry), showResult, hideResult, showMixUpLabels, clearMixUpLabels), CaseLightGeometry and CaseLightRoute (positions, data), CaseLightMixUp (label spots).
// Must not: count anything or decide when the result shows (CaseLightMain owns that).

/**
 * Label strip under each playable separation: two house numbers per cell (left-side address on
 * top, right-side below; one number when a cell has one delivery), each street in its own light
 * colour, the street name in larger type at the start of each street's run of cells on a shelf, and
 * "HOLD" under the HOLD block. The caption "Practice mail, real house numbers" with its small print
 * ("Not a USPS route. Address data (c) OpenStreetMap contributors"), and the end-of-recall score card ("From memory: X of Y this session" by default; the template
 * is an Inspector setting) sit on authored anchors (CaptionAnchor, ResultAnchor), placed inside
 * the glasses' view at the start position. After a recall pass, the mix-up end labels ("<address>
 * was put here", "goes here") are printed at the spots CaseLightMixUp lays out, on a light tint.
 *
 * Why raw Text placed by case geometry instead of a UIKit layout: these labels are printed on
 * world geometry at a fixed one-inch pitch, and they must sit exactly under the separations the
 * snap math uses. Positions come from CaseLightGeometry, the same source as the snap targets, so
 * a layout engine would only duplicate that geometry and could drift from it. There is no panel
 * or button here (the Start buttons are UIKit in CaseLightControlsUI).
 */

import { RoundedRectangle } from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import { addBacking, DEFAULT_BACKING_COLOR, setBackingSize } from "./CaseLightBackingUI"
import { CaseGeometry, HOLD_BLOCK_SLOT, HOLD_CELLS, LABEL_STRIP_CM, NO_SLOT, SEP_PITCH_CM, SEPS_PER_SHELF } from "./CaseLightGeometry"
import { cellLabels, STREETS, streetRuns } from "./CaseLightRoute"
import { MIXUP_LABEL_CAP_CM, MixUpLabelSpot } from "./CaseLightMixUp"
import { CASELIGHT_VERSION } from "./CaseLightVersion"

const EM_PER_CM = 43.886
const CAP_PER_EM = 0.7
const LABEL_Z = 0.14
/** Score card text box (cm): two lines at about 0.9 cm capitals. */
/** Version label: right of the caption, on the same unlabelled strip (cm, relative to the caption). */
const VERSION_OFFSET_X_CM = 8.9
const RESULT_WIDTH_CM = 9.2
const RESULT_HEIGHT_CM = 2.4
/** Backing sizes (cm): a little larger than the text they sit behind. */
const CAPTION_BACKING_W = 18.4
const CAPTION_BACKING_H = 2.0
/** Caption block centre, left of centre so it clears the version label (cm, relative to the anchor). */
const CAPTION_OFFSET_X_CM = -1.9
const CAPTION_BACKING_Y_CM = 0.2
const CAPTION_LINE_Y_CM = 0.615
const CREDIT_LINE_Y_CM = -0.395
const CAPTION_CAP_CM = 0.6
const CREDIT_CAP_CM = 0.4
/** Small print under the caption: the route disclaimer and the OpenStreetMap credit (ODbL). */
const CREDIT_TEXT = "Not a USPS route. Address data (c) OpenStreetMap contributors"
const VERSION_BACKING_W = 2.2
const VERSION_BACKING_H = 1.15
const RESULT_BACKING_PAD = 0.5
/** Lit label: text turns white and a tint in the glow colour sits behind it. */
const LIT_LABEL_COLOR = new vec4(1, 1, 1, 1)
const LIT_TINT_ALPHA = 0.32
/**
 * Mix-up end labels: light text (additive-safe) on a dim plate of the line colour. The plate is
 * dim, not light, so whatever stands behind a label (a letter's edge, a case line) is muted under
 * the words instead of shining through them; on Specs a dim plate shows as almost clear glass.
 */
const MIXUP_TEXT_COLOR = new vec4(1, 0.9, 0.98, 1)
const MIXUP_PLATE_LEVEL = 0.25
const MIXUP_PLATE_ALPHA = 0.7
/** Drawn after the case, the letters and the mix-up marks (all render order 0), so labels stay on top. */
const MIXUP_RENDER_ORDER = 50

function sizeForCap(capCm: number): number {
  return (capCm / CAP_PER_EM) * EM_PER_CM
}

@component
export class CaseLightCaseLabelsUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">CaseLightCaseLabelsUI - label strips, caption, session result</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Where the end-of-recall text appears (default: top of the view, above the case rows)")
  resultAnchor: SceneObject

  @input
  @hint("Where the caption sits (default: the unlabelled strip just above the upper playable row)")
  captionAnchor: SceneObject
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Caption that says what the letters are (the small print under it says it is not a USPS route and credits OpenStreetMap)")
  captionText: string = "Practice mail, real house numbers"

  @input
  @hint("End-of-recall card text; {x} = letters placed from memory (helped letters never count), {y} = letters placed. The earlier wording was \"Unaided: {x}/{y} this session\"")
  resultTemplate: string = "From memory: {x} of {y} this session"

  @input("vec4", "{0.6,0.82,1,1}")
  @widget(new ColorWidget())
  @hint("Label colour for street 0 (FAIRWAYS CT)")
  street0Color: vec4

  @input("vec4", "{0.6,0.96,0.64,1}")
  @widget(new ColorWidget())
  @hint("Label colour for street 1 (LEE CT)")
  street1Color: vec4

  @input("vec4", "{1,0.9,0.55,1}")
  @widget(new ColorWidget())
  @hint("Label colour for street 2 (FREY LAKE RD)")
  street2Color: vec4

  @input("vec4", "{0.96,0.7,0.96,1}")
  @widget(new ColorWidget())
  @hint("Label colour for street 3 (TRIBUTARY CT)")
  street3Color: vec4

  @input("vec4", "{1,0.72,0.38,1}")
  @widget(new ColorWidget())
  @hint("Colour of the HOLD label")
  holdColor: vec4

  @input("vec4", "{0.85,0.9,1,0.16}")
  @widget(new ColorWidget())
  @hint("Subtle backing behind free-floating text (caption, version, score card; the hint and pace caption use it too). Keep it light and low opacity: black is transparent on Specs")
  backingColor: vec4

  @input
  @widget(new SliderWidget(6, 12, 1))
  @hint("Repeat each street's name along its block every this many cells (smaller than the name at the block start), so a turned view still shows a street name")
  streetNameRepeatCells: number = 8
  @ui.group_end

  private built = false
  private geo: CaseGeometry | null = null
  private resultText: Text | null = null
  private labelTexts = new Map<number, { text: Text; color: vec4 }>()
  private holdLabel: Text | null = null
  private litHighlight: RoundedRectangle | null = null
  private litSlot = NO_SLOT
  private repeatCount = 0
  private captionTextComp: Text | null = null
  private creditTextComp: Text | null = null
  private versionTextComp: Text | null = null
  private resultBacking: RoundedRectangle | null = null
  private cellLabelCount = 0
  private mixUpRoot: SceneObject | null = null
  private mixUpLabels: Array<{ spot: MixUpLabelSpot; text: Text }> = []

  get isResultVisible(): boolean {
    return !!this.resultText && this.resultText.getSceneObject().enabled
  }

  /** Mix-up end labels on screen right now (two per shown pair). */
  get mixUpLabelCount(): number {
    return this.mixUpLabels.length
  }

  /** Each mix-up end label: its pair, its end, its words on one line and its world position. */
  get mixUpLabelReadouts(): Array<{ pair: number; end: "dropped" | "right"; words: string; world: vec3 }> {
    return this.mixUpLabels.map((m) => ({ pair: m.spot.pair, end: m.spot.end, words: m.spot.words, world: m.text.getSceneObject().getTransform().getWorldPosition() }))
  }

  /** Print the mix-up end labels at their spots (replacing any shown). */
  showMixUpLabels(spots: MixUpLabelSpot[], lineColor: vec4): void {
    this.clearMixUpLabels()
    if (spots.length === 0) return
    if (!this.mixUpRoot) {
      this.mixUpRoot = global.scene.createSceneObject("MixUpLabels")
      this.mixUpRoot.setParent(this.sceneObject)
    }
    const tint = new vec4(lineColor.x * MIXUP_PLATE_LEVEL, lineColor.y * MIXUP_PLATE_LEVEL, lineColor.z * MIXUP_PLATE_LEVEL, MIXUP_PLATE_ALPHA)
    for (const spot of spots) {
      const name = `MixUpLabel_${spot.pair}_${spot.end}`
      // Tint first so it draws behind its text.
      const plate = addBacking(this.mixUpRoot, `${name}_Backing`, spot.width, spot.height, tint, new vec3(spot.x, spot.y, spot.z - 0.05), 0.35)
      plate.renderMeshVisual.setRenderOrder(MIXUP_RENDER_ORDER)
      const t = this.makeText(name, spot.text, sizeForCap(MIXUP_LABEL_CAP_CM), new vec3(spot.x, spot.y, spot.z), spot.width - 0.2, spot.height, HorizontalAlignment.Center, MIXUP_TEXT_COLOR, 700, this.mixUpRoot)
      t.setRenderOrder(MIXUP_RENDER_ORDER + 1)
      this.mixUpLabels.push({ spot, text: t })
    }
  }

  /** Remove every mix-up end label. */
  clearMixUpLabels(): void {
    this.mixUpLabels = []
    if (!this.mixUpRoot) return
    for (let i = this.mixUpRoot.getChildrenCount() - 1; i >= 0; i--) this.mixUpRoot.getChild(i).destroy()
  }

  /** True while the score card's backing is drawn (it follows the card). */
  get isResultBackingVisible(): boolean {
    return !!this.resultBacking && this.resultBacking.getSceneObject().enabled
  }

  /** The end text as currently set (empty until the end of a recall pass). */
  get resultString(): string {
    return this.resultText ? this.resultText.text : ""
  }

  get captionString(): string {
    return this.captionTextComp ? this.captionTextComp.text : ""
  }

  /** The small print under the caption (route disclaimer and OpenStreetMap credit). */
  get creditString(): string {
    return this.creditTextComp ? this.creditTextComp.text : ""
  }

  /** The small version label's text, e.g. "v0.3". */
  get versionString(): string {
    return this.versionTextComp ? this.versionTextComp.text : ""
  }

  get labelledCellCount(): number {
    return this.cellLabelCount
  }

  /** Label lit with the glow: a separation 0..79, -2 for the HOLD label, -1 for none. */
  get litLabelSlot(): number {
    return this.litSlot
  }

  isLabelLit(slot: number): boolean {
    return slot !== NO_SLOT && slot === this.litSlot
  }

  /** How many smaller repeated street names were printed along the blocks. */
  get repeatedStreetNameCount(): number {
    return this.repeatCount
  }

  /**
   * Light the label under a lit cell (or the HOLD label for the HOLD block) in the glow colour;
   * every other label keeps its street colour. NO_SLOT turns it off.
   */
  setLitLabel(slotOrHold: number, glowColor: vec4): void {
    if (!this.geo || !this.litHighlight) return
    this.restoreLitLabel()
    const hl = this.litHighlight
    if (slotOrHold === HOLD_BLOCK_SLOT && this.holdLabel) {
      const hs = this.geo.lowerPlayableShelf
      const x0 = this.geo.dividerX(SEPS_PER_SHELF - HOLD_CELLS)
      const x1 = this.geo.dividerX(SEPS_PER_SHELF)
      setBackingSize(hl, x1 - x0 - 0.16, LABEL_STRIP_CM - 0.2)
      hl.getSceneObject().getTransform().setLocalPosition(new vec3((x0 + x1) / 2, this.geo.boardTopY(hs) - LABEL_STRIP_CM / 2, LABEL_Z - 0.06))
      this.holdLabel.textFill.color = LIT_LABEL_COLOR
      this.litSlot = HOLD_BLOCK_SLOT
    } else {
      const entry = this.labelTexts.get(slotOrHold)
      if (!entry) {
        hl.getSceneObject().enabled = false
        return
      }
      const c = this.geo.slotCenterLocal(slotOrHold)
      const shelf = this.geo.shelfOfSlot(slotOrHold)
      setBackingSize(hl, SEP_PITCH_CM - 0.16, LABEL_STRIP_CM - 0.2)
      hl.getSceneObject().getTransform().setLocalPosition(new vec3(c.x, this.geo.boardTopY(shelf) - LABEL_STRIP_CM / 2, LABEL_Z - 0.06))
      entry.text.textFill.color = LIT_LABEL_COLOR
      this.litSlot = slotOrHold
    }
    hl.backgroundColor = new vec4(glowColor.x, glowColor.y, glowColor.z, LIT_TINT_ALPHA)
    hl.getSceneObject().enabled = true
  }

  private restoreLitLabel(): void {
    if (this.litSlot === HOLD_BLOCK_SLOT && this.holdLabel) this.holdLabel.textFill.color = this.holdColor
    else {
      const entry = this.labelTexts.get(this.litSlot)
      if (entry) entry.text.textFill.color = entry.color
    }
    this.litSlot = NO_SLOT
    if (this.litHighlight) this.litHighlight.getSceneObject().enabled = false
  }

  build(geo: CaseGeometry): void {
    if (this.built) return
    this.built = true
    this.geo = geo
    const colors = [this.street0Color, this.street1Color, this.street2Color, this.street3Color]

    // The lit label tint: created before the labels so it draws behind them; hidden until a cell lights.
    this.litHighlight = addBacking(this.sceneObject, "LabelHighlight", SEP_PITCH_CM - 0.16, LABEL_STRIP_CM - 0.2, DEFAULT_BACKING_COLOR, vec3.zero(), 0.25)
    this.litHighlight.getSceneObject().enabled = false

    // per-tile factory - Hard Rule 3 grid-cell carve-out (N = 76): one label per separation,
    // placed on the case's fixed one-inch pitch from CaseLightGeometry.
    for (const cell of cellLabels()) {
      const shelf = geo.shelfOfSlot(cell.slot)
      const c = geo.slotCenterLocal(cell.slot)
      // Two house numbers, 0.74 cm capitals: the largest four digits that fit a one-inch cell.
      const y = geo.boardTopY(shelf) - 1.2
      const numbers = cell.right === null ? `${cell.left}` : `${cell.left}\n${cell.right}`
      const t = this.makeText(`Label_${cell.slot}`, numbers, sizeForCap(0.74), new vec3(c.x, y, LABEL_Z), SEP_PITCH_CM - 0.12, 2.3, HorizontalAlignment.Center, colors[cell.street], 500)
      this.labelTexts.set(cell.slot, { text: t, color: colors[cell.street] })
      this.cellLabelCount++
    }

    // Street name in larger type at the start of each street's run of cells on a shelf, under those cells.
    const runs = streetRuns()
    for (let i = 0; i < runs.length; i++) {
      const b = runs[i]
      const shelf = geo.shelfOfSlot(b.firstSlot)
      const col = b.firstSlot % SEPS_PER_SHELF
      // Start clear of the heavy street line drawn on the block's left divider.
      const left = geo.dividerX(col) + 0.5
      const width = b.cells * SEP_PITCH_CM - 0.7
      const y = geo.stripBottomY(shelf) + 0.62
      this.makeText(`StreetName_${i}`, STREETS[b.street].name, sizeForCap(0.82), new vec3(left + width / 2, y, LABEL_Z), width, 1.2, HorizontalAlignment.Left, colors[b.street], 700)

      // Smaller repeats along the block, so a view turned onto the middle of a block still shows
      // the street. Only where three cells remain, so the longest name (12 characters) fits at full size.
      const every = Math.max(4, Math.round(this.streetNameRepeatCells))
      for (let k = every; k + 3 <= b.cells; k += every) {
        const rx = geo.dividerX(col + k) + 0.25
        const rw = Math.min(b.cells - k, 3) * SEP_PITCH_CM - 0.4
        this.makeText(`StreetNameRepeat_${b.firstSlot + k}`, STREETS[b.street].name, sizeForCap(0.6), new vec3(rx + rw / 2, geo.stripBottomY(shelf) + 0.55, LABEL_Z), rw, 1.0, HorizontalAlignment.Left, colors[b.street], 500)
        this.repeatCount++
      }
    }

    // HOLD under the HOLD block (right end of the lower playable shelf).
    const hs = geo.lowerPlayableShelf
    const hx0 = geo.dividerX(SEPS_PER_SHELF - HOLD_CELLS)
    const hx1 = geo.dividerX(SEPS_PER_SHELF)
    this.holdLabel = this.makeText("HoldLabel", "HOLD", sizeForCap(1.2), new vec3((hx0 + hx1) / 2, geo.boardTopY(hs) - LABEL_STRIP_CM / 2, LABEL_Z), hx1 - hx0 - 0.3, LABEL_STRIP_CM - 0.3, HorizontalAlignment.Center, this.holdColor, 700)

    // Caption (persistent). Default anchor: the unlabelled strip just above the upper playable
    // row, so it is printed on the case and inside the glasses' view at the start position.
    const capParent = this.captionAnchor ? this.captionAnchor : this.sceneObject
    // Two lines on one backing, left of the version label: the caption, and under it in small type
    // "Not a USPS route." plus the OpenStreetMap credit the address data needs (ODbL).
    addBacking(capParent, "CaptionBacking", CAPTION_BACKING_W, CAPTION_BACKING_H, this.backingColor, new vec3(CAPTION_OFFSET_X_CM, CAPTION_BACKING_Y_CM, -0.04))
    this.captionTextComp = this.makeText("Caption", this.captionText, sizeForCap(CAPTION_CAP_CM), new vec3(CAPTION_OFFSET_X_CM, CAPTION_LINE_Y_CM, 0), CAPTION_BACKING_W - 0.6, 1.1, HorizontalAlignment.Center, new vec4(0.9, 0.9, 0.92, 1), 500, capParent)
    this.creditTextComp = this.makeText("CreditText", CREDIT_TEXT, sizeForCap(CREDIT_CAP_CM), new vec3(CAPTION_OFFSET_X_CM, CREDIT_LINE_Y_CM, 0), CAPTION_BACKING_W - 0.6, 0.8, HorizontalAlignment.Center, new vec4(0.82, 0.84, 0.88, 1), 500, capParent)

    // Small version label on the same strip, right of the caption, inside the start view.
    addBacking(capParent, "VersionBacking", VERSION_BACKING_W, VERSION_BACKING_H, this.backingColor, new vec3(VERSION_OFFSET_X_CM, 0, -0.04), 0.35)
    this.versionTextComp = this.makeText("VersionLabel", CASELIGHT_VERSION, sizeForCap(0.62), new vec3(VERSION_OFFSET_X_CM, 0, 0), 2.4, 1.2, HorizontalAlignment.Center, new vec4(0.82, 0.84, 0.88, 1), 500, capParent)

    // End-of-recall score card, hidden until a recall pass ends. Two lines in a card about 11 cm
    // wide; the default anchor is the upper left of the start view, where the tray is empty once
    // every letter of the pass is in the case.
    const resParent = this.resultAnchor ? this.resultAnchor : this.sceneObject
    this.resultBacking = addBacking(resParent, "ResultBacking", RESULT_WIDTH_CM + RESULT_BACKING_PAD, RESULT_HEIGHT_CM + 2 * RESULT_BACKING_PAD, this.backingColor, new vec3(0, 0, -0.04))
    this.resultBacking.getSceneObject().enabled = false
    this.resultText = this.makeText("ResultText", "", sizeForCap(0.72), vec3.zero(), RESULT_WIDTH_CM, RESULT_HEIGHT_CM, HorizontalAlignment.Center, new vec4(1, 1, 1, 1), 700, resParent)
    this.resultText.horizontalOverflow = HorizontalOverflow.Wrap
    this.resultText.getSceneObject().enabled = false
  }

  /** Show the score card: resultTemplate with {x} = from memory (unaided), {y} = placed (total). */
  showResult(unaided: number, total: number): void {
    if (!this.resultText) return
    this.resultText.text = this.formatResult(unaided, total)
    this.resultText.getSceneObject().enabled = true
    if (this.resultBacking) this.resultBacking.getSceneObject().enabled = true
  }

  /** The card text for these counts (exactly what showResult displays). */
  formatResult(unaided: number, total: number): string {
    return this.resultTemplate.split("{x}").join(`${unaided}`).split("{y}").join(`${total}`)
  }

  hideResult(): void {
    if (this.resultText) this.resultText.getSceneObject().enabled = false
    if (this.resultBacking) this.resultBacking.getSceneObject().enabled = false
  }

  private makeText(
    name: string,
    value: string,
    size: number,
    pos: vec3,
    widthCm: number,
    heightCm: number,
    align: HorizontalAlignment,
    color: vec4,
    weight: number,
    parent: SceneObject = this.sceneObject
  ): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(pos)
    const t = so.createComponent("Component.Text") as Text
    t.text = value
    t.depthTest = true
    t.size = size
    ;(t as Text & { weight?: number }).weight = weight
    t.horizontalAlignment = align
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Shrink
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -heightCm / 2, heightCm / 2)
    t.textFill.color = color
    return t
  }
}
