// Owns: the shared ground truth and measurements of the wall-placement scenarios: our own hit tests (independent of the product's), the test ray, the drawn case face and axes, and the "nothing else moved / rigid" snapshots.
// Talks to: WorldQueryModule (its own HitTestSession, passed in by each scenario), the SIK camera provider, CaseLightMain read-only getters, drawn scene objects (CaseLines, Label_n).
// Must not: call any product command or test hook, or change product state.

/**
 * Helpers for extra-wall-placement, extra-wall-refusals and extra-replace-mid-pass. Every number a
 * scenario compares the product with comes from here, measured from the scene or from a
 * HitTestSession the scenario owns, never from the product's own placement numbers.
 */
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {nextFrame} from "Leaf.lspkg/Utils/common/Utils"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {CaseLightMain} from "../CaseLightMain"
import {drawnWorldBox, log, mustFind} from "./CaseLightLeafSupport"

export const NEEDED_ROOM = "Sunlit Room (Lens Studio InteractiveResources.bundle/Scenes/Sunlit Room)"
export const WALL_WAIT_MS = 3000
/**
 * Aim of the test ray in the camera frame: right of and above the view centre, so the hit is not
 * straight ahead and not at eye height. Above the eye this room's wall hits are one plane
 * (z = -503.30 at every surveyed point); below it they scatter by centimetres (logged survey).
 */
export const AIM_YAW_DEG = 6
export const AIM_PITCH_DEG = 5
export const RAY_CM = 1000

export const TOL_HIT_CM = 1.0
export const TOL_NORMAL_DEG = 2
export const TOL_FACE_CM = 1.0
export const TOL_UPRIGHT_DEG = 0.5
export const TOL_FACING_DEG = 2.0
/** The outline follows each new hit, so the landing can differ from the last outline seen by one hit's noise. */
export const TOL_OUTLINE_CM = 0.5
export const TOL_OUTLINE_DEG = 0.5
export const TOL_SHELF_DRAWN_CM = 0.2
export const TOL_SHELF_GETTER_CM = 0.05
export const TOL_SAME_CM = 0.01
export const TOL_SAME_DEG = 0.01
export const TOL_SAME_SCALE = 1e-4
export const TOL_FRONT_CM = 0.05
export const TOL_FRONT_DEG = 0.05
export const BUILDER_OPEN_SHELF_CM = -24.8
/** The accepted wall distance band from the eye (coordinator spec, from Snap's 0.5 to 3 m content guidance). */
export const BAND_MIN_CM = 50
export const BAND_MAX_CM = 300

export interface Hit {
  pos: vec3
  normal: vec3
  tiltDeg: number
}

export interface Pose {
  p: vec3
  r: quat
  s: vec3
}

export function deg(rad: number): number {
  return (rad * 180) / Math.PI
}

export function angleDeg(a: vec3, b: vec3): number {
  return deg(Math.acos(Math.max(-1, Math.min(1, a.normalize().dot(b.normalize())))))
}

/**
 * Angle between two rotations. Both are normalised: engine quaternions can carry a norm a hair under
 * 1, and acos near 1 turns that into a false 0.02 deg between two copies of the same rotation.
 */
export function quatAngleDeg(a: quat, b: quat): number {
  const na = Math.sqrt(a.w * a.w + a.x * a.x + a.y * a.y + a.z * a.z)
  const nb = Math.sqrt(b.w * b.w + b.x * b.x + b.y * b.y + b.z * b.z)
  const d = Math.abs(a.w * b.w + a.x * b.x + a.y * b.y + a.z * b.z) / (na * nb)
  return deg(2 * Math.acos(Math.min(1, d)))
}

/** The test ray: from the eye, AIM_YAW/AIM_PITCH off the camera's forward axis, RAY_CM long. */
export function testRay(yawDeg: number, pitchDeg: number): {start: vec3; end: vec3} {
  const cam = WorldCameraFinderProvider.getInstance()
  const y = (yawDeg * Math.PI) / 180
  const p = (pitchDeg * Math.PI) / 180
  const dirCam = new vec3(Math.sin(y) * Math.cos(p), Math.sin(p), -Math.cos(y) * Math.cos(p))
  const dir = cam.getTransform().getWorldTransform().multiplyDirection(dirCam).normalize()
  const start = cam.getWorldPosition()
  return {start, end: start.add(dir.uniformScale(RAY_CM))}
}

/**
 * Our own hit along a ray: hit-test every frame until a surface comes back and the last
 * `settleFrames` results agree, or timeoutMs passes (then null). Normal flipped toward the eye.
 */
