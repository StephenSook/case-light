// Owns: the LEAF check of the core loop driven by LEAF's IK body (two IK-solved hands and a head that turns toward a target): at Lens start with nothing saved, Start practice, the practice glow and a placement in the lit slot, Start recall, a placement from memory, and a miss that lights the answer, every press made by an IK hand and every letter carried by an IK drag.
// Talks to: LEAF (IKBodyInteractor built with no fallback and its two IKHandInteractors, DiagnosticRecorder, ArmModel reach constants), SIK (InteractionManager hand interactors, Interactable and InteractableManipulation events, read only), CaseLightLeafSupport (printed answers, glow, label and arrow checks, eye-ray aim), CaseLightPlacementLogScenario's log reader, CaseLightMain read-only getters.
// Must not: route a step through simulated SIK input (no fallback, no DefaultLeafInteractor), move the case or shift a target to make it reachable, call CaseLightMain's test hooks or commands, or leave the camera turned (any IK head turn is undone at the end).

/**
 * Input: LEAF's IKBodyInteractor only (no Bitmoji avatar: it needs a network download).
 * - Letters: body.drag(letter, delta, hand). delta takes the letter to the point on the eye ray
 *   through the chosen cell at the letter's own depth (the Lens's drop rule).
 * - Buttons: body.left / body.right .trigger(button, false), the body's own IK hand with LEAF's
 *   direct (pinch) strategy, whose reach checks still run. body.trigger(button, hand) is not used
 *   for buttons: it picks LEAF's indirect (ray) strategy because the button centres are 74.5 to
 *   77.6 cm from either IK shoulder, past the 67.5 cm wrist reach, and that strategy parks the
 *   wrist at full reach with the index tip in the button row, so SIK's near-field poke lands on
 *   the neighbouring button (measured 2026-11-03: aiming at Start practice, either hand poked
 *   Start recall for about 100 frames, the ray never converged, and the poke started a recall
 *   pass). PRESS_HOW = "auto" switches back to body.trigger to show it. On a device these buttons
 *   are ray targets; the IK hand pressing them directly stands in for that. Letter grabs and drops
 *   stay pure IK.
 * - The hand is picked per target: left for points left of the case's centre, right otherwise.
 *
 * No faking: the body is built with no `fallback`, and the run sets LEAF's diagnostic policy to
 * fail-fast, so a reach, field-of-view, target-missing or timeout diagnostic throws where it fires
 * and the run is red; nothing is routed to simulated SIK input.
 * Proof that the IK path drove each step, read from SIK events and product logs (no test hooks):
 * - every Interactable event on a pressed button or a carried letter (trigger start and end, drag
 *   start and end) came from the SIK hand interactor LEAF patched for that hand
 *   (SIK.InteractionManager.getInteractorsByType(...)[0], the one IKHandInteractor drives);
 * - each letter's InteractableManipulation grab lists exactly that interactor, and the release
 *   the product scores follows it;
 * - while it worked, the hand triggered nothing but its target (no stray poke), and each press
 *   started exactly one pass;
 * - LEAF's DiagnosticRecorder holds no entry of any kind for the run (reach, FOV, target missing,
 *   overlap, convergence timeout).
 * Reach is logged per target: the hand, LEAF's own strategy pick, the shoulder-to-target distance
 * from the IK arm's own shoulder keypoint against LEAF's direct reach, the elbow angle that
 * distance needs, and the hand's distance to the target when SIK started the press or the grab.
 *
 * Outcomes are the scripted scenarios' own: c2 for practice (the lit slot and its label while the
 * letter is in hand, placed in the right cell, dark after), c3 for recall (dark in hand, the miss
 * lights the answer and its label, with the arrow if the answer is out of view, and the letter is
 * helped), the score counts as deltas, and one placement log line per drop, read with the log
 * scenario's own parser.
 * Needs nothing saved at Lens start (the opening pinch hint is up). It ends no recall pass, so it
 * saves nothing.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {nextFrame, withTimeout} from "Leaf.lspkg/Utils/common/Utils"
import {findInteractableByName} from "Leaf.lspkg/Interactors/InteractableUtils"
import {IKBodyInteractor} from "Leaf.lspkg/Interactors/interactor/ik/IKBodyInteractor"
import {DiagnosticRecorder} from "Leaf.lspkg/Diagnostic/DiagnosticRecorder"
import {elbowAngleDeg} from "Leaf.lspkg/Diagnostic/ReachContext"
import {FOREARM_LENGTH_CM, UPPER_ARM_LENGTH_CM, WRIST_MAX_REACH_CM} from "Leaf.lspkg/IKSolver/ArmModel"
import {Interactable} from "SpectaclesInteractionKit.lspkg/Components/Interaction/Interactable/Interactable"
import {InteractableManipulation} from "SpectaclesInteractionKit.lspkg/Components/Interaction/InteractableManipulation/InteractableManipulation"
import {Interactor, InteractorInputType} from "SpectaclesInteractionKit.lspkg/Core/Interactor/Interactor"
import {SIK} from "SpectaclesInteractionKit.lspkg/SIK"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import {CaseLightMain} from "../CaseLightMain"
import {
  cardText,
  expectArrow,
  expectArrowPointsAt,
  expectGlowAt,
  expectLabelLit,
  expectNoGlow,
  expectNoLabelLit,
  eyeRayPointAtDepthOf,
  fmt,
  hideLeafOverlay,
  log,
  mustFind,
  neighbourSlot,
  pieceInteractable,
  targetOf,
  targetOutsideDisplay,
  waitForReady,
  waitForTopGrabbable,
  waitUntil,
} from "./CaseLightLeafSupport"
import {parseLogLine} from "./CaseLightPlacementLogScenario"

type Hand = "left" | "right"

/** How buttons are pressed: "direct" = the body's IK hand with LEAF's direct strategy; "auto" = body.trigger (see the doc above). */
const PRESS_HOW: "auto" | "direct" = "direct"

