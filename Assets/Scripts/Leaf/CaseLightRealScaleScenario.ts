// Owns: the LEAF check of v0.6 item 13b (real scale): the case AS DRAWN at runtime (the CaseLines mesh's own vertices and the printed Label_n positions, in the case's frame, in world cm) against the figures in research/case_spec_and_exceptions.md: one-inch separations, a 40-cell shelf, 6 in between shelves inside the 1974 field range, a 12 in shelf depth; overall width, height and the lower playable shelf's height are printed, not asserted.
// Talks to: CaseLightLeafSupport (drawnWorldBox: a mesh's real vertex data through its world transform; labelText), CaseLightMain read-only (caseRoot, as the frame's origin and rotation only), SIK WorldCameraFinderProvider (the eye), drawn objects CaseLines / Label_n.
// Must not: import CaseLightGeometry or CaseLightCaseMesh (no constants are read), call product commands or test hooks, or change product state.

/**
 * Frame: origin and rotation of the case root, no scale, so a case drawn smaller in the world
 * measures smaller. CaseLines is one mesh of thin boxes, 24 vertices each (6 faces of 4); a box
 * longer in y than across is a vertical bar, and its line is the bar less its thickness. On a
 * playable shelf the dividers are the vertical lines sharing one y range (normal and heavy bars
 * alike), 41 of them: their centres across give every separation width (pitch) and
 * the 40-cell span. Shelf spacing is the step from the lower divider row to the upper one (bottoms
 * and tops). Depth is a board's depth edge (a bar along z ending at the front plane), less its
 * thickness. Positive controls: the same detector run on a 0.9 copy of the vertices reads 0.9 of
 * the pitch and span, and the printed labels sit midway between neighbouring dividers.
 * Sources (research/case_spec_and_exceptions.md): M-41 221.2 one-inch separations, 40 per shelf
 * (VERIFIED); NB-NAT-3233 6 in between shelves, field range 4-11/16 to 7-3/4 in (VERIFIED,
 * historical); vendor shelf 44 x 12 in (REPORTED); overall height and the lower shelf's height
 * above the floor or eye: no USPS source.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {drawnWorldBox, hideLeafOverlay, labelText, log, mustFind, waitForReady} from "./CaseLightLeafSupport"

const IN = 2.54
const PITCH = 1 * IN
const SPAN = 40 * IN
const SPACING = 6 * IN
const SPACING_MIN = (4 + 11 / 16) * IN
const SPACING_MAX = (7 + 3 / 4) * IN
const DEPTH = 12 * IN
const VENDOR_SHELF = 44 * IN

interface Box {
  lo: vec3
  hi: vec3
}

interface Row {
  y0: number
  y1: number
  xs: number[]
}

interface Measure {
  rows: Row[]
  pitch: number
  widths: number[]
  spans: number[]
  spacingBottoms: number
  spacingTops: number
  frontZ: number
  depths: number[]
  depth: number
  width: number
  height: number
  floorY: number
  lowerShelfTopY: number
}

function median(a: number[]): number {
  const s = a.slice().sort((x, y) => x - y)
  return s.length ? s[Math.floor(s.length / 2)] : NaN
}

function boxesOf(pts: vec3[]): Box[] {
  const out: Box[] = []
  for (let b = 0; b + 24 <= pts.length; b += 24) {
    let lo = new vec3(1e9, 1e9, 1e9)
    let hi = new vec3(-1e9, -1e9, -1e9)
    for (let k = b; k < b + 24; k++) {
      const p = pts[k]
      lo = new vec3(Math.min(lo.x, p.x), Math.min(lo.y, p.y), Math.min(lo.z, p.z))
      hi = new vec3(Math.max(hi.x, p.x), Math.max(hi.y, p.y), Math.max(hi.z, p.z))
    }
    out.push({lo, hi})
  }
  return out
}

/** Every measurement from the drawn boxes (case frame, cm). Throws by name when a feature is not found. */
function measure(pts: vec3[]): Measure {
  const boxes = boxesOf(pts)
  // Vertical bars, grouped by their line's y range (within 0.05 cm; the line is the bar less its
  // thickness, so heavy and normal bars of one row share it).
  const bars: {yc: number; len: number; x: number; z: number}[] = []
  for (const b of boxes) {
    const s = b.hi.sub(b.lo)
    if (!(s.y > 5 * Math.max(s.x, s.z) && s.x < 1 && s.z < 1)) continue
    bars.push({yc: (b.lo.y + b.hi.y) / 2, len: s.y - s.x, x: (b.lo.x + b.hi.x) / 2, z: (b.lo.z + b.hi.z) / 2})
  }
  bars.sort((a, b) => a.yc - b.yc || a.len - b.len)
  const groups: {yc: number; len: number; y0: number; y1: number; xs: number[]; zs: number[]}[] = []
  for (const b of bars) {
    let g = groups.find((q) => Math.abs(q.yc - b.yc) < 0.05 && Math.abs(q.len - b.len) < 0.05)
    if (!g) {
      g = {yc: b.yc, len: b.len, y0: b.yc - b.len / 2, y1: b.yc + b.len / 2, xs: [], zs: []}
      groups.push(g)
    }
    g.xs.push(b.x)
    g.zs.push(b.z)
  }
  const rows: Row[] = []
  const zs: number[] = []
  groups.forEach((g) => {
    const sorted = g.xs.slice().sort((a, b) => a - b)
    const xs: number[] = []
    for (const x of sorted) if (xs.length === 0 || x - xs[xs.length - 1] > 0.05) xs.push(x)
    if (xs.length >= 30) {
      rows.push({y0: g.y0, y1: g.y1, xs})
      for (const z of g.zs) zs.push(z)
    }
  })
  rows.sort((a, b) => a.y0 - b.y0)
  if (rows.length !== 2) throw new Error(`measure: expected 2 divider rows (vertical bars sharing one y range, 30 or more across), found ${rows.length}`)
  const widths: number[] = []
  const spans: number[] = []
  for (const r of rows) {
    for (let i = 1; i < r.xs.length; i++) widths.push(r.xs[i] - r.xs[i - 1])
    spans.push(r.xs[r.xs.length - 1] - r.xs[0])
  }
  const frontZ = median(zs)
  // Depth edges: bars along z whose front end is the front plane, going back.
  const depths: number[] = []
  for (const b of boxes) {
    const s = b.hi.sub(b.lo)
    if (!(s.z > 5 * Math.max(s.x, s.y) && s.x < 1)) continue
    if (Math.abs(b.hi.z - s.x / 2 - frontZ) < 0.3 && b.lo.z < frontZ - 5) depths.push(s.z - s.x)
  }
  if (depths.length === 0) throw new Error("measure: no shelf depth edge found (a bar along z ending at the front plane)")
  // Front horizontal lines inside the lower playable row: its strip bottom and its board top.
  const lower = rows[0]
  const tops: number[] = []
  for (const b of boxes) {
    const s = b.hi.sub(b.lo)
    if (!(s.x > 50 && s.y < 1 && s.z < 1)) continue
    const y = (b.lo.y + b.hi.y) / 2
    const z = (b.lo.z + b.hi.z) / 2
    if (Math.abs(z - frontZ) < 0.3 && y > lower.y0 + 1 && y < lower.y1 - 1) tops.push(y)
  }
  if (tops.length === 0) throw new Error("measure: the lower playable shelf's board line was not found")
  let lo = new vec3(1e9, 1e9, 1e9)
  let hi = new vec3(-1e9, -1e9, -1e9)
  for (const p of pts) {
    lo = new vec3(Math.min(lo.x, p.x), Math.min(lo.y, p.y), Math.min(lo.z, p.z))
    hi = new vec3(Math.max(hi.x, p.x), Math.max(hi.y, p.y), Math.max(hi.z, p.z))
  }
  return {
    rows,
    pitch: median(widths),
    widths,
    spans,
    spacingBottoms: rows[1].y0 - rows[0].y0,
    spacingTops: rows[1].y1 - rows[0].y1,
    frontZ,
    depths,
    depth: median(depths),
    width: hi.x - lo.x,
    height: hi.y - lo.y,
    floorY: lo.y,
    lowerShelfTopY: Math.min(...tops),
  }
}

