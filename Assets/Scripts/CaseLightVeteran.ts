// Owns: Veteran mode (on or off), the slot being edited, and keeping the shown reminder cards in step with the note rule; it keeps the shared slot-pinch target live while Veteran mode is on, reports each note the person changes, and applies notes shared from a Connected Lenses session to the route in use.
// Talks to: CaseLightMain (build, refresh, setMode, setRoute, onModeChanged, read-outs), CaseLightSlotPinch (the shared slot-pinch target), CaseLightVeteranUI (toggle state, chooser, cards), CaseLightNotes (note store and show rule), CaseLightNoteShare (the shared-note rules), CaseLightGeometry (card and chooser positions); CaseLightNoteSync subscribes to onLocalNoteChanged and calls applySharedNote / sharedNotesNow.
// Must not: create text, place or move letters, change any count, or decide when a pass runs (CaseLightMain pauses the letters while Veteran mode is on).

/**
 * Slot pinches and letter drops never share a pinch: while Veteran mode is on, CaseLightMain
 * makes no letter grabbable and the shared slot-pinch target (CaseLightSlotPinch, its arming rule
 * lives there) is the only thing on the case face that takes a pinch; while it is off and no Case
 * check runs, that target's collider is disabled, so a pinch can only reach a letter or a button.
 */

import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import Event, { PublicApi } from "SpectaclesInteractionKit.lspkg/Utils/Event"
import { CaseGeometry, NO_SLOT, SEP_PITCH_CM } from "./CaseLightGeometry"
import { chooserOptions, NoteStore, notesToShow, NoteViewMode, RouteNotes } from "./CaseLightNotes"
import { allSharedNotes, applySharedNote, SharedNote } from "./CaseLightNoteShare"
import { SlotPinchTarget } from "./CaseLightSlotPinch"
import { CaseLightVeteranUI, NoteCard } from "./CaseLightVeteranUI"

/** Cards stand in front of any letter in the slot (letters stick out 3 cm). */
const NOTE_Z_CM = 3.4
/** The chooser floats in front of the case, beside the slot (cm). */
const CHOOSER_Z_CM = 8
const CHOOSER_SIDE_OFFSET_CM = 8
/**
 * The chooser is drawn at its size in cm when it is this far from the eye, and scaled with its
 * distance elsewhere, so it looks the same size at every slot (its buttons about 2.75 deg tall and
 * 1.26 deg apart). Its side offset scales with it, so its near edge keeps clear of the slot.
 */
const CHOOSER_DESIGN_DISTANCE_CM = 50

export interface VeteranViewState {
  mode: NoteViewMode
  litSlot: number
}

