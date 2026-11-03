// Owns: putting the whole case group (CaseRoot) on a real wall when the user asks: the wall hit test, the aim preview (case outline on the wall, a warning ring elsewhere), the refuse rule, the placement pose, and "place in front of me".
// Talks to: CaseLightMain (build, onPlaced, read-outs), CaseLightPlacementUI (toggle state, button, refuse cue), WorldQueryModule (HitTestSession), the SIK targeting interactor (ray and pinch), CaseLightGeometry (outline and shelf height), CaseLightMeshUtil (aim meshes).
// Must not: create text, change any drill state, or move the case unless the user asked (Place on wall + a pinch on a wall, or Place in front of me).
// Size: about 500 lines because the test read-outs, the pinch arming, the refuse rule and the pose math stay with their one owner; the aim meshes are two short builders.

/**
 * Opt-in. Until the user asks, nothing here moves anything: the case opens exactly where it is
 * authored. Place on wall turns aiming on; while it is on, the SIK targeting interactor's ray
 * (startPoint to endPoint, so real hands and LEAF-driven SIK input behave the same) is hit-tested
 * against the real world with a WorldQueryModule HitTestSession (filter on, started before any
 * hit test, about 5 Hz). The would-be case outline follows the hit on a wall; anywhere else a
 * small warning ring shows instead. Releasing a pinch commits:
 *   on a wall: CaseRoot moves as one rigid body. The case face lands on the wall at the hit,
 *     horizontally centred there, upright (world up), facing the user (the hit normal, flipped
 *     toward the eye if needed, with its vertical part dropped). Height: CaseRoot keeps its
 *     opening height relative to the eye, so the bottom playable shelf stays where it was
 *     relative to the eye.
 *   on a surface more than maxWallTiltDeg from vertical (floor, table, ceiling): refused; the
 *     ring stays and the cue "Walls only" shows for a moment. Nothing moves.
 *   on a wall outside minWallDistanceCm..maxWallDistanceCm from the eye (default 0.5 to 3 m,
 *     Snap's guidance for content distance): refused the same way ("Walls within 3 m" / "Step back").
 *   on no hit at all (the hit test returns null outside the depth view): refused; the cue
 *     "No wall seen: Place in front of me" points to the fallback. Nothing moves.
 * A pinch counts only if it started while aiming was on and not on a button or a letter, so the
 * pinch that presses Place on wall can never also place the case. A placement turns aiming off.
 * Place in front of me puts CaseRoot back at its opening pose relative to the current head
 * (yaw only, so it stays upright).
 */

import { SIK } from "SpectaclesInteractionKit.lspkg/SIK"
import { Interactor, InteractorTriggerType } from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import Event, { PublicApi } from "SpectaclesInteractionKit.lspkg/Utils/Event"
import { CaseGeometry, CASE_WIDTH_CM, SEP_PITCH_CM, SEPS_PER_SHELF } from "./CaseLightGeometry"
import { addMeshObject, MeshAccumulator, RGBA } from "./CaseLightMeshUtil"
import { CaseLightPlacementUI } from "./CaseLightPlacementUI"

export type PlacementKind = "none" | "wall" | "front"
/** Why the latest pinch did not place the case ("none" after a placement or before any refusal). */
export type RefuseReason = "none" | "not-wall" | "too-far" | "too-close" | "no-hit"

/** A hit older than this (s) is too stale to commit on. */
const HIT_MAX_AGE_S = 0.6
const REFUSE_CUE_SECONDS = 1.5
const REFUSE_CUE_TEXT = "Walls only"
/** Few words per reason; the distance band follows Snap's guidance (content about 0.5 to 3 m away). */
const REFUSE_CUE_TEXTS: { [reason: string]: string } = { "not-wall": "Walls only", "too-far": "Walls within 3 m", "too-close": "Step back" }
/** The hit test returns null outside the depth view: the case stays and the cue names the fallback. */
const NO_HIT_CUE_TEXT = "No wall seen: Place in front of me"
const OUTLINE_T_CM = 1.0
/** The aim outline sits this far off the wall, toward the user (cm). */
const OUTLINE_Z_CM = 0.4
const RING_INNER_CM = 3
const RING_OUTER_CM = 4.2
const RING_SEGMENTS = 32
/** Ring and cue are sized for this distance and scaled up beyond it. */
const RING_BASE_DISTANCE_CM = 60