/** Longest one IK press or drag may take; a hand that never converges is red, not a hang. */
const IK_STEP_TIMEOUT_MS = 20000

/** The SIK hand interactor LEAF's IKHandInteractor patches and drives for `hand` (same lookup). */
function sikHandInteractor(hand: Hand): Interactor {
  const list = SIK.InteractionManager.getInteractorsByType(hand === "left" ? InteractorInputType.LeftHand : InteractorInputType.RightHand)
  if (list.length === 0) throw new Error(`no SIK ${hand} hand interactor in the scene`)
  return list[0]
}

function inputName(i: Interactor | null): string {
  if (!i) return "none"
  const n = InteractorInputType[i.inputType]
  return n !== undefined ? n : `${i.inputType}`
}

/** Every Interactable event on one target, with the interactor that sent it. */
class TargetEvents {
  readonly events: {name: string; by: Interactor}[] = []
  private readonly offs: (() => void)[] = []

  constructor(it: Interactable) {
    this.offs.push(it.onTriggerStart.add((e) => this.events.push({name: "triggerStart", by: e.interactor})))
    this.offs.push(it.onTriggerEnd.add((e) => this.events.push({name: "triggerEnd", by: e.interactor})))
    this.offs.push(it.onTriggerEndOutside.add((e) => this.events.push({name: "triggerEndOutside", by: e.interactor})))
    this.offs.push(it.onDragStart.add((e) => this.events.push({name: "dragStart", by: e.interactor})))
    this.offs.push(it.onDragEnd.add((e) => this.events.push({name: "dragEnd", by: e.interactor})))
  }

  off(): void {
    for (const o of this.offs) o()
  }

  count(name: string): number {
    return this.events.filter((e) => e.name === name).length
  }

  allBy(i: Interactor): boolean {
    return this.events.length > 0 && this.events.every((e) => e.by === i)
  }

  summary(): string {
    return this.events.length === 0 ? "none" : this.events.map((e) => `${e.name}:${inputName(e.by)}`).join(" ")
  }
}

/** What one SIK hand interactor targets, frame by frame, and whether it was triggering on it. */
class InteractorWatch {
  private readonly seen = new Map<string, number>()
  private running = true
  private readonly done: Promise<void>

  constructor(private readonly sik: Interactor) {
    this.done = this.loop()
  }

