// Owns: the short ring ripple that marks where a pinch lands (grab) and where a letter snaps in.
// Talks to: CaseLightMain, which calls build(material) once and play(worldPoint) per pinch or snap.
// Must not: decide when to ripple, hold session state, or draw anything that stays on screen.

/**
 * A small pool of camera-facing rings. Each ring grows from a small radius to endRadiusCm and
 * fades to black over durationSeconds. Black is transparent on the additive display, so fading
 * the colour is fading the ring. Drawn without a depth test so a ring on a held letter stays
 * visible; the object sits under HeadCueRoot so it draws after the case and the letters.
 */

import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"

const SEGMENTS = 40
const POOL_SIZE = 3
/** Ring width as a fraction of the unit radius (scaled with the ring). */
const RING_WIDTH = 0.14
/** Pull the ring this far toward the eye so it sits in front of the surface it marks (cm). */
const TOWARD_EYE_CM = 0.6
const START_SCALE = 0.25

/** Longest time step one frame may advance a ripple (s), so a loading hitch cannot skip it. */
const MAX_STEP_S = 1 / 30

interface Ring {
  obj: SceneObject
  builder: MeshBuilder
  /** Seconds since this ring started, or -1 when idle. */
  age: number
}

@component
export class CaseLightRipple extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">CaseLightRipple - ring where a pinch or snap lands</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input("vec4", "{0.95,0.95,0.95,1}")
  @widget(new ColorWidget())
  @hint("Ring colour (keep it bright and neutral: dark colours vanish on the additive display, and cyan is kept for the target cell)")
  rippleColor: vec4

  @input
  @widget(new SliderWidget(0.15, 1.5, 0.05))
  @hint("How long one ripple lasts, in seconds")
  durationSeconds: number = 0.45

  @input
  @widget(new SliderWidget(1, 8, 0.1))
  @hint("Radius the ring grows to, in cm")
  endRadiusCm: number = 3.2
  @ui.group_end

  private rings: Ring[] = []
  private nextRing = 0
  private played = 0
  private lastPoint: vec3 | null = null

  /** Ripples started since the Lens began. */
  get ripplesPlayed(): number {
    return this.played
  }

  /** Where the last ripple was centred, or null before the first one. */
  get lastRipplePoint(): vec3 | null {
    return this.lastPoint
  }

  /** Rings on screen right now. */
  get activeRipples(): number {
    return this.rings.filter((r) => r.obj.enabled).length
  }

  onAwake(): void {
    this.createEvent("UpdateEvent").bind(() => this.tick())
  }

  build(material: Material): void {
    if (this.rings.length > 0) return
    const mat = material ? material.clone() : null
    if (mat) {
      mat.mainPass.blendMode = BlendMode.Add
      mat.mainPass.depthTest = false
      mat.mainPass.depthWrite = false
    }
    for (let i = 0; i < POOL_SIZE; i++) {
      const obj = global.scene.createSceneObject(`Ripple_${i}`)
      obj.setParent(this.sceneObject)
      const builder = this.ringBuilder()
      const rmv = obj.createComponent("Component.RenderMeshVisual") as RenderMeshVisual
      rmv.mesh = builder.getMesh()
      if (mat) rmv.mainMaterial = mat
      obj.enabled = false
      this.rings.push({ obj, builder, age: -1 })
    }
  }

  /** Stop every ripple now (rings hidden). */
  stopAll(): void {
    for (const ring of this.rings) {
      ring.age = -1
      ring.obj.enabled = false
    }
  }

  /** Start one ripple centred on a world point, facing the eye. */
  play(worldPoint: vec3): void {
    if (this.rings.length === 0) return
    const ring = this.rings[this.nextRing]
    this.nextRing = (this.nextRing + 1) % this.rings.length

    const eye = WorldCameraFinderProvider.getInstance().getWorldPosition()
    const toEye = eye.sub(worldPoint)
    const dir = toEye.length > 1e-3 ? toEye.normalize() : vec3.forward()
    const t = ring.obj.getTransform()
    t.setWorldPosition(worldPoint.add(dir.uniformScale(TOWARD_EYE_CM)))
    t.setWorldRotation(quat.lookAt(dir, vec3.up()))
    this.played++
    this.lastPoint = worldPoint

    ring.age = 0
    ring.obj.enabled = true
    this.drawRing(ring, 0)
  }

  private tick(): void {
    const dt = Math.min(getDeltaTime(), MAX_STEP_S)
    for (const ring of this.rings) {
      if (ring.age < 0) continue
      ring.age += dt
      const k = this.durationSeconds > 0 ? ring.age / this.durationSeconds : 1
      if (k >= 1) {
        ring.age = -1
        ring.obj.enabled = false
        continue
      }
      this.drawRing(ring, k)
    }
  }

  /** Ring at progress k (0..1): grows with an ease-out and fades to black. */
  private drawRing(ring: Ring, k: number): void {
    const eased = 1 - Math.pow(1 - k, 3)
    this.setRing(ring, this.endRadiusCm * (START_SCALE + (1 - START_SCALE) * eased), 1 - k, this.rippleColor)
  }

  private setRing(ring: Ring, radius: number, brightness: number, c: vec4): void {
    ring.obj.getTransform().setLocalScale(new vec3(radius, radius, 1))
    const b = Math.max(0, brightness)
    for (let v = 0; v < (SEGMENTS + 1) * 2; v++) {
      const i = Math.floor(v / 2)
      const a = (i / SEGMENTS) * Math.PI * 2
      const r = v % 2 === 0 ? 1 - RING_WIDTH / 2 : 1 + RING_WIDTH / 2
      ring.builder.setVertexInterleaved(v, [Math.cos(a) * r, Math.sin(a) * r, 0, 0, 0, 1, c.x * b, c.y * b, c.z * b, 1])
    }
    ring.builder.updateMesh()
  }

  /** Unit annulus in the XY plane facing +Z: vertex 2i = inner, 2i+1 = outer, at angle i. */
  private ringBuilder(): MeshBuilder {
    const b = new MeshBuilder([
      { name: "position", components: 3 },
      { name: "normal", components: 3, normalized: true },
      { name: "color", components: 4 }
    ])
    b.topology = MeshTopology.Triangles
    b.indexType = MeshIndexType.UInt16
    const verts: number[] = []
    for (let i = 0; i <= SEGMENTS; i++) {
      const a = (i / SEGMENTS) * Math.PI * 2
      for (const r of [1 - RING_WIDTH / 2, 1 + RING_WIDTH / 2]) {
        verts.push(Math.cos(a) * r, Math.sin(a) * r, 0, 0, 0, 1, 0, 0, 0, 1)
      }
    }
    const idx: number[] = []
    for (let i = 0; i < SEGMENTS; i++) {
      const inner = 2 * i
      const outer = 2 * i + 1
      const innerNext = 2 * (i + 1)
      const outerNext = 2 * (i + 1) + 1
      // CCW seen from +Z (checked by cross product): (inner, outer, outerNext), (inner, outerNext, innerNext).
      idx.push(inner, outer, outerNext, inner, outerNext, innerNext)
    }
    b.appendVerticesInterleaved(verts)
    b.appendIndices(idx)
    b.updateMesh()
    return b
  }
}
