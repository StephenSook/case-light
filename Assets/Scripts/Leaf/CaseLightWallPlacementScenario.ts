// Owns: the LEAF check of v0.6 "put the case on a real wall": Place on wall, aim at a real wall within reach, pinch, and the whole case moves as one rigid body onto that wall (upright, facing the user, lower shelf kept at its opening height to the eye), nothing outside the case moves, a pinch with no hit is refused, and Place in front of me puts it back. While aiming, with the case on the wall and with it placed back in front, every pinchable control passes the shared spacing check (1 deg apart, 2 deg each way) and no control covers a cell or a row label; the controls' group (CaseControls) is the one part that changes relative to the case, by design: its scale follows its eye distance, predicted here from the test's own distances.
// Talks to: CaseLightLeafSupport (real UIKit presses, the LEAF SIK interactor's ray and pinch), CaseLightSpacingSupport and CaseLightTargetSpacing (the spacing census and check), CaseLightWallSupport (our own HitTestSession and drawn measurements), CaseLightMain read-only placement getters, CaseLightPlacementUI read-only getters, scene objects WallAimOutline / PlacementControls.
// Must not: call CaseLightMain's or CaseLightPlacement's commands or test hooks (setPlacing, placeInFront included), or change product state except through real input.

/**
 * Builder change (verified in CaseLightPlacement.ts / CaseLightPlacementUI.ts / CaseLightMain.ts):
 * Place on wall turns on a WorldQuery HitTestSession (filter on) that hit-tests the SIK targeting
 * interactor's ray. A pinch release over a wall (within maxWallTiltDeg of vertical, 50 to 300 cm
 * from the eye) moves CaseRoot so its face sits on the wall at the hit, upright, facing the user,
 * with its height kept relative to the eye. A release with no fresh hit is refused ("no-hit").
 * Place in front of me restores the opening pose relative to the head.
 *
 * Input: REAL. Both buttons are pressed through the UIKit path (LEAF trigger). The aim is the LEAF
 * SIK interactor's own ray (startPoint/endPoint), pointed into the room with no Interactable
 * under it, and the pinch is its trigger. The only change to LEAF's interactor: while aiming it
 * reports isTargeting() = true, as a real SIK hand does in its targeting pose.
 *
 * Ground truth: this scenario runs its OWN HitTestSession (filter off) along the same rays. The
 * product's hit and the drawn case are compared to that, never to the product's own numbers.
 * Precondition (fails with the setup it needs, so a missing wall can never read as a pass): a wall
 * hit along the test ray within WALL_WAIT_MS, 50 to 300 cm from the eye. That needs the preview
 * room Sunlit Room and the preview camera moved toward its wall, e.g. MovePreviewCamera
 * setPosition (0, 0, -350) (the wall is then about 1.6 m away); a LEAF run keeps that camera pose.
 *
 * Before aiming, Place in front of me puts the case in front of the eye: the case opens at its
 * authored place, which in this setup is 293 cm behind the preview camera, and the opening pose is
 * that authored place relative to the design eye (the world origin), so the press lands it 57 cm in
 * front of the eye. Every rigid and fallback check below is relative to that in-front pose. The
 * controls' group scale is predicted at Lens start, in front, on the wall and back in front from
 * the test's own distances over the layout's design distance (57.13 cm), and held while the group
 * is behind the eye (at Lens start in this setup), as the rule says.
 *
 * Our wall normal is the mean of three of our own hits' normals (aim ray, 3 deg right, 3 deg up).
 * Tolerances: hit point 1.0 cm; hit normal and facing 2 deg; face centre on the hit 1.0 cm along
 * the wall and 1.0 cm off the wall plane; upright 0.5 deg; landing vs the last aim outline 0.5 cm
 * and 0.5 deg; lower shelf height 0.2 cm (drawn labels) and 0.05 cm (getter); "unchanged"
 * transforms 0.01 cm, 0.01 deg, 1e-4 scale; fallback pose 0.05 cm and 0.05 deg.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {nextFrame, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {SIK} from "SpectaclesInteractionKit.lspkg/SIK"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {CaseLightPlacementUI} from "../CaseLightPlacementUI"
import {CaseLightLeafInteractor, fmt, hideLeafOverlay, log, mustFind, waitForReady, waitUntil} from "./CaseLightLeafSupport"
import {checkView, controlsClearOfCase} from "./CaseLightSpacingSupport"
import {ourStoreKeys} from "./CaseLightProgressSupport"
import {
  AIM_PITCH_DEG,
  AIM_YAW_DEG,
  BAND_MAX_CM,
  BAND_MIN_CM,
  BUILDER_OPEN_SHELF_CM,
  NEEDED_ROOM,
  TOL_FACE_CM,
  TOL_FACING_DEG,
  TOL_FRONT_CM,
  TOL_FRONT_DEG,
  TOL_HIT_CM,
  TOL_NORMAL_DEG,
  TOL_OUTLINE_CM,
  TOL_OUTLINE_DEG,
  TOL_SAME_CM,
  TOL_SHELF_DRAWN_CM,
  TOL_SHELF_GETTER_CM,
  TOL_UPRIGHT_DEG,
  WALL_WAIT_MS,
  CONTROLS_DESIGN_DISTANCE_CM,
  controlsDesignDistance,
  controlsScaleNow,
  expectControlsScale,
  angleDeg,
  caseRootPose,
  changed,
  deg,
  drawnAxes,
  drawnFace,
  expectRest,
  hintJointPoses,
  insideCaseRoot,
  isAimVisual,
  isInputFeedback,
  labelWorld,
  lowerRowLabelY,
  outsideCaseRoot,
  ownHit,
  ownPlane,
  ownSession,
  quatAngleDeg,
  restSnapshot,
  testRay,
} from "./CaseLightWallSupport"

const SETUP = `${NEEDED_ROOM} with the preview camera within 3 m of its wall (MovePreviewCamera setPosition 0, 0, -350)`

/** A real pinch of the LEAF interactor where its ray points now. */
async function pinch(ix: CaseLightLeafInteractor): Promise<void> {
  ix.startSelecting()
  for (let i = 0; i < 4; i++) await nextFrame()
  ix.stopSelecting()
  for (let i = 0; i < 3; i++) await nextFrame()
}