  private async loop(): Promise<void> {
    while (this.running) {
      await nextFrame()
      if (!this.running) break
      const ci = this.sik.currentInteractable
      if (!ci || isNull(ci)) continue
      const key = `${ci.getSceneObject().name}${this.sik.isTriggering ? " (triggering)" : ""}`
      this.seen.set(key, (this.seen.get(key) || 0) + 1)
    }
  }

  async stop(): Promise<void> {
    this.running = false
    await this.done
  }

  summary(): string {
    return this.seen.size === 0 ? "nothing" : Array.from(this.seen.entries()).map(([k, n]) => `${k} ${n} frames`).join(", ")
  }

  /** Names of interactables other than `target` the hand was triggering on (a stray poke or pinch). */
  strayTriggers(target: string): string[] {
    const out: string[] = []
    this.seen.forEach((_n, k) => {
      const m = k.match(/^(.*) \(triggering\)$/)
      if (m && m[1] !== target) out.push(m[1])
    })
    return out
  }
}

interface Reach {
  strategy: string
  shoulderCm: number
  elbowDeg: number
}

/** Shoulder-to-point distance from the IK arm's own shoulder keypoint, and the strategy LEAF picks. */
function reachOf(body: IKBodyInteractor, hand: Hand, it: Interactable, point: vec3): Reach {
  const k = body[hand].currentArmKeypoints
  if (!k) throw new Error(`IK ${hand} arm has no keypoints yet`)
  const d = point.sub(k.shoulder).length
  return {strategy: body[hand].isIndirect(it) ? "indirect" : "direct", shoulderCm: d, elbowDeg: elbowAngleDeg(d, UPPER_ARM_LENGTH_CM, FOREARM_LENGTH_CM)}
}

function fmtReach(r: Reach): string {
  return `${r.strategy}, shoulder ${r.shoulderCm.toFixed(1)} cm (direct reach ${WRIST_MAX_REACH_CM.toFixed(1)}), elbow ${r.elbowDeg.toFixed(0)} deg`
}

/** Midpoint of the IK hand's thumb and index tips (its pinch point), or null while untracked. */
function pinchPoint(body: IKBodyInteractor, hand: Hand): vec3 | null {
  const f = body[hand].currentFingerKeypoints
  if (!f) return null
  return f.thumb.tip.add(f.index.tip).uniformScale(0.5)
}

/** Left for points left of the case's centre (case-local x < 0), right otherwise. */
function handFor(world: vec3): Hand {
  const local = mustFind("CaseRoot").getTransform().getInvertedWorldTransform().multiplyPoint(world)
  return local.x < 0 ? "left" : "right"
}

/** Wait until the camera has stopped turning (the IK head has settled on its last target). */
async function waitHeadStill(): Promise<number> {
  const cam = WorldCameraFinderProvider.getInstance().getTransform()
  let prev = cam.getWorldRotation().multiplyVec3(vec3.back())
  let still = 0
  let frames = 0
  while (still < 6) {
    if (frames > 300) throw new Error("the IK head did not settle within 300 frames")
    await nextFrame()
    frames++
    const now = cam.getWorldRotation().multiplyVec3(vec3.back())
    const deg = (Math.acos(Math.max(-1, Math.min(1, now.dot(prev)))) * 180) / Math.PI
    still = deg < 0.01 ? still + 1 : 0
    prev = now
  }
  return frames
}

