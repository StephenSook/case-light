// Owns: the LEAF check of item A3's opening pinch hint: on a Lens start with no saved progress it plays at the top letter and, at every sampled frame of a whole loop, its full drawn hand (every skinned vertex, wrist and forearm included) stays at least 0.3 deg clear of the version tag, the caption, its credit line, the start hint and every button; it stays up through the opening Start press; the opening real grab ends it ("grab", one log line); a release, a later Start press or Again never brings it back.
// Talks to: CaseLightLeafSupport (real UIKit presses, real SIK grab and drop, independent answers, angle boxes), CaseLightRecallSupport (the test's own recall model and pass player, to reach Again), CaseLightMain read-only getters (progressWelcomeShown, pinchHintShown, pinchHintPlaying, pinchHintEnd, pinchHintDrawn, bundleOrder, placementLogLines, mode, lastDropResult, heldPieceIndex, isExitVisible, bundle.activePieceIndex), drawn objects by name (PinchHint and its hand, Piece_n, the protected items).
// Must not: import CaseLightPinchHintRule, CaseLightPinchHintUI or CaseLightLog, call product commands or test hooks, or change product state except through real input.

/**
 * Runs right after extra-progress-reset, which leaves no saved progress; with the welcome up at
 * open it fails at once with "run immediately after extra-progress-reset (needs no saved progress)".
 * It completes one recall pass to reach Again, which saves progress: extra-stand-in-hidden, next,
 * presses Reset progress at open to leave the store empty again.
 * The rule as written: shown only with no saved progress; it stays up through the opening Start
 * press (no letter can be grabbed before a Start press, checked below as a control); the grab of a
 * letter ends it with "grab"; never back.
 * Full extent: the test skins the hand itself (the mesh's own bone weights and inverse bind
 * matrices, the skin's bone objects), every 3rd vertex, at least 5 frames across a whole loop.
 * Controls: the hint plays at open; the clearance test reports the top letter (which the hand
 * pinches) as overlapped; the skinned hand lies on the fingertip joints (a broken skin fails).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {nextFrame} from "Leaf.lspkg/Utils/common/Utils"
import {CaseLightMain} from "../CaseLightMain"
import {AngleBox, CaseLightLeafInteractor, angleBox, drawnWorldBox, dropSlotFor, fmtBox, headAngles, hideLeafOverlay, log, mustFind, roundedRectWorldCorners, textWorldCorners, waitForReady, waitUntil} from "./CaseLightLeafSupport"
import {OwnModel, playRecallPass} from "./CaseLightRecallSupport"

/** Required clearance (deg) between the drawn hand and every protected item. */
const MIN_CLEAR_DEG = 0.3
/** One loop of the package's pinch is about 1.5 s; sample a little more than that. */
const SAMPLE_SECONDS = 1.8
const MIN_SAMPLES = 5
/** Every Nth vertex of the hand mesh. */
const VERTEX_STEP = 3

function findUnder(root: SceneObject, name: string): SceneObject | null {
  if (root.name === name) return root
  for (let i = 0; i < root.getChildrenCount(); i++) {
    const r = findUnder(root.getChild(i), name)
    if (r) return r
  }
  return null
}

/** The right hand's skinned vertices in world space, computed by the test from the mesh's own skin data. */
function handSkinner(hint: SceneObject): () => vec3[] {
  const geo = findUnder(hint, "RightHandGeo")
  const handHints = findUnder(hint, "HandHints")
  if (!geo || !handHints) throw new Error("RightHandGeo / HandHints not found under PinchHint")
  const mesh = (geo.getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mesh
  const pos = mesh.getVertexDataForAttribute("position")
  // Four slots per vertex, each "bone index + weight" (weight below 1; a whole number n > 0 is bone n-1 at weight 1).
  const boneData = mesh.getVertexDataForAttribute("boneData")
  const inverse = mesh.extractBoneInverseMatrices()
  const skin = handHints.getComponent("Component.Skin") as Skin
  const bones = mesh.extractBoneNames().map((n) => skin.getSkinBone(n))
  expect(bones.length > 0 && bones.every((b) => !!b) && inverse.length === bones.length, `the hand's ${bones.length} bones resolve on its skin`).toBe(true)
  const idx: number[] = []
  const bi: number[][] = []
  const bw: number[][] = []
  for (let v = 0; v < pos.length / 3; v += VERTEX_STEP) {
    const b: number[] = []
    const w: number[] = []
    let sum = 0
    for (let k = 0; k < 4; k++) {
      const x = boneData[v * 4 + k]
      const i = Math.floor(x + 1e-6)
      if (x - i > 1e-4) {
        b.push(i)
        w.push(x - i)
        sum += x - i
      }
    }
    if (sum < 0.5) {
      for (let k = 0; k < 4; k++) {
        const x = boneData[v * 4 + k]
        if (x >= 1 && Math.abs(x - Math.round(x)) < 1e-4) {
          b.push(Math.round(x) - 1)
          w.push(1)
          sum += 1
        }
      }
    }
    if (sum < 0.5) continue
    idx.push(v)
    bi.push(b)
    bw.push(w.map((x) => x / sum))
  }
  return () => {
    const m = bones.map((b, k) => b.getTransform().getWorldTransform().mult(inverse[k]))
    const out: vec3[] = []
    for (let j = 0; j < idx.length; j++) {
      const v = idx[j]
      const p = new vec3(pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2])
      let acc = vec3.zero()
      for (let k = 0; k < bi[j].length; k++) acc = acc.add(m[bi[j][k]].multiplyPoint(p).uniformScale(bw[j][k]))
      out.push(acc)
    }
    return out
  }
}