export async function ownHit(session: HitTestSession, start: vec3, end: vec3, timeoutMs: number, settleFrames: number = 8): Promise<{hit: Hit | null; results: number; nulls: number; spreadCm: number}> {
  const eye = WorldCameraFinderProvider.getInstance().getWorldPosition()
  let last: WorldQueryHitTestResult | null = null
  let results = 0
  let nulls = 0
  const recent: vec3[] = []
  const endAt = getTime() * 1000 + timeoutMs
  while (getTime() * 1000 < endAt) {
    session.hitTest(start, end, (r: WorldQueryHitTestResult) => {
      results++
      if (!r) {
        nulls++
        return
      }
      last = r
      recent.push(r.position)
      if (recent.length > settleFrames) recent.shift()
    })
    await nextFrame()
    if (recent.length >= settleFrames) break
  }
  if (!last || recent.length === 0) return {hit: null, results, nulls, spreadCm: 0}
  let spread = 0
  for (const p of recent) spread = Math.max(spread, p.distance(recent[recent.length - 1]))
  const r = last as WorldQueryHitTestResult
  let n = r.normal.normalize()
  if (n.dot(eye.sub(r.position)) < 0) n = n.uniformScale(-1)
  return {hit: {pos: r.position, normal: n, tiltDeg: deg(Math.asin(Math.min(1, Math.abs(n.y))))}, results, nulls, spreadCm: spread}
}

/** Every SceneObject under `so` (inclusive), keyed by its index path and name. */
export function collect(so: SceneObject, key: string, out: Map<string, SceneObject>): void {
  out.set(key, so)
  for (let i = 0; i < so.getChildrenCount(); i++) {
    const c = so.getChild(i)
    collect(c, `${key}/${i}:${c.name}`, out)
  }
}

/** World poses of every SceneObject that is not CaseRoot or inside it. */
export function outsideCaseRoot(caseRoot: SceneObject): Map<string, Pose> {
  const all = new Map<string, SceneObject>()
  for (let i = 0; i < global.scene.getRootObjectsCount(); i++) {
    const r = global.scene.getRootObject(i)
    collect(r, `${i}:${r.name}`, all)
  }
  const out = new Map<string, Pose>()
  all.forEach((so, k) => {
    let inside = false
    for (let p: SceneObject | null = so; p; p = p.getParent()) {
      if (p.isSame(caseRoot)) {
        inside = true
        break
      }
    }
    if (inside) return
    const t = so.getTransform()
    out.set(k, {p: t.getWorldPosition(), r: t.getWorldRotation(), s: t.getWorldScale()})
  })
  return out
}

/** Local (or world) poses of every SceneObject inside CaseRoot (CaseRoot itself excluded). */
export function insideCaseRoot(caseRoot: SceneObject, world: boolean): Map<string, Pose> {
  const all = new Map<string, SceneObject>()
  collect(caseRoot, "CaseRoot", all)
  all.delete("CaseRoot")
  const out = new Map<string, Pose>()
  all.forEach((so, k) => {
    const t = so.getTransform()
    out.set(k, world ? {p: t.getWorldPosition(), r: t.getWorldRotation(), s: t.getWorldScale()} : {p: t.getLocalPosition(), r: t.getLocalRotation(), s: t.getLocalScale()})
  })
  return out
}

/** Keys whose pose differs beyond the "unchanged" tolerances (keys in both maps only), with the size of the change. */
export function changed(a: Map<string, Pose>, b: Map<string, Pose>): string[] {
  const out: string[] = []
  a.forEach((pa, k) => {
    const pb = b.get(k)
    if (!pb) return
    const dp = pa.p.distance(pb.p)
    const dr = quatAngleDeg(pa.r, pb.r)
    const ds = pa.s.distance(pb.s)
    if (dp > TOL_SAME_CM || dr > TOL_SAME_DEG || ds > TOL_SAME_SCALE) out.push(`${k} (${dp.toFixed(3)} cm, ${dr.toFixed(3)} deg, scale ${ds.toFixed(5)})`)
  })
  return out
}

export function keyDiff(a: Map<string, Pose>, b: Map<string, Pose>): {added: string[]; removed: string[]} {
  const added: string[] = []
  const removed: string[] = []
  b.forEach((_, k) => {
    if (!a.has(k)) added.push(k)
  })
  a.forEach((_, k) => {
    if (!b.has(k)) removed.push(k)
  })
  return {added, removed}
}

