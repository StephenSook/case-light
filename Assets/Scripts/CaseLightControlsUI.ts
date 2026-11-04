// Owns: the opening row (UIKit BackPlate + Buttons: an "Options" toggle, Start practice, Start recall and the "Show my case" toggle), the Options panel it opens (the Drill pace and "Hide stand-in case" toggles), the "drill pace N/min" caption, the one-time "Pinch Start practice" hint, the one-time welcome panel (two lines and "Reset progress") on the case face, and the "Demo replay" label shown in the hint's place during a demo replay.
// Talks to: CaseLightMain, which subscribes to onStartPractice / onStartRecall / onToggleOptions / onTogglePace / onToggleShowMyCase / onToggleStandIn / onResetProgress and calls hideHint() / setOptionsOpen() / setPaceState() / setShowMyCaseState() / setStandInState() / showWelcome() / hideWelcome() / showNotice() / showDemoLabel().
// Must not: start a pass, the pace or the mastery map itself, hide the stand-in case itself, or hold any session state (the pace, map and stand-in on/off states and whether the Options panel is open are decided by CaseLightMain; this only mirrors them).

/**
 * One row of buttons across the top of the start view: the narrow "Options" toggle, Start
 * practice, Start recall and the narrow "Show my case" toggle, each at least 2 deg each way (Snap's
 * minimum target size) and ROW_GAP_CM apart (at least 1 deg at the start position, Snap's spacing
 * guidance). The two hint lines sit above the two Start buttons; the "drill pace N/min" caption sits
 * above Show my case, at the row's right end, and shows only while the pace is on. A row (not a
 * column) leaves the band between the row and the case free for the bundle, so the whole top letter
 * is in view at the start position.
 * Options opens a small panel under it: the Drill pace toggle (off by default) above "Hide stand-in
 * case", in a column left of the bundle (OPTIONS_*). It stays open until Options is pressed again, a
 * Start button is pressed or a pass ends; CaseLightMain decides every open and close (it ignores an
 * Options press while the score card or Again and Done are up, since the panel opens where the score
 * card stands), and hidden means its SceneObject is off, colliders included. It is far from the opening pinch hint, which plays over the bundle's
 * right half. Every button label uses the one size in CaseLightButtonText (narrow toggles wrap at
 * spaces); the Start button that is the next step is drawn as the primary action (setPrimary).
 * The welcome panel (only when saved progress exists) stands on the case face just under the
 * caption, over the empty upper row at open (no letter is in the case yet), in the case's frame:
 * two lines and a "Reset progress" button. CaseLightMain decides when it shows (it goes with the
 * hint on the opening Start press, and is hidden while Veteran mode is on). Hidden means the whole
 * WelcomeProgress SceneObject is off, so its backplate's collider and interaction plane and the
 * button's collider take no ray. The same panel shows a one-line notice for a few seconds when
 * CaseLightMain asks (storage full).
 * SceneObject names (stable, for tests): OptionsButton, StartPracticeButton, StartRecallButton,
 * ShowMyCaseButton, StartHint, StartHintLine2, PaceLabel, PaceLabelBacking, PaceLabelText,
 * OptionsPanel, DrillPaceButton, HideStandInButton, WelcomeProgress, WelcomeLine1, WelcomeLine2,
 * ResetProgressButton.
 */

import Event, { PublicApi } from "SpectaclesInteractionKit.lspkg/Utils/Event"
import { RoundedRectangle } from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"
import { addBacking, DEFAULT_BACKING_COLOR } from "./CaseLightBackingUI"
import { buttonLabel, setLabelPrimary } from "./CaseLightButtonText"
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
/** Between the buttons of the opening row: about 1.1 deg at the start position (Snap: targets at least 1 deg apart). */
const ROW_GAP_CM = 1.1
/** The narrow Options and Show my case toggles in the row (cm). */
const ROW_TOGGLE_W_CM = 2.35
const PAD_CM = 0.35
/** Gaps from the top of the button plate to the centres of the two hint lines (cm). */
const HINT_LINE2_GAP_CM = 0.75
const HINT_GAP_CM = 1.85
/** The "drill pace N/min" caption above the row's right end (cm), narrow enough to clear the hint backing. */
const PACE_CAPTION_W_CM = 3.6
const PACE_CAPTION_GAP_CM = 0.85
const PACE_CAPTION_HALF_H_CM = 0.65
/**
 * The Options panel, in this row's frame (cm): two toggles in a column under the Options toggle,
 * each 2.25 x 2.0 cm (about 2.4 x 2.1 deg at the start position, tall enough for three lines of
 * button labels). The column is shifted a little left of the Options toggle so it stays between
 * the display's left edge and the top letter (about 0.14 deg and 0.25 deg spare, where the stand-in
 * toggle used to be); with so little room it has no plate of its own. The row's frame leans back, so
 * the lower toggle is moved a little further left to keep the column's right edge at one angle.
 * OPTIONS_GAP_CM (about 1.1 deg) separates the row from the column and the two toggles.
 */
