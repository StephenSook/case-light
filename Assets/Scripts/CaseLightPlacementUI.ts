// Owns: the "Place on wall" toggle and the "Place in front of me" button (UIKit BackPlate + Buttons), and the short refuse cue ("Walls only") shown where the case cannot go.
// Talks to: CaseLightPlacement, which subscribes to onTogglePlacing / onPlaceInFront and calls setPlacingState() / showCue() / hideCue().
// Must not: move the case, run hit tests, or decide whether placing is on (CaseLightPlacement owns that; the toggle only mirrors it).

/**
 * A small panel on the case's upper right, past the right edge of the start view, so at open it is
 * outside the display and cannot overlap the Start row, the hint, the caption or the top letter.
 * It rides with the case (child of CaseRoot), so it is always beside the case wherever it is put.
 * One pinch, one button: a button acts on a release only if the pinch started on it.
 * SceneObject names (stable, for tests): PlacementControls (this object), PlaceOnWallButton,
 * PlaceInFrontButton, PlacementCue (created when a cue is needed; placed in world space where the
 * case cannot go, so it stays inside the case group and ahead of the view cue in the hierarchy).
 */

import Event, { PublicApi } from "SpectaclesInteractionKit.lspkg/Utils/Event"
import { BackPlate } from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import { Button } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import { FlexItem } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import { FlexLayout } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import { FlexAlign, FlexDirection, FlexJustify } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"

// Button labels: the one button type size and look in CaseLightButtonText.
import { buttonLabel } from "./CaseLightButtonText"

// ── Typography (the placement cue only): same type scale as CaseLightControlsUI ──────────
const FONT_SIZE_SCALE = 1.0
type TextRole = "Headline1" | "Headline2"
const TYPE_SCALE: Record<TextRole, { size: number; weight: number }> = {
  Headline1: { size: 54, weight: 700 },
  Headline2: { size: 48, weight: 700 }
}
function roleSize(role: TextRole, distanceCm: number = 110): number {
  return TYPE_SCALE[role].size * FONT_SIZE_SCALE * (distanceCm / 110)
}
function applyTextRole(t: Text, role: TextRole, distanceCm: number = 110): void {
  t.size = roleSize(role, distanceCm)
  ;(t as Text & { weight?: number }).weight = TYPE_SCALE[role].weight
}

const CONTENT_Z = 0.6
/** Between Place on wall and Place in front of me: their angle boxes (seen obliquely, off to the right) at least 1 deg apart. */
const GAP_CM = 2.0
const PAD_CM = 0.35
const CUE_WIDTH_CM = 12
const CUE_HALF_H_CM = 1