/** SIK's cursor and ray visuals follow the input ray by design: input feedback, not scene content (logged, never hidden). */
export function isInputFeedback(key: string): boolean {
  return key.indexOf(":InteractorCursors") >= 0
}

/** The aim outline and ring are posed in world space while aiming (by design) and hidden afterwards. */
export function isAimVisual(key: string): boolean {
  return key.indexOf(":WallAimOutline") >= 0 || key.indexOf(":WallAimRing") >= 0 || key.indexOf(":PlacementCue") >= 0
}

export function labelWorld(slot: number): vec3 {
  return mustFind(`Label_${slot}`).getTransform().getWorldPosition()
}

/** Mean drawn height (world y) of the lower playable row's cell labels (Label_0..Label_35). */
export function lowerRowLabelY(): number {
  let sum = 0
  for (let s = 0; s <= 35; s++) sum += labelWorld(s).y
  return sum / 36
}

/** The case's axes as drawn: right along the lower row's labels, up from Label_0 to Label_40 (one shelf above). */
export function drawnAxes(): {right: vec3; up: vec3; face: vec3} {
  const right = labelWorld(35).sub(labelWorld(0)).normalize()
  const up = labelWorld(40).sub(labelWorld(0)).normalize()
  return {right, up, face: right.cross(up).normalize()}
}

/** Half width (cm) of the strip around the point, along the wall, whose drawn vertices fix the face plane. */
export const FACE_STRIP_CM = 10

/**
 * Face centre of the drawn case (CaseLines vertices) relative to a point and a normal: s = offset
 * of the drawn horizontal centre along the wall (horizontal tangent), d = offset of the drawn face
 * plane from the point along the normal, y = drawn vertical centre. The face plane is found from
 * the vertices within FACE_STRIP_CM of the point along the wall (so a small angle between the
 * case and the given normal does not smear it): the busiest 0.1 cm bin there, then the mean of the
 * vertices within 0.5 cm of it (lines are thin boxes centred on the face, so both sides count).
 * d is NaN when no drawn vertex lies in that strip.
 */
export function drawnFace(origin: vec3, normal: vec3): {s: number; d: number; y: number; faceVerts: number; total: number} {
  const pts = drawnWorldBox("CaseLines").pts
  const tangent = vec3.up().cross(normal).normalize()
  let sMin = 1e9
  let sMax = -1e9
  let yMin = 1e9
  let yMax = -1e9
  const bins = new Map<number, number>()
  const near: number[] = []
  for (const w of pts) {
    const v = w.sub(origin)
    const s = v.dot(tangent)
    sMin = Math.min(sMin, s)
    sMax = Math.max(sMax, s)
    yMin = Math.min(yMin, w.y)
    yMax = Math.max(yMax, w.y)
    if (Math.abs(s) > FACE_STRIP_CM) continue
    const d = v.dot(normal)
    near.push(d)
    const k = Math.round(d * 10)
    bins.set(k, (bins.get(k) ?? 0) + 1)
  }
  let best = 0
  let bestCount = 0
  bins.forEach((c, k) => {
    if (c > bestCount) {
      bestCount = c
      best = k
    }
  })
  let sum = 0
  let n = 0
  for (const d of near) {
    if (Math.abs(d - best / 10) <= 0.5) {
      sum += d
      n++
    }
  }
  return {s: (sMin + sMax) / 2, d: n ? sum / n : NaN, y: (yMin + yMax) / 2, faceVerts: n, total: pts.length}
}

/**
 * Our own wall normal: hits along the aim ray and two rays 3 deg to the side and 3 deg up; the
 * normal is the mean of their three surface normals (each flipped to the eye), which halves a
 * single hit's scatter. (A plane through the three hit POSITIONS is not used: in this room the
 * hit positions are off one plane by centimetres, an apparent tilt near 6 deg; logged.)
 * Null if any of the three rays finds no surface.
 */
