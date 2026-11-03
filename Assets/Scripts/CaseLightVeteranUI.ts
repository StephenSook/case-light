// Owns: the Veteran mode toggle (UIKit BackPlate + Button), the reminder chooser shown beside a pinched slot (UIKit BackPlate + Buttons), and the pinned reminder cards printed at their slots.
// Talks to: CaseLightVeteran, which subscribes to onToggleVeteran / onPick and calls setVeteranState(), showChooser(), hideChooser(), showNotes(); CaseLightBackingUI (card plates).
// Must not: store notes, decide which notes show, or pick a slot (CaseLightVeteran owns that; the toggle only mirrors its state).

/**
 * The toggle panel sits under Place on wall / Place in front of me, past the right edge of the
 * start view, so at open it is outside the display. The chooser offers exactly the labels it is
 * given (three fixed reminders, plus Remove note when the slot has one), stacked in one column
 * beside the slot so the slot stays visible. Cards are printed inside the slot's opening, above
 * its label strip, in front of any letter standing in it.
 * One pinch, one button: a button acts on a release only if the pinch started on it.
 * SceneObject names (stable, for tests): VeteranControls (this object), VeteranModeButton,
 * NoteChooser, NoteOption_0..NoteOption_3, PinnedNotes, Note_<slot>, Note_<slot>_Text.
 */

import Event, { PublicApi } from "SpectaclesInteractionKit.lspkg/Utils/Event"
import { BackPlate } from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import { Button } from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import { FlexItem } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import { FlexLayout } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import { FlexAlign, FlexDirection, FlexJustify } from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import { addBacking } from "./CaseLightBackingUI"

// ── Typography: same type scale as CaseLightControlsUI ──────────────────────────────────
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
const BUTTON_LABEL_Z = 0.08
const GAP_CM = 0.4
const PAD_CM = 0.35
/** Most chooser rows: three reminders and Remove note. */
const MAX_OPTIONS = 4
/** Card text: capitals at least as tall as the cell labels (0.74 cm). */
const EM_PER_CM = 43.886
const CAP_PER_EM = 0.7
const NOTE_CAP_CM = 0.8
/** Card plates and text draw after the case, the letters and the marks. */
const NOTE_RENDER_ORDER = 50

export interface NoteCard {
  slot: number
  text: string
  /** Card centre in CaseRoot-local cm. */
  local: vec3
}

