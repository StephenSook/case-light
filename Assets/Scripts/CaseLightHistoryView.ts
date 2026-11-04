// Owns: the learning curve's drawing beside the route picker: one caption, a thin line through up to five points with a dot on each, and a score label under each point; shown or hidden as a whole.
// Talks to: CaseLightMain (makes it under the RoutePicker object, calls show()), CaseLightHistory (point positions, labels, caption), CaseLightMeshUtil (the line mesh).
// Must not: decide when it shows or what the scores are, take a pinch (no Interactable, no collider), or do anything per frame (one mesh, rebuilt only on show).

/**
 * Placement (RoutePicker-local cm, the picker's own plane, so it moves and scales with the picker):
 * left of Route 1 and above Show my case, in the start view, between the Start hint's plate and
 * the picker's plate. At the opening pose this is about yaw 4.3..8.4 deg and pitch 15.7..18.1 deg:
 * clear of every button and of the hint, inside the display and inside a preview still, far above
 * the cells and row labels. The drill pace caption stands in the same place, so CaseLightMain hides
 * the curve while the caption is up.
 * SceneObject names (stable, for tests): LearningCurve (root), LearningCurveLine,
 * LearningCurveCaption, LearningCurveLabel_0..LearningCurveLabel_4 (oldest left).
 */

import { curvePoints, HISTORY_CAPTION, HISTORY_MAX, HistoryScore, scoreLabel } from "./CaseLightHistory"
import { addMeshObject, MeshAccumulator, RGBA } from "./CaseLightMeshUtil"

/** Curve centre in the RoutePicker's frame (cm), measured from the opening pose. */
const CURVE_LOCAL = new vec3(-3.47, 1.66, 0.6)
/** Plot area (cm): the points' slots across, score 0 to 1 up. */
const PLOT_W_CM = 4.0
const PLOT_H_CM = 0.85
const PLOT_CENTRE_Y_CM = -0.02
const CAPTION_Y_CM = 0.95
const LABEL_Y_CM = -0.82
const LINE_T_CM = 0.06
const DOT_CM = 0.17
const LABEL_CAP_CM = 0.28
const CAPTION_CAP_CM = 0.28
const EM_PER_CM = 43.886
const CAP_PER_EM = 0.7
const LINE_COLOR: RGBA = [0.88, 0.9, 0.96, 1]
const LABEL_COLOR = new vec4(0.88, 0.9, 0.96, 1)
const CAPTION_COLOR = new vec4(0.75, 0.78, 0.86, 1)

export class CaseLightHistoryView {
  private readonly root: SceneObject
  private line: RenderMeshVisual | null = null
  private readonly material: Material
  private readonly caption: Text
  private readonly labels: Text[] = []
  private shownLabels: string[] = []

  constructor(parent: SceneObject, material: Material) {
    this.root = global.scene.createSceneObject("LearningCurve")
    this.root.setParent(parent)
    this.root.getTransform().setLocalPosition(CURVE_LOCAL)
    this.material = material
    this.caption = this.addText("LearningCurveCaption", HISTORY_CAPTION, new vec3(0, CAPTION_Y_CM, 0), CAPTION_CAP_CM, PLOT_W_CM, CAPTION_COLOR)
    for (let i = 0; i < HISTORY_MAX; i++) {
      this.labels.push(this.addText(`LearningCurveLabel_${i}`, "", new vec3(0, LABEL_Y_CM, 0), LABEL_CAP_CM, PLOT_W_CM / HISTORY_MAX, LABEL_COLOR))
    }
    this.root.enabled = false
  }

  /** True while the curve is drawn. */
  get isShown(): boolean {
    return this.root.enabled
  }

  /** The score labels drawn, left to right (empty while hidden). */
  get labelTexts(): string[] {
    return this.root.enabled ? this.shownLabels.slice() : []
  }

  /** Draw these points (oldest at the start), or hide everything when the list is empty. */
  show(list: readonly HistoryScore[]): void {
    if (list.length === 0) {
      this.root.enabled = false
      this.shownLabels = []
      return
    }
    const pts = curvePoints(list, PLOT_W_CM, PLOT_H_CM).map((p) => ({ x: p.x, y: p.y + PLOT_CENTRE_Y_CM }))
    const m = new MeshAccumulator()
    for (let i = 0; i + 1 < pts.length; i++) segment(m, pts[i], pts[i + 1], LINE_T_CM, LINE_COLOR)
    for (const p of pts) m.addQuadZ(p.x - DOT_CM / 2, p.y - DOT_CM / 2, p.x + DOT_CM / 2, p.y + DOT_CM / 2, 0.01, LINE_COLOR)
    if (this.line) this.line.mesh = m.finish()
    else this.line = addMeshObject(this.root, "LearningCurveLine", m.finish(), this.material)
    this.shownLabels = []
    for (let i = 0; i < HISTORY_MAX; i++) {
      const t = this.labels[i]
      const on = i < pts.length
      t.getSceneObject().enabled = on
      if (!on) continue
      t.text = scoreLabel(list[i])
      t.getSceneObject().getTransform().setLocalPosition(new vec3(pts[i].x, LABEL_Y_CM, 0))
      this.shownLabels.push(t.text)
    }
    this.root.enabled = true
  }

  private addText(name: string, text: string, local: vec3, capCm: number, widthCm: number, color: vec4): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(this.root)
    so.getTransform().setLocalPosition(local)
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    t.size = (capCm / CAP_PER_EM) * EM_PER_CM
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    const h = capCm * 2
    t.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -h / 2, h / 2)
    t.textFill.color = color
    return t
  }
}

/** A thin flat bar from a to b (facing +Z), as two triangles. */
function segment(m: MeshAccumulator, a: { x: number; y: number }, b: { x: number; y: number }, t: number, color: RGBA): void {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 1e-6) return
  const nx = (-dy / len) * (t / 2)
  const ny = (dx / len) * (t / 2)
  const p0 = [a.x - nx, a.y - ny]
  const p1 = [b.x - nx, b.y - ny]
  const p2 = [b.x + nx, b.y + ny]
  const p3 = [a.x + nx, a.y + ny]
  m.addTriangleZ(p0, p1, p2, 0, color)
  m.addTriangleZ(p0, p2, p3, 0, color)
}
