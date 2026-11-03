// Owns: the LEAF check of v0.6 feature 2: a recall miss comes back with exactly two letters before it (or at the end), unlit and still helped; the "Came back: N" line; retirement after two from-memory recall passes in a row (hidden from later passes, a miss in between breaks the run); the all-retired card; Done clears retirement; the score counts only letters placed from memory.
// Talks to: CaseLightLeafSupport (real SIK drops and UIKit presses, independent answers, assertions), CaseLightRecallSupport (the test's own model and pass player), CaseLightMain read-only getters (currentPassOrder, isHelpedThisPass, comeBackCount, cameBackText, retiredCount, isRetired, retireStreakOf, isAllRetired, isAllRetiredCardShown, isPieceShown, counts, resultText), Piece_n / ResultText by name.
// Must not: call CaseLightMain's test hooks or commands, import CaseLightPassLogic, or change product state except through real input.

/**
 * Every expected order comes from CaseLightRoute.recallOrder and the rule as written (our own
 * model in CaseLightRecallSupport), never from the product's queue; the product's live queue is
 * compared with the model before every drop.
 * Passes (all REAL input):
 *   A (Start recall): miss the top letter o0 (it must be 3rd in line: exactly 2 before it); when 2
 *     letters are left, miss the top one x (it goes to the end, 1 before it), and miss x again
 *     when it is the only one left (the end is the top). Card: our tally and "Came back: 3".
 *   B (Again): miss one letter z that was from memory in A. Retired after B = the letters from
 *     memory in A and B (our model).
 *   C (Again): only o0, x and z are presented; every retired letter is hidden and not in the
 *     bundle. After C, o0 and x retire (from memory in B and C) but z does not (its run was broken
 *     by the miss in B): the "not retired" check and its positive control in the same pass.
 *   D (Again): only z; it retires; every letter is retired.
 *   Again and Start recall then show "All letters learned / Done starts over" and start no pass.
 *   Done clears retirement (counts kept); Start recall then presents every letter again.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {CaseLightMain} from "../CaseLightMain"
import {CaseLightLeafInteractor, expectGlowAt, expectNoGlow, expectedResult, hideLeafOverlay, log, mustFind, targetOf, waitForReady, waitUntil} from "./CaseLightLeafSupport"
import {OwnModel, PassTally, playRecallPass} from "./CaseLightRecallSupport"

function cardLines(): {main: string; line2: string; shown: boolean} {
  const t = mustFind("ResultText").getComponent("Component.Text") as Text
  const l2 = mustFind("ResultCameBackText").getComponent("Component.Text") as Text
  return {main: t.text, line2: l2.text, shown: t.getSceneObject().enabled && l2.getSceneObject().enabled}
}

function expectCard(main: CaseLightMain, model: OwnModel, tally: PassTally, ctx: string): void {
  const c = cardLines()
  log(`RETIRE ${ctx}: card "${c.main}" / "${c.line2}"; product unaided ${main.unaidedCount} helped ${main.helpedCount} total ${main.totalCount}; ours ${model.fromMemory} / ${model.helped} / ${model.total}; came back ours ${tally.comeBacks}, product ${main.comeBackCount}`)
  expect(c.shown, `${ctx}: score card and its second line shown`).toBe(true)
  expect(c.main, `${ctx}: score = our tally (only letters placed from memory)`).toBe(expectedResult(model.fromMemory, model.total))
  expect(c.line2, `${ctx}: came back line = our count`).toBe(`Came back: ${tally.comeBacks}`)
  expect(main.comeBackCount, `${ctx}: comeBackCount`).toBe(tally.comeBacks)
  expect(main.cameBackText, `${ctx}: cameBackText getter`).toBe(c.line2)
  expect(main.unaidedCount, `${ctx}: unaided = our tally`).toBe(model.fromMemory)
  expect(main.helpedCount, `${ctx}: helped = our tally`).toBe(model.helped)
  expect(main.totalCount, `${ctx}: total = our tally`).toBe(model.total)
}

function expectRetirement(main: CaseLightMain, model: OwnModel, ctx: string): void {
  const prodRetired: number[] = []
  const ours: number[] = []
  for (let i = 0; i < model.n; i++) {
    if (main.isRetired(i)) prodRetired.push(i)
    if (model.retired[i]) ours.push(i)
    expect(main.retireStreakOf(i), `${ctx}: letter ${i} run of from-memory passes = our model`).toBe(model.streak[i])
  }
  log(`RETIRE ${ctx}: retired product [${prodRetired}] ours [${ours}], runs ${JSON.stringify(model.streak)}`)
  expect(JSON.stringify(prodRetired), `${ctx}: retired letters = our model`).toBe(JSON.stringify(ours))
  expect(main.retiredCount, `${ctx}: retiredCount`).toBe(model.retiredCount)
  expect(main.isAllRetired, `${ctx}: isAllRetired`).toBe(model.retiredCount === model.n)
}

/** Retired letters are hidden and out of the bundle; every other letter is shown (positive control). */
function expectShownForPass(main: CaseLightMain, model: OwnModel, ctx: string): void {
  const queue = main.currentPassOrder
  let hidden = 0
  let shown = 0
  for (let i = 0; i < model.n; i++) {
    const so = mustFind(`Piece_${i}`)
    if (model.retired[i]) {
      expect(main.isPieceShown(i) || so.enabled, `${ctx}: retired letter ${i} hidden (isPieceShown and Piece_${i})`).toBe(false)
      expect(queue.indexOf(i), `${ctx}: retired letter ${i} not in the bundle`).toBe(-1)
      hidden++
    } else {
      expect(main.isPieceShown(i) && so.enabled, `${ctx}: letter ${i} in the pass is shown (positive control)`).toBe(true)
      expect(queue.indexOf(i) >= 0, `${ctx}: letter ${i} in the bundle (positive control)`).toBe(true)
      shown++
    }
  }
  log(`RETIRE ${ctx}: ${shown} letters shown and in the bundle, ${hidden} retired letters hidden`)
}

