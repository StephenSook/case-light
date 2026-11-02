// Owns: the exit choice shown after the score card: "Again" and "Done" (UIKit BackPlate + Buttons).
// Talks to: CaseLightMain, which subscribes to onAgain / onDone and calls show() / hide().
// Must not: start a pass, change counts or hide anything else itself (CaseLightMain does that).

/**
 * One small panel with two buttons side by side, in the start view next to the score card. It
 * starts hidden and stays up until a choice is made (or a Start button is pressed), even after
 * the score text itself times out, so the exit is always there to take.
 * SceneObject names (stable, for tests): ExitControls (this object), AgainButton, DoneButton.
 *
 * Hidden-at-start without breaking UIKit: the BackPlate and Buttons initialize on OnStart, which
 * never fires for a disabled object, so the panel is built enabled and hidden on the first
 * LateUpdate (after every OnStart has run), unless show() was already called.
 */

import Event, { PublicApi } from "SpectaclesInteractionKit.lspkg/Utils/Event"
import { BackPlate } from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import { Button } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import { FlexItem } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import { FlexLayout } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import { FlexAlign, FlexDirection, FlexJustify } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"

// ── Typography: same type scale as CaseLightControlsUI ──────────────────────────────────
const FONT_SIZE_SCALE = 1.0
type TextRole = "Title1" | "Title2" | "HeadlineXL" | "Headline1" | "Headline2" | "Button"
const TYPE_SCALE: Record<TextRole, { size: number; weight: number }> = {
  Title1: { size: 105, weight: 700 },
  Title2: { size: 93, weight: 700 },
  HeadlineXL: { size: 62, weight: 700 },
  Headline1: { size: 54, weight: 700 },
  Headline2: { size: 48, weight: 700 },
  Button: { size: 39, weight: 500 }
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
const PAD_CM = 0.35

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
  @widget(new SliderWidget(3, 8, 0.1))
  @hint("Width of each button, in cm")
  buttonWidthCm: number = 4.1

  @input
  @widget(new SliderWidget(2.4, 6, 0.1))
  @hint("Height of each button, in cm")
  buttonHeightCm: number = 3.0

  @input
  @widget(new SliderWidget(30, 110, 1))
  @hint("Typical distance from the eye to these buttons, in cm (scales the label size)")
  viewDistanceCm: number = 60
  @ui.group_end

  private readonly _onAgain = new Event<void>()
  private readonly _onDone = new Event<void>()
  private wantVisible = false
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

  /** True while the Again / Done panel is on screen. */
  /** Releases ignored because the pinch did not start on that button. */
  get ignoredStrayReleaseCount(): number {
    return this.strayReleases
  }

  get isVisible(): boolean {
    return this.settled ? this.sceneObject.enabled : this.wantVisible
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
    flex.columnGap = 0.5
    flex.paddingTop = PAD_CM
    flex.paddingBottom = PAD_CM
    flex.paddingLeft = PAD_CM
    flex.paddingRight = PAD_CM
    const again = this.addButton(content, "AgainButton", this.againLabel, () => this._onAgain.invoke())
    const done = this.addButton(content, "DoneButton", this.doneLabel, () => this._onDone.invoke())
    flex.addItems([again, done])
    flex.onLayoutComplete.add((r) => {
      plate.size = new vec2(r.containerWidth, r.containerHeight)
    })

    // Settle visibility once every OnStart (UIKit init) has run.
    const late = this.createEvent("LateUpdateEvent")
    late.bind(() => {
      this.settled = true
      this.sceneObject.enabled = this.wantVisible
      late.enabled = false
    })
  }

  private addButton(parent: SceneObject, name: string, label: string, onPress: () => void): FlexItem {
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
    return item
  }

  private addButtonLabel(parent: SceneObject, text: string, widthCm: number, heightCm: number): void {
    const so = global.scene.createSceneObject("ButtonLabel")
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(0, 0, BUTTON_LABEL_Z))
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    applyTextRole(t, "Title2", this.viewDistanceCm)
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Shrink
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -heightCm / 2, heightCm / 2)
  }
}
