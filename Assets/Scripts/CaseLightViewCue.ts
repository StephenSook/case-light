// Owns: the head-following display rectangle (dimmed outside, for the video) and the edge arrow, plus the pure step() test.
// Talks to: CaseLightMain (build, setTargetCell / setTarget, configureCellPad, step), SIK's WorldCameraFinderProvider (camera pose).
// Must not: pick the target (CaseLightMain owns which slot is lit).

/**
 * The in-view test is an explicit angle test against the display's angular size, not the
 * preview camera frustum (the preview can show more than the glasses do). The arrow hides only
 * when the whole lit cell (all four corners) is inside the rectangle. step() is pure so a LEAF
 * scenario can feed synthetic head angles: a LEAF scenario cannot turn the head.
 * Display size default: Snap's table gives about 23 x 38 cm at 55 cm, about 23.6 x 38.1 degrees;
 * the hackathon guide says about 32 degrees wide, so both are settings.
 *
 * This object must stay last in the CaseLight hierarchy so its no-depth overlay draws on top.
 */

import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import { addMeshObject, MeshAccumulator } from "./CaseLightMeshUtil"

const RAD2DEG = 180 / Math.PI
const DEG2RAD = Math.PI / 180
/** Distance of the head-locked overlay plane from the eye (cm). */
const CUE_DISTANCE_CM = 50
const DIM_EXTENT_CM = 400

