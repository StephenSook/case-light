// Owns: the optional drill pace light (PaceLight) and its clock: on/off, letters per minute, which separation it is on.
// Talks to: CaseLightMain (build, setOn, read-outs), CaseLightGeometry (cell positions).
// Must not: touch the answer glow, the arrow, the counts or the sounds, or create text (the caption lives in CaseLightControlsUI).

/**
 * A thin warm light under one separation that steps along the playable cells in delivery order
 * (lower playable shelf left to right, then the upper, slots 0..79 including the HOLD block
 * cells), one separation per letter-time, then loops. At 18 letters per minute that is one
 * separation every 60 / 18 = 3.333 s. Source for the default rate: USPS Handbook M-41 Exhibit
 * 121.12 lists 18 pieces per minute for routing letter-size mail as the minimum office
 * performance standard. It is a pace to drill against, not a claim about any one carrier.
 *
 * Frame-rate independent: the separation is computed from elapsed time (steps = seconds *
 * lettersPerMinute / 60), never by counting frames. Changing the rate while it runs keeps the
 * current step and continues at the new rate from that moment (the read-outs apply the change
 * at once, not on the next frame).
 *
 * The light is additive with depth write off, so it adds to whatever is behind it (including the
 * answer glow when both are on the same cell) and never hides it.
 */

import { CaseGeometry, NO_SLOT, SEP_PITCH_CM, SLOT_COUNT } from "./CaseLightGeometry"
import { addMeshObject, MeshAccumulator, RGBA } from "./CaseLightMeshUtil"

/** Light geometry, relative to the bottom-centre of a separation's opening (cm). */
const CORE_HEIGHT_CM = 0.3
const CORE_BOTTOM_CM = 0.25
const CORE_INSET_CM = 0.35
const HALO_HEIGHT_CM = 0.8
const HALO_BOTTOM_CM = 0.1
const HALO_INSET_CM = 0.2
/** In front of the answer glow's outline (z = 0.1) so the two never z-fight. */
const CORE_Z_CM = 0.14
const HALO_Z_CM = 0.12
const HALO_LEVEL = 0.3

@component
export class CaseLightPace extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">CaseLightPace - optional drill pace light (off by default)</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(6, 60, 1))
  @hint("Drill pace in letters per minute: the light moves one separation per letter. Default 18 (USPS Handbook M-41 Exhibit 121.12 minimum office standard for routing letter-size mail)")
  lettersPerMinute: number = 18

  @input("vec4", "{1,0.78,0.35,1}")
  @widget(new ColorWidget())
  @hint("Colour of the pace light and its caption (keep it bright: dark renders transparent on Specs)")
  lightColor: vec4
  @ui.group_end

  private geo: CaseGeometry | null = null
  private light: SceneObject | null = null
  private on = false
  /** getTime() when the pace was switched on (the wall clock behind elapsedSeconds). */
  private onTime = 0
  /** Steps already taken at baseTime, and the rate used since then. Re-based when the rate changes. */
  private baseTime = 0
  private baseSteps = 0
  private rateAtBase = 18
  private shownIndex = NO_SLOT

  /** True while the pace light runs. */
  get isOn(): boolean {
    return this.on
  }

  /** Letters (separations) per minute the light moves at. */
  get rate(): number {
    return this.lettersPerMinute
  }

  /** Seconds the light stays on one separation (60 / lettersPerMinute). */
  get secondsPerSeparation(): number {
    return this.lettersPerMinute > 0 ? 60 / this.lettersPerMinute : 0
  }

  /** Seconds since the pace was switched on (0 while off). */
  get elapsedSeconds(): number {
    return this.on ? Math.max(0, getTime() - this.onTime) : 0
  }

  /** Separations advanced since the pace was switched on, not wrapped (0 while off). */
  get stepCount(): number {
    if (!this.on) return 0
    this.rebaseIfRateChanged()
    return Math.floor(this.rawSteps() + 1e-9)
  }

  /** Separation the light is on (0..79, delivery order), or -1 while off. */
  get sweepIndex(): number {
    return this.on ? this.stepCount % SLOT_COUNT : NO_SLOT
  }

  /** True when the light object is drawn. */
  get isLightVisible(): boolean {
    return !!this.light && this.light.isEnabledInHierarchy
  }

  build(geo: CaseGeometry, material: Material): void {
    if (this.geo) return
    this.geo = geo
    const c = this.lightColor
    const core: RGBA = [c.x, c.y, c.z, c.w]
    const halo: RGBA = [c.x * HALO_LEVEL, c.y * HALO_LEVEL, c.z * HALO_LEVEL, c.w]
    const hw = SEP_PITCH_CM / 2
    const m = new MeshAccumulator()
    m.addQuadZ(-hw + HALO_INSET_CM, HALO_BOTTOM_CM, hw - HALO_INSET_CM, HALO_BOTTOM_CM + HALO_HEIGHT_CM, HALO_Z_CM, halo)
    m.addQuadZ(-hw + CORE_INSET_CM, CORE_BOTTOM_CM, hw - CORE_INSET_CM, CORE_BOTTOM_CM + CORE_HEIGHT_CM, CORE_Z_CM, core)

    const mat = material.clone()
    mat.mainPass.blendMode = BlendMode.Add
    mat.mainPass.depthWrite = false
    mat.mainPass.twoSided = true
    this.light = addMeshObject(this.sceneObject, "PaceLight", m.finish(), mat).getSceneObject()
    this.light.enabled = false
    this.createEvent("UpdateEvent").bind(() => this.update())
  }

  /** Switch the pace on (always from slot 0) or off. */
  setOn(on: boolean): void {
    if (!this.geo) return
    if (on === this.on) return
    this.on = on
    if (on) {
      this.onTime = getTime()
      this.baseTime = this.onTime
      this.baseSteps = 0
      this.rateAtBase = this.lettersPerMinute
      this.shownIndex = NO_SLOT
      this.moveTo(0)
    } else {
      this.shownIndex = NO_SLOT
      if (this.light) this.light.enabled = false
    }
  }

  private update(): void {
    if (!this.on) return
    const i = this.sweepIndex
    if (i !== this.shownIndex) this.moveTo(i)
  }

  /** Fractional steps since switch-on at the rate in use since baseTime. */
  private rawSteps(): number {
    const rate = Math.max(0, this.rateAtBase)
    return this.baseSteps + (Math.max(0, getTime() - this.baseTime) * rate) / 60
  }

  /** A rate change keeps the current step: bank the steps so far, then continue at the new rate. */
  private rebaseIfRateChanged(): void {
    if (this.lettersPerMinute === this.rateAtBase) return
    this.baseSteps = this.rawSteps()
    this.baseTime = getTime()
    this.rateAtBase = this.lettersPerMinute
  }

  private moveTo(slot: number): void {
    if (!this.geo || !this.light) return
    const c = this.geo.slotCenterLocal(slot)
    this.light.getTransform().setLocalPosition(new vec3(c.x, c.y - this.geo.openingHeight / 2, c.z))
    this.light.enabled = true
    this.shownIndex = slot
  }
}