@component
export class CaseLightVeteranUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">CaseLightVeteranUI - Veteran mode, reminder chooser, pinned reminders</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @hint("Label on the toggle that lets a veteran pin sorting reminders on slots (pinch a slot)")
  veteranLabel: string = "Veteran mode"

  @input
  @widget(new SliderWidget(6, 14, 0.1))
  @hint("Width of the toggle, in cm")
  toggleWidthCm: number = 9.5

  @input
  @widget(new SliderWidget(8, 16, 0.1))
  @hint("Width of each chooser button, in cm (the longest reminder must fit)")
  chooserButtonWidthCm: number = 11

  @input
  @widget(new SliderWidget(2, 5, 0.1))
  @hint("Height of the toggle and chooser buttons, in cm")
  buttonHeightCm: number = 2.4

  @input
  @widget(new SliderWidget(30, 110, 1))
  @hint("Typical distance from the eye to these buttons, in cm (scales the label size)")
  viewDistanceCm: number = 60

  @input
  @widget(new SliderWidget(6, 14, 0.1))
  @hint("Width of a pinned reminder card, in cm (the text wraps to two lines inside it)")
  noteWidthCm: number = 9.6

  @input("vec4", "{1,0.86,0.55,1}")
  @widget(new ColorWidget())
  @hint("Colour of a pinned reminder's text (warm, distinct from the cyan target and the pink mix-up marks)")
  noteTextColor: vec4

  @input("vec4", "{0.3,0.22,0.1,0.75}")
  @widget(new ColorWidget())
  @hint("Plate behind a pinned reminder (dim, so a letter edge behind it does not shine through the words)")
  notePlateColor: vec4
  @ui.group_end

  private readonly _onToggleVeteran = new Event<void>()
  private readonly _onPick = new Event<string>()
  private toggleButton: Button | null = null
  private veteranOn = false
  private syncing = false
  /** Name of the button the current pinch started on, or "". */
  private armedButton = ""
  private strayReleases = 0

  private chooser: SceneObject | null = null
  private chooserFlex: FlexLayout | null = null
  private optionObjs: SceneObject[] = []
  private optionItems: FlexItem[] = []
  private optionTexts: Text[] = []
  private optionLabels: string[] = []
  private itemsInLayout = 0
  private wantChooser = false
  private settled = false

  private notesRoot: SceneObject | null = null
  private cards = new Map<number, { root: SceneObject; text: Text }>()

  /** Fired when Veteran mode is pressed. CaseLightVeteran decides the new state. */
  get onToggleVeteran(): PublicApi<void> {
    return this._onToggleVeteran.publicApi()
  }

  /** Fired with the label of the chooser button pressed. */
  get onPick(): PublicApi<string> {
    return this._onPick.publicApi()
  }

  /** True while the Veteran mode toggle shows its on state. */
  get isVeteranToggleOn(): boolean {
    return this.toggleButton ? this.toggleButton.isOn : this.veteranOn
  }

  get isChooserVisible(): boolean {
    return this.settled ? !!this.chooser && this.chooser.enabled : this.wantChooser
  }

  /** The chooser's visible option labels, top to bottom (empty while it is hidden). */
  get chooserOptionLabels(): string[] {
    return this.isChooserVisible ? this.optionLabels.slice() : []
  }

  /** True while the card for this slot is on screen. */
  isCardShown(slot: number): boolean {
    const c = this.cards.get(slot)
    return !!c && c.root.enabled
  }

  /** The text on this slot's card (shown or not), or "". */
  cardText(slot: number): string {
    const c = this.cards.get(slot)
    return c ? c.text.text : ""
  }

  /** World position of this slot's card (zero if none). */
  cardWorldPosition(slot: number): vec3 {
    const c = this.cards.get(slot)
    return c ? c.root.getTransform().getWorldPosition() : vec3.zero()
  }

  /** Releases ignored because the pinch did not start on that button. */
  get ignoredStrayReleaseCount(): number {
    return this.strayReleases
  }

  /** Mirror Veteran mode on the toggle. Never fires onToggleVeteran. */
  setVeteranState(on: boolean): void {
    this.veteranOn = on
    this.applyToggleState()
  }

  /**
   * Show the chooser with these labels (at most four), centred at a CaseRoot-local point and
   * turned by a CaseRoot-local rotation.
   */
  showChooser(labels: string[], local: vec3, rotation: quat): void {
    if (!this.chooser || !this.chooserFlex) return
    const n = Math.min(MAX_OPTIONS, labels.length)
    this.optionLabels = labels.slice(0, n)
    for (let i = 0; i < MAX_OPTIONS; i++) {
      if (i < n) this.optionTexts[i].text = this.optionLabels[i]
      this.optionObjs[i].enabled = i < n
    }
    // Rows in the layout follow the number of options (Remove note comes and goes).
    if (n > this.itemsInLayout) this.chooserFlex.addItems(this.optionItems.slice(this.itemsInLayout, n))
    else if (n < this.itemsInLayout) this.chooserFlex.removeItems(this.optionItems.slice(n, this.itemsInLayout))
    this.itemsInLayout = n
    const t = this.chooser.getTransform()
    t.setLocalPosition(local)
    t.setLocalRotation(rotation)
    this.wantChooser = true
    if (this.settled) this.chooser.enabled = true
  }

  hideChooser(): void {
    this.wantChooser = false
    if (this.settled && this.chooser) this.chooser.enabled = false
  }

  /** Show exactly these cards (creating any that are missing); every other card is hidden. */
  showNotes(cards: NoteCard[]): void {
    const want = new Set<number>()
    for (const c of cards) {
      want.add(c.slot)
      const card = this.ensureCard(c.slot)
      card.text.text = c.text
      card.root.getTransform().setLocalPosition(c.local)
      card.root.enabled = true
    }
    this.cards.forEach((card, slot) => {
      if (!want.has(slot)) card.root.enabled = false
    })
  }

  onAwake(): void {
    // The toggle panel.
    this.sceneObject.createComponent("Component.Canvas")
    const plate = this.sceneObject.createComponent(BackPlate.getTypeName()) as BackPlate
    const content = global.scene.createSceneObject("Content")
    content.setParent(this.sceneObject)
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))
    const flex = this.column(content)
    flex.addItems([this.addToggle(content)])
    flex.onLayoutComplete.add((r) => {
      plate.size = new vec2(r.containerWidth, r.containerHeight)
    })

    // The chooser and the cards live on the case itself (CaseRoot-local), not on this panel.
    const caseRoot = this.sceneObject.getParent() ? this.sceneObject.getParent()! : this.sceneObject
    this.buildChooser(caseRoot)
    this.notesRoot = global.scene.createSceneObject("PinnedNotes")
    this.notesRoot.setParent(caseRoot)

    // Settle the chooser's visibility once every OnStart (UIKit init) has run.
    const late = this.createEvent("LateUpdateEvent")
    late.bind(() => {
      this.settled = true
      if (this.chooser) this.chooser.enabled = this.wantChooser
      late.enabled = false
    })
  }

  private column(content: SceneObject): FlexLayout {
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
    return flex
  }

  /** Veteran mode: a toggle that mirrors CaseLightVeteran's state (off by default). */
  private addToggle(parent: SceneObject): FlexItem {
    const name = "VeteranModeButton"
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    const size = new vec3(this.toggleWidthCm, this.buttonHeightCm, 1)
    const btn = so.createComponent(Button.getTypeName()) as Button
    btn.setIsToggleable(true)
    btn.size = size
    btn.onInitialized.add(() => {
      btn.size = size
      this.applyToggleState()
    })
    btn.onTriggerDown.add(() => {
      this.armedButton = name
    })
    // onValueChange fires after the button flipped itself; a write from setVeteranState is
    // skipped, and a flip from a pinch that did not start here is put back.
    btn.onValueChange.add(() => {
      if (this.syncing) return
      if (this.armedButton !== name) {
        this.strayReleases++
        this.applyToggleState()
        return
      }
      this.armedButton = ""
      this.applyToggleState()
      this._onToggleVeteran.invoke()
    })
    this.toggleButton = btn
    this.addButtonLabel(so, this.veteranLabel, this.toggleWidthCm - 0.5, this.buttonHeightCm - 0.6)
    const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
    item.overrideWidth = this.toggleWidthCm
    item.overrideHeight = this.buttonHeightCm
    return item
  }

  /** One column of up to four buttons; its labels are set each time it is shown. */
  private buildChooser(parent: SceneObject): void {
    const root = global.scene.createSceneObject("NoteChooser")
    root.setParent(parent)
    root.createComponent("Component.Canvas")
    const plate = root.createComponent(BackPlate.getTypeName()) as BackPlate
    // Darker plate: the chooser floats over the case, so its lines must not read through the words.
    plate.style = "dark"
    const content = global.scene.createSceneObject("Content")
    content.setParent(root)
    content.getTransform().setLocalPosition(new vec3(0, 0, CONTENT_Z))
    const flex = this.column(content)
    for (let i = 0; i < MAX_OPTIONS; i++) {
      const name = `NoteOption_${i}`
      const so = global.scene.createSceneObject(name)
      so.setParent(content)
      const size = new vec3(this.chooserButtonWidthCm, this.buttonHeightCm, 1)
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
        if (i < this.optionLabels.length) this._onPick.invoke(this.optionLabels[i])
      })
      this.optionTexts.push(this.addButtonLabel(so, "", this.chooserButtonWidthCm - 0.5, this.buttonHeightCm - 0.6))
      const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
      item.overrideWidth = this.chooserButtonWidthCm
      item.overrideHeight = this.buttonHeightCm
      this.optionObjs.push(so)
      this.optionItems.push(item)
    }
    flex.addItems(this.optionItems)
    this.itemsInLayout = MAX_OPTIONS
    flex.onLayoutComplete.add((r) => {
      plate.size = new vec2(r.containerWidth, r.containerHeight)
    })
    this.chooser = root
    this.chooserFlex = flex
  }

  private addButtonLabel(parent: SceneObject, text: string, widthCm: number, heightCm: number): Text {
    const so = global.scene.createSceneObject("ButtonLabel")
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(0, 0, BUTTON_LABEL_Z))
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    applyTextRole(t, "Headline2", this.viewDistanceCm)
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Shrink
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -heightCm / 2, heightCm / 2)
    t.textFill.color = new vec4(1, 1, 1, 1)
    return t
  }

  /** A card: a dim plate and two lines of warm text, at most noteWidthCm wide. */
  private ensureCard(slot: number): { root: SceneObject; text: Text } {
    const have = this.cards.get(slot)
    if (have) return have
    const w = this.noteWidthCm
    const h = noteHeightCm()
    const root = global.scene.createSceneObject(`Note_${slot}`)
    root.setParent(this.notesRoot ? this.notesRoot : this.sceneObject)
    const plate = addBacking(root, `Note_${slot}_Plate`, w, h, this.notePlateColor, new vec3(0, 0, -0.05), 0.35)
    plate.renderMeshVisual.setRenderOrder(NOTE_RENDER_ORDER)
    const textObj = global.scene.createSceneObject(`Note_${slot}_Text`)
    textObj.setParent(root)
    const t = textObj.createComponent("Component.Text") as Text
    t.depthTest = true
    t.size = (NOTE_CAP_CM / CAP_PER_EM) * EM_PER_CM
    ;(t as Text & { weight?: number }).weight = 700
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Wrap
    t.verticalOverflow = VerticalOverflow.Shrink
    t.layoutRect = Rect.create(-(w - 0.4) / 2, (w - 0.4) / 2, -(h - 0.3) / 2, (h - 0.3) / 2)
    t.textFill.color = this.noteTextColor
    t.setRenderOrder(NOTE_RENDER_ORDER + 1)
    const card = { root, text: t }
    this.cards.set(slot, card)
    return card
  }

  /** Push the mirrored state into the toggle (safe before the button initializes). */
  private applyToggleState(): void {
    const btn = this.toggleButton
    if (btn && btn.isOn !== this.veteranOn) {
      this.syncing = true
      btn.isOn = this.veteranOn
      this.syncing = false
    }
  }
}

/** Card height (cm): two lines of NOTE_CAP_CM capitals plus margins. */
export function noteHeightCm(): number {
  return 2 * (NOTE_CAP_CM / CAP_PER_EM) * 1.25 + 0.5
}