interface WallHit {
  position: vec3
  /** Unit surface normal, flipped toward the eye. */
  normal: vec3
  /** Degrees between the surface and vertical (0 = a perfect wall, 90 = floor or ceiling). */
  tiltDeg: number
  /** A wall within the distance band: the case may go here. */
  isWall: boolean
  reason: RefuseReason
  time: number
}

@component
export class CaseLightPlacement extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">CaseLightPlacement - put the case on a real wall (opt-in)</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("The case group that moves as one rigid body (case, labels, tray, buttons, caption)")
  caseRoot: SceneObject

  @input
  @hint("Place on wall / Place in front of me controls and the refuse cue")
  controls: CaseLightPlacementUI
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(5, 60, 1))
  @hint("A surface more than this many degrees from vertical is not a wall (floor, table, ceiling): the placement is refused")
  maxWallTiltDeg: number = 30

  @input
  @widget(new SliderWidget(20, 100, 5))
  @hint("A wall closer than this to the eye is refused (cm). Snap's guidance: keep content about 0.5 to 3 m away")
  minWallDistanceCm: number = 50

  @input
  @widget(new SliderWidget(100, 500, 10))
  @hint("A wall farther than this from the eye is refused (cm); the case is for arm's reach. Snap's guidance: about 0.5 to 3 m")
  maxWallDistanceCm: number = 300

  @input
  @widget(new SliderWidget(0, 40, 1))
  @hint("Gap between the wall and the case face, in cm (0 = the face on the wall; 30 = the case's back on the wall)")
  wallGapCm: number = 0

  @input("vec4", "{0.55,0.9,1,1}")
  @widget(new ColorWidget())
  @hint("Colour of the case outline shown on the wall while aiming")
  aimColor: vec4

  @input("vec4", "{1,0.72,0.3,1}")
  @widget(new ColorWidget())
  @hint("Colour of the ring and cue shown where the case cannot go")
  refuseColor: vec4
  @ui.group_end

  private readonly _onPlaced = new Event<PlacementKind>()
  private geo: CaseGeometry | null = null
  private session: HitTestSession | null = null
  private sessionStarted = false
  private _placing = false
  private placingSinceFrame = 0
  private frame = 0
  private armed: Interactor | null = null
  private lastHit: WallHit | null = null
  private outlineObj: SceneObject | null = null
  private ringObj: SceneObject | null = null
  private refuseCueUntil = -1
  private _count = 0
  private _refused = 0
  private _lastRefused = false
  private _lastRefuseReason: RefuseReason = "none"
  private _lastKind: PlacementKind = "none"
  private _lastHitPos: vec3 | null = null
  private _lastHitNormal: vec3 | null = null
  private _hitResults = 0
  private _hitTests = 0
  /** Opening pose of CaseRoot in the head's yaw frame (no pitch or roll), measured at build. */
  private openOffset = vec3.zero()
  private openRot = quat.quatIdentity()
  private openRootAboveEyeCm = 0
  private openShelfAboveEyeCm = 0

  // ── Read-only state (tests and CaseLightMain) ───────────────────────────────────────────

  /** Fired after the case moved: "wall" or "front". */
  get onPlaced(): PublicApi<PlacementKind> {
    return this._onPlaced.publicApi()
  }

  /** True while Place on wall is on (aiming at walls). */
  get isPlacing(): boolean {
    return this._placing
  }

  /** Placements made (wall and front both count). */
  get placementCount(): number {
    return this._count
  }

  /** Refused placements (pinch released over a surface that is not a wall). */
  get refusedCount(): number {
    return this._refused
  }

  /** True when the latest committed pinch was refused (reset by the next placement). */
  get lastPlacementRefused(): boolean {
    return this._lastRefused
  }

  /** Why the latest pinch was refused: "not-wall", "too-far", "too-close", "no-hit", or "none". */
  get lastRefuseReason(): RefuseReason {
    return this._lastRefuseReason
  }

  get lastPlacementKind(): PlacementKind {
    return this._lastKind
  }

  /** World hit point of the latest wall placement (null before one). */
  get lastPlacementHit(): vec3 | null {
    return this._lastHitPos
  }

  /** Surface normal (flipped toward the eye) of the latest wall placement (null before one). */
  get lastPlacementNormal(): vec3 | null {
    return this._lastHitNormal
  }

  /** Where the case face points, in world space (CaseRoot +Z). */
  get caseFaceNormalWorld(): vec3 {
    return this.caseRoot ? this.caseRoot.getTransform().getWorldTransform().multiplyDirection(new vec3(0, 0, 1)).normalize() : vec3.zero()
  }

  /** The case's up, in world space (CaseRoot +Y). */
  get caseUpWorld(): vec3 {
    return this.caseRoot ? this.caseRoot.getTransform().getWorldTransform().multiplyDirection(new vec3(0, 1, 0)).normalize() : vec3.zero()
  }

  /** Height of the bottom playable shelf's board top above the eye right now, in cm (negative = below). */
  get lowerShelfAboveEyeCm(): number {
    if (!this.geo || !this.caseRoot) return 0
    const shelf = this.caseRoot.getTransform().getWorldTransform().multiplyPoint(new vec3(0, this.geo.boardTopY(this.geo.lowerPlayableShelf), 0))
    return shelf.y - this.eyePosition().y
  }

  /** The same height measured at the opening pose (build time), in cm. */
  get openLowerShelfAboveEyeCm(): number {
    return this.openShelfAboveEyeCm
  }

  /** True while the case outline is shown on a wall under the aim. */
  get isAimOutlineVisible(): boolean {
    return !!this.outlineObj && this.outlineObj.enabled
  }

  /** True while the warning ring is shown (aim on a surface that is not a wall). */
  get isRefuseRingVisible(): boolean {
    return !!this.ringObj && this.ringObj.enabled
  }

  /** Latest aim: "wall", "not-wall" or "none" (no hit, or aiming off). */
  get aimState(): "wall" | "not-wall" | "none" {
    if (!this._placing || !this.lastHit) return "none"
    return this.lastHit.isWall ? "wall" : "not-wall"
  }

  /** Hit tests sent and results that came back with a surface (diagnostics). */
  get hitTestCount(): number {
    return this._hitTests
  }

  get hitResultCount(): number {
    return this._hitResults
  }

  // ── Commands (the two controls) ─────────────────────────────────────────────────────────

  /** Place on wall on or off (the toggle's path). */
  setPlacing(on: boolean): void {
    if (!this.geo) return
    this._placing = on
    this.placingSinceFrame = this.frame
    this.armed = null
    this.lastHit = null
    if (on) {
      this.ensureSession()
    } else if (this.session && this.sessionStarted) {
      this.session.stop()
      this.sessionStarted = false
    }
    if (!on) this.hideAim()
    if (this.controls) this.controls.setPlacingState(on)
  }

  /** Back to the opening pose relative to the current head (yaw only). The button's path. */
  placeInFront(): void {
    if (!this.geo || !this.caseRoot) return
    const yaw = this.headYaw()
    const r = quat.angleAxis(yaw, vec3.up())
    const t = this.caseRoot.getTransform()
    t.setWorldPosition(this.eyePosition().add(r.multiplyVec3(this.openOffset)))
    t.setWorldRotation(r.multiply(this.openRot))
    this.setPlacing(false)
    this._count++
    this._lastKind = "front"
    this._lastRefused = false
    this._lastRefuseReason = "none"
    this._onPlaced.invoke("front")
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────────────────

  /** Called once by CaseLightMain after the case is built at its opening pose. */
  build(geo: CaseGeometry, material: Material): void {
    if (this.geo || !this.caseRoot) return
    this.geo = geo

    // Opening pose, measured, in the head's yaw frame.
    const eye = this.eyePosition()
    const yaw0 = this.headYaw()
    const inv = quat.angleAxis(-yaw0, vec3.up())
    const t = this.caseRoot.getTransform()
    this.openOffset = inv.multiplyVec3(t.getWorldPosition().sub(eye))
    this.openRot = inv.multiply(t.getWorldRotation())
    this.openRootAboveEyeCm = t.getWorldPosition().y - eye.y
    this.openShelfAboveEyeCm = this.lowerShelfAboveEyeCm

    const mat = material.clone()
    mat.mainPass.blendMode = BlendMode.Add
    mat.mainPass.depthWrite = false
    mat.mainPass.twoSided = true
    this.outlineObj = addMeshObject(this.sceneObject, "WallAimOutline", this.buildOutline(geo), mat).getSceneObject()
    this.outlineObj.enabled = false
    this.ringObj = addMeshObject(this.sceneObject, "WallAimRing", this.buildRing(), mat).getSceneObject()
    this.ringObj.enabled = false

    if (this.controls) {
      this.controls.onTogglePlacing.add(() => this.setPlacing(!this._placing))
      this.controls.onPlaceInFront.add(() => this.placeInFront())
      this.controls.setPlacingState(false)
    }
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  private ensureSession(): void {
    if (!this.session) {
      const wq = require("LensStudio:WorldQueryModule") as WorldQueryModule
      const options = HitTestSessionOptions.create()
      options.filter = true
      this.session = wq.createHitTestSessionWithOptions(options)
    }
    // Depth computation only runs after start(); every hitTest comes after this.
    if (!this.sessionStarted) {
      this.session.start()
      this.sessionStarted = true
    }
  }

  private onUpdate(): void {
    this.frame++
    if (this.refuseCueUntil >= 0 && getTime() > this.refuseCueUntil) {
      this.refuseCueUntil = -1
      if (this.controls) this.controls.hideCue()
      if (!this._placing && this.ringObj) this.ringObj.enabled = false
    }
    if (!this._placing || !this.session) return

    const interactor = this.pickInteractor()
    if (!interactor) {
      this.hideAim()
      return
    }
    const start = interactor.startPoint
    const end = interactor.endPoint
    if (start && end) {
      this._hitTests++
      this.session.hitTest(start, end, (r: WorldQueryHitTestResult) => this.onHit(r))
    }

    // Pinch start: arm only if aiming was already on and the pinch is not on a button or letter.
    const pinchStarted = interactor.previousTrigger === InteractorTriggerType.None && interactor.currentTrigger !== InteractorTriggerType.None
    const pinchEnded = interactor.previousTrigger !== InteractorTriggerType.None && interactor.currentTrigger === InteractorTriggerType.None
    if (pinchStarted) {
      this.armed = this.frame > this.placingSinceFrame && !interactor.currentInteractable ? interactor : null
    } else if (pinchEnded) {
      const wasArmed = this.armed === interactor
      this.armed = null
      if (wasArmed) this.commit()
    }
  }

  /** The armed interactor while a pinch is on; otherwise the earliest-listed active targeting one. */
  private pickInteractor(): Interactor | null {
    if (this.armed) return this.armed
    const list = SIK.InteractionManager.getTargetingInteractors()
    for (const it of list) {
      if (it.isActive()) return it
    }
    return null
  }

  private onHit(r: WorldQueryHitTestResult | null): void {
    if (!this._placing) return
    if (!r) {
      this.lastHit = null
      this.hideAim()
      return
    }
    this._hitResults++
    const eye = this.eyePosition()
    let n = r.normal.normalize()
    if (n.dot(eye.sub(r.position)) < 0) n = n.uniformScale(-1)
    const tiltDeg = (Math.asin(Math.min(1, Math.abs(n.y))) * 180) / Math.PI
    const dist = r.position.distance(eye)
    const reason: RefuseReason = tiltDeg > this.maxWallTiltDeg ? "not-wall" : dist > this.maxWallDistanceCm ? "too-far" : dist < this.minWallDistanceCm ? "too-close" : "none"
    const hit: WallHit = { position: r.position, normal: n, tiltDeg, isWall: reason === "none", reason, time: getTime() }
    this.lastHit = hit
    this.showAim(hit)
  }

  /** Release of an armed pinch: place on a wall, refuse anything else. */
  private commit(): void {
    const hit = this.lastHit
    if (!hit || getTime() - hit.time > HIT_MAX_AGE_S) {
      // No surface in the depth view (the hit test returns null outside it): keep the case, point to the fallback.
      this._refused++
      this._lastRefused = true
      this._lastRefuseReason = "no-hit"
      this.showNoHitCue()
      return
    }
    if (!hit.isWall) {
      this._refused++
      this._lastRefused = true
      this._lastRefuseReason = hit.reason
      this.showRefuseCue(hit)
      return
    }
    this._lastRefuseReason = "none"
    const pose = this.wallPose(hit)
    const t = this.caseRoot.getTransform()
    t.setWorldPosition(pose.position)
    t.setWorldRotation(pose.rotation)
    this._count++
    this._lastKind = "wall"
    this._lastRefused = false
    this._lastHitPos = hit.position
    this._lastHitNormal = hit.normal
    this.setPlacing(false)
    this._onPlaced.invoke("wall")
  }

  /** Where CaseRoot goes for a wall hit: face on the wall at the hit, upright, facing the user. */
  private wallPose(hit: WallHit): { position: vec3; rotation: quat } {
    const flat = new vec3(hit.normal.x, 0, hit.normal.z)
    // A wall's normal is near horizontal; the tilt limit keeps this well away from zero.
    const face = flat.length > 1e-4 ? flat.normalize() : this.headFacingBack()
    const rotation = quat.angleAxis(Math.atan2(face.x, face.z), vec3.up())
    const eye = this.eyePosition()
    const position = new vec3(hit.position.x, eye.y + this.openRootAboveEyeCm, hit.position.z).add(face.uniformScale(this.wallGapCm))
    return { position, rotation }
  }

  // ── Aim visuals ─────────────────────────────────────────────────────────────────────────

  private showAim(hit: WallHit): void {
    if (hit.isWall) {
      if (this.ringObj && this.refuseCueUntil < 0) this.ringObj.enabled = false
      if (!this.outlineObj) return
      const pose = this.wallPose(hit)
      const t = this.outlineObj.getTransform()
      t.setWorldPosition(pose.position)
      t.setWorldRotation(pose.rotation)
      this.outlineObj.enabled = true
    } else {
      if (this.outlineObj) this.outlineObj.enabled = false
      this.placeRing(hit)
    }
  }

  private hideAim(): void {
    if (this.outlineObj) this.outlineObj.enabled = false
    if (this.ringObj && this.refuseCueUntil < 0) this.ringObj.enabled = false
  }

  private placeRing(hit: WallHit): void {
    if (!this.ringObj) return
    const t = this.ringObj.getTransform()
    const dist = hit.position.distance(this.eyePosition())
    const s = Math.max(1, dist / RING_BASE_DISTANCE_CM)
    t.setWorldPosition(hit.position.add(hit.normal.uniformScale(0.5)))
    t.setWorldRotation(quat.rotationFromTo(new vec3(0, 0, 1), hit.normal))
    t.setWorldScale(new vec3(s, s, s))
    this.ringObj.enabled = true
  }

  private showRefuseCue(hit: WallHit): void {
    this.placeRing(hit)
    this.refuseCueUntil = getTime() + REFUSE_CUE_SECONDS
    if (!this.controls) return
    const eye = this.eyePosition()
    const dist = hit.position.distance(eye)
    const s = Math.max(1, dist / RING_BASE_DISTANCE_CM)
    // Just above the ring, upright, turned to the eye.
    const at = hit.position.add(hit.normal.uniformScale(1)).add(new vec3(0, (RING_OUTER_CM + 2) * s, 0))
    const toEye = eye.sub(at)
    const facing = quat.angleAxis(Math.atan2(toEye.x, toEye.z), vec3.up())
    this.controls.showCue(REFUSE_CUE_TEXTS[hit.reason] ?? REFUSE_CUE_TEXT, at, facing, dist, this.refuseColor)
  }

  /** No hit to place on: a short cue 80 cm ahead of the eye pointing to Place in front of me. Nothing moves. */
  private showNoHitCue(): void {
    this.refuseCueUntil = getTime() + REFUSE_CUE_SECONDS
    if (!this.controls) return
    const cam = WorldCameraFinderProvider.getInstance()
    const eye = this.eyePosition()
    const fwd = cam.getTransform().forward.uniformScale(-1)
    const flat = new vec3(fwd.x, 0, fwd.z)
    const dir = flat.length > 1e-4 ? flat.normalize() : new vec3(0, 0, -1)
    const at = eye.add(dir.uniformScale(80))
    const facing = quat.angleAxis(Math.atan2(-dir.x, -dir.z), vec3.up())
    this.controls.showCue(NO_HIT_CUE_TEXT, at, facing, 80, this.refuseColor)
  }

  /** The case's face outline plus its two playable rows, flat on z = OUTLINE_Z_CM (case-local). */
  private buildOutline(geo: CaseGeometry): RenderMesh {
    const m = new MeshAccumulator()
    const c = this.aimColor
    const edge: RGBA = [c.x, c.y, c.z, 1]
    const faint: RGBA = [c.x * 0.12, c.y * 0.12, c.z * 0.12, 1]
    const t = OUTLINE_T_CM
    const z = OUTLINE_Z_CM
    const hw = CASE_WIDTH_CM / 2
    const y0 = geo.floorY()
    const y1 = geo.caseTopY()
    // Outer frame: four flat bars (one layer each, so the additive colour stays true).
    m.addQuadZ(-hw, y0, hw, y0 + t, z, edge)
    m.addQuadZ(-hw, y1 - t, hw, y1, z, edge)
    m.addQuadZ(-hw, y0 + t, -hw + t, y1 - t, z, edge)
    m.addQuadZ(hw - t, y0 + t, hw, y1 - t, z, edge)
    // The two playable rows: a faint band with an edge above and below.
    const pw = (SEPS_PER_SHELF * SEP_PITCH_CM) / 2
    const lo = geo.boardTopY(geo.lowerPlayableShelf)
    const hi = geo.openingTopY(geo.upperPlayableShelf)
    m.addQuadZ(-pw, lo + t, pw, hi - t, z, faint)
    m.addQuadZ(-pw, lo, pw, lo + t, z, edge)
    m.addQuadZ(-pw, hi - t, pw, hi, z, edge)
    return m.finish()
  }

  /** A flat ring facing +Z, centred on the origin. */
  private buildRing(): RenderMesh {
    const m = new MeshAccumulator()
    const c = this.refuseColor
    const col: RGBA = [c.x, c.y, c.z, 1]
    for (let i = 0; i < RING_SEGMENTS; i++) {
      const a0 = (i / RING_SEGMENTS) * Math.PI * 2
      const a1 = ((i + 1) / RING_SEGMENTS) * Math.PI * 2
      const i0 = [Math.cos(a0) * RING_INNER_CM, Math.sin(a0) * RING_INNER_CM]
      const o0 = [Math.cos(a0) * RING_OUTER_CM, Math.sin(a0) * RING_OUTER_CM]
      const i1 = [Math.cos(a1) * RING_INNER_CM, Math.sin(a1) * RING_INNER_CM]
      const o1 = [Math.cos(a1) * RING_OUTER_CM, Math.sin(a1) * RING_OUTER_CM]
      m.addTriangleZ(i0, o0, o1, 0, col)
      m.addTriangleZ(i0, o1, i1, 0, col)
    }
    return m.finish()
  }

  // ── Head helpers ────────────────────────────────────────────────────────────────────────

  private eyePosition(): vec3 {
    return WorldCameraFinderProvider.getInstance().getWorldPosition()
  }

  /** Head yaw (rad): the rotation about world up that turns -Z into where the head faces. */
  private headYaw(): number {
    const m = WorldCameraFinderProvider.getInstance().getTransform().getWorldTransform()
    let f = m.multiplyDirection(new vec3(0, 0, -1))
    // Looking down, the head's up points forward; looking up, it points back.
    if (Math.abs(f.x) + Math.abs(f.z) < 0.1) f = m.multiplyDirection(new vec3(0, -Math.sign(f.y), 0))
    return Math.atan2(-f.x, -f.z)
  }

  /** The horizontal direction from the head toward the user's back (used only if a normal is vertical). */
  private headFacingBack(): vec3 {
    const yaw = this.headYaw()
    return new vec3(Math.sin(yaw), 0, Math.cos(yaw))
  }
}
