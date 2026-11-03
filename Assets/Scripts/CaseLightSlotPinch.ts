// Owns: the one slot-pinch target over the playable rows (SceneObject "SlotPinchTarget": a thin box collider and an Interactable), its arming rule, and which users currently need it live.
// Talks to: CaseLightMain (creates it), CaseLightVeteran (pins reminders) and CaseLightMain's Case check (finds misplaced letters), which acquire / release it and subscribe to onSlotPinched; CaseLightGeometry (the slot under a pinch).
// Must not: decide what a pinch means, change any state of the drill, or be live when no user needs it.

/**
 * A slot pinch counts only if it starts and ends on the target with the same interactor; the slot
 * is the one under the pinch where it started (a playable separation, never the HOLD block). A
 * pinch that leaves the target, ends off it or is cancelled disarms, so a later stray release from
 * the same hand cannot count. The collider is enabled only while at least one user has acquired
 * it (Veteran mode, or a Case check), so outside those it never takes a pinch meant for a letter
 * or a button.
 */

import { Interactable } from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import { Interactor } from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import Event, { PublicApi } from "SpectaclesInteractionKit.lspkg/Utils/Event"
import { CaseGeometry, NO_SLOT } from "./CaseLightGeometry"

/** The target sits just in front of the case face (cm). */
const TARGET_Z_CM = 0.4
const TARGET_DEPTH_CM = 0.8

export class SlotPinchTarget {
  readonly sceneObject: SceneObject
  private readonly caseRoot: SceneObject
  private readonly geo: CaseGeometry
  private readonly users = new Set<string>()
  private readonly _onSlotPinched = new Event<number>()
  private armedSlot = NO_SLOT
  private armedInteractor: Interactor | null = null
  private pinches = 0

  constructor(caseRoot: SceneObject, geo: CaseGeometry, debugCollider: boolean = false) {
    this.caseRoot = caseRoot
    this.geo = geo
    const so = global.scene.createSceneObject("SlotPinchTarget")
    so.setParent(caseRoot)
    const lo = geo.stripBottomY(geo.lowerPlayableShelf)
    const hi = geo.openingTopY(geo.upperPlayableShelf)
    so.getTransform().setLocalPosition(new vec3(0, (lo + hi) / 2, TARGET_Z_CM))
    const collider = so.createComponent("Physics.ColliderComponent") as ColliderComponent
    const shape = Shape.createBoxShape()
    shape.size = new vec3(2 * -geo.leftX, hi - lo, TARGET_DEPTH_CM)
    collider.shape = shape
    collider.fitVisual = false
    collider.debugDrawEnabled = debugCollider
    const interactable = so.createComponent(Interactable.getTypeName()) as Interactable
    interactable.onTriggerStart.add((e) => {
      this.disarmAll()
      if (!this.isLive || !e.interactor) return
      const hit = e.interactor.targetHitInfo
      const p = hit && hit.hit ? hit.hit.position : e.interactor.targetHitPosition
      if (!p) return
      const slot = this.slotAtWorld(p)
      if (slot === NO_SLOT) return
      this.armedSlot = slot
      this.armedInteractor = e.interactor
    })
    interactable.onTriggerEnd.add((e) => {
      const slot = this.armedSlot
      const same = !!e.interactor && e.interactor === this.armedInteractor
      this.disarmAll()
      if (this.isLive && same && slot !== NO_SLOT) {
        this.pinches++
        this._onSlotPinched.invoke(slot)
      }
    })
    const disarm = (e: { interactor: Interactor }): void => {
      if (e.interactor && e.interactor === this.armedInteractor) this.disarmAll()
    }
    interactable.onHoverExit.add(disarm)
    interactable.onTriggerEndOutside.add(disarm)
    interactable.onTriggerCanceled.add(disarm)
    so.enabled = false
    this.sceneObject = so
  }

  /** Fired with the slot of each counted pinch (users check whether it is theirs). */
  get onSlotPinched(): PublicApi<number> {
    return this._onSlotPinched.publicApi()
  }

  /** True while the collider takes pinches. */
  get isLive(): boolean {
    return this.sceneObject.enabled
  }

  /** Pinches counted since the Lens opened (all users). */
  get pinchCount(): number {
    return this.pinches
  }

  /** A user needs the target live (idempotent). */
  acquire(user: string): void {
    this.users.add(user)
    this.apply()
  }

  /** A user no longer needs it; it goes dark when nobody does. */
  release(user: string): void {
    this.users.delete(user)
    this.apply()
  }

  /** The playable slot under a world point on the case face, or -1 (the HOLD block never counts). */
  slotAtWorld(world: vec3): number {
    const local = this.caseRoot.getTransform().getInvertedWorldTransform().multiplyPoint(world)
    const slot = this.geo.slotAtFacePoint(local.x, local.y, 0)
    if (!this.geo.isValidSlot(slot) || this.geo.isHoldSlot(slot)) return NO_SLOT
    return slot
  }

  private apply(): void {
    const on = this.users.size > 0
    if (this.sceneObject.enabled !== on) {
      this.sceneObject.enabled = on
      this.disarmAll()
    }
  }

  private disarmAll(): void {
    this.armedSlot = NO_SLOT
    this.armedInteractor = null
  }
}
