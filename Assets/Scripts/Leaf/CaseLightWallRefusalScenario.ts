// Owns: the LEAF check of v0.6's refusals: a pinch on a real wall outside 50..300 cm from the eye ("Walls within 3 m" / "Step back") or on a surface far from vertical ("Walls only") is refused with the right reason and cue, the warning ring shows instead of the outline, and nothing moves.
// Talks to: CaseLightLeafSupport (real UIKit presses, the LEAF SIK interactor's ray and pinch), CaseLightWallSupport (our own HitTestSession and snapshots), CaseLightMain read-only placement getters, CaseLightPlacementUI read-only getters, scene objects WallAimOutline / WallAimRing.
// Must not: call CaseLightMain's or CaseLightPlacement's commands or test hooks, or change product state except through real input.

/**
 * Which refusal this run proves comes from OUR OWN hit distance along the test ray, measured
 * before the product is touched: beyond 310 cm it must be "too-far", under 40 cm "too-close".
 * Setup: preview room Sunlit Room; camera at the room origin (MovePreviewCamera reset: the wall is
 * about 5 m away) for "too-far", or at (0, 0, -470) for "too-close". A wall inside the band, or no
 * wall at all, fails the precondition by name, so the wrong setup can never read as a pass.
 * Also: a survey of the camera's hit-test cone finds a surface more than 35 deg from vertical (in
 * Sunlit Room from the origin: the ceiling, 14 deg up), and a pinch there must be refused as
 * "not-wall" with the cue "Walls only". In the origin setup no such surface fails the precondition by
 * name; the too-close setup (facing the wall at about 33 cm) has none in view and logs NOT RUN.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {nextFrame, sleep} from "Leaf.lspkg/Utils/common/Utils"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {CaseLightPlacementUI} from "../CaseLightPlacementUI"
import {CaseLightLeafInteractor, fmt, hideLeafOverlay, log, mustFind, waitForReady, waitUntil} from "./CaseLightLeafSupport"
import {AIM_PITCH_DEG, AIM_YAW_DEG, BAND_MAX_CM, BAND_MIN_CM, NEEDED_ROOM, TOL_SAME_CM, WALL_WAIT_MS, caseRootPose, expectRest, ownHit, ownSession, quatAngleDeg, restSnapshot, testRay} from "./CaseLightWallSupport"

const SETUP = `${NEEDED_ROOM} with the preview camera at the room origin (MovePreviewCamera reset) for "too-far", or at (0, 0, -470) for "too-close"`

@component
export class CaseLightWallRefusalScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    const ui = mustFind("PlacementControls").getComponent(CaseLightPlacementUI.getTypeName()) as CaseLightPlacementUI
    const eye = WorldCameraFinderProvider.getInstance().getWorldPosition()
    const caseRoot = main.caseRoot
    const outline = mustFind("WallAimOutline")
    const ring = mustFind("WallAimRing")
    const session = ownSession()
    try {
      expect(main.placement.minWallDistanceCm, "product band minimum (spec 50 cm)").toBe(BAND_MIN_CM)
      expect(main.placement.maxWallDistanceCm, "product band maximum (spec 300 cm)").toBe(BAND_MAX_CM)
      const ray = testRay(AIM_YAW_DEG, AIM_PITCH_DEG)
      const pre = await ownHit(session, ray.start, ray.end, WALL_WAIT_MS)
      if (!pre.hit) throw new Error(`Precondition failed: no wall hit along the test ray within ${WALL_WAIT_MS} ms (${pre.results} results, all empty). This scenario needs ${SETUP}.`)
      const dist = pre.hit.pos.distance(eye)
      const expected = dist > BAND_MAX_CM + 10 ? "too-far" : dist < BAND_MIN_CM - 10 ? "too-close" : ""
      const cue = expected === "too-far" ? "Walls within 3 m" : "Step back"
      log(`REFUSE precondition: eye ${fmt(eye)}, our hit ${fmt(pre.hit.pos)}, ${dist.toFixed(1)} cm away, tilt ${pre.hit.tiltDeg.toFixed(2)} deg: expect "${expected || "(in band: wrong setup)"}"`)
      if (pre.hit.tiltDeg > 15) throw new Error(`Precondition failed: the surface on the test ray is not a wall (tilt ${pre.hit.tiltDeg.toFixed(1)} deg). This scenario needs ${SETUP}.`)
      if (!expected) throw new Error(`Precondition failed: the wall is ${dist.toFixed(1)} cm away, inside or near the accepted band (${BAND_MIN_CM}..${BAND_MAX_CM} cm, 10 cm margin). This scenario needs ${SETUP}.`)

      // Survey of the hit-test cone for a surface that is not a wall (the "Walls only" rule).
      const survey: string[] = []
      let notWall: {yaw: number; pitch: number; pos: vec3; tilt: number} | null = null
      for (const pitch of [-14, -10, -6, 6, 10, 14]) {
        for (const yaw of [-10, 0, 10]) {
          const r = testRay(yaw, pitch)
          const h = await ownHit(session, r.start, r.end, 300, 3)
          if (h.hit && !notWall && h.hit.tiltDeg > main.placement.maxWallTiltDeg + 5) notWall = {yaw, pitch, pos: h.hit.pos, tilt: h.hit.tiltDeg}
          survey.push(h.hit ? `(${yaw},${pitch}) tilt ${h.hit.tiltDeg.toFixed(1)}` : `(${yaw},${pitch}) none`)
        }
      }
      log(`REFUSE cone survey (yaw,pitch deg): ${survey.join("; ")}; earliest surface found more than ${main.placement.maxWallTiltDeg + 5} deg from vertical: ${notWall ? `(${notWall.yaw},${notWall.pitch}) tilt ${notWall.tilt.toFixed(1)} at ${fmt(notWall.pos)}` : "none"}`)
      // The origin setup must offer one (Sunlit Room: the ceiling); the too-close setup faces the wall at 33 cm and cannot.
      if (!notWall && expected === "too-far") throw new Error(`Precondition failed: no surface more than ${main.placement.maxWallTiltDeg + 5} deg from vertical (floor, ceiling, table) inside the camera's hit-test cone, so the "Walls only" rule cannot be checked. This scenario needs ${SETUP}.`)

      expect(main.placementCount, "at open: placementCount").toBe(0)
      expect(main.placementRefusedCount, "at open: placementRefusedCount").toBe(0)
      const openPose = caseRootPose(main)
      const rest = restSnapshot(caseRoot)

      await ix.pressButton("PlaceOnWallButton")
      await waitUntil(() => main.placementMode, 1000, "placementMode on after Place on wall")
      ix.aimRay(ray.start, ray.end)
      await waitUntil(() => main.wallAimState === "not-wall" && ring.enabled, WALL_WAIT_MS, `the product sees the out-of-band wall (aim state "not-wall", ring shown)`)
      await sleep(300)
      const ringP = ring.getTransform().getWorldPosition()
      const dRing = ringP.distance(pre.hit.pos.add(pre.hit.normal.uniformScale(0.5)))
      log(`REFUSE aiming: aim state ${main.wallAimState}, ring at ${fmt(ringP)} (${dRing.toFixed(3)} cm from our hit + 0.5 cm), outline shown ${outline.enabled}`)
      expect(outline.enabled, `aiming at a wall ${dist.toFixed(0)} cm away: no case outline`).toBe(false)
      expect(dRing <= 1.0, `aiming: the warning ring sits on our hit (${dRing.toFixed(3)} cm)`).toBe(true)

      ix.startSelecting()
      for (let i = 0; i < 4; i++) await nextFrame()
      ix.stopSelecting()
      await waitUntil(() => main.placementRefusedCount === 1, 2000, "the release on the out-of-band wall is refused")
      for (let i = 0; i < 3; i++) await nextFrame()
      ix.endAim()
      log(`REFUSE result: reason ${main.lastPlacementRefuseReason}, refused ${main.placementRefusedCount}, placements ${main.placementCount}, cue "${ui.cueString}" shown ${ui.isCueVisible}`)
      expect(main.lastPlacementRefuseReason, `pinch on a wall ${dist.toFixed(0)} cm away: reason`).toBe(expected)
      expect(main.lastPlacementRefused, "refused: lastPlacementRefused").toBe(true)
      expect(main.placementCount, "refused: no placement").toBe(0)
      expect(ui.cueString, "refused: the cue words").toBe(cue)
      expect(ui.isCueVisible, "refused: the cue shows").toBe(true)
      const after = caseRootPose(main)
      const moved = after.p.distance(openPose.p)
      expect(moved <= TOL_SAME_CM && quatAngleDeg(after.r, openPose.r) <= 0.01, `refused: the case did not move (${moved.toFixed(4)} cm)`).toBe(true)
      expectRest(caseRoot, rest, `after the ${expected} refusal`)
      await sleep(1700)
      expect(ui.isCueVisible, "the cue hides after its moment (1.5 s)").toBe(false)

      // "Walls only": a pinch on a surface far from vertical (here the ceiling) is refused.
      expect(main.placementMode, "aiming still on for the next pinch").toBe(true)
      if (notWall) {
        const nw = notWall as {yaw: number; pitch: number; pos: vec3; tilt: number}
        const nwRay = testRay(nw.yaw, nw.pitch)
        ix.aimRay(nwRay.start, nwRay.end)
        await waitUntil(() => main.wallAimState === "not-wall" && ring.enabled, WALL_WAIT_MS, "the product sees the non-wall surface (ring shown)")
        await sleep(300)
        expect(outline.enabled, "aiming at a non-wall surface: no case outline").toBe(false)
        ix.startSelecting()
        for (let i = 0; i < 4; i++) await nextFrame()
        ix.stopSelecting()
        await waitUntil(() => main.placementRefusedCount === 2, 2000, "the release on the non-wall surface is refused")
        for (let i = 0; i < 3; i++) await nextFrame()
        ix.endAim()
        log(`REFUSE not-wall: surface tilt ${nw.tilt.toFixed(1)} deg at ${fmt(nw.pos)}: reason ${main.lastPlacementRefuseReason}, refused ${main.placementRefusedCount}, cue "${ui.cueString}"`)
        expect(main.lastPlacementRefuseReason, "pinch on a surface far from vertical: reason").toBe("not-wall")
        expect(main.placementCount, "not-wall: no placement").toBe(0)
        expect(ui.cueString, "not-wall: the cue words").toBe("Walls only")
        const after2 = caseRootPose(main)
        expect(after2.p.distance(openPose.p) <= TOL_SAME_CM && quatAngleDeg(after2.r, openPose.r) <= 0.01, `not-wall: the case did not move (${after2.p.distance(openPose.p).toFixed(4)} cm)`).toBe(true)
        expectRest(caseRoot, rest, "after the not-wall refusal")
      } else {
        log(`REFUSE not-wall: NOT RUN in the ${expected} setup (no surface far from vertical in view); the origin setup runs it`)
      }

      // Aiming stays on after a refusal; the toggle turns it off.
      expect(main.placementMode, "aiming stays on after a refusal").toBe(true)
      await ix.pressButton("PlaceOnWallButton")
      await waitUntil(() => !main.placementMode, 1000, "Place on wall pressed again turns aiming off")
      expect(main.wallAimState, "aiming off: aim state").toBe("none")
      expect(outline.enabled, "aiming off: outline hidden").toBe(false)
      log(`REFUSE aiming off: ring shown ${ring.enabled} (it stays with the refuse cue for its 1.5 s), cue shown ${ui.isCueVisible}`)
      await sleep(1700)
      expect(ring.enabled || ui.isCueVisible, "aiming off, after the cue's moment: ring and cue hidden").toBe(false)
      log("REFUSE done")
    } finally {
      ix.endAim()
      session.stop()
    }
    await hideLeafOverlay()
  }
}
