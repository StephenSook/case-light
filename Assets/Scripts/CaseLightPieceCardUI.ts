// Owns: the printed face of one sample letter: the address in large print, the veteran's hold note and its plain gloss.
// Talks to: CaseLightBundle, which creates one per letter and calls configure(), relabel() and setHeld().
// Must not: decide when a piece counts as held (CaseLightMain / CaseLightBundle own that).

/**
 * Grabbing the top piece is the preview's stand-in for reading the letter, so both texts stay
 * hidden until the piece is in hand. Created at runtime (bundle size is a setting), so there are
 * no Inspector fields here; sizes come in through configure(). The address never shrinks: the
 * letter is sized so the longest sample address fits at full size.
 *
 * Layout scales with the letter: positions are fractions of its height, the note and gloss have
 * fixed capitals, and every text box is the letter's print width.
 *
 * Text sizing: Text.size is the em-square height, em cm = size / 43.886 (StudioLib.d.ts).
 * Capitals were assumed to be 0.7 em, so a requested capital height h uses size = h / 0.7 * 43.886;
 * measured in the preview, this font's capitals are closer to 0.66 em (3 cm requested renders
 * about 2.8 cm).
 */

const EM_PER_CM = 43.886
const CAP_PER_EM = 0.7
// Dark print on the plain white card the letter shows in hand (CaseLightBundle.heldCardColor).
// On the additive display dark print reads as see-through letters cut into a bright card.
const ADDRESS_COLOR = new vec4(0.05, 0.06, 0.09, 1)
const NOTE_COLOR = new vec4(0.6, 0.3, 0.0, 1)
const GLOSS_COLOR = new vec4(0.2, 0.22, 0.28, 1)
/** Vertical layout as fractions of the letter height: note, then gloss, then the address. */
const NOTE_Y_FRACTION = 0.33
const GLOSS_Y_FRACTION = 0.17
const ADDRESS_Y_FRACTION = -0.13
/**
 * Note and gloss capitals (cm). Fixed at their v0.4 sizes (0.46 and 0.36 of the old 1.25 cm address
 * capitals): in v0.5 the address got smaller to fit the real street names, and the note and gloss,
 * which still fit, were kept as they were.
 */
const NOTE_CAP_CM = 0.575
const GLOSS_CAP_CM = 0.45

@component
export class CaseLightPieceCardUI extends BaseScriptComponent {
  private addressText: Text | null = null
  private noteText: Text | null = null
  private glossText: Text | null = null
  private note: string | null = null
  private held = false

  get isHeldShown(): boolean {
    return this.held
  }

  /** True while the hold note is on screen. */
  get isNoteVisible(): boolean {
    return !!this.noteText && this.noteText.getSceneObject().enabled
  }

  /** True while the plain gloss under the hold note is on screen (same rule as the note). */
  get isGlossVisible(): boolean {
    return !!this.glossText && this.glossText.getSceneObject().enabled
  }

  get glossString(): string {
    return this.glossText ? this.glossText.text : ""
  }

  get addressString(): string {
    return this.addressText ? this.addressText.text : ""
  }

  /** Rendered bounds of the address text in the card's local cm (only meaningful while shown). */
  addressBounds(): Rect | null {
    return this.addressText ? this.addressText.getBoundingBox() : null
  }

  configure(address: string, note: string | null, addressCapHeightCm: number, widthCm: number, gloss: string | null = null, letterHeightCm: number = 10.5): void {
    this.note = note
    const h = letterHeightCm
    this.addressText = this.makeText("AddressText", address, addressCapHeightCm, widthCm, new vec3(0, h * ADDRESS_Y_FRACTION, 0), ADDRESS_COLOR)
    this.noteText = this.makeText("HoldNoteText", note ?? "", NOTE_CAP_CM, widthCm, new vec3(0, h * NOTE_Y_FRACTION, 0), NOTE_COLOR)
    // The gloss only exists with a note, so it follows the note's show/hide rule exactly.
    this.glossText = this.makeText("HoldGlossText", note ? gloss ?? "" : "", GLOSS_CAP_CM, widthCm, new vec3(0, h * GLOSS_Y_FRACTION, 0), GLOSS_COLOR)
    this.setHeld(false)
  }

  /** New words for the same card (a route switch): address, hold note and gloss; sizes stay. */
  relabel(address: string, note: string | null, gloss: string | null = null): void {
    this.note = note
    if (this.addressText) this.addressText.text = address
    if (this.noteText) this.noteText.text = note ?? ""
    if (this.glossText) this.glossText.text = note ? gloss ?? "" : ""
    this.setHeld(this.held)
  }

  /** Show the large address (and the hold note, if this piece has one) only while in hand. */
  setHeld(held: boolean): void {
    this.held = held
    if (this.addressText) this.addressText.getSceneObject().enabled = held
    if (this.noteText) this.noteText.getSceneObject().enabled = held && !!this.note
    if (this.glossText) this.glossText.getSceneObject().enabled = held && !!this.note && this.glossText.text.length > 0
  }

  private makeText(name: string, value: string, capHeightCm: number, widthCm: number, pos: vec3, color: vec4): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(this.sceneObject)
    so.getTransform().setLocalPosition(pos)
    const t = so.createComponent("Component.Text") as Text
    t.text = value
    t.depthTest = true
    t.size = (capHeightCm / CAP_PER_EM) * EM_PER_CM
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    // Never shrink: the letter is sized so the longest sample address fits at full size.
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    const halfH = capHeightCm
    t.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -halfH, halfH)
    t.textFill.color = color
    return t
  }
}