function f2(x: number): string {
  return x.toFixed(2)
}

@component
export class CaseLightRealScaleScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const root = main.caseRoot
    const lines = mustFind("CaseLines")
    let under = false
    for (let so: SceneObject | null = lines; so; so = so.getParent()) if (so.isSame(root)) under = true
    expect(under, "the drawn case mesh CaseLines is under the case root (so the case root frame is the case's own)").toBe(true)

    // The case frame: case root position and rotation, world cm (no scale).
    const origin = root.getTransform().getWorldPosition()
    const rInv = root.getTransform().getWorldRotation().invert()
    const toCase = (w: vec3): vec3 => rInv.multiplyVec3(w.sub(origin))
    const drawn = drawnWorldBox("CaseLines")
    expect(drawn.n % 24, `CaseLines vertices come in boxes of 24 (${drawn.n} vertices)`).toBe(0)
    const pts = drawn.pts.map(toCase)
    const m = measure(pts)
    const eye = toCase(WorldCameraFinderProvider.getInstance().getWorldPosition())
    const shelfBelowEye = eye.y - m.lowerShelfTopY
    const shelfAboveFloor = m.lowerShelfTopY - m.floorY
    const wMin = Math.min(...m.widths)
    const wMax = Math.max(...m.widths)
    log(`SCALE MEASURED (case frame, cm): ${drawn.n} vertices; divider rows ${m.rows.map((r) => `${r.xs.length} dividers y ${f2(r.y0)}..${f2(r.y1)}`).join(", ")}; pitch median ${f2(m.pitch)} (every separation ${f2(wMin)}..${f2(wMax)}, ${m.widths.length} widths); 40-cell spans ${m.spans.map(f2).join(" and ")}; shelf spacing ${f2(m.spacingBottoms)} (bottoms) / ${f2(m.spacingTops)} (tops); depth ${f2(m.depth)} (${m.depths.length} edges, ${f2(Math.min(...m.depths))}..${f2(Math.max(...m.depths))}); overall (outer edge of the drawn lines, 0.15 cm bars included) ${f2(m.width)} x ${f2(m.height)}; lower playable shelf top ${f2(shelfAboveFloor)} above the drawn floor, ${f2(shelfBelowEye)} below the eye`)

    // Positive control 1: the same detector on a 0.9 copy reads 0.9 of the pitch and span.
    const small = measure(pts.map((p) => p.uniformScale(0.9)))
    log(`SCALE control: 0.9 copy reads pitch ${f2(small.pitch)}, spans ${small.spans.map(f2).join(" and ")}`)
    expect(Math.abs(small.pitch - 0.9 * m.pitch) < 0.01 && Math.abs(small.spans[0] - 0.9 * m.spans[0]) < 0.05, "control: the detector reads a 0.9 copy as 0.9 of the pitch and span").toBe(true)
    // Positive control 2: the printed labels sit midway between neighbouring dividers, at the same pitch.
    const labelXs: number[] = []
    let midChecked = 0
    let midWorst = 0
    for (let s = 0; s < 80; s++) {
      const t = labelText(s)
      if (!t || !t.getSceneObject().isEnabledInHierarchy) continue
      const x = toCase(t.getSceneObject().getTransform().getWorldPosition()).x
      const row = m.rows[Math.floor(s / 40)]
      const col = s % 40
      if (col + 1 < row.xs.length) {
        midWorst = Math.max(midWorst, Math.abs(x - (row.xs[col] + row.xs[col + 1]) / 2))
        midChecked++
      }
      if (s % 40 !== 0 && labelText(s - 1)) labelXs.push(x - toCase(labelText(s - 1)!.getSceneObject().getTransform().getWorldPosition()).x)
    }
    const labelPitch = median(labelXs)
    log(`SCALE control: ${midChecked} labels, worst offset from the midpoint of their dividers ${midWorst.toFixed(3)} cm; label pitch ${f2(labelPitch)}`)
    expect(midChecked >= 70 && midWorst < 0.1, `control: every printed label sits midway between its two dividers (worst ${midWorst.toFixed(3)} cm over ${midChecked})`).toBe(true)
    expect(Math.abs(labelPitch - m.pitch) < 0.02, `control: the label spacing (${f2(labelPitch)}) agrees with the divider pitch (${f2(m.pitch)})`).toBe(true)

    // HARD checks: every one is evaluated and logged, then all are asserted together (so one red
    // run names every check that is out).
    const checks: {ok: boolean; what: string}[] = []
    for (let k = 0; k < 2; k++) checks.push({ok: m.rows[k].xs.length === 41, what: `row ${k}: ${m.rows[k].xs.length} dividers, want 41 (40 separations)`})
    checks.push({ok: Math.abs(m.pitch - PITCH) <= 0.05, what: `slot pitch ${f2(m.pitch)} cm within 2.54 +/- 0.05 (one inch, M-41 221.2, VERIFIED)`})
    checks.push({ok: Math.abs(wMin - PITCH) <= 0.05 && Math.abs(wMax - PITCH) <= 0.05, what: `every separation width (${f2(wMin)}..${f2(wMax)}) within 2.54 +/- 0.05`})
    for (let k = 0; k < 2; k++) checks.push({ok: Math.abs(m.spans[k] - SPAN) <= 0.5, what: `row ${k}: 40-cell span ${f2(m.spans[k])} cm within 101.6 +/- 0.5 (40 one-inch separations)`})
    for (const [name, h] of [["bottoms", m.spacingBottoms], ["tops", m.spacingTops]] as [string, number][]) {
      checks.push({ok: h >= SPACING_MIN && h <= SPACING_MAX, what: `shelf spacing (${name}) ${f2(h)} cm inside the 1974 field range ${f2(SPACING_MIN)}..${f2(SPACING_MAX)} (NB-NAT-3233, VERIFIED historical)`})
      checks.push({ok: Math.abs(h - SPACING) <= 0.5, what: `shelf spacing (${name}) ${f2(h)} cm within 15.24 +/- 0.5 (6 in)`})
    }
    checks.push({ok: Math.abs(m.depth - DEPTH) <= 1, what: `shelf depth ${f2(m.depth)} cm within 30.48 +/- 1 (12 in, vendor, REPORTED)`})
    for (const c of checks) log(`SCALE CHECK ${c.ok ? "ok " : "RED"} ${c.what}`)
    const red = checks.filter((c) => !c.ok).map((c) => c.what)
    expect(red.length === 0 ? "none" : red.join("; "), `real-scale hard checks out of tolerance (${red.length} of ${checks.length})`).toBe("none")

    const dW = m.width - VENDOR_SHELF
    log(`SCALE case ${f2(m.width)} x ${f2(m.height)} cm (width vs 44 in vendor shelf: ${dW >= 0 ? "+" : ""}${f2(dW)} cm, REPORTED, printed not asserted; height: no USPS source), slot pitch ${f2(m.pitch)} cm, 40 cells ${f2(m.spans[0])} cm, shelf spacing ${f2(m.spacingBottoms)} cm, depth ${f2(m.depth)} cm, lower playable shelf top ${f2(shelfBelowEye)} cm below the eye and ${f2(shelfAboveFloor)} cm above the drawn floor (design brief, not a USPS figure), real scale: pitch/span/spacing/depth OK`)
    await hideLeafOverlay()
  }
}
