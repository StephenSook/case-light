// Owns: the LEAF check of rule CF1: re-placing the case mid-pass (on a wall, then with Place in front of me) keeps everything: the pass, the score counts, the next letter, the remaining bundle, a letter in hand, and the letters already placed (they move with the case).
// Talks to: CaseLightLeafSupport (real SIK grab/drop and UIKit presses, two LEAF interactors), CaseLightWallSupport (our own HitTestSession, test ray), CaseLightMain read-only getters (mode, counts, bundleOrder, placedThisPass, topPieceIndex, heldPieceIndex, litSlotIndex, isPiecePlaced, placement read-outs), the Piece_n and CaseRoot scene objects.
// Must not: call CaseLightMain's or CaseLightPlacement's commands or test hooks, or change product state except through real input.

/**
 * Rule CF1 (coordinator, pre-approved for Stephen): a re-place keeps the pass (practice or recall),
 * the score counts, which letter is next / on top, the letter in hand, and the placed letters
 * (rigidly, with the case). Only Again resets; a recall miss changes only that letter's helped state.
 *
 * Flow, all REAL input: Start recall at the room origin; place one letter right, miss one (it comes
 * back to the hand). Then the user walks toward the wall: the scenario waits (bounded) for the
 * camera to come within 3 m of the Sunlit Room wall, which in the preview is MovePreviewCamera
 * setPosition (0, 0, -350) issued while the scenario waits. Re-place 1: Place on wall + pinch on the
 * wall. Re-place 2: Place in front of me, pressed by a SECOND LEAF interactor while the other one
 * holds the top letter (v0.6 feature 2: the missed letter is 3rd in line by then, so the letter in
 * hand is our model's top letter, and the missed letter comes back later and counts as helped). After each re-place every item below must be unchanged:
 *   mode, unaided / helped / total, placedThisPass, top letter, pass order, remaining bundle, lit
 *   answer, held letter (re-place 2), and every placed letter's pose relative to CaseRoot.
 * Then the held letter is dropped on its separation and the pass finished; the final score must be
 * the test's own count: unaided n - 1, helped 1, total n, card "From memory: n-1 of n this session".
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {nextFrame, sleep} from "Leaf.lspkg/Utils/common/Utils"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {CaseLightMain} from "../CaseLightMain"
import {CaseLightLeafInteractor, dropSlotFor, expectedResult, fmt, hideLeafOverlay, log, mustFind, neighbourSlot, targetOf, waitForReady, waitForTopGrabbable, waitUntil} from "./CaseLightLeafSupport"
import {modelComeBack} from "./CaseLightRecallSupport"
import {AIM_PITCH_DEG, AIM_YAW_DEG, BAND_MAX_CM, BAND_MIN_CM, NEEDED_ROOM, WALL_WAIT_MS, ownHit, ownSession, quatAngleDeg, testRay} from "./CaseLightWallSupport"

const WALK_WAIT_MS = 150000

interface PassState {
  mode: string
  unaided: number
  helped: number
  total: number
  placedThisPass: number
  top: number
  held: number
  order: string
  remaining: string
  lit: number
  /** Placed letters' poses in CaseRoot's frame. */
  placed: Map<number, {p: vec3; r: quat}>
}

function readState(main: CaseLightMain): PassState {
  const inv = main.caseRoot.getTransform().getInvertedWorldTransform()
  const rootRot = main.caseRoot.getTransform().getWorldRotation()
  const placed = new Map<number, {p: vec3; r: quat}>()
  for (let i = 0; i < main.pieceCount; i++) {
    if (!main.isPiecePlaced(i)) continue
    const t = mustFind(`Piece_${i}`).getTransform()
    placed.set(i, {p: inv.multiplyPoint(t.getWorldPosition()), r: rootRot.invert().multiply(t.getWorldRotation())})
  }
  const order = main.bundleOrder
  return {
    mode: main.mode,
    unaided: main.unaidedCount,
    helped: main.helpedCount,
    total: main.totalCount,
    placedThisPass: main.placedThisPass,
    top: main.topPieceIndex,
    held: main.heldPieceIndex,
    order: JSON.stringify(order),
    remaining: JSON.stringify(main.currentPassOrder),
    lit: main.litSlotIndex,
    placed,
  }
}