/** The controls a person pinches with the case placed (the welcome is gone by then). */
const PLACED_REQUIRED = ["OptionsButton", "StartPracticeButton", "StartRecallButton", "ShowMyCaseButton", "RouteButton_1", "RouteButton_2", "PlaceOnWallButton", "PlaceInFrontButton", "VeteranModeButton"]

@component
export class CaseLightWallPlacementScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    const ui = mustFind("PlacementControls").getComponent(CaseLightPlacementUI.getTypeName()) as CaseLightPlacementUI
    const cam = WorldCameraFinderProvider.getInstance()
    const eye = cam.getWorldPosition()
    const caseRoot = main.caseRoot
    const outline = mustFind("WallAimOutline")
    const session = ownSession()

    try {
      // ── Precondition: a real wall within reach along the test ray, in time ─────────────────
      expect(main.placement.minWallDistanceCm, "product band minimum (spec 50 cm)").toBe(BAND_MIN_CM)
      expect(main.placement.maxWallDistanceCm, "product band maximum (spec 300 cm)").toBe(BAND_MAX_CM)
      const ray = testRay(AIM_YAW_DEG, AIM_PITCH_DEG)
      const pre = await ownHit(session, ray.start, ray.end, WALL_WAIT_MS)
      const preDist = pre.hit ? pre.hit.pos.distance(eye) : NaN
      log(`WALL precondition: eye ${fmt(eye)}, ray -> ${fmt(ray.end)}: ${pre.hit ? `hit ${fmt(pre.hit.pos)} (${preDist.toFixed(1)} cm away) normal ${fmt(pre.hit.normal)} tilt ${pre.hit.tiltDeg.toFixed(2)} deg` : "no hit"} (${pre.results} results, ${pre.nulls} empty)`)
      if (!pre.hit) throw new Error(`Precondition failed: no wall hit along the test ray within ${WALL_WAIT_MS} ms (${pre.results} hit-test results, all empty). This scenario needs ${SETUP}; the "Plane" room has no walls, so nothing here can pass.`)
      if (pre.hit.tiltDeg > 15) throw new Error(`Precondition failed: the surface on the test ray is not a wall (tilt ${pre.hit.tiltDeg.toFixed(1)} deg). This scenario needs ${SETUP}.`)
      if (!(preDist >= BAND_MIN_CM + 10 && preDist <= BAND_MAX_CM - 10)) throw new Error(`Precondition failed: the wall is ${preDist.toFixed(1)} cm from the eye, outside ${BAND_MIN_CM + 10}..${BAND_MAX_CM - 10} cm. This scenario needs ${SETUP}.`)
      // Positive control of "no hit is seen as no hit": a ray far off the camera axis.
      const offRay = testRay(40, 0)
      const off = await ownHit(session, offRay.start, offRay.end, 800)
      log(`WALL control: ray 40 deg off the camera axis: ${off.hit ? `hit ${fmt(off.hit.pos)}` : "no hit"} (${off.results} results, ${off.nulls} empty)`)
      expect(off.results > 0 && !off.hit, "control: the 40 deg off-axis ray (used for the no-hit pinch) returns results, all empty").toBe(true)

      // ── a. At open (Lens start), then in front of the eye ────────────────────────────────────
      expect(main.placementMode, "at open: placementMode").toBe(false)
      expect(main.placementCount, "at open: placementCount").toBe(0)
      expect(main.placementRefusedCount, "at open: placementRefusedCount").toBe(0)
      expect(main.lastPlacementKind, "at open: lastPlacementKind").toBe("none")
      expect(main.lastPlacementRefuseReason, "at open: lastPlacementRefuseReason").toBe("none")
      expect(main.lastPlacementHit === null, "at open: no placement hit yet").toBe(true)
      expect(main.wallAimState, "at open: wallAimState").toBe("none")
      expect(ui.isPlaceOnWallOn, "at open: Place on wall toggle off").toBe(false)
      expect(outline.enabled, "at open: aim outline hidden").toBe(false)
      // The controls' group scales with its eye distance over its design distance (from the design
      // eye, the world origin, to the group at the case's authored place). The case is still there now.
      const designDist = controlsDesignDistance()
      log(`WALL controls design distance: ${designDist.toFixed(2)} cm (product ${main.controlsDesignDistanceCm.toFixed(2)})`)
      expect(Math.abs(designDist - CONTROLS_DESIGN_DISTANCE_CM) <= 0.05, `the controls' design distance is the layout's ${CONTROLS_DESIGN_DISTANCE_CM} cm (${designDist.toFixed(2)})`).toBe(true)
      expect(Math.abs(main.controlsDesignDistanceCm - designDist) <= 0.01, `the product's design distance matches (${main.controlsDesignDistanceCm.toFixed(2)})`).toBe(true)
      // At Lens start the scale is 1; it stays 1 while the group is behind the eye (this setup: the
      // camera starts 293 cm past the case's authored place).
      const startScale = expectControlsScale(designDist, "at Lens start (wherever the camera started)", 1)

      // ── Place in front of me, so the case and its controls stand in front of the eye ────────
      // (a carrier who opened the Lens near a wall). The opening pose is the authored place relative
      // to the design eye, so the case lands that far in front of the eye now.
      const authoredRoot = caseRoot.getTransform().getWorldPosition()
      const authoredRot = caseRoot.getTransform().getWorldRotation()
      // The head's yaw (the camera's view direction, flattened); the authored place is for yaw 0.
      const fwd = cam.getTransform().getWorldTransform().multiplyDirection(new vec3(0, 0, -1))
      const headYaw = quat.angleAxis(Math.atan2(-fwd.x, -fwd.z), vec3.up())
      const expectedFront = eye.add(headYaw.multiplyVec3(authoredRoot))
      await ix.pressButton("PlaceInFrontButton")
      await waitUntil(() => main.placementCount === 1, 1000, "a placement after the opening Place in front of me")
      await sleep(200)
      expect(main.lastPlacementKind, "opening Place in front of me: lastPlacementKind").toBe("front")
      const placed0 = main.placementCount
      const frontRoot = caseRoot.getTransform().getWorldPosition()
      const dFront = frontRoot.distance(expectedFront)
      log(`WALL in front: CaseRoot ${fmt(frontRoot)} vs the eye plus its authored offset (turned by the head's yaw) ${fmt(expectedFront)}: ${dFront.toFixed(4)} cm`)
      expect(dFront <= TOL_FRONT_CM, `opening Place in front of me: CaseRoot at the eye plus its authored offset (${dFront.toFixed(4)} cm)`).toBe(true)
      expect(quatAngleDeg(caseRoot.getTransform().getWorldRotation(), headYaw.multiply(authoredRot)) <= TOL_FRONT_DEG, "opening Place in front of me: the authored heading turned by the head's yaw").toBe(true)
      const frontScale = expectControlsScale(designDist, "in front of the eye", startScale.applied)
      expect(Math.abs(frontScale.applied - 1) <= 0.006, `in front of the eye: the controls are at scale 1 (${frontScale.applied.toFixed(4)})`).toBe(true)

      // From here the in-front pose is the reference ("open") for every rigid and fallback check.
      const openPose = caseRootPose(main)
      const rest = restSnapshot(caseRoot)
      const groupKeys: string[] = []
      rest.insideLocal.forEach((_, k) => {
        if (k.slice(-":CaseControls".length) === ":CaseControls") groupKeys.push(k)
      })
      expect(groupKeys.length, `CaseControls found once inside CaseRoot (${groupKeys.join(", ")})`).toBe(1)
      const groupKey = groupKeys[0]
      const openGroupPose = rest.insideLocal.get(groupKey)!
      // The pinch hint's animated hand is left out of the snapshots (it moves by design while nothing
      // is saved); its anchor must still be in them, so the hint as a whole stays rigid with the case.
      const hintAnchors: string[] = []
      rest.insideLocal.forEach((_, k) => {
        if (/:PinchHintAnchor$/.test(k)) hintAnchors.push(k)
      })
      expect(hintAnchors.length, "control: the pinch hint's anchor stays in the rigid snapshot (only its animated hand is left out)").toBe(1)
      // Ambient check: with no input at all, does anything drift on its own?
      const hintBefore = hintJointPoses(caseRoot)
      await sleep(500)
      const ambientOut = changed(rest.outside, outsideCaseRoot(caseRoot))
      const ambientIn = changed(rest.insideLocal, insideCaseRoot(caseRoot, false))
      log(`WALL ambient (0.5 s, no input): outside CaseRoot ${ambientOut.length} drift (${ambientOut.filter(isInputFeedback).length} input feedback), inside ${ambientIn.length}`)
      expect(ambientOut.filter((k) => !isInputFeedback(k)).length + ambientIn.length, "at open, with no input: objects that drift on their own").toBe(0)
      // Control for the hint's exclusion: the hint plays exactly when nothing is saved, and when it
      // plays its hand is there and animating, so leaving its joints out cannot hide a missing hint.
      const hintMoved = changed(hintBefore, hintJointPoses(caseRoot))
      const nothingSaved = ourStoreKeys().length === 0
      log(`WALL pinch hint: nothing saved ${nothingSaved}, playing ${main.pinchHintPlaying}; ${hintBefore.size} hand joints left out of the rigid snapshots, ${hintMoved.length} of them moved in the 0.5 s`)
      expect(main.pinchHintPlaying, "control: the pinch hint plays exactly when nothing is saved").toBe(nothingSaved)
      if (nothingSaved) expect(hintBefore.size > 0 && hintMoved.length > 0, `control: with nothing saved the hint's hand is present and animating (${hintBefore.size} joints, ${hintMoved.length} moved)`).toBe(true)
      const openInsideWorld = insideCaseRoot(caseRoot, true)
      const openShelfDrawn = lowerRowLabelY() - eye.y
      const openGetter = main.openLowerShelfAboveEyeCm
      const localFace = drawnFace(caseRoot.getTransform().getWorldPosition(), caseRoot.getTransform().getWorldTransform().multiplyDirection(new vec3(0, 0, 1)).normalize())
      log(`WALL open: CaseRoot ${fmt(openPose.p)}, eye ${fmt(eye)}, lower row labels ${openShelfDrawn.toFixed(2)} cm above the eye (drawn), getter now ${main.lowerShelfAboveEyeCm.toFixed(2)}, at open ${openGetter.toFixed(2)}; ${rest.outside.size} objects outside CaseRoot, ${rest.insideLocal.size} inside; drawn face finder in case frame: s ${localFace.s.toFixed(3)}, d ${localFace.d.toFixed(3)} (${localFace.faceVerts} of ${localFace.total} vertices)`)
      expect(Math.abs(localFace.d) <= 0.05, `control: the drawn-face finder puts the face at the case's z = 0 (${localFace.d.toFixed(3)} cm)`).toBe(true)
      expect(Math.abs(localFace.s) <= 0.1, `control: the drawn-face finder puts the centre at the case's x = 0 (${localFace.s.toFixed(3)} cm)`).toBe(true)
      expect(Math.abs(openGetter - main.lowerShelfAboveEyeCm) <= TOL_SHELF_GETTER_CM, `at open: lower shelf at its opening height (now ${main.lowerShelfAboveEyeCm.toFixed(2)}, open ${openGetter.toFixed(2)})`).toBe(true)
      expect(Math.abs(openGetter - BUILDER_OPEN_SHELF_CM) <= TOL_SHELF_GETTER_CM, `at open: lower shelf board top ${openGetter.toFixed(2)} cm vs the builder's ${BUILDER_OPEN_SHELF_CM}`).toBe(true)

      // ── Place on wall ───────────────────────────────────────────────────────────────────
      await ix.pressButton("PlaceOnWallButton")
      await waitUntil(() => main.placementMode, 1000, "placementMode on after Place on wall")
      expect(ui.isPlaceOnWallOn, "Place on wall toggle shows on").toBe(true)
      expect(main.placementCount, "the press that turns aiming on places nothing").toBe(placed0)
      expect(main.placementRefusedCount, "the press that turns aiming on refuses nothing").toBe(0)
      expect(caseRootPose(main).p.distance(openPose.p) <= TOL_SAME_CM, "the press that turns aiming on moves nothing").toBe(true)
      // Aiming (Place on wall on): the case has not moved, every pinchable button meets the spacing check.
      checkView("wall placement, aiming", {required: ["PlaceOnWallButton", "PlaceInFrontButton", "VeteranModeButton", "StartPracticeButton", "StartRecallButton"], absent: []})

      // ── f. No hit: a pinch with nothing under the ray is refused and nothing moves ────────
      // The product hit-tests the ray every frame (placement.hitTestCount counts those requests) with
      // WorldQuery's smoothing filter on, and WorldQuery answers at about 5 Hz, so a wall hit from the
      // ray before the swing can linger for a few results. So: one bounded wait for BOTH at least
      // OFF_MIN_NEW_TESTS new product hit tests since the swing AND "none"; on the bound, fail and name
      // the condition that never held (a frozen count can never pass on a stale state). Then "none"
      // must hold on every frame for OFF_HOLD_MS, so a single flicker cannot pass.
      const OFF_MIN_NEW_TESTS = 3
      const OFF_BOUND_MS = 3000
      const OFF_HOLD_MS = 500
      const testsAtSwing = main.placement.hitTestCount
      const swingAt = getTime()
      ix.aimRay(offRay.start, offRay.end)
      let offReached = false
      while ((getTime() - swingAt) * 1000 <= OFF_BOUND_MS) {
        if (main.placement.hitTestCount - testsAtSwing >= OFF_MIN_NEW_TESTS && main.wallAimState === "none") {
          offReached = true
          break
        }
        await nextFrame()
      }
      const offLatencyMs = (getTime() - swingAt) * 1000
      const offDelta = main.placement.hitTestCount - testsAtSwing
      if (!offReached) {
        const why = offDelta < OFF_MIN_NEW_TESTS ? `count did not advance: ${offDelta} new hit tests in ${OFF_BOUND_MS} ms (frozen)` : `still ${main.wallAimState} after ${offDelta} new hit tests in ${OFF_BOUND_MS} ms`
        log(`WALL off axis: ${why}`)
        expect(false, `aiming 40 deg off axis: no hit within ${OFF_BOUND_MS} ms (${why})`).toBe(true)
      }
      const holdAt = getTime()
      let holdFrames = 0
      while ((getTime() - holdAt) * 1000 < OFF_HOLD_MS) {
        await nextFrame()
        holdFrames++
        expect(main.wallAimState, `aiming 40 deg off axis: "none" holds for ${OFF_HOLD_MS} ms (flipped back on hold frame ${holdFrames})`).toBe("none")
      }
      log(`WALL off axis: "none" after ${offLatencyMs.toFixed(0)} ms and ${offDelta} new product hit tests; held ${((getTime() - holdAt) * 1000).toFixed(0)} ms over ${holdFrames} frames (${main.placement.hitTestCount - testsAtSwing} hit tests since the swing)`)
      expect(main.wallAimState, "aiming 40 deg off axis: no hit").toBe("none")
      expect(outline.enabled, "aiming 40 deg off axis: no aim outline").toBe(false)
      await pinch(ix)
      await waitUntil(() => main.placementRefusedCount === 1, 2000, "the release with no hit is refused")
      log(`WALL no-hit: reason ${main.lastPlacementRefuseReason}, refused ${main.placementRefusedCount}, cue "${ui.cueString}" shown ${ui.isCueVisible}`)
      expect(main.lastPlacementRefuseReason, "no-hit pinch: reason").toBe("no-hit")
      expect(main.lastPlacementRefused, "no-hit pinch: lastPlacementRefused").toBe(true)
      expect(main.placementCount, "no-hit pinch: no placement").toBe(placed0)
      expect(ui.cueString, "no-hit pinch: the cue points to the fallback").toBe("No wall seen: Place in front of me")
      expect(ui.isCueVisible, "no-hit pinch: the cue shows").toBe(true)
      expect(main.placementMode, "no-hit pinch: aiming stays on").toBe(true)
      const afterNoHit = caseRootPose(main)
      expect(afterNoHit.p.distance(openPose.p) <= TOL_SAME_CM && quatAngleDeg(afterNoHit.r, openPose.r) <= 0.01, `no-hit pinch: the case did not move (${afterNoHit.p.distance(openPose.p).toFixed(4)} cm)`).toBe(true)
      expectRest(caseRoot, rest, "after the no-hit pinch")

      // ── b. Aim at the wall and release ─────────────────────────────────────────────────────
      ix.aimRay(ray.start, ray.end)
      try {
        await waitUntil(() => main.wallAimState === "wall" && outline.enabled, WALL_WAIT_MS, "the product sees a wall along the test ray")
      } catch (e) {
        throw new Error(`Precondition or product failure: our own session hit a wall at ${fmt(pre.hit.pos)} (${preDist.toFixed(1)} cm) but the product's aim stayed "${main.wallAimState}" for ${WALL_WAIT_MS} ms (needs ${SETUP}).`)
      }
      const targeting = SIK.InteractionManager.getTargetingInteractors()
      const activeTargeting = targeting.filter((it) => it.isActive())
      log(`WALL targeting interactors: ${targeting.map((it) => `${(it as unknown as {getSceneObject?: () => SceneObject}).getSceneObject?.()?.name ?? `input type ${it.inputType}`}${it.isActive() ? "" : " (inactive)"}`).join(", ")}`)
      expect(activeTargeting.length > 0 && (activeTargeting[0] as object) === ix.sik, "the product's interactor (earliest active targeting one) is the LEAF interactor").toBe(true)
      // Hold the aim still so the product's filtered hit settles, then read ours for these exact rays.
      await sleep(900)
      const plane = await ownPlane(session, 1500)
      if (!plane) throw new Error(`Precondition failed: our own wall hits went away while aiming (needs ${SETUP}).`)
      const truth = plane.hit
      const wallN = plane.normal
      const outlineP = outline.getTransform().getWorldPosition()
      const outlineR = outline.getTransform().getWorldRotation()
      log(`WALL aiming: our hit ${fmt(truth.pos)} (${truth.pos.distance(eye).toFixed(1)} cm away); our wall normal (mean of 3 hits) ${fmt(wallN)} (tilt ${deg(Math.asin(Math.min(1, Math.abs(wallN.y)))).toFixed(3)} deg); single-hit normals ${plane.perHitDeg.map((d) => d.toFixed(2)).join("/")} deg off it; plane through the 3 hit positions ${plane.positionPlaneTiltDeg.toFixed(2)} deg off it; outline at ${fmt(outlineP)}; product hit tests ${main.placement.hitTestCount}, results ${main.placement.hitResultCount}`)

      await pinch(ix)
      await waitUntil(() => main.placementCount === placed0 + 1, 2000, "a placement after the pinch release on the wall")
      ix.endAim()
      await sleep(300)

      expect(main.lastPlacementKind, "after the wall pinch: lastPlacementKind").toBe("wall")
      expect(main.placementCount, "after the wall pinch: placementCount").toBe(placed0 + 1)
      expect(main.lastPlacementRefused, "after the wall pinch: not refused").toBe(false)
      expect(main.lastPlacementRefuseReason, "after the wall pinch: refuse reason cleared").toBe("none")
      expect(main.placementRefusedCount, "after the wall pinch: refusedCount still 1 (the no-hit pinch)").toBe(1)
      expect(main.placementMode, "a placement turns aiming off").toBe(false)
      expect(ui.isPlaceOnWallOn, "Place on wall toggle back off").toBe(false)
      expect(outline.enabled, "aim outline hidden after the placement (it was shown while aiming)").toBe(false)
      const hit = main.lastPlacementHit
      const hitN = main.lastPlacementNormal
      expect(!!hit && !!hitN, "a placement hit and normal are recorded").toBe(true)
      const dHit = hit!.distance(truth.pos)
      const dN = angleDeg(hitN!, wallN)
      log(`WALL placed: product hit ${fmt(hit!)} normal ${fmt(hitN!)} vs ours ${fmt(truth.pos)} ${fmt(wallN)}: ${dHit.toFixed(3)} cm, ${dN.toFixed(3)} deg`)
      expect(dHit <= TOL_HIT_CM, `the product used the wall hit (product vs our own hit ${dHit.toFixed(3)} cm, tolerance ${TOL_HIT_CM})`).toBe(true)
      expect(dN <= TOL_NORMAL_DEG, `wall normal matches ours (${dN.toFixed(3)} deg, tolerance ${TOL_NORMAL_DEG})`).toBe(true)
      const face = drawnFace(truth.pos, wallN)
      log(`WALL drawn face vs our hit: along the wall ${face.s.toFixed(3)} cm, off the wall plane ${face.d.toFixed(3)} cm (${face.faceVerts} of ${face.total} vertices on that plane), drawn vertical centre ${face.y.toFixed(2)} vs hit y ${truth.pos.y.toFixed(2)} (height is kept to the eye, not to the hit)`)
      expect(Math.abs(face.s) <= TOL_FACE_CM, `drawn case face centred on the hit along the wall (${face.s.toFixed(3)} cm, tolerance ${TOL_FACE_CM})`).toBe(true)
      expect(Math.abs(face.d) <= TOL_FACE_CM, `drawn case face on the wall plane at the hit (${face.d.toFixed(3)} cm, tolerance ${TOL_FACE_CM})`).toBe(true)
      const placedPose = caseRootPose(main)
      const dOutline = placedPose.p.distance(outlineP)
      const rOutline = quatAngleDeg(placedPose.r, outlineR)
      expect(dOutline <= TOL_OUTLINE_CM && rOutline <= TOL_OUTLINE_DEG, `the case landed where the aim outline showed it just before the pinch (${dOutline.toFixed(3)} cm, ${rOutline.toFixed(3)} deg)`).toBe(true)

      // ── c. Upright, facing the user, lower shelf at its opening height ─────────────────────
      const up = main.caseUpWorld
      const axes = drawnAxes()
      const upDeg = angleDeg(up, vec3.up())
      const upDrawnDeg = angleDeg(axes.up, vec3.up())
      const faceN = main.caseFaceNormalWorld
      const toCam = eye.sub(placedPose.p)
      const toCamFlat = new vec3(toCam.x, 0, toCam.z)
      const facingWall = angleDeg(faceN, wallN)
      const facingDrawn = angleDeg(axes.face, wallN)
      const toCamDeg = angleDeg(new vec3(faceN.x, 0, faceN.z), toCamFlat)
      log(`WALL pose: up ${fmt(up)} (${upDeg.toFixed(3)} deg), drawn up ${upDrawnDeg.toFixed(3)} deg; face ${fmt(faceN)} vs wall normal ${facingWall.toFixed(3)} deg, drawn face ${facingDrawn.toFixed(3)} deg, vs the direction to the camera (level) ${toCamDeg.toFixed(2)} deg`)
      expect(upDeg <= TOL_UPRIGHT_DEG, `upright: caseUpWorld vs world up ${upDeg.toFixed(3)} deg (tolerance ${TOL_UPRIGHT_DEG})`).toBe(true)
      expect(upDrawnDeg <= TOL_UPRIGHT_DEG, `upright as drawn: Label_0 to Label_40 vs world up ${upDrawnDeg.toFixed(3)} deg`).toBe(true)
      expect(facingWall <= TOL_FACING_DEG, `faces out of the wall toward the user: face normal vs our wall normal (flipped to the eye) ${facingWall.toFixed(3)} deg`).toBe(true)
      expect(facingDrawn <= TOL_FACING_DEG, `faces the user as drawn: label row right x up vs our wall normal ${facingDrawn.toFixed(3)} deg`).toBe(true)
      expect(faceN.dot(toCam) > 0 && toCamDeg < 30, `the face points toward the camera (level angle ${toCamDeg.toFixed(2)} deg)`).toBe(true)
      const shelfDrawn = lowerRowLabelY() - eye.y
      log(`WALL shelf: lower row labels ${shelfDrawn.toFixed(3)} cm above the eye (open ${openShelfDrawn.toFixed(3)}); getter ${main.lowerShelfAboveEyeCm.toFixed(3)} (open ${openGetter.toFixed(3)}); hit was ${(truth.pos.y - eye.y).toFixed(2)} cm above the eye`)
      expect(Math.abs(shelfDrawn - openShelfDrawn) <= TOL_SHELF_DRAWN_CM, `lower shelf height to the eye kept, as drawn (${shelfDrawn.toFixed(3)} vs ${openShelfDrawn.toFixed(3)} cm)`).toBe(true)
      expect(Math.abs(main.lowerShelfAboveEyeCm - openGetter) <= TOL_SHELF_GETTER_CM, `lower shelf height to the eye kept, getter (${main.lowerShelfAboveEyeCm.toFixed(3)} vs ${openGetter.toFixed(3)} cm)`).toBe(true)

      // ── The controls on the wall: the spacing check and the clearance from cells and row labels ──
      // Every pinchable control meets the spacing check, and no control covers a cell or a row label.
      // The welcome went with the placement (it stands over the upper row's cells).
      const wallScale = controlsScaleNow(designDist, frontScale.applied)
      const wallDist = wallScale.dist
      const sWall = wallScale.predicted
      const sWallActual = wallScale.applied
      log(`WALL controls on the wall: group ${wallDist.toFixed(2)} cm from the eye, predicted scale ${sWall.toFixed(4)}, applied ${sWallActual.toFixed(4)}`)
      checkView(`case on the wall (${wallDist.toFixed(1)} cm, scale ${sWallActual.toFixed(3)})`, {required: PLACED_REQUIRED, absent: ["ResetProgressButton"]})
      const wallClear = controlsClearOfCase(main)
      log(`SPACING case on the wall: ${wallClear.controls} control rectangles vs ${wallClear.caseItems} cells and row labels; smallest clearance ${wallClear.smallest.toFixed(2)} deg (${wallClear.pair})`)
      expect(wallClear.smallest > 0, `case on the wall: no control covers a cell or a row label (smallest clearance ${wallClear.smallest.toFixed(2)} deg, ${wallClear.pair})`).toBe(true)

      // ── d. Nothing else moves; the case moves as one rigid body ───────────────────────────
      // Except by design the controls' group, whose scale follows its eye distance: this test predicts
      // that scale from its own distances (now over at open) and the product's must match it within its
      // 0.5 percent update step; the group's expected pose in the rigid check is then the opening pose
      // at that scale, and everything else must still be exactly rigid.
      expect(sWall > 1.5, `control: the wall is far enough that the controls must grow (predicted scale ${sWall.toFixed(3)})`).toBe(true)
      expectControlsScale(designDist, "on the wall", frontScale.applied)
      rest.insideLocal.set(groupKey, {p: openGroupPose.p, r: openGroupPose.r, s: vec3.one().uniformScale(sWallActual)})
      expectRest(caseRoot, rest, "after the wall placement")
      // Positive controls: the same comparison sees CaseRoot itself move, and sees its children move in world space.
      const rootMoved = changed(new Map([["CaseRoot", openPose]]), new Map([["CaseRoot", placedPose]]))
      expect(rootMoved.length, `control: the comparison sees CaseRoot move (${rootMoved.join("")})`).toBe(1)
      const worldMoved = changed(openInsideWorld, insideCaseRoot(caseRoot, true)).filter((k) => !isAimVisual(k))
      expect(worldMoved.length >= openInsideWorld.size - 4, `control: the comparison sees CaseRoot's children move in world space (${worldMoved.length} of ${openInsideWorld.size})`).toBe(true)


      // ── e. Fallback: Place in front of me ─────────────────────────────────────────────────
      // The expected distance comes from our own hit, not the product: the face lands on our hit along
      // the wall (case x = 0, z = 0 on the face) with its height kept to the unmoved eye.
      const awayCm = placedPose.p.distance(openPose.p)
      const expectedWall = new vec3(truth.pos.x, openPose.p.y, truth.pos.z)
      const expectedAway = expectedWall.distance(openPose.p)
      log(`WALL away from the in-front pose: ${awayCm.toFixed(2)} cm, predicted from our own hit ${expectedAway.toFixed(2)} cm`)
      expect(Math.abs(awayCm - expectedAway) <= 0.1 * expectedAway, `control: before the fallback the case is as far from its in-front pose as our own hit predicts (${awayCm.toFixed(1)} vs ${expectedAway.toFixed(1)} cm, within 10 percent)`).toBe(true)
      await ix.pressButton("PlaceInFrontButton")
      await waitUntil(() => main.placementCount === placed0 + 2, 1000, "a placement after Place in front of me")
      await sleep(200)
      expect(main.lastPlacementKind, "after Place in front of me: lastPlacementKind").toBe("front")
      expect(main.placementMode, "after Place in front of me: aiming off").toBe(false)
      const backPose = caseRootPose(main)
      const dBack = backPose.p.distance(openPose.p)
      const rBack = quatAngleDeg(backPose.r, openPose.r)
      log(`WALL fallback: CaseRoot ${fmt(backPose.p)} vs open ${fmt(openPose.p)}: ${dBack.toFixed(4)} cm, ${rBack.toFixed(4)} deg (the head has not moved, so the opening pose relative to the head is the opening pose); lower shelf getter ${main.lowerShelfAboveEyeCm.toFixed(3)}; Label_0 ${fmt(labelWorld(0))}`)
      expect(dBack <= TOL_FRONT_CM, `Place in front of me: CaseRoot back at its opening position (${dBack.toFixed(4)} cm)`).toBe(true)
      expect(rBack <= TOL_FRONT_DEG, `Place in front of me: CaseRoot back at its opening rotation (${rBack.toFixed(4)} deg)`).toBe(true)
      const backWorld = changed(openInsideWorld, insideCaseRoot(caseRoot, true)).filter((k) => !isAimVisual(k))
      expect(backWorld.length, `Place in front of me: every case part back where it was drawn at open${backWorld.length ? ` (${backWorld.slice(0, 3).join("; ")})` : ""}`).toBe(0)
      // The controls' group is back at its opening distance, so back at scale 1 (predicted the same way).
      const nearScale = expectControlsScale(designDist, "placed back in front", sWallActual)
      const nearDist = nearScale.dist
      const sNearActual = nearScale.applied
      expect(Math.abs(sNearActual - 1) <= 0.006, `placed back in front: the controls' group is back at scale 1 (applied ${sNearActual.toFixed(4)})`).toBe(true)
      rest.insideLocal.set(groupKey, {p: openGroupPose.p, r: openGroupPose.r, s: vec3.one().uniformScale(sNearActual)})
      expectRest(caseRoot, rest, "after Place in front of me")
      // The case placed in front (a carrier at the case): the same spacing check and clearance.
      checkView(`case placed in front (${nearDist.toFixed(1)} cm, scale ${sNearActual.toFixed(3)})`, {required: PLACED_REQUIRED, absent: ["ResetProgressButton"]})
      const nearClear = controlsClearOfCase(main)
      log(`SPACING case placed in front: ${nearClear.controls} control rectangles vs ${nearClear.caseItems} cells and row labels; smallest clearance ${nearClear.smallest.toFixed(2)} deg (${nearClear.pair})`)
      expect(nearClear.smallest > 0, `case placed in front: no control covers a cell or a row label (smallest clearance ${nearClear.smallest.toFixed(2)} deg, ${nearClear.pair})`).toBe(true)
      log("WALL done")
    } finally {
      ix.endAim()
      session.stop()
    }
    await hideLeafOverlay()
  }
}
