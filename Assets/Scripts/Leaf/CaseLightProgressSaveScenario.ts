// Owns: the LEAF check of item A2's save half: with no saved progress (pressing Reset progress before the pass if the welcome is up), one recall pass with every row-0 letter (the hold letter too) from memory and one row-1 letter missed once and placed when it came back saves route 1 row 0 learned, row 1 not learned, and the last score from the test's own tally; the welcome is hidden after the opening Start press; route 2 is not written.
// Talks to: CaseLightLeafSupport (real UIKit presses and SIK drops, independent answers from the printed case), CaseLightRecallSupport (the test's own recall model and pass player), CaseLightProgressSupport (the test's own store reading and JSON parse), CaseLightMain read-only getters (mode, placementLogLines, progressWelcomeShown), drawn objects by name (WelcomeProgress, ResetProgressButton).
// Must not: import CaseLightProgress, CaseLightProgressStore or CaseLightLog, write to or clear the store, call product commands or test hooks, or change product state except through real input.

/**
 * Runs as a pair with extra-progress-welcome (this one runs before it; the Lens restarts between them and
 * the store keeps what this one saved). Expected rows follow the rule as written: a row is saved
 * learned when every letter on it was last placed from memory this session, and not learned when
 * one of its letters was missed (its come-back placement is helped). Controls: before the pass no
 * key of ours is in the store; route 1 row 1 must NOT be saved learned.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {nextFrame} from "Leaf.lspkg/Utils/common/Utils"
import {CaseLightMain} from "../CaseLightMain"
import {CaseLightLeafInteractor, hideLeafOverlay, log, rowOfTarget, targetOf, waitForReady} from "./CaseLightLeafSupport"
import {LAST_KEY, ROUTE1_KEY, ROUTE2_KEY, logStore, ourStoreKeys, shown, storeHas, storeJson} from "./CaseLightProgressSupport"
import {OwnModel, playRecallPass} from "./CaseLightRecallSupport"

function lastLogLine(main: CaseLightMain): string {
  const lines = main.placementLogLines
  return lines.length > 0 ? lines[lines.length - 1] : ""
}

function findLogLine(main: CaseLightMain, needle: string): string {
  const lines = main.placementLogLines
  for (let i = lines.length - 1; i >= 0; i--) if (lines[i].indexOf(needle) >= 0) return lines[i]
  return ""
}

@component
export class CaseLightProgressSaveScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    const n = main.pieceCount
    const model = new OwnModel(n)
    expect(main.routeId, "the Lens opens on route 1").toBe(1)
    logStore("at open")

    // ── Start from no saved progress ─────────────────────────────────────────────────────
    if (shown("ResetProgressButton")) {
      log("PROGRESS welcome up at open: pressing Reset progress")
      await ix.pressButton("ResetProgressButton")
      expect(lastLogLine(main).indexOf("event=progress-reset") >= 0, "Reset progress is logged").toBe(true)
      expect(shown("WelcomeProgress") || shown("ResetProgressButton"), "Reset progress hides the welcome and the button").toBe(false)
    }
    expect(JSON.stringify(ourStoreKeys()), "control: no key of ours in the store before the pass").toBe("[]")
    expect(main.progressWelcomeShown, "no welcome without saved progress").toBe(false)

    // Each letter's row, from the printed case (the hold letter's HOLD block is row 0).
    const rows: number[] = []
    for (let i = 0; i < n; i++) rows.push(rowOfTarget(targetOf(main, i)))
    log(`PROGRESS rows of letters ${JSON.stringify(rows)}`)
    expect(rows.filter((r) => r === 1).length >= 1, "row 1 has a letter to miss").toBe(true)

    // ── The opening Start press: the welcome stays hidden ────────────────────────────────
    await ix.pressButton("StartRecallButton")
    model.startPass()
    expect(main.mode, "a recall pass is running").toBe("recall")
    expect(shown("WelcomeProgress") || shown("ResetProgressButton") || main.progressWelcomeShown, "the welcome is hidden after the opening Start").toBe(false)

    // ── One recall pass: the row-1 letter presented earliest is missed once ───────────────
    let weak = -1
    const tally = await playRecallPass(ix, main, model, "progress pass", (p, k) => {
      if (weak < 0 && k === 0 && rows[p] === 1) {
        weak = p
        return true
      }
      return false
    })
    expect(weak >= 0 && tally.helpedSet.size === 1 && tally.helpedSet.has(weak), `only letter ${weak} (row 1) was helped`).toBe(true)
    await nextFrame()
    logStore("after the pass")

    // Our own expectation: row 0 every letter from memory: learned; row 1 had a miss: not learned.
    const expectRows = [0]
    const route1 = storeJson(ROUTE1_KEY)
    const last = storeJson(LAST_KEY)
    expect(route1 !== null && route1 !== "bad", `${ROUTE1_KEY} saved and readable`).toBe(true)
    expect(JSON.stringify(route1.rows), "route 1: row 0 saved learned, row 1 not").toBe(JSON.stringify(expectRows))
    expect(route1.rows.indexOf(1), "control: route 1 row 1 is NOT saved learned (one of its letters was missed)").toBe(-1)
    expect(last !== null && last !== "bad", `${LAST_KEY} saved and readable`).toBe(true)
    log(`PROGRESS last saved ${JSON.stringify(last)}; our tally ${model.fromMemory} of ${model.total}`)
    expect(last.x, "last x = our tally of letters placed from memory").toBe(model.fromMemory)
    expect(last.y, "last y = our tally of letters placed").toBe(model.total)
    expect(model.fromMemory === n - 1 && model.total === n, `our tally is ${n - 1} of ${n}`).toBe(true)
    expect(storeHas(ROUTE2_KEY), "route 2 is not written (per-route keys)").toBe(false)
    const saved = findLogLine(main, "event=progress-saved")
    log(`PROGRESS log: ${saved}`)
    expect(saved.indexOf(`route=1`) >= 0 && saved.indexOf(`event=progress-saved rows=0 x=${model.fromMemory} y=${model.total}`) >= 0, "the save is logged with route, rows and score").toBe(true)
    await hideLeafOverlay()
  }
}
