// Owns: the bundle tray and the sample letters (Piece_<i>): SIK grab/move, stacking, snap-in, return to hand.
// Talks to: CaseLightMain (build, layout, setActivePiece, placeIn, snapThenReturn; onGrab/onDragMove/onRelease), CaseLightPieceCardUI.
// Must not: decide right or wrong, count anything, or light slots (CaseLightMain owns that).

/**
 * Each letter has SIK Interactable + InteractableManipulation (rotation and scale locked) and a
 * collider; only the top letter of the bundle can be grabbed. The held letter turns to face the
 * user. A letter's SceneObject name is fixed by its index in the sample bundle (Piece_<index>),
 * not by its position in the current pass order, so tests can address a piece directly.
 * The tray sits just above the upper playable row, centred and about 43 cm from the eye, so the
 * whole top letter is inside the glasses' view at the start position and within reach of either
 * hand, with a short throw down to the case. The letter is a scaled sample envelope (13.2 x 5.4 cm,
 * about 55% of a #10) so it fits the 23.6 degree display at that reach.
 *
 * Looks: a letter in the tray is a light outline; aimed at, the outline turns white; in hand it
 * is a plain white card with dark print. Nothing on a letter is cyan: cyan is kept for the one
 * target cell.
 */

import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import { InteractableManipulation } from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import animate, { CancelFunction } from "SpectaclesInteractionKit.lspkg/Utils/animate"
import Event, { PublicApi } from "SpectaclesInteractionKit.lspkg/Utils/Event"
import { addMeshObject, MeshAccumulator, RGBA } from "./CaseLightMeshUtil"
import { CaseLightPieceCardUI } from "./CaseLightPieceCardUI"
import { SamplePiece } from "./CaseLightRoute"

export interface PieceMoveArgs {
  piece: number
  worldPosition: vec3
}

/**
 * Scaled sample envelope (aspect 2.4, like a #10): small enough that the whole top letter fits the
 * glasses' display within arm's reach, with every sample address on one line inside the print area.
 */
export const LETTER_W = 13.2
export const LETTER_H = 5.4
const LETTER_T = 0.3
/** Print area: the letter minus a 0.6 cm margin each side. */
export const PRINT_W = LETTER_W - 1.2
const TRAY_W = LETTER_W + 0.6
/** Shallow, low tray: a base under the stack, so it never covers the caption below it. */
const TRAY_D = 5
const TRAY_H = 0.6
const TOP_SPOT_Z = TRAY_D / 2 - 0.8
const MISS_HOLD_SECONDS = 0.45
const RETURN_SECONDS = 0.35

interface PieceState {
  obj: SceneObject
  interactable: Interactable
  manipulation: InteractableManipulation
  collider: ColliderComponent
  visual: RenderMeshVisual
  card: CaseLightPieceCardUI
  placed: boolean
  busy: boolean
  cancel: CancelFunction | null
  /** World point where the last pinch on this letter landed (from SIK's hit), or null. */
  pinch: vec3 | null
}