@component
export class CaseLightPlacementUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">CaseLightPlacementUI - Place on wall / Place in front of me</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Label on the toggle that turns wall aiming on (aim at a wall, then pinch)")
  placeOnWallLabel: string = "Place on wall"

  @input
  @hint("Label on the button that puts the case back in front of you")
  placeInFrontLabel: string = "Place in front of me"

  @input
  @widget(new SliderWidget(6, 14, 0.1))
  @hint("Width of each button, in cm")
  buttonWidthCm: number = 9.5

  @input
  @widget(new SliderWidget(2, 5, 0.1))
  @hint("Height of each button, in cm (2.3 keeps the pair 1 deg apart and 1 deg above Veteran mode)")
  buttonHeightCm: number = 2.3

  @input
  @widget(new SliderWidget(30, 110, 1))
  @hint("Typical distance from the eye to these buttons, in cm (scales the label size)")
  viewDistanceCm: number = 60
  @ui.group_end

  private readonly _onTogglePlacing = new Event<void>()
  private readonly _onPlaceInFront = new Event<void>()
  private wallButton: Button | null = null
  private placingOn = false
  private syncing = false
  /** Name of the button the current pinch started on, or "". */
  private armedButton = ""
  private strayReleases = 0
  private cueObj: SceneObject | null = null
  private cueText: Text | null = null

  /** Fired when Place on wall is pressed. CaseLightPlacement decides the new state. */
  get onTogglePlacing(): PublicApi<void> {
    return this._onTogglePlacing.publicApi()
  }

  /** Fired when Place in front of me is pressed. */
  get onPlaceInFront(): PublicApi<void> {
    return this._onPlaceInFront.publicApi()
  }

  /** True while the Place on wall toggle shows its on state. */
  get isPlaceOnWallOn(): boolean {
    return this.wallButton ? this.wallButton.isOn : this.placingOn
  }

  /** True while the refuse cue is on screen. */
  get isCueVisible(): boolean {
    return !!this.cueObj && this.cueObj.enabled
  }

  /** The cue's words (empty until a cue has shown). */
  get cueString(): string {
    return this.cueText ? this.cueText.text : ""
  }

  /** Releases ignored because the pinch did not start on that button. */
  get ignoredStrayReleaseCount(): number {
    return this.strayReleases
  }

  /** Mirror the placing state on the toggle. Never fires onTogglePlacing. */
  setPlacingState(on: boolean): void {
    this.placingOn = on
    this.applyPlacingState()
  }

  /** Show a short cue at a world point, upright and turned by `rotation`, sized for `distanceCm`. */
  showCue(text: string, worldPos: vec3, rotation: quat, distanceCm: number, color: vec4): void {
    if (!this.cueObj) {
      this.cueObj = global.scene.createSceneObject("PlacementCue")
      this.cueObj.setParent(this.sceneObject)
      const t = this.cueObj.createComponent("Component.Text") as Text
      t.depthTest = true
      t.horizontalAlignment = HorizontalAlignment.Center
      t.verticalAlignment = VerticalAlignment.Center
      t.horizontalOverflow = HorizontalOverflow.Overflow
      t.verticalOverflow = VerticalOverflow.Overflow
      t.layoutRect = Rect.create(-CUE_WIDTH_CM / 2, CUE_WIDTH_CM / 2, -CUE_HALF_H_CM, CUE_HALF_H_CM)
      this.cueText = t
    }
    const t = this.cueText!
    t.text = text
    t.textFill.color = color
    applyTextRole(t, "Headline1", Math.max(this.viewDistanceCm, distanceCm))
    const tr = this.cueObj.getTransform()
    tr.setWorldPosition(worldPos)
    tr.setWorldRotation(rotation)
    this.cueObj.enabled = true
  }

  hideCue(): void {
    if (this.cueObj) this.cueObj.enabled = false
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
    flex.direction = FlexDirection.Column
    flex.justifyContent = FlexJustify.Center
    flex.alignItems = FlexAlign.Center
    flex.rowGap = GAP_CM
    flex.paddingTop = PAD_CM
    flex.paddingBottom = PAD_CM
    flex.paddingLeft = PAD_CM
    flex.paddingRight = PAD_CM
    const wall = this.addWallToggle(content)
    const front = this.addButton(content, "PlaceInFrontButton", this.placeInFrontLabel, () => this._onPlaceInFront.invoke())
    flex.addItems([wall, front])
    flex.onLayoutComplete.add((r) => {
      plate.size = new vec2(r.containerWidth, r.containerHeight)
    })
  }

  /** Place on wall: a toggle that mirrors CaseLightPlacement's state (off by default). */
  private addWallToggle(parent: SceneObject): FlexItem {
    const name = "PlaceOnWallButton"
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const size = new vec3(this.buttonWidthCm, this.buttonHeightCm, 1)
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.setIsToggleable(true)
    btn.size = size
    btn.onInitialized.add(() => {
      btn.size = size
      this.applyPlacingState()
    })
    btn.onTriggerDown.add(() => {
      this.armedButton = name
    })
    // onValueChange fires after the button flipped itself; a write from setPlacingState is
    // skipped, and a flip from a pinch that did not start here is put back.
    btn.onValueChange.add(() => {
      if (this.syncing) return
      if (this.armedButton !== name) {
        this.strayReleases++
        this.applyPlacingState()
        return
      }
      this.armedButton = ""
      // Show the decided state, not the self-flip: CaseLightPlacement answers with setPlacingState.
      this.applyPlacingState()
      this._onTogglePlacing.invoke()
    })
    this.wallButton = btn
    this.addButtonLabel(so, this.placeOnWallLabel, this.buttonWidthCm - 0.5, this.buttonHeightCm - 0.6)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = this.buttonWidthCm
    item.overrideHeight = this.buttonHeightCm
    return item
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
    buttonLabel(parent, text, widthCm, heightCm)
  }

  /** Push the mirrored state into the toggle (safe before the button initializes). */
  private applyPlacingState(): void {
    const btn = this.wallButton
    if (btn && btn.isOn !== this.placingOn) {
      this.syncing = true
      btn.isOn = this.placingOn
      this.syncing = false
    }
  }
}