@component
export class CaseLightVeteran extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">CaseLightVeteran - pin sorting reminders on slots</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("The case group (the chooser and the cards are placed in its frame)")
  caseRoot: SceneObject

  @input
  @hint("Veteran mode toggle, reminder chooser and pinned cards")
  ui: CaseLightVeteranUI
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Debug</span>')
  @ui.group_start("Debug")
  @input
  @hint("Draw the shared slot-pinch target's collider as a wireframe (CaseLightMain reads this when it makes the target; takes effect on preview restart)")
  debugCollider: boolean = false
  @ui.group_end

  private readonly _onModeChanged = new Event<boolean>()
  private readonly _onLocalNoteChanged = new Event<SharedNote>()
  private readonly routeNotes = new RouteNotes()
  /** The notes of the route in use (Route 1 until CaseLightMain says otherwise). */
  private store: NoteStore = this.routeNotes.storeFor(1)
  private _route = 1
  private geo: CaseGeometry | null = null
  private view: () => VeteranViewState = () => ({ mode: "idle", litSlot: NO_SLOT })
  private showSelection: (slot: number) => void = () => {}
  private pinch: SlotPinchTarget | null = null
  private _on = false
  private _selected = NO_SLOT
  private _slotPinches = 0
  private _shown: number[] = []

  // ── Read-only state ─────────────────────────────────────────────────────────────────────

  /** Fired after Veteran mode changed (true = on). */
  get onModeChanged(): PublicApi<boolean> {
    return this._onModeChanged.publicApi()
  }

  /** Fired after the person changed a note with the chooser: the slot and its reminder ("" = removed). Never fired for an applied shared note. */
  get onLocalNoteChanged(): PublicApi<SharedNote> {
    return this._onLocalNoteChanged.publicApi()
  }

  get isOn(): boolean {
    return this._on
  }

  noteForSlot(slot: number): string | null {
    return this.store.noteFor(slot)
  }

  noteSlots(): number[] {
    return this.store.slots()
  }

  /** True while this slot's card is on screen. */
  isNoteShown(slot: number): boolean {
    return this.ui ? this.ui.isCardShown(slot) : false
  }

  /** Slots whose card is meant to show right now (from the note rule). */
  get shownNoteSlots(): number[] {
    return this._shown.slice()
  }

  /** The slot whose chooser is open, or -1. */
  get selectedSlot(): number {
    return this._selected
  }

  get isChooserOpen(): boolean {
    return this.ui ? this.ui.isChooserVisible : false
  }

  /** The chooser's visible labels, top to bottom (empty while closed). */
  get chooserOptionLabels(): string[] {
    return this.ui ? this.ui.chooserOptionLabels : []
  }

  /** Slot pinches taken (each opened the chooser). */
  get slotPinchCount(): number {
    return this._slotPinches
  }

  /** True while the slot-pinch target can take a pinch. */
  get isSlotTargetLive(): boolean {
    return !!this.pinch && this.pinch.isLive
  }

  // ── Commands ────────────────────────────────────────────────────────────────────────────

  /** Veteran mode on or off (the toggle's path). Off closes the chooser; notes are kept. */
  setMode(on: boolean): void {
    if (!this.geo) return
    if (this._on === on) {
      if (this.ui) this.ui.setVeteranState(on)
      return
    }
    this._on = on
    if (this.pinch) {
      if (on) this.pinch.acquire("veteran")
      else this.pinch.release("veteran")
    }
    if (!on) this.closeChooser()
    if (this.ui) this.ui.setVeteranState(on)
    this.refresh()
    this._onModeChanged.invoke(on)
  }

  /** Use this route's notes (each route keeps its own; switching back restores them). Closes the chooser. */
  setRoute(route: number): void {
    if (route === this._route) return
    this._route = route
    this.store = this.routeNotes.storeFor(route)
    this.closeChooser()
    this.refresh()
  }

  /** Apply a note shared by someone else to the route in use and refresh the cards. Returns whether anything changed. */
  applySharedNote(n: SharedNote): boolean {
    const changed = applySharedNote(this.store, n)
    if (changed) this.refresh()
    return changed
  }

  /** Every note of the route in use, as shared notes (ascending by slot). */
  sharedNotesNow(): SharedNote[] {
    return allSharedNotes(this.store)
  }

  /** The route whose notes are in use. */
  get routeId(): number {
    return this._route
  }

  /** Re-apply the note rule (CaseLightMain calls this whenever the lit slot or the mode changes). */
  refresh(): void {
    if (!this.geo || !this.ui) return
    const v = this.view()
    this._shown = notesToShow(this.store, { mode: v.mode, litSlot: v.litSlot, veteranMode: this._on })
    const cards: NoteCard[] = this._shown.map((slot) => ({ slot, text: this.store.noteFor(slot) as string, local: this.cardLocal(slot) }))
    this.ui.showNotes(cards)
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────────────────

  /**
   * Called once by CaseLightMain. `view` reports the pass mode and the lit slot; `showSelection`
   * outlines the slot being edited (-1 clears it); `pinch` is the shared slot-pinch target.
   */
  build(geo: CaseGeometry, view: () => VeteranViewState, showSelection: (slot: number) => void, pinch: SlotPinchTarget): void {
    if (this.geo || !this.caseRoot) return
    this.geo = geo
    this.view = view
    this.showSelection = showSelection
    this.pinch = pinch
    pinch.onSlotPinched.add((slot) => {
      if (this._on) this.openChooser(slot)
    })
    if (this.ui) {
      this.ui.onToggleVeteran.add(() => this.setMode(!this._on))
      this.ui.onPick.add((label) => this.onPick(label))
      this.ui.setVeteranState(false)
    }
  }

  private openChooser(slot: number): void {
    if (!this.ui || !this.geo) return
    this._slotPinches++
    this._selected = slot
    this.showSelection(slot)
    const c = this.geo.slotCenterLocal(slot)
    // Beside the slot (toward the case's middle), in front of the case, turned to the eye.
    const side = c.x < 0 ? 1 : -1
    const at = (scale: number) => new vec3(c.x + side * (CHOOSER_SIDE_OFFSET_CM * scale + SEP_PITCH_CM / 2), c.y, CHOOSER_Z_CM)
    const scale = this.chooserScale(at(this.chooserScale(at(1))))
    const local = at(scale)
    this.ui.showChooser(chooserOptions(this.store, slot), local, this.faceEyeLocal(local), scale)
  }

  private closeChooser(): void {
    this._selected = NO_SLOT
    this.showSelection(NO_SLOT)
    if (this.ui) this.ui.hideChooser()
  }

  private onPick(label: string): void {
    if (!this._on || this._selected === NO_SLOT) return
    const slot = this._selected
    const changed = this.store.applyPick(slot, label)
    this.closeChooser()
    this.refresh()
    if (changed) {
      const now = this.store.noteFor(slot)
      this._onLocalNoteChanged.invoke({ slot, note: now === null ? "" : now })
    }
  }

  /** Card centre for a slot (CaseRoot-local): inside the opening, above its label strip, on the case. */
  private cardLocal(slot: number): vec3 {
    const geo = this.geo!
    const c = geo.slotCenterLocal(slot)
    const half = this.ui ? this.ui.noteWidthCm / 2 : 4.8
    const x = Math.max(geo.leftX + half, Math.min(-geo.leftX - half, c.x))
    return new vec3(x, geo.openingCenterY(geo.shelfOfSlot(slot)), NOTE_Z_CM)
  }

  /** The chooser's scale at a CaseRoot-local point: its eye distance over the design distance. */
  private chooserScale(local: vec3): number {
    const world = this.caseRoot.getTransform().getWorldTransform().multiplyPoint(local)
    return world.distance(cameraWorldPosition()) / CHOOSER_DESIGN_DISTANCE_CM
  }

  /** A CaseRoot-local rotation that turns a panel at `local` to the eye (yaw and pitch, no roll). */
  private faceEyeLocal(local: vec3): quat {
    const cam = this.caseRoot.getTransform().getInvertedWorldTransform().multiplyPoint(cameraWorldPosition())
    const d = cam.sub(local)
    const yaw = Math.atan2(d.x, d.z)
    const pitch = -Math.atan2(d.y, Math.sqrt(d.x * d.x + d.z * d.z))
    return quat.angleAxis(yaw, vec3.up()).multiply(quat.angleAxis(pitch, vec3.right()))
  }
}

function cameraWorldPosition(): vec3 {
  return WorldCameraFinderProvider.getInstance().getWorldPosition()
}
