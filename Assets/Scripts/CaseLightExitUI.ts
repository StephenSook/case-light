// Owns: the exit choice shown after the score card: "Again" and "Done" (UIKit BackPlate + Buttons), and the optional "Case check" button just above them.
// Talks to: CaseLightMain, which subscribes to onAgain / onDone / onCaseCheck and calls show() / hide() / setCaseCheckOffered().
// Must not: start a pass or a Case check, change counts or hide anything else itself (CaseLightMain does that).

/**
 * One small panel with two buttons side by side, in the start view next to the score card. It
 * starts hidden and stays up until a choice is made (or a Start button is pressed), even after
 * the score text itself times out, so the exit is always there to take.
 * SceneObject names (stable, for tests): ExitControls (this object), AgainButton, DoneButton,
 * CaseCheckButton (centred just above the panel; shown only while CaseLightMain offers it).
 *
 * Hidden-at-start without breaking UIKit: the BackPlate and Buttons initialize on OnStart, which
 * never fires for a disabled object, so the panel is built enabled and hidden on the opening
 * LateUpdate (after every OnStart has run), unless show() was already called.
 */

import Event, { PublicApi } from "SpectaclesInteractionKit.lspkg/Utils/Event"
import { BackPlate } from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import { Button } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import { FlexItem } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import { FlexLayout } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import { FlexAlign, FlexDirection, FlexJustify } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"

// Labels: the one button type size and look in CaseLightButtonText.
import { buttonLabel } from "./CaseLightButtonText"

const CONTENT_Z = 0.6
const PAD_CM = 0.35
/** Between Again and Done (cm): about 1.15 deg at the start position (Snap: targets at least 1 deg apart). */
const BUTTON_GAP_CM = 1.1
/**
 * Case check button (cm): 2.0 cm tall (about 2.2 deg, Snap's 2 deg minimum), placed so it is about
 * 1.1 deg above Again and Done (the plate's padding plus CASE_CHECK_GAP_CM) and about 1.1 deg below
 * the Start row (with the panel where the scene puts it).
 */
const CASE_CHECK_W_CM = 5.6
const CASE_CHECK_H_CM = 2.0
const CASE_CHECK_GAP_CM = 0.8

