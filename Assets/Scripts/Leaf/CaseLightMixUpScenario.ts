// Owns: the LEAF check for the mix-up marks: after a recall pass with misses, one line per missed address from its opening wrong cell to its right cell (HOLD block for a refused hold piece), both end cells outlined in the line colour, and the two end labels ("<address> was put here", "goes here") on their own cells without covering each other or any cell label; nothing during a pass or after practice; Again, Done and Start each clear them; mixUpLines off draws none; with the ladder also on, recall still shows no cue before a drop.
// Talks to: CaseLightLeafSupport (real SIK/UIKit input, independent answers, mix-up, mix-up end and glow assertions), CaseLightMain read-only getters (mixUpLineCount, mixUpPairs, mixUpDetails, mixUpLabelCount, isMixUpVisible, cueKind, lastExitPressTime), MixUpLineMesh / MixUpLabel_n / Again / Done / Start buttons by name.
// Must not: call CaseLightMain's test hooks or commands, or change product state except through real input; the exceptions are mixUpLines and practiceLadder, switched here and put back (true, false) in a finally.

/**
 * Builder feature (verified in CaseLightMain.ts / CaseLightMixUp.ts): in a recall pass the Lens
 * keeps each address's OPENING wrong drop (dropped cell, right cell). When the pass ends and
 * mixUpLines is on, one thin line per pair is drawn on the case (MixUpLineMesh). beginPass (any
 * Start, and Again) and Done clear them.
 *
 * Input: REAL (LEAF SIK interactor) for every grab, drop and button press.
 * Expected pairs are built here from the cells the test aimed at (checked against lastDropSlot)
 * and the independent answers read from the printed case, not from the Lens's record.
 * Positive controls: the lines are seen ON for exactly the expected pairs, with the drawn mesh
 * reaching both cells of each pair, before any "no line" observation made during a pass or after
 * practice is asserted (those are recorded when made and asserted afterwards).
 * Ends (v0.4, expectMixUpEnds): outlines read from the drawn mesh, label words checked against
 * the address printed on that letter's own AddressText, label positions measured from the eye.
 * A Start press is made only after the 0.6 s Start guard that follows Done has passed.
 * v0.6 feature 2: every recall pass is played by playRecallPass (CaseLightRecallSupport), which
 * checks the live queue against the test's own come-back model before every drop; a missed letter
 * is dropped again (wrong or right) when it comes back with two letters before it.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {CaseLightMain} from "../CaseLightMain"
import {hideLeafOverlay, mixUpLabelObjectsShown, expectMixUpEnds, waitUntil,
  CaseLightLeafInteractor,
  dropSlotFor,
  expectMixUp,
  expectNoGlow,
  expectNoMixUp,
  expectNoRegion,
  log,
  neighbourSlot,
  pairsKey,
  targetOf,
  waitForReady,
  waitForTopGrabbable,
} from "./CaseLightLeafSupport"
import {OwnModel, playRecallPass} from "./CaseLightRecallSupport"
import {findSceneObjectByName} from "Leaf.lspkg/Utils/common/Utils"

interface Pair {
  dropped: number
  right: number
  /** The missed letter (its printed address is what the dropped-end label must read). */
  piece: number
}

interface Seen {
  where: string
  count: number
  visible: boolean
  pairs: number
  mesh: boolean
  labels: number
  labelObjects: number
}

function observe(main: CaseLightMain, where: string): Seen {
  const mesh = findSceneObjectByName("MixUpLineMesh")
  return {where, count: main.mixUpLineCount, visible: main.isMixUpVisible, pairs: main.mixUpPairs.length, mesh: !!mesh && mesh.enabled, labels: main.mixUpLabelCount, labelObjects: mixUpLabelObjectsShown()}
}

/** A second wrong cell for the same address: same shelf, two columns away, never the HOLD block or the answer. */
function secondWrong(target: number, already: number): number {
  const col = target % 40
  const s = col < 33 ? target + 2 : target - 2
  return s === already ? target + 3 : s
}