const PANEL_TOGGLE_W_CM = 2.25
const PANEL_TOGGLE_H_CM = 2.0
const OPTIONS_GAP_CM = 1.1
const OPTIONS_SHIFT_X_CM = -0.36
const LOWER_TOGGLE_SHIFT_X_CM = -0.16
/**
 * Welcome panel, in the case's frame (cm): centred across at the case's centre, just under the
 * caption strip, a little in front of the face. Lines and button relative to the panel's centre.
 * Reset progress is 2.05 cm tall (about 2.1 deg at the start position, Snap's 2 deg minimum); the
 * plate reaches down far enough to hold it with the same padding.
 */
const WELCOME_CASE_POS = new vec3(0, -1.25, 1.2)
const WELCOME_W_CM = 19.5
const WELCOME_TOP_CM = 1.95
const WELCOME_BOTTOM_CM = -3.0
const WELCOME_LINE1_Y_CM = 1.2
const WELCOME_LINE2_Y_CM = 0.15
const WELCOME_LINE1_CAP_CM = 0.62
const WELCOME_LINE2_CAP_CM = 0.52
const RESET_Y_CM = -1.625
const RESET_W_CM = 5.4
const RESET_H_CM = 2.05
const EM_PER_CM = 43.886
const CAP_PER_EM = 0.7
/** Caption prefix; the text is exactly "drill pace <N>/min". */
const PACE_CAPTION_PREFIX = "drill pace "
/** Demo replay label: a warm coral, on a backing the height of one hint line pair (cm). */
const DEMO_LABEL_COLOR = new vec4(1, 0.62, 0.55, 1)
const DEMO_BACKING_H_CM = 1.8

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
  @hint("Width of each Start button, in cm (the row of four, 1 deg apart, must stay inside the view and clear of the route buttons)")
  buttonWidthCm: number = 5.0

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
  @hint("Label on the toggle at the left of the row that opens the Options panel (Drill pace, Hide stand-in case)")
  optionsLabel: string = "Options"

  @input
  @hint("Label on the small toggle that turns the optional drill pace light on and off")
  paceButtonLabel: string = "Drill pace"

  @input
  @hint("Label on the toggle that shows the mastery map on the case (what you remember, from your recall passes)")
  showMyCaseLabel: string = "Show my case"

  @input
  @hint("Label on the toggle that hides the stand-in case (its lines and the printed numbers, street names and HOLD), leaving only what the glasses would draw over a real case")
  hideStandInLabel: string = "Hide stand-in case"

  @input
  @hint("Label on the button that removes the saved progress (shown with the welcome lines)")
  resetProgressLabel: string = "Reset progress"
  @ui.group_end

  private readonly _onStartPractice = new Event<void>()
  private readonly _onStartRecall = new Event<void>()
  private readonly _onToggleOptions = new Event<void>()
  private readonly _onTogglePace = new Event<void>()
  private readonly _onToggleShowMyCase = new Event<void>()
  private readonly _onToggleStandIn = new Event<void>()
  private readonly _onResetProgress = new Event<void>()
  private welcomeRoot: SceneObject | null = null
  private welcomeLine1: Text | null = null
  private welcomeLine2: Text | null = null
  private resetButtonObj: SceneObject | null = null
  /** What the welcome panel should show once UIKit has initialised: nothing, the welcome, or a notice. */
  private welcomeWant: "none" | "welcome" | "notice" = "none"
  private welcomeSettled = false
  private noticeHide: DelayedCallbackEvent | null = null
  private showMyCaseButton: Button | null = null
  private showMyCaseOn = false
  /** True while setShowMyCaseState writes the toggle, so that write is not reported back as a press. */
  private syncingShowMyCase = false
  private standInButton: Button | null = null
  private optionsButton: Button | null = null
  private optionsRoot: SceneObject | null = null
  private optionsOpen = false
  private optionsSettled = false
  /** True while setOptionsOpen writes the toggle, so that write is not reported back as a press. */
  private syncingOptions = false
  private standInOn = false
  /** True while setStandInState writes the toggle, so that write is not reported back as a press. */
  private syncingStandIn = false
  private hint: SceneObject | null = null
  private hintLine2: SceneObject | null = null
  private hintBacking: RoundedRectangle | null = null
  private demoLabel: SceneObject | null = null
  private demoBacking: RoundedRectangle | null = null
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
  private practiceText: Text | null = null
  private recallText: Text | null = null
  private primary: "practice" | "recall" | "none" = "practice"

  /**
   * Which Start button is drawn as the primary action: "practice", "recall" or "none" (during a
   * pass). CaseLightMain decides; this only mirrors it. Both buttons always take a press.
   */
  get primaryAction(): "practice" | "recall" | "none" {
    return this.primary
  }

  /** Draw one Start button as the primary action (label-yellow, bold), the other secondary; "none": both secondary. */
  setPrimary(which: "practice" | "recall" | "none"): void {
    this.primary = which
    this.applyPrimary()
  }

  private applyPrimary(): void {
    if (this.practiceText) setLabelPrimary(this.practiceText, this.primary === "practice")
    if (this.recallText) setLabelPrimary(this.recallText, this.primary === "recall")
  }

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

  /** True while the "Demo replay" label is on screen. */
  get isDemoLabelShown(): boolean {
    return !!this.demoLabel && this.demoLabel.enabled
  }

  /** The label's text ("" before it is shown). */
  get demoLabelText(): string {
    const t = this.demoLabel ? (this.demoLabel.getComponent("Component.Text") as Text) : null
    return t ? t.text : ""
  }

  /**
   * Show the demo replay label in the hint's place (the hint goes for good). Shown for the whole
   * replay, so no frame of a replay can be taken for live input.
   */
  showDemoLabel(text: string): void {
    this.hideHint()
    if (!this.demoLabel || !this.demoBacking) return
    const t = this.demoLabel.getComponent("Component.Text") as Text
    if (t) t.text = text
    this.demoLabel.enabled = true
    this.demoBacking.getSceneObject().enabled = true
  }

  /** Hide both hint lines (and their backing) for the rest of the session (called on the opening Start press). */
  hideHint(): void {
    this.hintDismissed = true
    if (this.hint) this.hint.enabled = false
    if (this.hintLine2) this.hintLine2.enabled = false
    if (this.hintBacking) this.hintBacking.getSceneObject().enabled = false
    // The welcome is one-time too: it goes with the hint.
    this.hideWelcome()
  }

  /** Fired when "Reset progress" is pressed. */
  get onResetProgress(): PublicApi<void> {
    return this._onResetProgress.publicApi()
  }

  /** True while the welcome lines are on screen (not a notice). */
  get isWelcomeVisible(): boolean {
    return this.welcomeWant === "welcome" && (!this.welcomeSettled || (!!this.welcomeRoot && this.welcomeRoot.enabled))
  }

  /** True while the Reset progress button is on screen. */
  get isResetProgressVisible(): boolean {
    return this.isWelcomeVisible && !!this.resetButtonObj && this.resetButtonObj.enabled
  }

  /** The two welcome lines as set ("" when hidden). */
  get welcomeLineTexts(): string[] {
    if (!this.isWelcomeVisible) return ["", ""]
    return [this.welcomeLine1 ? this.welcomeLine1.text : "", this.welcomeLine2 ? this.welcomeLine2.text : ""]
  }

  /** The notice line while one is shown, else "". */
  get noticeText(): string {
    return this.welcomeWant === "notice" && this.welcomeLine1 ? this.welcomeLine1.text : ""
  }

  /** Show the welcome lines and Reset progress (CaseLightMain calls this only when progress was saved). */
  showWelcome(line1: string, line2: string): void {
    if (this.welcomeLine1) this.welcomeLine1.text = line1
    if (this.welcomeLine2) {
      this.welcomeLine2.text = line2
      this.welcomeLine2.getSceneObject().enabled = true
    }
    if (this.resetButtonObj) this.resetButtonObj.enabled = true
    if (this.noticeHide) this.noticeHide.enabled = false
    this.welcomeWant = "welcome"
    this.applyWelcome()
  }

  /** Hide the welcome lines and Reset progress for the rest of the session (a notice may still show). */
  hideWelcome(): void {
    if (this.welcomeWant !== "welcome") return
    this.welcomeWant = "none"
    this.applyWelcome()
  }

  /** A plain one-line notice in the welcome panel's place for `seconds` (no button, no second line). */
  showNotice(text: string, seconds: number): void {
    if (this.welcomeLine1) this.welcomeLine1.text = text
    if (this.welcomeLine2) this.welcomeLine2.getSceneObject().enabled = false
    if (this.resetButtonObj) this.resetButtonObj.enabled = false
    this.welcomeWant = "notice"
    this.applyWelcome()
    if (this.noticeHide) {
      this.noticeHide.enabled = true
      this.noticeHide.reset(seconds)
    }
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

  /** Fired when the user presses the Options toggle. CaseLightMain decides whether the panel opens. */
  get onToggleOptions(): PublicApi<void> {
    return this._onToggleOptions.publicApi()
  }

  /** Fired when the user presses the Drill pace toggle. CaseLightMain decides the new state. */
  get onTogglePace(): PublicApi<void> {
    return this._onTogglePace.publicApi()
  }

  /** Fired when the user presses the Show my case toggle. CaseLightMain decides the new state. */
  get onToggleShowMyCase(): PublicApi<void> {
    return this._onToggleShowMyCase.publicApi()
  }

  /** True while the Show my case toggle shows its on state. */
  get isShowMyCaseOn(): boolean {
    return this.showMyCaseButton ? this.showMyCaseButton.isOn : this.showMyCaseOn
  }

  /** Mirror the mastery map's state in the toggle. Never fires onToggleShowMyCase. */
  setShowMyCaseState(on: boolean): void {
    this.showMyCaseOn = on
    this.applyShowMyCaseState()
  }

  /** Fired when the user presses the Hide stand-in case toggle. CaseLightMain decides the new state. */
  get onToggleStandIn(): PublicApi<void> {
    return this._onToggleStandIn.publicApi()
  }

  /** True while the Hide stand-in case toggle shows its on state. */
  get isHideStandInOn(): boolean {
    return this.standInButton ? this.standInButton.isOn : this.standInOn
  }

  /** Mirror the stand-in state in the toggle (on = hidden). Never fires onToggleStandIn. */
  setStandInState(on: boolean): void {
    this.standInOn = on
    this.applyStandInState()
  }

  /** True while the Options panel (Drill pace, Hide stand-in case) is open. */
  get isOptionsOpen(): boolean {
    return this.optionsOpen
  }

  /** Open or close the Options panel (the Options toggle mirrors it). Never fires onToggleOptions. */
  setOptionsOpen(open: boolean): void {
    this.optionsOpen = open
    this.applyOptions()
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
    // Canvas at the root: Hierarchy sorting paints the BackPlate before the content.
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
    flex.columnGap = ROW_GAP_CM
    flex.paddingTop = PAD_CM
    flex.paddingBottom = PAD_CM
    flex.paddingLeft = PAD_CM
    flex.paddingRight = PAD_CM
    const options = this.addRowToggle(content, "OptionsButton", this.optionsLabel, () => this.applyOptions(), () => {
      if (!this.syncingOptions) this._onToggleOptions.invoke()
    })
    this.optionsButton = options.button
    const practice = this.addButton(content, "StartPracticeButton", this.practiceLabel, () => this._onStartPractice.invoke())
    const recall = this.addButton(content, "StartRecallButton", this.recallLabel, () => this._onStartRecall.invoke())
    this.practiceText = practice.label
    this.recallText = recall.label
    this.applyPrimary()
    const showMyCase = this.addRowToggle(content, "ShowMyCaseButton", this.showMyCaseLabel, () => this.applyShowMyCaseState(), () => {
      if (!this.syncingShowMyCase) this._onToggleShowMyCase.invoke()
    })
    this.showMyCaseButton = showMyCase.button
    flex.addItems([options.item, practice.item, recall.item, showMyCase.item])

    // The hint lines (over the two Start buttons) and the pace caption (over the toggle) are
    // placed from the row's measured size; created after the content so the Canvas draws them on top.
    // Subtle backing behind both hint lines, created ahead of them so it draws behind them.
    this.hintBacking = addBacking(this.sceneObject, "StartHintBacking", this.hintWidth(), 2.75, this.backingColor, new vec3(0, 0, CONTENT_Z - 0.05))
    this.hint = this.addHint("StartHint", this.hintText, "HeadlineXL", 0.8, new vec4(1, 0.92, 0.6, 1))
    this.hintLine2 = this.addHint("StartHintLine2", this.hintLine2Text, "Body", 0.55, new vec4(0.92, 0.94, 0.98, 1))
    this.addPaceCaption()
    // The demo replay label: hidden unless a demo replay runs; it takes the hint's place.
    this.demoBacking = addBacking(this.sceneObject, "DemoReplayBacking", this.hintWidth(), DEMO_BACKING_H_CM, this.backingColor, new vec3(0, 0, CONTENT_Z - 0.05))
    this.demoBacking.getSceneObject().enabled = false
    this.demoLabel = this.addHint("DemoReplayLabel", "", "HeadlineXL", 0.8, DEMO_LABEL_COLOR)
    this.demoLabel.enabled = false
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
    this.addWelcome()
    this.addOptionsPanel()
  }

  /**
   * The welcome panel on the case face (own Canvas and BackPlate, a child of the case group so it
   * moves with the case). Built enabled so UIKit initialises; settled hidden on the opening
   * LateUpdate unless showWelcome() or showNotice() came earlier.
   */
  private addWelcome(): void {
    const parent = this.sceneObject.getParent()
    const root = global.scene.createSceneObject("WelcomeProgress")
    root.setParent(parent ? parent : this.sceneObject)
    root.getTransform().setLocalPosition(parent ? WELCOME_CASE_POS : new vec3(0, -6, 0))
    root.createComponent("Component.Canvas")
    const plate = root.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.size = new vec2(WELCOME_W_CM, WELCOME_TOP_CM - WELCOME_BOTTOM_CM)
    const content = global.scene.createSceneObject("WelcomeContent")
    content.setParent(root)
    // The plate is centred on the root; content is placed so the plate spans WELCOME_TOP..BOTTOM.
    content.getTransform().setLocalPosition(new vec3(0, -(WELCOME_TOP_CM + WELCOME_BOTTOM_CM) / 2, CONTENT_Z))
    this.welcomeLine1 = this.addWelcomeLine(content, "WelcomeLine1", WELCOME_LINE1_Y_CM, WELCOME_LINE1_CAP_CM, new vec4(1, 0.92, 0.6, 1))
    this.welcomeLine2 = this.addWelcomeLine(content, "WelcomeLine2", WELCOME_LINE2_Y_CM, WELCOME_LINE2_CAP_CM, new vec4(0.92, 0.94, 0.98, 1))
    const btnObj = global.scene.createSceneObject("ResetProgressButton")
    btnObj.setParent(content)
    btnObj.getTransform().setLocalPosition(new vec3(0, RESET_Y_CM, 0))
    const size = new vec3(RESET_W_CM, RESET_H_CM, 1)
    const btn = btnObj.createComponent(Button.getTypeName()) as Button
    btn.size = size
    btn.onInitialized.add(() => {
      btn.size = size
    })
    // One pinch, one button: act on the release only if this pinch started on this button.
    btn.onTriggerDown.add(() => {
      this.armedButton = "ResetProgressButton"
    })
    btn.onTriggerUp.add(() => {
      if (this.armedButton !== "ResetProgressButton") {
        this.strayReleases++
        return
      }
      this.armedButton = ""
      this._onResetProgress.invoke()
    })
    buttonLabel(btnObj, this.resetProgressLabel, RESET_W_CM - 0.4, RESET_H_CM - 0.4)
    this.resetButtonObj = btnObj
    this.welcomeRoot = root
    this.noticeHide = this.createEvent("DelayedCallbackEvent")
    this.noticeHide.bind(() => {
      if (this.welcomeWant !== "notice") return
      this.welcomeWant = "none"
      this.applyWelcome()
    })
    const late = this.createEvent("LateUpdateEvent")
    late.bind(() => {
      this.welcomeSettled = true
      this.applyWelcome()
      late.enabled = false
    })
  }

  private addWelcomeLine(parent: SceneObject, name: string, y: number, capCm: number, color: vec4): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(0, y, BUTTON_LABEL_Z))
    const t = so.createComponent("Component.Text") as Text
    t.text = ""
    t.depthTest = true
    t.size = (capCm / CAP_PER_EM) * EM_PER_CM
    ;(t as Text & { weight?: number }).weight = 600
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Shrink
    t.verticalOverflow = VerticalOverflow.Overflow
    const w = WELCOME_W_CM - 1.0
    t.layoutRect = Rect.create(-w / 2, w / 2, -capCm, capCm)
    t.textFill.color = color
    return t
  }

  /** Show or hide the welcome panel as wanted (only after UIKit has initialised it). */
  private applyWelcome(): void {
    if (!this.welcomeSettled || !this.welcomeRoot) return
    this.welcomeRoot.enabled = this.welcomeWant !== "none"
  }

  /**
   * The Options panel (a child of this row, so it moves with it): the Drill pace toggle above Hide
   * stand-in case, in a column under the Options toggle. Built enabled so UIKit initialises;
   * settled hidden on the opening LateUpdate unless it was opened earlier. Hidden means its
   * SceneObject is off, so its toggles take no ray.
   */
  private addOptionsPanel(): void {
    const root = global.scene.createSceneObject("OptionsPanel")
    root.setParent(this.sceneObject)
    root.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))
    // Under the Options toggle (the row's left end, as laid out by the FlexLayout).
    const x = -this.rowWidth() / 2 + PAD_CM + ROW_TOGGLE_W_CM / 2 + OPTIONS_SHIFT_X_CM
    const paceY = -this.buttonHeightCm / 2 - OPTIONS_GAP_CM - PANEL_TOGGLE_H_CM / 2
    const pace = this.addToggle(root, "DrillPaceButton", this.paceButtonLabel, PANEL_TOGGLE_W_CM, PANEL_TOGGLE_H_CM, () => this.applyPaceState(), () => {
      // onValueChange fires after the button has flipped its own state; a write from setPaceState
      // is skipped, so the press is reported once and CaseLightMain stays the one decider.
      if (!this.syncingPace) this._onTogglePace.invoke()
    })
    pace.getSceneObject().getTransform().setLocalPosition(new vec3(x, paceY, 0))
    this.paceButton = pace
    const standIn = this.addToggle(root, "HideStandInButton", this.hideStandInLabel, PANEL_TOGGLE_W_CM, PANEL_TOGGLE_H_CM, () => this.applyStandInState(), () => {
      if (!this.syncingStandIn) this._onToggleStandIn.invoke()
    })
    standIn.getSceneObject().getTransform().setLocalPosition(new vec3(x + LOWER_TOGGLE_SHIFT_X_CM, paceY - PANEL_TOGGLE_H_CM - OPTIONS_GAP_CM, 0))
    this.standInButton = standIn
    this.applyPaceState()
    this.applyStandInState()
    this.optionsRoot = root
    const late = this.createEvent("LateUpdateEvent")
    late.bind(() => {
      this.optionsSettled = true
      this.applyOptions()
      late.enabled = false
    })
  }

  /** Show or hide the Options panel as wanted (only after UIKit has initialised it) and mirror it in the toggle. */
  private applyOptions(): void {
    const btn = this.optionsButton
    if (btn && btn.isOn !== this.optionsOpen) {
      this.syncingOptions = true
      btn.isOn = this.optionsOpen
      this.syncingOptions = false
    }
    if (this.optionsSettled && this.optionsRoot) this.optionsRoot.enabled = this.optionsOpen
  }

  /** The caption "drill pace N/min", warm like the pace light, above the toggle; shown only while the pace is on. */
  private addPaceCaption(): void {
    const capW = PACE_CAPTION_W_CM
    const capObj = global.scene.createSceneObject("PaceLabel")
    capObj.setParent(this.sceneObject)
    this.paceLabelObj = capObj
    // Subtle backing behind the caption (shown with it), created ahead of it so it draws behind.
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

  /** A narrow toggle in the opening row (laid out by the row's FlexLayout), the row's height. */
  private addRowToggle(parent: SceneObject, name: string, label: string, onReady: () => void, onPress: () => void): { button: Button; item: FlexItem } {
    const button = this.addToggle(parent, name, label, ROW_TOGGLE_W_CM, this.buttonHeightCm, onReady, onPress)
    const item = button.getSceneObject().createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = ROW_TOGGLE_W_CM
    item.overrideHeight = this.buttonHeightCm
    return { button, item }
  }

  /**
   * A toggle with its label wrapped onto lines ("Show my case" to "Show / my case", "Hide stand-in
   * case" to "Hide / stand-in / case"). The press is reported once (onValueChange, after the button
   * flips its own state); a write from the mirror methods is skipped by their syncing flags.
   */
  private addToggle(parent: SceneObject, name: string, label: string, widthCm: number, heightCm: number, onReady: () => void, onPress: () => void): Button {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const size = new vec3(widthCm, heightCm, 1)
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.setIsToggleable(true)
    btn.size = size
    btn.onInitialized.add(() => {
      btn.size = size
      onReady()
    })
    btn.onValueChange.add(onPress)
    buttonLabel(so, label, widthCm - 0.04, heightCm - 0.1)
    return btn
  }

  private applyStandInState(): void {
    const btn = this.standInButton
    if (btn && btn.isOn !== this.standInOn) {
      this.syncingStandIn = true
      btn.isOn = this.standInOn
      this.syncingStandIn = false
    }
  }

  private applyShowMyCaseState(): void {
    const btn = this.showMyCaseButton
    if (btn && btn.isOn !== this.showMyCaseOn) {
      this.syncingShowMyCase = true
      btn.isOn = this.showMyCaseOn
      this.syncingShowMyCase = false
    }
  }

  /** Row width as laid out (the FlexLayout centres the items with these sizes and gaps). */
  private rowWidth(): number {
    return 2 * ROW_TOGGLE_W_CM + 2 * this.buttonWidthCm + 3 * ROW_GAP_CM + 2 * PAD_CM
  }

  /** The hint spans the two Start buttons. */
  private hintWidth(): number {
    return 2 * this.buttonWidthCm + ROW_GAP_CM
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
   * row's right end (Show my case), from the row's laid-out width and height.
   */
  private placeAboveRow(rowWidth: number, rowHeight: number): void {
    const left = -rowWidth / 2 + PAD_CM
    const hintX = left + ROW_TOGGLE_W_CM + ROW_GAP_CM + this.hintWidth() / 2
    const paceX = left + ROW_TOGGLE_W_CM + 2 * this.buttonWidthCm + 3 * ROW_GAP_CM + ROW_TOGGLE_W_CM / 2
    const top = rowHeight / 2
    if (this.hint) this.hint.getTransform().setLocalPosition(new vec3(hintX, top + HINT_GAP_CM, CONTENT_Z))
    if (this.hintLine2) this.hintLine2.getTransform().setLocalPosition(new vec3(hintX, top + HINT_LINE2_GAP_CM, CONTENT_Z))
    // The backing spans both lines: from just above the row to just above line 1.
    if (this.hintBacking) this.hintBacking.getSceneObject().getTransform().setLocalPosition(new vec3(hintX, top + (HINT_LINE2_GAP_CM + HINT_GAP_CM) / 2, CONTENT_Z - 0.05))
    if (this.paceLabelObj) this.paceLabelObj.getTransform().setLocalPosition(new vec3(paceX, top + PACE_CAPTION_GAP_CM, CONTENT_Z))
    const demoY = top + (HINT_LINE2_GAP_CM + HINT_GAP_CM) / 2
    if (this.demoLabel) this.demoLabel.getTransform().setLocalPosition(new vec3(hintX, demoY, CONTENT_Z))
    if (this.demoBacking) this.demoBacking.getSceneObject().getTransform().setLocalPosition(new vec3(hintX, demoY, CONTENT_Z - 0.05))
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

  private addButton(parent: SceneObject, name: string, label: string, onPress: () => void): { button: Button; item: FlexItem; label: Text } {
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
    const t = buttonLabel(so, label, this.buttonWidthCm - 0.5, this.buttonHeightCm - 0.6)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = this.buttonWidthCm
    item.overrideHeight = this.buttonHeightCm
    return { button: btn, item, label: t }
  }
}
