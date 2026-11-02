// Owns: the Start practice / Start recall buttons, the small Drill pace toggle with its "drill pace N/min" caption (UIKit BackPlate + Buttons), and the one-time "Pinch Start practice" hint.
// Talks to: CaseLightMain, which subscribes to onStartPractice / onStartRecall / onTogglePace and calls hideHint() / setPaceState().
// Must not: start a pass or the pace itself, or hold any session state (the pace on/off state lives in CaseLightPace; this only mirrors it).

/**
 * One row of buttons across the top of the start view: Start practice, Start recall and the small
 * Drill pace toggle (off by default). The two hint lines sit above the two Start buttons; the
 * "drill pace N/min" caption sits above the Drill pace toggle and shows only while the pace is
 * on. A row (not a column) leaves the band between the row and the case free for the bundle, so
 * the whole top letter is in view at the start position.
 * SceneObject names (stable, for tests): StartPracticeButton, StartRecallButton, StartHint,
 * StartHintLine2, PaceRow, DrillPaceButton, PaceLabel, PaceLabelText.
 */

import Event, { PublicApi } from "SpectaclesInteractionKit.lspkg/Utils/Event"
import { RoundedRectangle } from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import { addBacking, DEFAULT_BACKING_COLOR } from "./CaseLightBackingUI"
import { BackPlate } from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import { Button } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import { FlexItem } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import { FlexLayout } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import { FlexAlign, FlexDirection, FlexJustify } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"

// ── Typography: the single source of truth for text size + weight ────────────
// Text.size is the em-square height: em cm = size / 43.886 (StudioLib.d.ts). Sizes are the
// Snap Specs type scale at 110 cm; roleSize scales by distance so the angular size holds.
const FONT_SIZE_SCALE = 1.0
type TextRole = "Title1" | "Title2" | "HeadlineXL" | "Headline1" | "Headline2" | "Subheadline" | "Button" | "Callout" | "Body" | "Caption"
const TYPE_SCALE: Record<TextRole, { size: number; weight: number }> = {
  Title1: { size: 105, weight: 700 },
  Title2: { size: 93, weight: 700 },
  HeadlineXL: { size: 62, weight: 700 },
  Headline1: { size: 54, weight: 700 },
  Headline2: { size: 48, weight: 700 },
  Subheadline: { size: 41, weight: 700 },
  Button: { size: 39, weight: 500 },
  Callout: { size: 39, weight: 700 },
  Body: { size: 39, weight: 500 },
  Caption: { size: 38, weight: 500 }
}
function roleSize(role: TextRole, distanceCm: number = 110): number {
  return TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
}
function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = roleSize(role, distanceCm)
  ;(t as Text & { weight?: number }).weight = TYPE_SCALE[role].weight
}

const CONTENT_Z = 0.6
const BUTTON_LABEL_Z = 0.08
const STACK_GAP_CM = 0.5
const PAD_CM = 0.35
/** Gaps from the top of the button plate to the centres of the two hint lines (cm). */
const HINT_LINE2_GAP_CM = 0.75
const HINT_GAP_CM = 1.85
/** The Drill pace toggle at the right end of the row, and its caption above it (cm). */
const PACE_BUTTON_WIDTH_CM = 4.4
const PACE_CAPTION_GAP_CM = 0.85
const PACE_CAPTION_HALF_H_CM = 0.65
/** Caption prefix; the text is exactly "drill pace <N>/min". */
const PACE_CAPTION_PREFIX = "drill pace "