export async function ownPlane(session: HitTestSession, timeoutMs: number): Promise<{hit: Hit; normal: vec3; perHitDeg: number[]; spreadCm: number; positionPlaneTiltDeg: number} | null> {
  const eye = WorldCameraFinderProvider.getInstance().getWorldPosition()
  const rays = [testRay(AIM_YAW_DEG, AIM_PITCH_DEG), testRay(AIM_YAW_DEG + 3, AIM_PITCH_DEG), testRay(AIM_YAW_DEG, AIM_PITCH_DEG + 3)]
  const hits: Hit[] = []
  let spread = 0
  for (const r of rays) {
    const h = await ownHit(session, r.start, r.end, timeoutMs)
    if (!h.hit) return null
    hits.push(h.hit)
    spread = Math.max(spread, h.spreadCm)
  }
  const n = hits[0].normal.add(hits[1].normal).add(hits[2].normal).normalize()
  let pn = hits[1].pos.sub(hits[0].pos).cross(hits[2].pos.sub(hits[0].pos)).normalize()
  if (pn.dot(eye.sub(hits[0].pos)) < 0) pn = pn.uniformScale(-1)
  return {hit: hits[0], normal: n, perHitDeg: hits.map((h) => angleDeg(h.normal, n)), spreadCm: spread, positionPlaneTiltDeg: angleDeg(pn, n)}
}

export function caseRootPose(main: CaseLightMain): Pose {
  const t = main.caseRoot.getTransform()
  return {p: t.getWorldPosition(), r: t.getWorldRotation(), s: t.getWorldScale()}
}


/** Our own HitTestSession: filter off (the raw surface), started before any hit test. Stop it when done. */
export function ownSession(): HitTestSession {
  const wq = require("LensStudio:WorldQueryModule") as WorldQueryModule
  const opts = HitTestSessionOptions.create()
  opts.filter = false
  const session = wq.createHitTestSessionWithOptions(opts)
  session.start()
  return session
}

/** Snapshot of everything a re-place may not change: world poses outside CaseRoot, local poses inside it. */
export interface RestSnapshot {
  outside: Map<string, Pose>
  insideLocal: Map<string, Pose>
}

export function restSnapshot(caseRoot: SceneObject): RestSnapshot {
  return {outside: outsideCaseRoot(caseRoot), insideLocal: insideCaseRoot(caseRoot, false)}
}

/**
 * Nothing outside CaseRoot moved (input feedback aside, logged) and nothing inside CaseRoot moved
 * relative to CaseRoot (the aim visuals and the refuse cue aside: they are posed in world space by
 * design). `skipInside` names keys allowed to move inside (for example a letter in hand).
 */
export function expectRest(caseRoot: SceneObject, snap: RestSnapshot, ctx: string, skipInside: (key: string) => boolean = () => false): void {
  const out = outsideCaseRoot(caseRoot)
  const moved = changed(snap.outside, out)
  const feedback = moved.filter(isInputFeedback)
  const other = moved.filter((k) => !isInputFeedback(k))
  const kd = keyDiff(snap.outside, out)
  log(`WALL ${ctx}: outside CaseRoot ${out.size} objects, moved ${other.length}${other.length ? `: ${other.join("; ")}` : ""}; input feedback moved ${feedback.length}; added ${kd.added.length}${kd.added.length ? ` (${kd.added.join(", ")})` : ""}, removed ${kd.removed.length}`)
  expect(other.length, `${ctx}: objects outside CaseRoot that moved${other.length ? ` (${other.slice(0, 4).join("; ")})` : ""}`).toBe(0)
  const inside = insideCaseRoot(caseRoot, false)
  const movedIn = changed(snap.insideLocal, inside)
  const allowed = movedIn.filter((k) => isAimVisual(k) || skipInside(k))
  const otherIn = movedIn.filter((k) => !isAimVisual(k) && !skipInside(k))
  const kdi = keyDiff(snap.insideLocal, inside)
  log(`WALL ${ctx}: inside CaseRoot ${inside.size} objects, local change ${otherIn.length}${otherIn.length ? `: ${otherIn.join("; ")}` : ""}; allowed (aim visuals, cue, named) ${allowed.length}; added ${kdi.added.length}${kdi.added.length ? ` (${kdi.added.join(", ")})` : ""}, removed ${kdi.removed.length}`)
  expect(otherIn.length, `${ctx}: CaseRoot children that moved relative to CaseRoot (not rigid)${otherIn.length ? ` (${otherIn.slice(0, 4).join("; ")})` : ""}`).toBe(0)
}

/** Distance (cm) from the eye to our own hit along the test ray, or null with the reason logged. */
export async function ownWallDistance(session: HitTestSession, timeoutMs: number): Promise<{hit: Hit | null; distCm: number; results: number}> {
  const ray = testRay(AIM_YAW_DEG, AIM_PITCH_DEG)
  const h = await ownHit(session, ray.start, ray.end, timeoutMs)
  const eye = WorldCameraFinderProvider.getInstance().getWorldPosition()
  return {hit: h.hit, distCm: h.hit ? h.hit.pos.distance(eye) : NaN, results: h.results}
}