@component
export class CaseLightMixUpScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    expect(main.mixUpLines, "mixUpLines on by default").toBe(true)
    const deferred: Seen[] = []
    let checkedTotal = 0
    /**
     * Assert the recorded no-line observations (taken during passes and after practice). Called only
     * after the lines have been seen ON by the same read-outs. The last drop of a recall pass is
     * skipped: that observation is taken at the score view, where lines belong.
     */
    const checkDeferred = (after: string): void => {
      for (const o of deferred) {
        if (o.where.indexOf("idle pass") === 0) continue
        expect(o.count === 0 && !o.visible && o.pairs === 0 && !o.mesh && o.labels === 0 && o.labelObjects === 0, `no mix-up line or label ${o.where}: ${JSON.stringify(o)}`).toBe(true)
        checkedTotal++
      }
      log(`MIXUP ${after}: ${checkedTotal} no-line observations checked so far`)
      deferred.length = 0
    }

    /** Drop the top piece at `slot`, check the aim landed there, and record the no-line state during the pass. */
    const dropAt = async (slot: number, what: string): Promise<{piece: number; result: string}> => {
      const p = await waitForTopGrabbable(main)
      await ix.dropTopPieceAtSlot(main, slot)
      expect(main.lastDropSlot, `${what}: dropped in cell ${slot}`).toBe(slot)
      deferred.push(observe(main, `${main.mode} pass, after ${what} (${main.lastDropResult})`))
      return {piece: p, result: main.lastDropResult}
    }

    const model = new OwnModel(main.pieceCount)
    /** The recall pass just started: its top letter missed once (cell 23 for the hold piece), all else right. Returns the expected pair. */
    const onePassOneMiss = async (label: string): Promise<Pair[]> => {
      model.startPass()
      const opener = main.bundleOrder[0]
      const t = targetOf(main, opener)
      const a = t === -2 ? 23 : neighbourSlot(t)
      await playRecallPass(ix, main, model, label, (p, k) => (p === opener && k === 0 ? a : false), (d) => {
        deferred.push(observe(main, `${main.mode} pass, after ${label} piece ${d.piece} drop ${d.k + 1} in ${d.slot} (${d.result})`))
      })
      return [{dropped: a, right: t, piece: opener}]
    }

    try {
      // Practice with a miss: practice never draws lines (recorded now, asserted later).
      await ix.pressButton("StartPracticeButton")
      {
        const p = await waitForTopGrabbable(main)
        const t = targetOf(main, p)
        const r = await dropAt(neighbourSlot(t), `practice piece ${p} wrong`)
        expect(r.result, "practice miss").toBe("miss")
        while (main.mode === "practice") {
          const q = await waitForTopGrabbable(main)
          await dropAt(dropSlotFor(main, q), `practice piece ${q} right`)
        }
      }
      deferred.push(observe(main, "after the practice pass with a miss"))

      // Recall pass 1: three addresses missed, one of them twice, plus the hold piece refused.
      // v0.6 feature 2: a missed letter comes back with exactly two letters before it, so its
      // second wrong drop and its right drop happen when it comes back (our model checks the live
      // queue before every drop; replaces the old "wrong, wrong, right in a row" sequence).
      await ix.pressButton("StartRecallButton")
      const order = main.bundleOrder
      log(`MIXUP recall 1 order ${JSON.stringify(order)}`)
      model.startPass()
      const want: Pair[] = []
      const nonHold = order.filter((i) => targetOf(main, i) !== -2)
      const twice = nonHold[0]
      const once = nonHold[2]
      let holdRefused = false
      const tA = targetOf(main, twice)
      const aTwice = neighbourSlot(tA)
      const bTwice = secondWrong(tA, aTwice)
      const aOnce = neighbourSlot(targetOf(main, once))
      await playRecallPass(ix, main, model, "recall 1", (p, k) => {
        if (p === twice && k === 0) return aTwice
        if (p === twice && k === 1) return bTwice
        if (p === once && k === 0) return aOnce
        if (targetOf(main, p) === -2 && k === 0) return 23
        return false
      }, (d) => {
        deferred.push(observe(main, `${main.mode} pass, after recall 1 piece ${d.piece} drop ${d.k + 1} in ${d.slot} (${d.result})`))
        if (d.piece === twice && d.k === 1) expect(d.result, "2nd wrong drop is a miss").toBe("miss")
        if (d.piece === twice && d.k === 0) {
          expect(d.result, "1st wrong drop is a miss").toBe("miss")
          want.push({dropped: aTwice, right: tA, piece: twice})
        }
        if (d.piece === once && d.k === 0) {
          expect(d.result, "wrong drop is a miss").toBe("miss")
          want.push({dropped: aOnce, right: targetOf(main, once), piece: once})
        }
        if (targetOf(main, d.piece) === -2 && d.k === 0) {
          expect(d.result, "hold refused").toBe("refused-hold")
          want.push({dropped: 23, right: -2, piece: d.piece})
          holdRefused = true
        }
      })
      expect(holdRefused, "the hold piece was refused once in recall 1").toBe(true)
      expect(want.length, "three addresses missed in recall 1").toBe(3)
      log(`MIXUP recall 1 expected ${pairsKey(want)}, shown ${pairsKey(main.mixUpPairs)}, lines ${main.mixUpLineCount}`)
      expectMixUp(main, want, "after recall 1 (positive control)")
      expectMixUpEnds(main, want, "after recall 1")

      // Now the deferred no-line observations (practice, and during recall 1 after each miss and placement).
      checkDeferred("after recall 1")
      expect(checkedTotal >= 19, `${checkedTotal} no-line observations from practice and recall 1`).toBe(true)

      // Again clears them; its pass shows only its own miss.
      await ix.pressButton("AgainButton")
      expect(main.mode, "Again starts a recall pass").toBe("recall")
      expectNoMixUp(main, "after Again")
      const want2 = await onePassOneMiss("recall 2")
      expectMixUp(main, want2, "after recall 2 (one miss)")
      expectMixUpEnds(main, want2, "after recall 2")
      checkDeferred("after recall 2")

      // Done clears them.
      await ix.pressButton("DoneButton")
      model.done()
      expect(main.mode, "Done goes idle").toBe("idle")
      expectNoMixUp(main, "after Done")

      // Recall 3 (Start recall), one miss, lines shown; then Start clears them. The Start press waits
      // out the Start guard that follows Done (a press inside it is ignored by design).
      await waitUntil(() => getTime() - main.lastExitPressTime > main.startGuardSeconds + 0.15, 3000, "Start guard after Done passed")
      await ix.pressButton("StartRecallButton")
      const want3 = await onePassOneMiss("recall 3")
      expectMixUp(main, want3, "after recall 3 (one miss)")
      expectMixUpEnds(main, want3, "after recall 3")
      checkDeferred("after recall 3")
      await ix.pressButton("StartRecallButton")
      expect(main.mode, "Start recall starts recall 4").toBe("recall")
      expectNoMixUp(main, "after pressing Start recall")

      // mixUpLines off: recall 4 with a miss draws nothing (lines were seen on after recall 3).
      main.mixUpLines = false
      await onePassOneMiss("recall 4")
      expect(main.isExitVisible, "recall 4 finished (exit shown)").toBe(true)
      expectNoMixUp(main, "after recall 4 with mixUpLines off")
      checkDeferred("after recall 4")

      // Both toggles on: recall shows no glow or ladder cue before the opening drop.
      main.mixUpLines = true
      main.practiceLadder = true
      await ix.pressButton("StartRecallButton")
      expect(JSON.stringify(main.bundleOrder), "recall 5 order = our model (retired letters left out)").toBe(JSON.stringify(model.startPass()))
      {
        const p = await waitForTopGrabbable(main)
        const t = targetOf(main, p)
        await ix.dropTopPieceAtSlot(main, t === -2 ? 23 : neighbourSlot(t), {
          onHeld: () => {
            expectNoGlow(main, "recall 5 (ladder and mix-up lines on), in hand")
            expect(main.cueKind, "recall 5 in hand: cueKind").toBe("none")
            expectNoRegion(main, "recall 5 in hand")
            expectNoMixUp(main, "recall 5 in hand")
          },
          beforeRelease: () => {
            expectNoGlow(main, "recall 5 just before the drop")
            expectNoRegion(main, "recall 5 just before the drop")
          },
        })
        expect(main.lastDropResult === "miss" || main.lastDropResult === "refused-hold", "recall 5 opening drop missed").toBe(true)
        expectNoMixUp(main, "recall 5 after a miss, during the pass")
      }
    } finally {
      main.mixUpLines = true
      main.practiceLadder = false
    }
    log("MIXUP done")
    await hideLeafOverlay()
  }
}