@component
export class CaseLightControlsUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">CaseLightControlsUI - Start practice / Start recall buttons</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Label on the button that starts a practice pass (slots lit)")
  practiceLabel: string = "Start practice"

  @input
  @hint("Label on the button that starts a recall pass (case dark)")
  recallLabel: string = "Start recall"

  @input
  @widget(new SliderWidget(4, 16, 0.5))
  @hint("Width of each Start button, in cm (the row of three must stay inside the view)")
  buttonWidthCm: number = 6

  @input
  @widget(new SliderWidget(3, 8, 0.1))
  @hint("Height of the button row, in cm (the row, the hint and the bundle share the view above the case)")
  buttonHeightCm: number = 2.5

  @input
  @widget(new SliderWidget(30, 110, 1))
  @hint("Typical distance from the eye to these buttons, in cm (scales the label size)")
  viewDistanceCm: number = 55

  @input
  @hint("One-time hint shown just above the buttons until a Start button is pressed (the Lens starts idle)")
  hintText: string = "Pinch Start practice"

  @input
  @hint("Second line under the hint (what practice and recall are), shown and hidden with it")
  hintLine2Text: string = "Practice, then the case goes dark."

  @input
  @hint("Label on the small toggle that turns the optional drill pace light on and off")
  paceButtonLabel: string = "Drill pace"
  @ui.group_end

  private readonly _onStartPractice = new Event<void>()
  private readonly _onStartRecall = new Event<void>()
  private readonly _onTogglePace = new Event<void>()
  private hint: SceneObject | null = null
  private hintLine2: SceneObject | null = null
  private hintBacking: RoundedRectangle | null = null
  private paceBacking: RoundedRectangle | null = null
  private paceLabelObj: SceneObject | null = null
  /** Name of the button the current pinch started on, or "". */
  private armedButton = ""
  private strayReleases = 0
  private backingColor = DEFAULT_BACKING_COLOR
  private hintDismissed = false
  private paceButton: Button | null = null
  private paceText: Text | null = null
  private paceOn = false
  private paceRate = 18
  private paceColor = new vec4(1, 0.78, 0.35, 1)
  /** True while setPaceState writes the toggle, so that write is not reported back as a press. */
  private syncingPace = false

  /** True while the one-time "Pinch Start practice" hint is on screen. */
  /** Releases ignored because the pinch did not start on that button. */
  get ignoredStrayReleaseCount(): number {
    return this.strayReleases
  }

  get isHintVisible(): boolean {
    return !!this.hint && this.hint.enabled
  }

  /** True while the second hint line ("Practice, then the case goes dark.") is on screen. */
  get isHintLine2Visible(): boolean {
    return !!this.hintLine2 && this.hintLine2.enabled
  }

  /** Hide both hint lines (and their backing) for the rest of the session (called on the opening Start press). */
  hideHint(): void {
    this.hintDismissed = true
    if (this.hint) this.hint.enabled = false
    if (this.hintLine2) this.hintLine2.enabled = false
    if (this.hintBacking) this.hintBacking.getSceneObject().enabled = false
  }

  /** Tint of the subtle backings behind free-floating text (set from CaseLightCaseLabelsUI.backingColor). */
  setBackingColor(color: vec4): void {
    this.backingColor = color
    if (this.hintBacking) this.hintBacking.backgroundColor = color
    if (this.paceBacking) this.paceBacking.backgroundColor = color
  }

  get onStartPractice(): PublicApi<void> {
    return this._onStartPractice.publicApi()
  }

  get onStartRecall(): PublicApi<void> {
    return this._onStartRecall.publicApi()
  }

  /** Fired when the user presses the Drill pace toggle. CaseLightMain decides the new state. */
  get onTogglePace(): PublicApi<void> {
    return this._onTogglePace.publicApi()
  }

  /** True while the "drill pace N/min" caption is on screen. */
  get isPaceLabelVisible(): boolean {
    return !!this.paceText && this.paceText.isEnabledInHierarchy
  }

  /** The caption text (set even while hidden), e.g. "drill pace 18/min". */
  get paceLabelText(): string {
    return this.captionFor(this.paceRate)
  }

  /** True while the Drill pace toggle shows its on state. */
  get isPaceButtonOn(): boolean {
    return this.paceButton ? this.paceButton.isOn : this.paceOn
  }

  /** Mirror the pace state: toggle look, caption text and caption visibility. Never fires onTogglePace. */
  setPaceState(on: boolean, lettersPerMinute: number, color?: vec4): void {
    this.paceOn = on
    this.paceRate = lettersPerMinute
    if (color) this.paceColor = color
    this.applyPaceState()
  }

  onAwake(): void {
    // Canvas at the root: Hierarchy sorting paints the BackPlate first, then the content.
    this.sceneObject.createComponent("Component.Canvas")
    const plate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate

    const content = global.scene.createSceneObject("Content")
    content.setParent(this.sceneObject)
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))

    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    // Items are registered explicitly below (before the layout initializes), which UIKit only
    // allows with auto-discovery off (FlexLayout.addItems throws otherwise).
    flex.autoDiscoverItemsOnStart = false
    flex.width = -1
    flex.height = -1
    // One row across the top of the view, so the bundle has the band below it.
    flex.direction = FlexDirection.Row
    flex.justifyContent = FlexJustify.Center
    flex.alignItems = FlexAlign.Center
    flex.columnGap = STACK_GAP_CM
    flex.paddingTop = PAD_CM
    flex.paddingBottom = PAD_CM
    flex.paddingLeft = PAD_CM
    flex.paddingRight = PAD_CM
    const practice = this.addButton(content, "StartPracticeButton", this.practiceLabel, () => this._onStartPractice.invoke())
    const recall = this.addButton(content, "StartRecallButton", this.recallLabel, () => this._onStartRecall.invoke())
    const paceRow = this.addPaceRow(content)
    flex.addItems([practice.item, recall.item, paceRow])

    // The hint lines (over the two Start buttons) and the pace caption (over the toggle) are
    // placed from the row's measured size; created after the content so the Canvas draws them on top.
    // Subtle backing behind both hint lines, created first so it draws behind them.
    this.hintBacking = addBacking(this.sceneObject, "StartHintBacking", this.hintWidth(), 2.75, this.backingColor, new vec3(0, 0, CONTENT_Z - 0.05))
    this.hint = this.addHint("StartHint", this.hintText, "HeadlineXL", 0.8, new vec4(1, 0.92, 0.6, 1))
    this.hintLine2 = this.addHint("StartHintLine2", this.hintLine2Text, "Body", 0.55, new vec4(0.92, 0.94, 0.98, 1))
    this.addPaceCaption()
    this.placeAboveRow(this.rowWidth(), this.buttonHeightCm + 2 * PAD_CM)
    flex.onLayoutComplete.add((r) => {
      plate.size = new vec2(r.containerWidth, r.containerHeight)
      this.placeAboveRow(r.containerWidth, r.containerHeight)
    })
    if (this.hintDismissed) {
      this.hint.enabled = false
      this.hintLine2.enabled = false
      this.hintBacking.getSceneObject().enabled = false
    }
  }

  /** The row's right end: PaceRow holds the Drill pace toggle (laid out by the row's FlexLayout). */
  private addPaceRow(parent: SceneObject): FlexItem {
    const row = global.scene.createSceneObject("PaceRow")
    row.setParent(parent)
    const rowItem = row.createComponent(FlexItem.getTypeName()) as FlexItem
    rowItem.overrideWidth = PACE_BUTTON_WIDTH_CM
    rowItem.overrideHeight = this.buttonHeightCm

    // The toggle: same Button style as the big buttons, in toggle mode, off by default.
    const btnObj = global.scene.createSceneObject("DrillPaceButton")
    btnObj.setParent(row)
    const size = new vec3(PACE_BUTTON_WIDTH_CM, this.buttonHeightCm, 1)
    const btn = btnObj.createComponent(Button.getTypeName()) as Button
    btn.setIsToggleable(true)
    btn.size = size
    btn.onInitialized.add(() => {
      btn.size = size
      this.applyPaceState()
    })
    // onValueChange fires after the button has flipped its own state; a write from setPaceState
    // is skipped, so the press is reported once and CaseLightMain stays the one decider.
    btn.onValueChange.add(() => {
      if (!this.syncingPace) this._onTogglePace.invoke()
    })
    this.paceButton = btn
    this.addButtonLabel(btnObj, this.paceButtonLabel, PACE_BUTTON_WIDTH_CM - 0.4, this.buttonHeightCm - 0.5, "Headline2")
    this.applyPaceState()
    return rowItem
  }

  /** The caption "drill pace N/min", warm like the pace light, above the toggle; shown only while the pace is on. */
  private addPaceCaption(): void {
    const capW = PACE_BUTTON_WIDTH_CM + 1.2
    const capObj = global.scene.createSceneObject("PaceLabel")
    capObj.setParent(this.sceneObject)
    this.paceLabelObj = capObj
    // Subtle backing behind the caption (shown with it), created first so it draws behind.
    this.paceBacking = addBacking(capObj, "PaceLabelBacking", capW, 2 * PACE_CAPTION_HALF_H_CM, this.backingColor, new vec3(0, 0, -0.05))
    const capText = global.scene.createSceneObject("PaceLabelText")
    capText.setParent(capObj)
    capText.getTransform().setLocalPosition(new vec3(0, 0, BUTTON_LABEL_Z))
    const t = capText.createComponent("Component.Text") as Text
    t.depthTest = true
    applyTextRole(t, "Headline1", this.viewDistanceCm * 0.8)
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Shrink
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-capW / 2, capW / 2, -PACE_CAPTION_HALF_H_CM, PACE_CAPTION_HALF_H_CM)
    this.paceText = t
    this.applyPaceState()
  }

  /** Row width as laid out (the FlexLayout centres the items with these sizes and gaps). */
  private rowWidth(): number {
    return 2 * this.buttonWidthCm + PACE_BUTTON_WIDTH_CM + 2 * STACK_GAP_CM + 2 * PAD_CM
  }

  /** The hint spans the two Start buttons. */
  private hintWidth(): number {
    return 2 * this.buttonWidthCm + STACK_GAP_CM
  }

  /** Push the mirrored pace state into the toggle and caption (safe before the button initializes). */
  private applyPaceState(): void {
    if (this.paceText) {
      this.paceText.text = this.captionFor(this.paceRate)
      this.paceText.textFill.color = this.paceColor
      // The Text component is switched, not its SceneObject, so the row never re-lays out.
      this.paceText.enabled = this.paceOn
    }
    if (this.paceBacking) this.paceBacking.getSceneObject().enabled = this.paceOn
    const btn = this.paceButton
    if (btn && btn.isOn !== this.paceOn) {
      this.syncingPace = true
      btn.isOn = this.paceOn
      this.syncingPace = false
    }
  }

  private captionFor(lettersPerMinute: number): string {
    const n = Number.isInteger(lettersPerMinute) ? `${lettersPerMinute}` : lettersPerMinute.toFixed(1)
    return `${PACE_CAPTION_PREFIX}${n}/min`
  }

  /**
   * Hint lines above the two Start buttons (line 1 above line 2) and the pace caption above the
   * toggle, from the row's laid-out width and height.
   */
  private placeAboveRow(rowWidth: number, rowHeight: number): void {
    const left = -rowWidth / 2 + PAD_CM
    const hintX = left + this.hintWidth() / 2
    const paceX = left + 2 * this.buttonWidthCm + 2 * STACK_GAP_CM + PACE_BUTTON_WIDTH_CM / 2
    const top = rowHeight / 2
    if (this.hint) this.hint.getTransform().setLocalPosition(new vec3(hintX, top + HINT_GAP_CM, CONTENT_Z))
    if (this.hintLine2) this.hintLine2.getTransform().setLocalPosition(new vec3(hintX, top + HINT_LINE2_GAP_CM, CONTENT_Z))
    // The backing spans both lines: from just above the row to just above line 1.
    if (this.hintBacking) this.hintBacking.getSceneObject().getTransform().setLocalPosition(new vec3(hintX, top + (HINT_LINE2_GAP_CM + HINT_GAP_CM) / 2, CONTENT_Z - 0.05))
    if (this.paceLabelObj) this.paceLabelObj.getTransform().setLocalPosition(new vec3(paceX, top + PACE_CAPTION_GAP_CM, CONTENT_Z))
  }

  private addHint(name: string, text: string, role: TextRole, halfHeightCm: number, color: vec4): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(this.sceneObject)
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    applyTextRole(t, role, this.viewDistanceCm * 1.3)
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Shrink
    t.verticalOverflow = VerticalOverflow.Overflow
    const w = this.hintWidth()
    t.layoutRect = Rect.create(-w / 2, w / 2, -halfHeightCm, halfHeightCm)
    t.textFill.color = color
    return so
  }

  private addButton(parent: SceneObject, name: string, label: string, onPress: () => void): { button: Button; item: FlexItem } {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const size = new vec3(this.buttonWidthCm, this.buttonHeightCm, 1)
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.size = size
    btn.onInitialized.add(() => {
      btn.size = size
    })
    // One pinch, one button: act on the release only if this pinch started on this button.
    btn.onTriggerDown.add(() => {
      this.armedButton = name
    })
    btn.onTriggerUp.add(() => {
      if (this.armedButton !== name) {
        this.strayReleases++
        return
      }
      this.armedButton = ""
      onPress()
    })
    this.addButtonLabel(so, label, this.buttonWidthCm - 0.5, this.buttonHeightCm - 0.6)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = this.buttonWidthCm
    item.overrideHeight = this.buttonHeightCm
    return { button: btn, item }
  }

  private addButtonLabel(parent: SceneObject, text: string, widthCm: number, heightCm: number, role: TextRole = "Title1"): void {
    const so = global.scene.createSceneObject("ButtonLabel")
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(0, 0, BUTTON_LABEL_Z))
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    applyTextRole(t, role, this.viewDistanceCm)
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Shrink
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -heightCm / 2, heightCm / 2)
  }
}