/** IK press of a button: hand per button position, every event from that hand's SIK interactor. */
async function ikPress(body: IKBodyInteractor, main: CaseLightMain, name: string, how: "auto" | "direct"): Promise<void> {
  const it = findInteractableByName(name, undefined, true)
  if (!it) throw new Error(`Button "${name}" not found or not enabled`)
  const pos = it.getSceneObject().getTransform().getWorldPosition()
  const hand = handFor(pos)
  const r = reachOf(body, hand, it, pos)
  const ev = new TargetEvents(it)
  const watch = new InteractorWatch(sikHandInteractor(hand))
  const linesBefore = main.placementLogLines.length
  let wristAtStart = -1
  const offStart = it.onTriggerStart.add(() => {
    const w = body[hand].currentWristPose
    if (w && wristAtStart < 0) wristAtStart = w.position.distance(pos)
  })
  try {
    if (how === "auto") {
      await withTimeout(body.trigger(it, hand), IK_STEP_TIMEOUT_MS, `IK trigger("${name}", ${hand}) did not complete`)
    } else {
      const done = await withTimeout(body[hand].trigger(it, false), IK_STEP_TIMEOUT_MS, `IK ${hand} hand direct trigger("${name}") did not complete`)
      if (!done) throw new Error(`IK ${hand} hand direct trigger("${name}") stopped by a reach check (see LEAF's diagnostics)`)
    }
  } catch (e) {
    const f = body[hand].currentFingerKeypoints
    const tip = f ? f.index.tip : null
    await watch.stop()
    log(`IKLOOP press ${name} FAILED: ${hand} hand, LEAF's pick ${fmtReach(r)}, pressed ${how}; button at ${fmt(pos)}; index tip ${tip ? `${fmt(tip)}, ${tip.distance(pos).toFixed(1)} cm from the button` : "unknown"}; the hand's SIK interactor targeted ${watch.summary()}; events on the button ${ev.summary()}`)
    throw e
  } finally {
    ev.off()
    offStart()
  }
  await watch.stop()
  const me = sikHandInteractor(hand)
  const passStarts = main.placementLogLines.slice(linesBefore).filter((l) => parseLogLine(l).get("event") === "pass-start").length
  log(`IKLOOP press ${name}: ${hand} hand, LEAF's pick ${fmtReach(r)}, pressed ${how}; wrist to button at trigger start ${wristAtStart.toFixed(1)} cm; the hand's SIK interactor targeted ${watch.summary()}; events ${ev.summary()}; pass-start lines ${passStarts}`)
  expect(ev.count("triggerStart"), `${name}: one trigger start on the button (events ${ev.summary()})`).toBe(1)
  expect(ev.count("triggerEnd"), `${name}: one trigger end on the button, one press (events ${ev.summary()})`).toBe(1)
  expect(ev.allBy(me), `${name}: every event came from the IK ${hand} hand's SIK interactor (events ${ev.summary()})`).toBe(true)
  expect(watch.strayTriggers(name).join(","), `${name}: the hand triggered nothing else on the way (targeted ${watch.summary()})`).toBe("")
  expect(passStarts, `${name}: exactly one pass started`).toBe(1)
}

interface Drop {
  piece: number
  hand: Hand
  heldFrames: number
}

/**
 * IK drag of the top letter so it is let go over `slot` as seen from the eye. `inHand` runs on
 * every frame the product reports the letter in hand; its earliest failure is rethrown after the drag.
 */