@component
export class CaseLightExitUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">CaseLightExitUI - Again / Done after the score card</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Label on the button that starts a new recall pass straight away")
  againLabel: string = "Again"

  @input
  @hint("Label on the button that ends the session view (nothing glowing, counts kept)")
  doneLabel: string = "Done"

  @input
  @hint("Label on the button that starts the optional Case check (two letters drawn in wrong cells, pinch both)")
  caseCheckLabel: string = "Case check"

  @input
  @widget(new SliderWidget(3, 8, 0.1))
  @hint("Width of each button, in cm")
  buttonWidthCm: number = 4.1

  @input
  @widget(new SliderWidget(2.4, 6, 0.1))
  @hint("Height of each button, in cm (2.5 keeps Again, Done and Case check above it at least 1 deg apart and 1 deg under the Start row)")
  buttonHeightCm: number = 2.5

  @input
  @widget(new SliderWidget(30, 110, 1))
  @hint("Typical distance from the eye to these buttons, in cm (kept for the scene; labels use the one button size in CaseLightButtonText)")
  viewDistanceCm: number = 60
  @ui.group_end

  private readonly _onAgain = new Event<void>()
  private readonly _onDone = new Event<void>()
  private readonly _onCaseCheck = new Event<void>()
  private wantVisible = false
  private caseCheckOffered = false
  private caseCheckButton: SceneObject | null = null
  /** Name of the button the current pinch started on, or "". */
  private armedButton = ""
  private strayReleases = 0
  private settled = false

  /** Fired when "Again" is pressed. */
  get onAgain(): PublicApi<void> {
    return this._onAgain.publicApi()
  }

  /** Fired when "Done" is pressed. */
  get onDone(): PublicApi<void> {
    return this._onDone.publicApi()
  }

  /** Fired when "Case check" is pressed. */
  get onCaseCheck(): PublicApi<void> {
    return this._onCaseCheck.publicApi()
  }

  /** Releases ignored because the pinch did not start on that button. */
  get ignoredStrayReleaseCount(): number {
    return this.strayReleases
  }

  /** True while the Again / Done panel is on screen. */
  get isVisible(): boolean {
    return this.settled ? this.sceneObject.enabled : this.wantVisible
  }

  /** True while the Case check button is on screen (offered, and the panel is up). */
  get isCaseCheckVisible(): boolean {
    return this.isVisible && this.caseCheckOffered
  }

  /** The Case check button's object (for layout read-outs), or null before onAwake. */
  get caseCheckButtonObject(): SceneObject | null {
    return this.caseCheckButton
  }

  /** Offer the Case check button with the panel (true) or take it away (false). */
  setCaseCheckOffered(on: boolean): void {
    this.caseCheckOffered = on
    if (this.settled && this.caseCheckButton) this.caseCheckButton.enabled = on
  }

  show(): void {
    this.wantVisible = true
    if (this.settled) this.sceneObject.enabled = true
  }

  hide(): void {
    this.wantVisible = false
    if (this.settled) this.sceneObject.enabled = false
  }

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    const plate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate

    const content = global.scene.createSceneObject("Content")
    content.setParent(this.sceneObject)
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))
    const flex = content.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.autoDiscoverItemsOnStart = false
    flex.width = -1
    flex.height = -1
    flex.direction = FlexDirection.Row
    flex.justifyContent = FlexJustify.Center
    flex.alignItems = FlexAlign.Center
    flex.columnGap = BUTTON_GAP_CM
    flex.paddingTop = PAD_CM
    flex.paddingBottom = PAD_CM
    flex.paddingLeft = PAD_CM
    flex.paddingRight = PAD_CM
    const again = this.addButton(content, "AgainButton", this.againLabel, () => this._onAgain.invoke())
    const done = this.addButton(content, "DoneButton", this.doneLabel, () => this._onDone.invoke())
    flex.addItems([again, done])
    // Case check: its own button, centred just above the panel (outside the row, so Again and
    // Done stay exactly where they are).
    const check = this.makeButton(this.sceneObject, "CaseCheckButton", this.caseCheckLabel, CASE_CHECK_W_CM, CASE_CHECK_H_CM, 0.4, () => this._onCaseCheck.invoke())
    check.getTransform().setLocalPosition(new vec3(0, (this.buttonHeightCm + 2 * PAD_CM) / 2 + CASE_CHECK_GAP_CM + CASE_CHECK_H_CM / 2, CONTENT_Z))
    this.caseCheckButton = check
    flex.onLayoutComplete.add((r) => {
      plate.size = new vec2(r.containerWidth, r.containerHeight)
      check.getTransform().setLocalPosition(new vec3(0, r.containerHeight / 2 + CASE_CHECK_GAP_CM + CASE_CHECK_H_CM / 2, CONTENT_Z))
    })

    // Settle visibility once every OnStart (UIKit init) has run.
    const late = this.createEvent("LateUpdateEvent")
    late.bind(() => {
      this.settled = true
      check.enabled = this.caseCheckOffered
      this.sceneObject.enabled = this.wantVisible
      late.enabled = false
    })
  }

  private addButton(parent: SceneObject, name: string, label: string, onPress: () => void): FlexItem {
    const so = this.makeButton(parent, name, label, this.buttonWidthCm, this.buttonHeightCm, 0.6, onPress)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = this.buttonWidthCm
    item.overrideHeight = this.buttonHeightCm
    return item
  }

  /** A UIKit Button with a centred label; it acts on a release only if the pinch started on it. */
  private makeButton(parent: SceneObject, name: string, label: string, widthCm: number, heightCm: number, labelInsetCm: number, onPress: () => void): SceneObject {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const size = new vec3(widthCm, heightCm, 1)
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
    buttonLabel(so, label, widthCm - 0.5, heightCm - labelInsetCm)
    return so
  }
}