@component
export class CaseLightBundle extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">CaseLightBundle - bundle tray and sample letters</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(0.6, 2, 0.05))
  @hint("Height of the capital letters in the held letter's address, in cm (one size for every letter; 1.25 keeps the longest sample address inside the print area)")
  addressCapHeightCm: number = 1.25

  @input("vec4", "{0.82,0.84,0.9,1}")
  @widget(new ColorWidget())
  @hint("Outline colour of a letter")
  letterOutlineColor: vec4

  @input("vec4", "{1,1,1,1}")
  @widget(new ColorWidget())
  @hint("Outline colour of the top letter while it is aimed at (keep it neutral: cyan is reserved for the target cell)")
  hoverOutlineColor: vec4

  @input("vec4", "{0.94,0.94,0.92,1}")
  @widget(new ColorWidget())
  @hint("Colour of the letter in hand: a plain white card (its address prints dark on it)")
  heldCardColor: vec4

  @input("vec4", "{0.16,0.17,0.2,1}")
  @widget(new ColorWidget())
  @hint("Fill colour of a letter (dark reads as see-through on the additive display)")
  letterFillColor: vec4
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Debug</span>')
  @ui.group_start("Debug")
  @input
  @hint("Draw the letters' colliders as wireframes (takes effect on preview restart)")
  debugColliders: boolean = false
  @ui.group_end

  private pieces: PieceState[] = []
  private normalMesh: RenderMesh | null = null
  private hoverMesh: RenderMesh | null = null
  private heldMesh: RenderMesh | null = null
  private heldIndex = -1
  private activeIndex = -1
  private stackOrder: number[] = []

  private readonly _onGrab = new Event<number>()
  private readonly _onDragMove = new Event<PieceMoveArgs>()
  private readonly _onRelease = new Event<PieceMoveArgs>()

  /** A piece was pinched (grab started). Payload: piece index. */
  get onGrab(): PublicApi<number> {
    return this._onGrab.publicApi()
  }

  /** Fires every frame while a piece is held. */
  get onDragMove(): PublicApi<PieceMoveArgs> {
    return this._onDragMove.publicApi()
  }

  /** A held piece was let go. */
  get onRelease(): PublicApi<PieceMoveArgs> {
    return this._onRelease.publicApi()
  }

  get pieceCount(): number {
    return this.pieces.length
  }

  /** Letter size and print width (cm), for tests that check the address fits. */
  get letterWidthCm(): number {
    return LETTER_W
  }

  get letterHeightCm(): number {
    return LETTER_H
  }

  get printWidthCm(): number {
    return PRINT_W
  }

  /** Index of the piece currently in hand, or -1. */
  get heldPieceIndex(): number {
    return this.heldIndex
  }

  /** Index of the only piece that can be grabbed right now, or -1. */
  get activePieceIndex(): number {
    return this.activeIndex
  }

  onAwake(): void {
    this.createEvent("LateUpdateEvent").bind(() => this.lateUpdate())
  }

  build(pieces: SamplePiece[], material: Material): void {
    if (this.pieces.length > 0) return
    const outline = this.rgba(this.letterOutlineColor)
    const hover = this.rgba(this.hoverOutlineColor)
    const fill = this.rgba(this.letterFillColor)
    this.normalMesh = this.letterMesh(fill, outline)
    this.hoverMesh = this.letterMesh(fill, hover)
    const card = this.rgba(this.heldCardColor)
    this.heldMesh = this.letterMesh(card, card)
    this.buildTray(material, outline)

    for (let i = 0; i < pieces.length; i++) {
      this.pieces.push(this.buildPiece(i, pieces[i], material))
    }
  }

  /** Put every piece back in the tray, stacked in the given order (order[0] on top). */
  layout(order: number[]): void {
    this.stackOrder = order.slice()
    this.heldIndex = -1
    for (const p of this.pieces) {
      if (p.cancel) p.cancel()
      p.cancel = null
      p.placed = false
      p.busy = false
      this.showHeld(p, false)
    }
    this.restack()
    this.setActivePiece(-1)
  }

  /** Only this piece can be grabbed (or none, with -1). */
  setActivePiece(index: number): void {
    this.activeIndex = index
    for (let i = 0; i < this.pieces.length; i++) {
      const p = this.pieces[i]
      const on = i === index && !p.placed && !p.busy
      p.interactable.enabled = on
      p.collider.enabled = on
      if (!on && !p.card.isHeldShown) p.visual.mesh = this.normalMesh
    }
  }

  /** In hand: plain white card with the address shown. Out of hand: the tray look. */
  private showHeld(p: PieceState, held: boolean): void {
    p.card.setHeld(held)
    p.visual.mesh = held ? this.heldMesh : this.normalMesh
  }

  /** True while a piece shows its in-hand look (white card). */
  isCardLookHeld(index: number): boolean {
    const p = this.pieces[index]
    return !!p && p.visual.mesh === this.heldMesh
  }

  /** Show or hide the large address and hold note on a piece. */
  setCardHeld(index: number, held: boolean): void {
    const p = this.pieces[index]
    if (p) this.showHeld(p, held)
  }

  isNoteVisible(index: number): boolean {
    const p = this.pieces[index]
    return !!p && p.card.isNoteVisible
  }

  isGlossVisible(index: number): boolean {
    const p = this.pieces[index]
    return !!p && p.card.isGlossVisible
  }

  isAddressVisible(index: number): boolean {
    const p = this.pieces[index]
    return !!p && p.card.isHeldShown
  }

  /**
   * Where the latest pinch on a letter landed (SIK hit point), or the letter's centre when the
   * input reported no hit point. Consumes the stored point.
   */
  takePinchPoint(index: number): vec3 {
    const p = this.pieces[index]
    if (!p) return vec3.zero()
    const point = p.pinch ? p.pinch : p.obj.getTransform().getWorldPosition()
    p.pinch = null
    return point
  }

  /** Rendered address bounds on a piece's card, in cm (meaningful while the address is shown). */
  addressBounds(index: number): Rect | null {
    const p = this.pieces[index]
    return p ? p.card.addressBounds() : null
  }

  pieceObject(index: number): SceneObject | null {
    const p = this.pieces[index]
    return p ? p.obj : null
  }

  pieceWorldPosition(index: number): vec3 {
    const p = this.pieces[index]
    return p ? p.obj.getTransform().getWorldPosition() : vec3.zero()
  }

  isPlaced(index: number): boolean {
    const p = this.pieces[index]
    return !!p && p.placed
  }

  /** World position of the top of the bundle (where a piece in hand returns to). */
  topSpotWorld(): vec3 {
    return this.getTransform().getWorldTransform().multiplyPoint(new vec3(0, LETTER_H / 2 + 0.6, TOP_SPOT_Z))
  }

  /** Leave a piece standing in a separation, edge on, sticking out a little toward the user. */
  placeIn(index: number, worldPosition: vec3, worldRotation: quat): void {
    const p = this.pieces[index]
    if (!p) return
    if (p.cancel) p.cancel()
    p.cancel = null
    p.placed = true
    p.busy = false
    this.showHeld(p, false)
    p.obj.getTransform().setWorldPosition(worldPosition)
    p.obj.getTransform().setWorldRotation(worldRotation)
    if (this.activeIndex === index) this.setActivePiece(-1)
  }

  /** Snap into the dropped separation briefly, then fly back to the hand. */
  snapThenReturn(index: number, worldPosition: vec3, worldRotation: quat, onReturned: () => void): void {
    const p = this.pieces[index]
    if (!p) return
    if (p.cancel) p.cancel()
    p.busy = true
    this.showHeld(p, false)
    p.obj.getTransform().setWorldPosition(worldPosition)
    p.obj.getTransform().setWorldRotation(worldRotation)
    this.setActivePiece(this.activeIndex)
    p.cancel = animate({
      duration: MISS_HOLD_SECONDS,
      update: () => {},
      ended: () => this.flyToHand(index, onReturned)
    })
  }

  /** Fly back to the top of the bundle (no snap first). */
  returnToHand(index: number, onReturned: () => void): void {
    const p = this.pieces[index]
    if (!p) return
    if (p.cancel) p.cancel()
    p.busy = true
    this.showHeld(p, false)
    this.setActivePiece(this.activeIndex)
    this.flyToHand(index, onReturned)
  }

  private flyToHand(index: number, onReturned: () => void): void {
    const p = this.pieces[index]
    const t = p.obj.getTransform()
    const fromPos = t.getWorldPosition()
    const fromRot = t.getWorldRotation()
    const toPos = this.topSpotWorld()
    const toRot = this.faceCameraRotation(toPos)
    p.cancel = animate({
      duration: RETURN_SECONDS,
      easing: "ease-out-cubic",
      update: (k: number) => {
        t.setWorldPosition(vec3.lerp(fromPos, toPos, k))
        t.setWorldRotation(quat.slerp(fromRot, toRot, k))
      },
      ended: () => {
        p.cancel = null
        p.busy = false
        this.setActivePiece(this.activeIndex)
        onReturned()
      }
    })
  }

  private restack(): void {
    const n = this.stackOrder.length
    const step = n > 1 ? Math.min(1.3, (TRAY_D - 2.5) / (n - 1)) : 0
    const trayT = this.getTransform().getWorldTransform()
    for (let k = 0; k < n; k++) {
      const p = this.pieces[this.stackOrder[k]]
      if (!p) continue
      const pos = trayT.multiplyPoint(new vec3(0, LETTER_H / 2 + 0.6, TOP_SPOT_Z - k * step))
      p.obj.getTransform().setWorldPosition(pos)
      p.obj.getTransform().setWorldRotation(this.faceCameraRotation(pos))
    }
  }

  private lateUpdate(): void {
    if (this.heldIndex < 0) return
    const p = this.pieces[this.heldIndex]
    if (!p) return
    const t = p.obj.getTransform()
    const pos = t.getWorldPosition()
    t.setWorldRotation(this.faceCameraRotation(pos))
    this._onDragMove.invoke({ piece: this.heldIndex, worldPosition: pos })
  }

  private faceCameraRotation(pos: vec3): quat {
    const cam = WorldCameraFinderProvider.getInstance().getWorldPosition()
    const toCam = cam.sub(pos)
    if (toCam.length < 1e-3) return quat.quatIdentity()
    return quat.lookAt(toCam.normalize(), vec3.up())
  }

  private buildPiece(index: number, data: SamplePiece, material: Material): PieceState {
    const obj = global.scene.createSceneObject(`Piece_${index}`)
    obj.setParent(this.sceneObject)

    const visual = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
    visual.mesh = this.normalMesh
    if (material) visual.mainMaterial = material

    const collider = obj.createComponent("Physics.ColliderComponent") as ColliderComponent
    const shape = Shape.createBoxShape()
    shape.size = new vec3(LETTER_W, LETTER_H, 2)
    collider.shape = shape
    collider.fitVisual = false
    collider.debugDrawEnabled = this.debugColliders

    const interactable = obj.createComponent(Interactable.getTypeName()) as Interactable
    const manipulation = obj.createComponent(InteractableManipulation.getTypeName()) as InteractableManipulation
    manipulation.setCanRotate(false)
    manipulation.setCanScale(false)

    const cardObj = global.scene.createSceneObject("PieceCard")
    cardObj.setParent(obj)
    cardObj.getTransform().setLocalPosition(new vec3(0, 0, LETTER_T / 2 + 0.25))
    const card = cardObj.createComponent(CaseLightPieceCardUI.getTypeName()) as CaseLightPieceCardUI
    card.configure(data.address, data.note, this.addressCapHeightCm, PRINT_W, data.gloss, LETTER_H)

    const state: PieceState = { obj, interactable, manipulation, collider, visual, card, placed: false, busy: false, cancel: null, pinch: null }

    interactable.onTriggerStart.add((e) => {
      const hit = e.interactor ? e.interactor.targetHitInfo : null
      state.pinch = hit && hit.hit ? hit.hit.position : null
    })
    interactable.onHoverEnter.add(() => {
      if (this.activeIndex === index && !card.isHeldShown) visual.mesh = this.hoverMesh
    })
    interactable.onHoverExit.add(() => {
      if (!card.isHeldShown) visual.mesh = this.normalMesh
    })
    manipulation.onManipulationStart.add(() => {
      if (this.activeIndex !== index || state.placed || state.busy) return
      this.heldIndex = index
      this._onGrab.invoke(index)
    })
    manipulation.onManipulationEnd.add(() => {
      if (this.heldIndex !== index) return
      this.heldIndex = -1
      if (!card.isHeldShown) visual.mesh = this.normalMesh
      this._onRelease.invoke({ piece: index, worldPosition: obj.getTransform().getWorldPosition() })
    })
    return state
  }

  private letterMesh(fill: RGBA, outline: RGBA): RenderMesh {
    const m = new MeshAccumulator()
    m.addBox(0, 0, 0, LETTER_W / 2, LETTER_H / 2, LETTER_T / 2, fill)
    m.rectOutline(-LETTER_W / 2, -LETTER_H / 2, LETTER_W / 2, LETTER_H / 2, 0, 0.22, outline)
    return m.finish()
  }

  private buildTray(material: Material, color: RGBA): void {
    const m = new MeshAccumulator()
    const t = 0.14
    const hw = TRAY_W / 2
    const hd = TRAY_D / 2
    for (const y of [0, TRAY_H]) {
      m.lineX(-hw, hw, y, hd, t, color)
      m.lineX(-hw, hw, y, -hd, t, color)
      m.lineZ(-hw, y, -hd, hd, t, color)
      m.lineZ(hw, y, -hd, hd, t, color)
    }
    for (const x of [-hw, hw]) {
      for (const z of [-hd, hd]) m.lineY(x, 0, TRAY_H, z, t, color)
    }
    addMeshObject(this.sceneObject, "TrayLines", m.finish(), material)
  }

  private rgba(c: vec4): RGBA {
    return [c.x, c.y, c.z, c.w]
  }
}