function fmtState(s: PassState): string {
  return `mode ${s.mode}, unaided ${s.unaided}, helped ${s.helped}, total ${s.total}, placed this pass ${s.placedThisPass}, top ${s.top}, held ${s.held}, remaining ${s.remaining}, lit ${s.lit}, placed letters ${Array.from(s.placed.keys()).join(",")}`
}

function expectSameState(before: PassState, after: PassState, ctx: string): void {
  expect(after.mode, `${ctx}: mode`).toBe(before.mode)
  expect(after.unaided, `${ctx}: unaided count`).toBe(before.unaided)
  expect(after.helped, `${ctx}: helped count`).toBe(before.helped)
  expect(after.total, `${ctx}: total count`).toBe(before.total)
  expect(after.placedThisPass, `${ctx}: letters placed this pass`).toBe(before.placedThisPass)
  expect(after.top, `${ctx}: top letter`).toBe(before.top)
  expect(after.held, `${ctx}: letter in hand`).toBe(before.held)
  expect(after.order, `${ctx}: pass order`).toBe(before.order)
  expect(after.remaining, `${ctx}: remaining bundle`).toBe(before.remaining)
  expect(after.lit, `${ctx}: lit answer`).toBe(before.lit)
  expect(after.placed.size, `${ctx}: number of placed letters`).toBe(before.placed.size)
  before.placed.forEach((pb, i) => {
    const pa = after.placed.get(i)
    expect(!!pa, `${ctx}: letter ${i} still placed`).toBe(true)
    const dp = pa!.p.distance(pb.p)
    const dr = quatAngleDeg(pa!.r, pb.r)
    expect(dp <= 0.01 && dr <= 0.01, `${ctx}: placed letter ${i} unchanged relative to CaseRoot (${dp.toFixed(4)} cm, ${dr.toFixed(4)} deg)`).toBe(true)
  })
}