async function ikDropTop(body: IKBodyInteractor, main: CaseLightMain, slot: number, ctx: string, inHand: (p: number, frame: number) => void): Promise<Drop> {
  const p = await waitForTopGrabbable(main)
  const it = pieceInteractable(p)
  if (!it) throw new Error(`${ctx}: Piece_${p} not grabbable`)
  const so = it.getSceneObject()
  const t = so.getTransform()
  const from = t.getWorldPosition()
  const dest = eyeRayPointAtDepthOf(main.slotWorldPosition(slot), from)
  // Sanity check of the test's own aim (pure helper, same maths as a real drop).
  const seen = main.slotUnderWorldPoint(dest)
  if (seen !== slot) throw new Error(`Test aim error: drag target for cell ${slot} projects to cell ${seen}`)
  const hand = handFor(main.slotWorldPosition(slot))
  const rFrom = reachOf(body, hand, it, from)
  const rTo = reachOf(body, hand, it, dest)
  const me = sikHandInteractor(hand)

  const man = so.getComponent(InteractableManipulation.getTypeName()) as InteractableManipulation
  if (!man) throw new Error(`${ctx}: Piece_${p} has no InteractableManipulation`)
  let grabs = 0
  let releases = 0
  let grabBy: Interactor[] = []
  let pinchToLetter = -1
  const offGrab = man.onManipulationStart.add((e) => {
    grabs++
    grabBy = e.interactors.slice()
    const pp = pinchPoint(body, hand)
    pinchToLetter = pp ? pp.distance(t.getWorldPosition()) : -1
  })
  const offRelease = man.onManipulationEnd.add(() => releases++)
  const ev = new TargetEvents(it)
  const watch = new InteractorWatch(me)

  let held = 0
  let lastHeld = from
  let earliestErr: unknown = null
  let running = true
  const watcher = (async () => {
    while (running) {
      await nextFrame()
      if (!running || main.heldPieceIndex !== p) continue
      held++
      lastHeld = t.getWorldPosition()
      try {
        inHand(p, held)
      } catch (e) {
        if (earliestErr === null) earliestErr = e
      }
    }
  })()
  try {
    await withTimeout(body.drag(it, dest.sub(from), hand), IK_STEP_TIMEOUT_MS, `${ctx}: IK drag of Piece_${p} toward cell ${slot} (${hand}) did not complete`)
    await waitUntil(() => releases >= 1 && main.heldPieceIndex < 0, 2000, `${ctx}: the product handled the IK release`)
  } catch (e) {
    await watch.stop()
    log(`IKLOOP ${ctx} FAILED: Piece_${p} to cell ${slot} by the ${hand} hand; grab point ${fmtReach(rFrom)}; let-go point ${rTo.shoulderCm.toFixed(1)} cm from the shoulder; grabs ${grabs}, releases ${releases}, ${held} frames in hand; the hand's SIK interactor targeted ${watch.summary()}; events ${ev.summary()}`)
    throw e
  } finally {
    running = false
    offGrab()
    offRelease()
    ev.off()
  }
  await watcher
  await watch.stop()
  log(`IKLOOP ${ctx}: Piece_${p} to cell ${slot} by the ${hand} hand; grab point ${fmtReach(rFrom)}; let-go point ${rTo.shoulderCm.toFixed(1)} cm from the shoulder (elbow ${rTo.elbowDeg.toFixed(0)} deg); pinch point to letter at grab ${pinchToLetter.toFixed(2)} cm; letter on its last held frame ${lastHeld.distance(dest).toFixed(2)} cm from the aim (${fmt(lastHeld)} vs ${fmt(dest)}); ${held} frames in hand; the hand's SIK interactor targeted ${watch.summary()}; events ${ev.summary()}`)
  if (earliestErr !== null) throw earliestErr
  expect(grabs, `${ctx}: one grab of Piece_${p}`).toBe(1)
  expect(grabBy.length === 1 && grabBy[0] === me, `${ctx}: the grab lists only the IK ${hand} hand's SIK interactor (${grabBy.map((i) => inputName(i)).join(",")})`).toBe(true)
  expect(releases, `${ctx}: one release of Piece_${p}`).toBe(1)
  expect(ev.count("triggerStart") >= 1 && ev.count("triggerEnd") + ev.count("triggerEndOutside") >= 1, `${ctx}: the IK pinch started and ended a trigger on Piece_${p} (events ${ev.summary()})`).toBe(true)
  expect(ev.allBy(me), `${ctx}: every event on Piece_${p} came from the IK ${hand} hand's SIK interactor (events ${ev.summary()})`).toBe(true)
  expect(held > 0, `${ctx}: the product had Piece_${p} in hand (${held} frames)`).toBe(true)
  expect(watch.strayTriggers(so.name).join(","), `${ctx}: the hand triggered nothing but Piece_${p} (targeted ${watch.summary()})`).toBe("")
  return {piece: p, hand, heldFrames: held}
}

/** Exactly one new placement line since `linesBefore`, with these fields. */
function expectOnePlacementLine(main: CaseLightMain, linesBefore: number, ctx: string, want: Record<string, string>): void {
  const fresh = main.placementLogLines.slice(linesBefore).map((l) => parseLogLine(l))
  const placements = fresh.filter((f) => !f.has("event"))
  expect(placements.length, `${ctx}: one placement log line for the drop`).toBe(1)
  const f = placements[0]
  for (const key of Object.keys(want)) {
    expect(f.get(key), `${ctx}: log ${key}`).toBe(want[key])
  }
}

function placedToken(slot: number): string {
  return slot >= 36 && slot <= 39 ? "HOLD" : `${slot}`
}

function rightToken(target: number): string {
  return target === -2 ? "HOLD" : `${target}`
}