@component
export class CaseLightViewCue extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">CaseLightViewCue - display rectangle and edge arrow</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(15, 50, 0.1))
  @hint("Width of the glasses' display in degrees (Snap's table: about 23.6 at 55 cm; hackathon guide: about 32)")
  displayWidthDeg: number = 23.6

  @input
  @widget(new SliderWidget(20, 60, 0.1))
  @hint("Height of the glasses' display in degrees (about 38.1 at 55 cm)")
  displayHeightDeg: number = 38.1

  @input
  @hint("Draw the display rectangle and dim everything outside it (a video aid; on glasses the dimming is invisible)")
  showDisplayFrame: boolean = true

  @input
  @widget(new SliderWidget(0, 0.9, 0.05))
  @hint("How dark the area outside the display rectangle is drawn")
  dimOpacity: number = 0.55

  @input("vec4", "{0.6,0.9,1,1}")
  @widget(new ColorWidget())
  @hint("Colour of the edge arrow")
  arrowColor: vec4

  @input
  @widget(new SliderWidget(1, 6, 0.1))
  @hint("How far inside the display edge the arrow tip sits, in cm on the overlay plane 50 cm out (3.5 cm = about 4 degrees), so it stays inside the binocular overlap instead of at the very edge")
  arrowInsetCm: number = 3.5
  @ui.group_end

  private rig: SceneObject | null = null
  private frameObj: SceneObject | null = null
  private arrowObj: SceneObject | null = null
  private target: vec3 | null = null
  private targetCorners: vec3[] = []
  private arrowShown = false
  private yaw = 0
  private pitch = 0
  private padYaw = 0
  private padPitch = 0
  private defaultPadYaw = 0
  private defaultPadPitch = 0

  /** Angular half-width (deg) of the current target as seen this frame (0 for a point target). */
  get lastPadYawDeg(): number {
    return this.padYaw
  }

  /** Angular half-height (deg) of the current target as seen this frame (0 for a point target). */
  get lastPadPitchDeg(): number {
    return this.padPitch
  }

  /** step()'s default yaw pad: one separation's angular half-width from the start position. */
  get defaultPadYawDeg(): number {
    return this.defaultPadYaw
  }

  /** step()'s default pitch pad: one separation's angular half-height from the start position. */
  get defaultPadPitchDeg(): number {
    return this.defaultPadPitch
  }

  /** True while the edge arrow is drawn. */
  get isArrowVisible(): boolean {
    return this.arrowShown
  }

  /** Head-relative yaw (deg, + = right) of the current target, last frame. */
  get lastYawDeg(): number {
    return this.yaw
  }

  /** Head-relative pitch (deg, + = up) of the current target, last frame. */
  get lastPitchDeg(): number {
    return this.pitch
  }

  get halfWidthDeg(): number {
    return this.displayWidthDeg / 2
  }

  get halfHeightDeg(): number {
    return this.displayHeightDeg / 2
  }

  get hasTarget(): boolean {
    return this.target !== null
  }

  /**
   * Pure in-view test for a target of angular half-size (padYawDeg, padPitchDeg) centred at
   * (yawDeg, pitchDeg). Angles are head-relative tangent-plane angles in degrees
   * (yaw = atan2(x, -z), pitch = atan2(y, -z) in camera space; + = right / up).
   * Returns true when ANY part of the target is OUTSIDE the display rectangle (show the arrow):
   *   |yaw| + padYaw > halfWidthDeg  OR  |pitch| + padPitch > halfHeightDeg.
   * The arrow hides only when the whole target is inside. Defaults: one separation seen from
   * the start position (set by configureCellPad); pass 0, 0 for a single point.
   * A target behind the head has |yaw| or |pitch| above 90 and is outside.
   */
  step(yawDeg: number, pitchDeg: number, padYawDeg: number = this.defaultPadYaw, padPitchDeg: number = this.defaultPadPitch): boolean {
    return Math.abs(yawDeg) + padYawDeg > this.halfWidthDeg || Math.abs(pitchDeg) + padPitchDeg > this.halfHeightDeg
  }

  /** Default pads for step(): a cell of half-size (halfWidthCm, halfHeightCm) at distanceCm. */
  configureCellPad(halfWidthCm: number, halfHeightCm: number, distanceCm: number): void {
    const d = Math.max(1, distanceCm)
    this.defaultPadYaw = Math.atan(halfWidthCm / d) * RAD2DEG
    this.defaultPadPitch = Math.atan(halfHeightCm / d) * RAD2DEG
  }

  /** Head-relative (yaw, pitch) in degrees of a world point, from the current camera pose. */
  anglesTo(worldPoint: vec3): vec2 {
    const local = WorldCameraFinderProvider.getInstance().getInvertedWorldTransform().multiplyPoint(worldPoint)
    const ahead = -local.z
    return new vec2(Math.atan2(local.x, ahead) * RAD2DEG, Math.atan2(local.y, ahead) * RAD2DEG)
  }

  /** A point target for the arrow (no size), or null for no target. */
  setTarget(worldPoint: vec3 | null): void {
    this.target = worldPoint
    this.targetCorners = []
    this.tick()
  }

  /**
   * A rectangular target (the lit separation or the HOLD block): its centre and its four
   * corners in world space. The arrow shows until all four corners are inside the display.
   */
  setTargetCell(center: vec3, corners: vec3[]): void {
    this.target = center
    this.targetCorners = corners.slice()
    this.tick()
  }

  onAwake(): void {
    this.createEvent("LateUpdateEvent").bind(() => this.tick())
  }

  build(material: Material): void {
    if (this.rig) return
    const overlayMat = material ? material.clone() : null
    if (overlayMat) {
      overlayMat.mainPass.blendMode = BlendMode.Normal
      overlayMat.mainPass.depthTest = false
      overlayMat.mainPass.depthWrite = false
    }
    this.rig = global.scene.createSceneObject("HeadCueRig")
    this.rig.setParent(this.sceneObject)

    const hx = CUE_DISTANCE_CM * Math.tan(this.halfWidthDeg * DEG2RAD)
    const hy = CUE_DISTANCE_CM * Math.tan(this.halfHeightDeg * DEG2RAD)
    const z = -CUE_DISTANCE_CM

    const f = new MeshAccumulator()
    const dim: [number, number, number, number] = [0, 0, 0, this.dimOpacity]
    const e = DIM_EXTENT_CM
    f.addQuadZ(-e, hy, e, e, z, dim)
    f.addQuadZ(-e, -e, e, -hy, z, dim)
    f.addQuadZ(-e, -hy, -hx, hy, z, dim)
    f.addQuadZ(hx, -hy, e, hy, z, dim)
    f.rectOutline(-hx, -hy, hx, hy, z, 0.16, [0.92, 0.92, 0.92, 0.9])
    this.frameObj = addMeshObject(this.rig, "DisplayFrame", f.finish(), overlayMat).getSceneObject()
    this.frameObj.enabled = this.showDisplayFrame

    const a = new MeshAccumulator()
    const c = this.arrowColor
    a.addTriangleZ([0, 0], [-2.0, 1.25], [-2.0, -1.25], 0, [c.x, c.y, c.z, c.w])
    a.addQuadZ(-3.0, -0.35, -1.9, 0.35, 0, [c.x, c.y, c.z, c.w])
    this.arrowObj = addMeshObject(this.rig, "EdgeArrow", a.finish(), overlayMat).getSceneObject()
    this.arrowObj.enabled = false
  }

  /** Angular half-extents of the target's corners around its centre, from the current pose. */
  private measurePads(center: vec2): void {
    this.padYaw = 0
    this.padPitch = 0
    if (this.targetCorners.length === 0) return
    const inv = WorldCameraFinderProvider.getInstance().getInvertedWorldTransform()
    for (const corner of this.targetCorners) {
      const local = inv.multiplyPoint(corner)
      if (-local.z <= 1e-3) {
        // A corner at or behind the eye plane: the target cannot be fully in view.
        this.padYaw = 180
        this.padPitch = 180
        return
      }
      const cy = Math.atan2(local.x, -local.z) * RAD2DEG
      const cp = Math.atan2(local.y, -local.z) * RAD2DEG
      this.padYaw = Math.max(this.padYaw, Math.abs(cy - center.x))
      this.padPitch = Math.max(this.padPitch, Math.abs(cp - center.y))
    }
  }

  private tick(): void {
    if (!this.rig || !this.arrowObj) return
    const camT = WorldCameraFinderProvider.getInstance().getTransform()
    const rt = this.rig.getTransform()
    rt.setWorldPosition(camT.getWorldPosition())
    rt.setWorldRotation(camT.getWorldRotation())
    if (this.frameObj) this.frameObj.enabled = this.showDisplayFrame

    if (!this.target) {
      this.arrowShown = false
      this.arrowObj.enabled = false
      return
    }
    const ang = this.anglesTo(this.target)
    this.yaw = ang.x
    this.pitch = ang.y
    this.measurePads(ang)
    this.arrowShown = this.step(ang.x, ang.y, this.padYaw, this.padPitch)
    this.arrowObj.enabled = this.arrowShown
    if (!this.arrowShown) return

    // Direction from the view centre toward the target, on the overlay plane.
    const local = WorldCameraFinderProvider.getInstance().getInvertedWorldTransform().multiplyPoint(this.target)
    let dx = local.x
    let dy = local.y
    if (-local.z > 1e-3) {
      dx = (local.x / -local.z) * CUE_DISTANCE_CM
      dy = (local.y / -local.z) * CUE_DISTANCE_CM
    }
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 1e-4) {
      dx = 1
      dy = 0
    }
    const hx = CUE_DISTANCE_CM * Math.tan(this.halfWidthDeg * DEG2RAD) - this.arrowInsetCm
    const hy = CUE_DISTANCE_CM * Math.tan(this.halfHeightDeg * DEG2RAD) - this.arrowInsetCm
    const s = Math.min(Math.abs(dx) > 1e-4 ? hx / Math.abs(dx) : Infinity, Math.abs(dy) > 1e-4 ? hy / Math.abs(dy) : Infinity)
    const at = this.arrowObj.getTransform()
    at.setLocalPosition(new vec3(dx * s, dy * s, -CUE_DISTANCE_CM + 0.5))
    at.setLocalRotation(quat.angleAxis(Math.atan2(dy, dx), vec3.forward()))
  }
}