@component
export class CaseLightReplaceMidPassScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    const cam = WorldCameraFinderProvider.getInstance()
    const eye0 = cam.getWorldPosition()
    const openRoot = main.caseRoot.getTransform().getWorldPosition()
    const openRot = main.caseRoot.getTransform().getWorldRotation()
    const n = main.pieceCount
    const session = ownSession()
    try {
      // Precondition: the Lens opened at the room origin, the wall out of reach (> 3 m).
      const ray0 = testRay(AIM_YAW_DEG, AIM_PITCH_DEG)
      const pre = await ownHit(session, ray0.start, ray0.end, WALL_WAIT_MS)
      const preDist = pre.hit ? pre.hit.pos.distance(eye0) : NaN
      log(`CF1 precondition: eye ${fmt(eye0)}, wall ${pre.hit ? `${preDist.toFixed(1)} cm away` : "not seen"}`)
      if (!pre.hit || !(preDist > BAND_MAX_CM)) throw new Error(`Precondition failed: this scenario needs ${NEEDED_ROOM} with the preview camera at the room origin when it starts (MovePreviewCamera reset); the wall was ${pre.hit ? `${preDist.toFixed(1)} cm` : "not seen"}.`)

      // ── Recall: one letter right, one miss ───────────────────────────────────────────────
      await ix.pressButton("StartRecallButton")
      expect(main.mode, "recall started").toBe("recall")
      const order = main.bundleOrder
      let ownUnaided = 0
      let ownHelped = 0
      let missPiece = -1
      for (let k = 0; k < order.length && missPiece < 0; k++) {
        const p = await waitForTopGrabbable(main)
        expect(p, `recall letter #${k + 1}`).toBe(order[k])
        if (k >= 1 && !main.isHoldPiece(p)) {
          await ix.dropTopPieceAtSlot(main, neighbourSlot(targetOf(main, p)))
          expect(main.lastDropResult, `letter ${p} deliberate miss`).toBe("miss")
          missPiece = p
        } else {
          await ix.dropTopPieceAtSlot(main, dropSlotFor(main, p))
          expect(main.lastDropResult, `letter ${p} placed`).toBe("correct")
          ownUnaided++
        }
      }
      expect(missPiece >= 0, "a letter was missed").toBe(true)
      // v0.6 feature 2: the missed letter goes back with exactly two letters before it (our model).
      const queue0 = modelComeBack(order.slice(main.placedThisPass))
      await waitForTopGrabbable(main)
      expect(JSON.stringify(main.currentPassOrder), "after the miss: live queue = our model (missed letter 3rd)").toBe(JSON.stringify(queue0))
      const heldLetter = queue0[0]
      await sleep(300)
      const s0 = readState(main)
      log(`CF1 before re-placing: ${fmtState(s0)}`)
      expect(s0.unaided, "own count: unaided so far").toBe(ownUnaided)
      expect(s0.helped, "own count: helped so far").toBe(0)
      expect(s0.lit, "the missed letter's answer is lit").toBe(targetOf(main, missPiece))

      // ── The user walks toward the wall ─────────────────────────────────────────────────────
      log(`CF1 waiting up to ${WALK_WAIT_MS / 1000} s for the user to walk within 3 m of the wall (preview: MovePreviewCamera setPosition 0, 0, -350)`)
      await waitUntil(() => cam.getWorldPosition().distance(eye0) > 100, WALK_WAIT_MS, "the camera moved toward the wall (MovePreviewCamera setPosition 0, 0, -350)")
      for (let i = 0; i < 10; i++) await nextFrame()
      const eye1 = cam.getWorldPosition()
      const ray = testRay(AIM_YAW_DEG, AIM_PITCH_DEG)
      const near = await ownHit(session, ray.start, ray.end, WALL_WAIT_MS)
      const nearDist = near.hit ? near.hit.pos.distance(eye1) : NaN
      log(`CF1 walked: eye ${fmt(eye1)}, wall ${near.hit ? `${nearDist.toFixed(1)} cm away at ${fmt(near.hit.pos)}` : "not seen"}`)
      if (!near.hit || !(nearDist >= BAND_MIN_CM + 10 && nearDist <= BAND_MAX_CM - 10)) throw new Error(`Precondition failed: after the walk the wall must be ${BAND_MIN_CM + 10}..${BAND_MAX_CM - 10} cm away (it is ${near.hit ? `${nearDist.toFixed(1)} cm` : "not seen"}); needs MovePreviewCamera setPosition 0, 0, -350 in ${NEEDED_ROOM}.`)
      expectSameState(s0, readState(main), "after walking (control: walking alone changes nothing)")

      // ── Re-place 1: on the wall ────────────────────────────────────────────────────────────
      await ix.pressButton("PlaceOnWallButton")
      await waitUntil(() => main.placementMode, 1000, "placementMode on")
      ix.aimRay(ray.start, ray.end)
      await waitUntil(() => main.wallAimState === "wall", WALL_WAIT_MS, "the product sees the wall")
      await sleep(600)
      ix.startSelecting()
      for (let i = 0; i < 4; i++) await nextFrame()
      ix.stopSelecting()
      await waitUntil(() => main.placementCount === 1, 2000, "the case placed on the wall")
      for (let i = 0; i < 3; i++) await nextFrame()
      ix.endAim()
      await sleep(300)
      const root1 = main.caseRoot.getTransform().getWorldPosition()
      expect(main.lastPlacementKind, "re-place 1 kind").toBe("wall")
      expect(root1.distance(openRoot) > 100, `control: re-place 1 really moved the case (${root1.distance(openRoot).toFixed(1)} cm)`).toBe(true)
      const s1 = readState(main)
      log(`CF1 after the wall re-place: CaseRoot ${fmt(root1)}; ${fmtState(s1)}`)
      expectSameState(s0, s1, "after re-placing on the wall")

      // ── Re-place 2: Place in front of me, with the missed letter in hand ──────────────────
      const hold = await ix.grabTopPieceAndHold(main)
      expect(hold.piece, "the letter in hand is our model's top letter").toBe(heldLetter)
      await waitUntil(() => main.heldPieceIndex === heldLetter, 1000, "the product reports the letter in hand")
      const sHeld = readState(main)
      const ix2 = new CaseLightLeafInteractor()
      await ix2.pressButton("PlaceInFrontButton")
      await waitUntil(() => main.placementCount === 2, 1000, "Place in front of me placed the case")
      for (let i = 0; i < 5; i++) await nextFrame()
      const root2 = main.caseRoot.getTransform().getWorldPosition()
      const expectedRoot2 = eye1.add(openRoot.sub(eye0))
      const s2 = readState(main)
      log(`CF1 after Place in front of me (letter ${heldLetter} in hand): CaseRoot ${fmt(root2)}, expected ${fmt(expectedRoot2)} (opening offset from the moved head); drag ended ${hold.dragEnded()}; ${fmtState(s2)}`)
      expect(main.lastPlacementKind, "re-place 2 kind").toBe("front")
      expect(root2.distance(expectedRoot2) <= 0.05, `Place in front of me uses the moved head (${root2.distance(expectedRoot2).toFixed(3)} cm from the opening offset)`).toBe(true)
      expect(quatAngleDeg(main.caseRoot.getTransform().getWorldRotation(), openRot) <= 0.05, "Place in front of me: same heading as at open (head yaw unchanged)").toBe(true)
      expect(hold.dragEnded(), "the letter was not dropped by the re-place").toBe(false)
      expectSameState(sHeld, s2, "after Place in front of me with a letter in hand")
      expect(s2.held, "the letter is still in hand").toBe(heldLetter)

      // ── Finish the pass; the score is the test's own count ─────────────────────────────────
      await ix.dropHeldPieceAtSlot(main, hold.it, dropSlotFor(main, heldLetter))
      hold.off()
      expect(main.lastDropResult, `the held letter ${heldLetter} placed after the re-places`).toBe("correct")
      ownUnaided++
      expect(main.unaidedCount, "the held letter counts from memory").toBe(ownUnaided)
      while (main.mode === "recall") {
        const p = await waitForTopGrabbable(main)
        await ix.dropTopPieceAtSlot(main, dropSlotFor(main, p))
        expect(main.lastDropResult, `letter ${p} placed`).toBe("correct")
        if (p === missPiece) ownHelped++
        else ownUnaided++
      }
      expect(ownHelped, "the missed letter came back and counted as helped").toBe(1)
      await sleep(300)
      const shown = (mustFind("ResultText").getComponent("Component.Text") as Text).text
      log(`CF1 final: unaided ${main.unaidedCount}, helped ${main.helpedCount}, total ${main.totalCount}; own count unaided ${ownUnaided}, helped ${ownHelped}, total ${n}; card "${shown}"`)
      expect(main.unaidedCount, "final unaided = own count").toBe(ownUnaided)
      expect(main.helpedCount, "final helped = own count").toBe(ownHelped)
      expect(main.totalCount, "final total = every letter").toBe(n)
      expect(ownUnaided, "own count: every letter but the missed one unaided").toBe(n - 1)
      expect(shown, "score card").toBe(expectedResult(n - 1, n))
      log("CF1 done")
    } finally {
      ix.endAim()
      session.stop()
    }
    await hideLeafOverlay()
  }
}