/** How far (deg) the nearest point lies outside the box; negative when a point is inside it. */
function clearanceDeg(angles: vec2[], b: AngleBox): number {
  let m = 1e9
  for (const a of angles) m = Math.min(m, Math.max(b.minYaw - a.x, a.x - b.maxYaw, b.minPitch - a.y, a.y - b.maxPitch))
  return m
}

function linesWith(main: CaseLightMain, needle: string): number[] {
  const out: number[] = []
  main.placementLogLines.forEach((l, i) => {
    if (l.indexOf(needle) >= 0) out.push(i)
  })
  return out
}

function expectEnded(main: CaseLightMain, hint: SceneObject, ctx: string): void {
  expect(main.pinchHintPlaying, `${ctx}: the hint is not playing`).toBe(false)
  expect(main.pinchHintEnd, `${ctx}: it ended with the grab`).toBe("grab")
  expect(main.pinchHintDrawn || hint.isEnabledInHierarchy, `${ctx}: the hand is not drawn`).toBe(false)
  expect(linesWith(main, "event=pinch-hint-start").length + "/" + linesWith(main, "event=pinch-hint-end").length, `${ctx}: still one start line and one end line`).toBe("1/1")
}

@component
export class CaseLightPinchHintScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    if (main.progressWelcomeShown) throw new Error("run immediately after extra-progress-reset (needs no saved progress)")

    // ── At open: playing, drawn, logged once ─────────────────────────────────────────────
    const top = main.bundleOrder[0]
    const hint = mustFind("PinchHint")
    log(`HINT at open: shown ${main.pinchHintShown}, playing ${main.pinchHintPlaying}, end ${main.pinchHintEnd}, drawn ${main.pinchHintDrawn}, top letter ${top}`)
    expect(main.pinchHintShown && main.pinchHintPlaying, "control: the hint plays at open (no saved progress)").toBe(true)
    expect(main.pinchHintEnd, "not ended at open").toBe("none")
    expect(hint.isEnabledInHierarchy, "the hint hand is drawn at open").toBe(true)
    const starts = linesWith(main, "event=pinch-hint-start")
    expect(starts.length === 1 && main.placementLogLines[starts[0]].indexOf(`piece=${top}`) >= 0, `one start line naming the top letter ${top}`).toBe(true)
    expect(linesWith(main, "event=pinch-hint-end").length, "no end line yet").toBe(0)
    expect(main.bundle.activePieceIndex, "control: no letter can be grabbed while idle (the hint must outlast the opening Start)").toBe(-1)

    // ── The full drawn hand, a whole loop: clear of every protected item ─────────────────
    const items: {name: string; box: AngleBox}[] = [
      {name: "version tag", box: angleBox([...textWorldCorners("VersionLabel"), ...roundedRectWorldCorners("VersionBacking")])},
      {name: "caption", box: angleBox([...textWorldCorners("Caption"), ...roundedRectWorldCorners("CaptionBacking")])},
      {name: "credit line", box: angleBox(textWorldCorners("CreditText"))},
      {name: "start hint", box: angleBox([...textWorldCorners("StartHint"), ...textWorldCorners("StartHintLine2"), ...roundedRectWorldCorners("StartHintBacking")])},
      {name: "drill pace caption's place", box: angleBox(roundedRectWorldCorners("PaceLabelBacking"))},
    ]
    // Drill pace and Hide stand-in case by their places in the Options panel (it can be opened while the hint plays).
    for (const b of ["OptionsButton", "StartPracticeButton", "StartRecallButton", "DrillPaceButton", "ShowMyCaseButton", "HideStandInButton", "RouteButton_1", "RouteButton_2", "PlaceOnWallButton", "VeteranModeButton"]) items.push({name: b, box: angleBox(roundedRectWorldCorners(b))})
    const letterBox = angleBox(drawnWorldBox(`Piece_${top}`).pts)
    const skinned = handSkinner(hint)
    const index = findUnder(hint, "index_4_R")
    if (!index) throw new Error("index_4_R not found under PinchHint")
    const worst = items.map(() => 1e9)
    let letterClear = 1e9
    let tipGap = 1e9
    let samples = 0
    let ext: AngleBox = {minYaw: 1e9, maxYaw: -1e9, minPitch: 1e9, maxPitch: -1e9}
    const t0 = getTime()
    let frame = 0
    while (getTime() - t0 < SAMPLE_SECONDS) {
      if (frame++ % 3 === 0) {
        const pts = skinned()
        const tip = index.getTransform().getWorldPosition()
        for (const p of pts) tipGap = Math.min(tipGap, p.distance(tip))
        const angles = pts.map((p) => headAngles(p))
        const b = angleBox(pts)
        ext = {minYaw: Math.min(ext.minYaw, b.minYaw), maxYaw: Math.max(ext.maxYaw, b.maxYaw), minPitch: Math.min(ext.minPitch, b.minPitch), maxPitch: Math.max(ext.maxPitch, b.maxPitch)}
        items.forEach((it, k) => (worst[k] = Math.min(worst[k], clearanceDeg(angles, it.box))))
        letterClear = Math.min(letterClear, clearanceDeg(angles, letterBox))
        samples++
      }
      await nextFrame()
    }
    log(`HINT full hand over ${SAMPLE_SECONDS} s (${samples} frames): ${fmtBox(ext)}; nearest skinned vertex to the index tip ${tipGap.toFixed(2)} cm`)
    items.forEach((it, k) => log(`HINT clearance to ${it.name} (${fmtBox(it.box)}): ${worst[k].toFixed(2)} deg`))
    expect(samples >= MIN_SAMPLES, `at least ${MIN_SAMPLES} frames sampled across a loop (${samples})`).toBe(true)
    expect(tipGap < 1.5, `control: the test's skinned hand lies on the index tip joint (${tipGap.toFixed(2)} cm)`).toBe(true)
    expect(letterClear < 0, `control: the clearance test reports the top letter, which the hand pinches, as overlapped (${letterClear.toFixed(2)} deg)`).toBe(true)
    items.forEach((it, k) => expect(worst[k] >= MIN_CLEAR_DEG, `the hand stays ${MIN_CLEAR_DEG} deg clear of the ${it.name} at every sampled frame (${worst[k].toFixed(2)} deg)`).toBe(true))

    // ── The opening Start press leaves it up ────────────────────────────────────────────
    await ix.pressButton("StartPracticeButton")
    expect(main.mode, "a practice pass is running").toBe("practice")
    expect(main.pinchHintPlaying && main.pinchHintEnd === "none", "still playing after the opening Start press").toBe(true)
    expect(hint.isEnabledInHierarchy, "the hand is still drawn after the opening Start press").toBe(true)
    expect(linesWith(main, "event=pinch-hint-end").length, "no end line after the opening Start press").toBe(0)

    // ── The opening real grab ends it ───────────────────────────────────────────────────
    const held = await ix.grabTopPieceAndHold(main)
    expect(main.heldPieceIndex, "a letter is in hand").toBe(held.piece)
    expectEnded(main, hint, "with the letter in hand")
    const end = linesWith(main, "event=pinch-hint-end")
    log(`HINT end line: ${end.length > 0 ? main.placementLogLines[end[0]] : "(none)"}`)
    expect(main.placementLogLines[end[0]].indexOf("reason=grab") >= 0, "the end line says reason=grab").toBe(true)

    // ── A release, a later Start press and Again do not bring it back ────────────────────
    const slot = dropSlotFor(main, held.piece)
    await ix.dropHeldPieceAtSlot(main, held.it, slot)
    held.off()
    expect(main.lastDropResult, `letter ${held.piece} placed in cell ${slot}`).toBe("correct")
    expectEnded(main, hint, "after the release")
    const model = new OwnModel(main.pieceCount)
    await ix.pressButton("StartRecallButton")
    model.startPass()
    expect(main.mode, "a recall pass is running").toBe("recall")
    expectEnded(main, hint, "after a later Start press")
    await playRecallPass(ix, main, model, "recall to reach Again")
    await waitUntil(() => main.isExitVisible, 3000, "Again / Done shown after the recall pass")
    await ix.pressButton("AgainButton")
    expect(main.mode, "Again started a recall pass").toBe("recall")
    expectEnded(main, hint, "after Again")
    await hideLeafOverlay()
  }
}