@component
export class CaseLightComeBackRetireScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    const n = main.pieceCount
    const model = new OwnModel(n)
    const guardPast = async (what: string) => waitUntil(() => getTime() - main.lastExitPressTime > main.startGuardSeconds + 0.15, 3000, `Start guard passed after ${what}`)

    // ── Pass A ────────────────────────────────────────────────────────────────────────────
    await ix.pressButton("StartRecallButton")
    const startA = model.startPass()
    expectShownForPass(main, model, "pass A start (nothing retired)")
    const o0 = startA[0]
    let x = -1
    let litAfterMiss = -1
    let countsBefore = {u: 0, h: 0, t: 0}
    const tA = await playRecallPass(ix, main, model, "pass A", (p, k, q) => {
      if (p === o0 && k === 0) return true
      if (x < 0 && k === 0 && p !== o0 && q.length === 2) {
        x = p
        return true
      }
      if (p === x && k === 1 && q.length === 1) return true
      return false
    }, (d) => {
      if (d.piece === o0 && d.k === 0) {
        expect(d.queueBefore.indexOf(o0), "control: o0 was on top before its miss").toBe(0)
        expect(d.queueAfter.indexOf(o0), `a. missed letter ${o0} is 3rd in line: exactly 2 letters before it`).toBe(2)
        expect(main.currentPassOrder.indexOf(o0), "a. product queue: missed letter at index 2").toBe(2)
        expect(main.isHelpedThisPass(o0), "b. the missed letter is helped for the rest of the pass").toBe(true)
        expect(main.isHelpedThisPass(d.queueAfter[0]), "b. control: the next letter is not helped").toBe(false)
        expectGlowAt(main, targetOf(main, o0), "b. control: the answer is lit right after the miss")
        litAfterMiss = targetOf(main, o0)
      }
      if (d.piece === x && d.k === 0) {
        expect(d.queueBefore.length, "a. x missed with one other letter left").toBe(2)
        expect(d.queueAfter.indexOf(x), `a. with fewer than 2 left, missed letter ${x} goes to the end (index 1 of 2)`).toBe(d.queueAfter.length - 1)
      }
      if (d.piece === x && d.k === 1) {
        expect(JSON.stringify(d.queueAfter), `a. missed again as the only letter left: it is the end (and the top)`).toBe(JSON.stringify([x]))
      }
      if (d.piece === o0 && d.k === 1) {
        expect(d.result, "b. the returning letter placed right").toBe("correct")
        expect(main.unaidedCount - countsBefore.u, "b. the returning letter is not counted from memory").toBe(0)
        expect(main.helpedCount - countsBefore.h, "b. the returning letter is counted helped").toBe(1)
        expect(main.totalCount - countsBefore.t, "b. and placed once").toBe(1)
      }
    }, (p, k) => {
      if (p === o0 && k === 1) {
        // b. It comes back unlit: two different letters were picked up in between (positive control: lit after the miss).
        expect(litAfterMiss >= 0, "b. control seen: lit after the miss").toBe(true)
        expectNoGlow(main, `b. missed letter ${o0} back on top: unlit`)
        expect(main.isHelpedThisPass(o0), "b. still helped when it comes back").toBe(true)
        countsBefore = {u: main.unaidedCount, h: main.helpedCount, t: main.totalCount}
      }
      if (p === x && k === 1) expectNoGlow(main, `b. letter ${x} back after one other letter was picked up: unlit`)
      if (p === x && k === 2) log(`RETIRE x ${x} back with no other letter picked up in between: answer lit ${main.litSlotIndex === targetOf(main, x)} (lit slot ${main.litSlotIndex})`)
    })
    expect(x >= 0, "a. a letter was missed with fewer than 2 left").toBe(true)
    expect(tA.comeBacks, "pass A: our come-back count").toBe(3)
    await waitUntil(() => main.isResultVisible, 2000, "card after pass A")
    expectCard(main, model, tA, "c/g after pass A")
    expectRetirement(main, model, "d. after pass A (nothing retired yet: one pass is not enough)")
    expect(main.retiredCount, "d. one from-memory pass retires nothing").toBe(0)
    const fromMemoryA = tA.startOrder.filter((p) => !tA.helpedSet.has(p))

    // ── Pass B (Again): miss one letter that was from memory in A ─────────────────────────
    await ix.pressButton("AgainButton")
    model.startPass()
    expectShownForPass(main, model, "pass B start (nothing retired)")
    let z = -1
    const tB = await playRecallPass(ix, main, model, "pass B", (p, k) => {
      if (z < 0 && k === 0 && fromMemoryA.indexOf(p) >= 0) {
        z = p
        return true
      }
      return false
    })
    expect(z >= 0, "pass B: a letter from memory in A was missed").toBe(true)
    await waitUntil(() => main.isResultVisible, 2000, "card after pass B")
    expectCard(main, model, tB, "c/g after pass B")
    expectRetirement(main, model, "d. after pass B")
    expect(main.retiredCount, "d. letters from memory in A and B retire").toBe(fromMemoryA.length - 1)

    // ── Pass C (Again): only the letters not retired ─────────────────────────────────────
    await ix.pressButton("AgainButton")
    const startC = model.startPass()
    log(`RETIRE pass C start ours ${JSON.stringify(startC)}, product ${JSON.stringify(main.currentPassOrder)}; o0 ${o0}, x ${x}, z ${z}`)
    expect(JSON.stringify(startC.slice().sort()), "pass C presents only o0, x and z (our model)").toBe(JSON.stringify([o0, x, z].sort()))
    expectShownForPass(main, model, "d. pass C start")
    const tC = await playRecallPass(ix, main, model, "pass C")
    await waitUntil(() => main.isResultVisible, 2000, "card after pass C")
    expectCard(main, model, tC, "c/g after pass C")
    expectRetirement(main, model, "d. after pass C")
    expect(main.isRetired(o0) && main.isRetired(x), `d. control: o0 ${o0} and x ${x} (helped in A, from memory in B and C) retire`).toBe(true)
    expect(main.isRetired(z), `d. z ${z} (from memory in A, missed in B, from memory in C) is not retired`).toBe(false)

    // ── Pass D (Again): only z ───────────────────────────────────────────────────────────
    await ix.pressButton("AgainButton")
    const startD = model.startPass()
    expect(JSON.stringify(startD), "pass D presents only z (our model)").toBe(JSON.stringify([z]))
    expectShownForPass(main, model, "d. pass D start")
    const tD = await playRecallPass(ix, main, model, "pass D")
    await waitUntil(() => main.isResultVisible, 2000, "card after pass D")
    expectCard(main, model, tD, "c/g after pass D")
    expectRetirement(main, model, "d. after pass D (every letter retired)")
    expect(main.isAllRetired, "every letter retired").toBe(true)

    // ── e. All retired: Again and Start recall show the card and start no pass ───────────
    const passes = main.recallPassCount
    const kept = {u: main.unaidedCount, h: main.helpedCount, t: main.totalCount}
    expect(main.isAllRetiredCardShown, "control: the all-retired card is not up before Again").toBe(false)
    await ix.pressButton("AgainButton")
    await sleep(200)
    const card = cardLines()
    log(`RETIRE all retired, Again: card "${card.main}" / "${card.line2}", mode ${main.mode}, passes ${main.recallPassCount}, queue ${JSON.stringify(main.currentPassOrder)}`)
    expect(main.isAllRetiredCardShown, "e. Again: the all-retired card shows").toBe(true)
    expect(card.main, "e. card text").toBe("All letters learned")
    expect(card.line2, "e. card second line").toBe("Done starts over")
    expect(main.mode, "e. Again starts no pass").toBe("idle")
    expect(main.recallPassCount, "e. no recall pass counted").toBe(passes)
    expect(main.currentPassOrder.length + (main.topPieceIndex >= 0 ? 1 : 0), "e. nothing to pick up").toBe(0)
    expect(main.isExitVisible, "e. Again / Done stay up").toBe(true)
    await guardPast("Again")
    await ix.pressButton("StartRecallButton")
    await sleep(200)
    expect(main.isAllRetiredCardShown && main.mode === "idle" && main.recallPassCount === passes, `e. Start recall: the card again and no pass (mode ${main.mode}, passes ${main.recallPassCount})`).toBe(true)

    // ── f. Done clears retirement; counts are kept; every letter comes back ──────────────
    expect(main.retiredCount, "f. control: every letter retired before Done").toBe(n)
    await ix.pressButton("DoneButton")
    model.done()
    expectRetirement(main, model, "f. after Done (retirement cleared)")
    expect(main.retiredCount, "f. Done: nothing retired").toBe(0)
    expect(main.isAllRetiredCardShown, "f. Done: the all-retired card is gone").toBe(false)
    expect(main.unaidedCount === kept.u && main.helpedCount === kept.h && main.totalCount === kept.t, `f. Done keeps the session counts (${JSON.stringify(kept)})`).toBe(true)
    await guardPast("Done")
    await ix.pressButton("StartRecallButton")
    const startE = model.startPass()
    expect(main.mode, "f. Start recall after Done starts a pass").toBe("recall")
    expect(JSON.stringify(main.bundleOrder), "f. that pass presents every letter (our model)").toBe(JSON.stringify(startE))
    expect(startE.length, "f. every letter is back").toBe(n)
    expectShownForPass(main, model, "f. pass after Done")
    log(`RETIRE done: session from memory ${model.fromMemory} of ${model.total} (ours), product ${main.unaidedCount} of ${main.totalCount}`)
    await hideLeafOverlay()
  }
}