/** The whole loop; the scenario's run() calls it. */
async function runIkLoop(): Promise<void> {
  const main = await waitForReady()
  if (main.progressWelcomeShown) throw new Error("needs nothing saved at Lens start: run it after a Reset progress (e.g. straight after extra-stand-in-hidden)")
  expect(main.pinchHintShown, "nothing saved at Lens start: the opening pinch hint is up (precondition control)").toBe(true)
  expect(main.mode, "idle at Lens start").toBe("idle")

  const rec = DiagnosticRecorder.getInstance()
  rec.setPolicy("fail-fast")
  expect(rec.policy, "LEAF diagnostic policy for this run").toBe("fail-fast")
  expect(rec.getAll().length, "no LEAF diagnostic before the IK body exists").toBe(0)

  const camT = WorldCameraFinderProvider.getInstance().getTransform()
  const camPos0 = camT.getWorldPosition()
  const camRot0 = camT.getWorldRotation()
  const rootT = mustFind("CaseRoot").getTransform()
  const rootPos0 = rootT.getWorldPosition()
  const rootRot0 = rootT.getWorldRotation()
  const left = sikHandInteractor("left")
  const right = sikHandInteractor("right")
  expect(left !== right, "two distinct SIK hand interactors").toBe(true)

  const body = new IKBodyInteractor()
  try {
    await body.ready
    await waitUntil(() => !!body.left.currentArmKeypoints && !!body.right.currentArmKeypoints, 30000, "IK arms have keypoints")
    const sh = (h: Hand) => body[h].currentArmKeypoints!.shoulder
    log(`IKLOOP body: eye ${fmt(camPos0)}, left shoulder ${fmt(sh("left"))}, right shoulder ${fmt(sh("right"))}, CaseRoot ${fmt(rootPos0)}`)

    // 1. Start practice with an IK trigger.
    await ikPress(body, main, "StartPracticeButton", PRESS_HOW)
    expect(main.mode, "practice started by the IK press").toBe("practice")

    // 2. Practice: the top letter's slot glows while it is in hand; an IK drag puts it there.
    const p0 = await waitForTopGrabbable(main)
    const t0 = targetOf(main, p0)
    const slot0 = t0 === -2 ? 37 : t0
    const lines0 = main.placementLogLines.length
    const d0 = await ikDropTop(body, main, slot0, "practice", (p, frame) => {
      expectGlowAt(main, t0, `practice: Piece_${p} in hand (frame ${frame})`)
      expectLabelLit(main, t0, `practice: Piece_${p} in hand (frame ${frame})`)
    })
    expect(main.lastDropResult, `practice: Piece_${p0} placed`).toBe("correct")
    expect(main.lastDropSlot, `practice: Piece_${p0} let go over its cell`).toBe(slot0)
    expect(main.isPiecePlaced(p0), `practice: Piece_${p0} stands in the case`).toBe(true)
    expectNoGlow(main, "practice: after placing")
    expectNoLabelLit(main, "practice: after placing")
    expectOnePlacementLine(main, lines0, "practice", {mode: "practice", piece: `${p0}`, address: cardText(p0, "AddressText").text, placed: placedToken(slot0), right: rightToken(t0), result: "correct", memory: "0"})
    log(`IKLOOP practice: Piece_${p0} placed in cell ${slot0} (lit while in hand on all ${d0.heldFrames} frames)`)

    // 3. Start recall with an IK trigger.
    await waitForTopGrabbable(main)
    await ikPress(body, main, "StartRecallButton", PRESS_HOW)
    expect(main.mode, "recall started by the IK press").toBe("recall")
    await waitForTopGrabbable(main)
    expectNoGlow(main, "recall start")
    expectNoLabelLit(main, "recall start")

    const dark = (c: string) => {
      expectNoGlow(main, c)
      expectNoLabelLit(main, c)
    }

    // 4. The top recall letter placed right from memory: correct, unaided.
    const p1 = await waitForTopGrabbable(main)
    const t1 = targetOf(main, p1)
    const slot1 = t1 === -2 ? 37 : t1
    const u1 = main.unaidedCount
    const h1 = main.helpedCount
    const lines1 = main.placementLogLines.length
    const d1 = await ikDropTop(body, main, slot1, "recall right", (p, frame) => dark(`recall right: Piece_${p} in hand (frame ${frame})`))
    expect(main.lastDropResult, `recall right: Piece_${p1} placed`).toBe("correct")
    expect(main.lastDropSlot, `recall right: Piece_${p1} let go over its cell`).toBe(slot1)
    expect(main.isPiecePlaced(p1), `recall right: Piece_${p1} stands in the case`).toBe(true)
    expect(main.isHelpedThisPass(p1), `recall right: Piece_${p1} not helped`).toBe(false)
    expect(main.unaidedCount - u1, "recall right: unaided count +1").toBe(1)
    expect(main.helpedCount - h1, "recall right: helped count unchanged").toBe(0)
    dark("recall right: after placing")
    expectOnePlacementLine(main, lines1, "recall right", {mode: "recall", piece: `${p1}`, address: cardText(p1, "AddressText").text, placed: placedToken(slot1), right: rightToken(t1), result: "correct", memory: "1"})
    log(`IKLOOP recall right: Piece_${p1} placed in cell ${slot1} from memory (dark on all ${d1.heldFrames} frames in hand)`)

    // 5. The next letter dropped in a wrong cell: a miss, and the answer cell lights.
    const p2 = await waitForTopGrabbable(main)
    expect(main.isHoldPiece(p2), `recall miss: test picked a non-hold letter (Piece_${p2})`).toBe(false)
    const t2 = targetOf(main, p2)
    const wrong = neighbourSlot(t2)
    const lines2 = main.placementLogLines.length
    const d2 = await ikDropTop(body, main, wrong, "recall miss", (p, frame) => dark(`recall miss: Piece_${p} in hand (frame ${frame})`))
    expect(main.lastDropResult, `recall miss: Piece_${p2} in cell ${wrong}`).toBe("miss")
    expect(main.lastDropSlot, `recall miss: Piece_${p2} let go over the wrong cell`).toBe(wrong)
    expectGlowAt(main, t2, "recall miss: after the miss")
    expectLabelLit(main, t2, "recall miss: after the miss")
    const settleFrames = await waitHeadStill()
    const outside = targetOutsideDisplay(main, t2)
    expectArrow(main, outside, `recall miss: after the miss (answer ${t2} outside=${outside})`)
    if (outside) expectArrowPointsAt(main, t2, "recall miss: after the miss")
    expect(main.isPiecePlaced(p2), `recall miss: Piece_${p2} not placed`).toBe(false)
    expect(main.isHelpedThisPass(p2), `recall miss: Piece_${p2} helped for the rest of the pass`).toBe(true)
    expectOnePlacementLine(main, lines2, "recall miss", {mode: "recall", piece: `${p2}`, address: cardText(p2, "AddressText").text, placed: placedToken(wrong), right: rightToken(t2), result: "miss", memory: "0"})
    log(`IKLOOP recall miss: Piece_${p2} in cell ${wrong}, answer ${t2} lit (outside the display ${outside}, head still after ${settleFrames} frames; dark on all ${d2.heldFrames} frames in hand)`)

    // The IK path drove every step: LEAF recorded no diagnostic at all for the run.
    const entries = rec.getAll()
    expect(entries.length, `LEAF DiagnosticRecorder: no reach, FOV, target-missing, overlap or timeout entry (${entries.map((e) => `${e.diagnostic.category}: ${e.diagnostic.message}`).join(" | ") || "none"})`).toBe(0)
    expect(rec.policy, "LEAF diagnostic policy still fail-fast").toBe("fail-fast")
    expect(rootT.getWorldPosition().distance(rootPos0) < 1e-3, "the case did not move").toBe(true)
    expect(Math.abs(rootT.getWorldRotation().dot(rootRot0)) > 0.99999, "the case did not turn").toBe(true)
    log(`IKLOOP done: hands ${d0.hand}, ${d1.hand}, ${d2.hand}; no LEAF diagnostic`)
  } finally {
    body.destroy()
    const turned = (Math.acos(Math.max(-1, Math.min(1, camT.getWorldRotation().multiplyVec3(vec3.back()).dot(camRot0.multiplyVec3(vec3.back()))))) * 180) / Math.PI
    camT.setWorldPosition(camPos0)
    camT.setWorldRotation(camRot0)
    log(`IKLOOP camera restored (the IK head had turned it ${turned.toFixed(2)} deg)`)
  }
}

@component
export class CaseLightIkLoopScenario extends Scenario {
  async run(): Promise<void> {
    await runIkLoop()
    await hideLeafOverlay()
  }
}
