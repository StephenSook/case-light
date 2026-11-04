// Owns: today's route choice, "Route 1 | Route 2" (UIKit BackPlate + two toggle Buttons), shown as one selected route, and greyed out while a pass runs.
// Talks to: CaseLightMain, which subscribes to onPickRoute and calls setRoute() / setEnabled().
// Must not: switch the route itself, touch the case or the bundle, or hold any session state (CaseLightMain decides; this only mirrors).

/**
 * A narrow panel in the start view, in the Start row's own plane just right of Drill pace: two
 * buttons stacked, "Route 1" over "Route 2", its bottom edge level with the row's. It rises beside
 * the Drill pace caption (never under it) and stays inside the display with room to spare; the
 * Start row sits a little left of centre to make room. It rides with the case (child of CaseRoot).
 * One pinch, one button: a button acts on a release only if the pinch started on it; a press
 * while inactive, or a flip that did not start on that button, is put back.
 * SceneObject names (stable, for tests): RoutePicker (this object), RouteButton_1, RouteButton_2.
 */

import Event, { PublicApi } from "SpectaclesInteractionKit.lspkg/Utils/Event"
import { BackPlate } from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import { Button } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import { FlexItem } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import { FlexLayout } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import { FlexAlign, FlexDirection, FlexJustify } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import { DEFAULT_ROUTE, RouteId, routeLabel, ROUTE_IDS } from "./CaseLightRoute"

import { buttonLabel } from "./CaseLightButtonText"

const CONTENT_Z = 0.6
/** Between the two route buttons: about 1.06 deg at the start position (Snap: targets at least 1 deg apart). */
const GAP_CM = 1.05
const PAD_CM = 0.15

@component
export class CaseLightRouteUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">CaseLightRouteUI - today\'s route: Route 1 | Route 2</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(2, 8, 0.05))
  @hint("Width of each route button, in cm (the panel sits between Drill pace and the display edge)")
  buttonWidthCm: number = 2.0

  @input
  @widget(new SliderWidget(1.2, 5, 0.05))
  @hint("Height of each route button, in cm (the two are stacked, 1 deg apart; 2.0 keeps each over 2 deg tall)")
  buttonHeightCm: number = 2.0

  @input
  @widget(new SliderWidget(0.4, 0.9, 0.01))
  @hint("Kept for the scene; the labels use the one button size in CaseLightButtonText and fit on one line")
  labelCapCm: number = 0.48
  @ui.group_end

  private readonly _onPickRoute = new Event<RouteId>()
  private buttons = new Map<RouteId, Button>()
  private route: RouteId = DEFAULT_ROUTE
  private pickable = true
  private syncing = false
  /** Name of the button the current pinch started on, or "". */
  private armedButton = ""
  private strayReleases = 0

  /** Fired with the route whose button was pressed. CaseLightMain decides whether it switches. */
  get onPickRoute(): PublicApi<RouteId> {
    return this._onPickRoute.publicApi()
  }

  /** The route shown as selected. */
  get shownRoute(): RouteId {
    return this.route
  }

  /** True while the buttons take a press (no pass running). */
  get isEnabled(): boolean {
    return this.pickable
  }

  /** The button labels, left to right. */
  get labels(): string[] {
    return ROUTE_IDS.map((r) => routeLabel(r))
  }

  /** Releases ignored because the pinch did not start on that button (or the picker was inactive). */
  get ignoredStrayReleaseCount(): number {
    return this.strayReleases
  }

  /** Show this route as selected. Never fires onPickRoute. */
  setRoute(route: RouteId): void {
    this.route = route
    this.applyState()
  }

  /** Grey the picker out (false) while a pass runs; true again between passes. */
  setEnabled(on: boolean): void {
    this.pickable = on
    this.buttons.forEach((b) => {
      b.inactive = !on
    })
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
    flex.addItems(ROUTE_IDS.map((r) => this.addRouteButton(content, r)))
    flex.onLayoutComplete.add((r) => {
      plate.size = new vec2(r.containerWidth, r.containerHeight)
    })
  }

  private addRouteButton(parent: SceneObject, route: RouteId): FlexItem {
    const name = `RouteButton_${route}`
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const size = new vec3(this.buttonWidthCm, this.buttonHeightCm, 1)
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.setIsToggleable(true)
    btn.size = size
    btn.onInitialized.add(() => {
      btn.size = size
      btn.inactive = !this.pickable
      this.applyState()
    })
    btn.onTriggerDown.add(() => {
      this.armedButton = name
    })
    // The button flips itself; the mirrored state is put back at once and CaseLightMain answers
    // with setRoute() if the switch is taken.
    btn.onValueChange.add(() => {
      if (this.syncing) return
      const armed = this.armedButton === name
      this.armedButton = ""
      this.applyState()
      if (!armed || !this.pickable) {
        this.strayReleases++
        return
      }
      this._onPickRoute.invoke(route)
    })
    this.buttons.set(route, btn)
    this.addButtonLabel(so, routeLabel(route), this.buttonWidthCm - 0.2, this.buttonHeightCm - 0.3)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = this.buttonWidthCm
    item.overrideHeight = this.buttonHeightCm
    return item
  }

  private addButtonLabel(parent: SceneObject, text: string, widthCm: number, heightCm: number): void {
    // The one button size: "Route 1" fits the narrow button on one line (extra-control-labels measures it).
    buttonLabel(parent, text, widthCm, heightCm)
  }

  /** Exactly one button shows as on: the selected route's (safe before the buttons initialize). */
  private applyState(): void {
    this.syncing = true
    this.buttons.forEach((b, r) => {
      const on = r === this.route
      if (b.isOn !== on) b.isOn = on
    })
    this.syncing = false
  }
}
