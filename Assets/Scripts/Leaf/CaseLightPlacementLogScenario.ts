// Owns: the LEAF check that the placement log reproduces what happened and what the card shows: one line per attempt with seq advancing by one, the printed address, the cell the test dropped at, the right cell from the printed labels, the result, memory=1 only for right recall placements of letters not missed earlier in the pass, pass and route-switch lines, and a recount from the lines that equals the drawn score card.
// Talks to: CaseLightLeafSupport (real SIK grabs, drops and releases, real UIKit presses, independent printed-label answers), CaseLightMain read-only getters (placementLogLines, logSessionId, logLineCount, mode, topPieceIndex, isHoldPiece, lastDropResult, counts), ResultText / ResultCameBackText / Piece_n by name.
// Must not: import CaseLightLog (this file has its own parser), call product commands or test hooks, or change product state except through real input.

/**
 * Real input only. Practice: the opening letter is released off the case once, the hold letter is
 * refused in cell 23 once, everything else goes in its cell. Recall 1: the opening letter is missed
 * once and the hold letter refused once. Recall 2 (Again): its opening letter is missed once. Then
 * Route 2 is picked. Every attempt is recorded here as it is made (letter, its printed address,
 * the cell aimed at, the independent answer, the expected result and memory flag) and compared
 * with the log lines one to one. The score recount uses only the lines.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {CaseLightLeafInteractor, answerFor, cardText, expectedResult, hideLeafOverlay, log, mustFind, neighbourSlot, waitForReady, waitForTopGrabbable, waitUntil} from "./CaseLightLeafSupport"
import {switchRoute} from "./CaseLightRouteSupport"

const PREFIX = "CASELIGHT_LOG v1"

/** Our own reader: "CASELIGHT_LOG v1" then key=value fields; a value is bare, or double-quoted with \" and \\ escapes. */
export function parseLogLine(line: string): Map<string, string> {
  if (line.indexOf(PREFIX + " ") !== 0) throw new Error(`log line without the prefix: ${line}`)
  const out = new Map<string, string>()
  let i = PREFIX.length + 1
  while (i < line.length) {
    const eq = line.indexOf("=", i)
    if (eq < 0) throw new Error(`no "=" after position ${i} in: ${line}`)
    const key = line.substring(i, eq)
    if (!/^[a-z]+$/.test(key)) throw new Error(`bad key "${key}" in: ${line}`)
    let j = eq + 1
    let value = ""
    if (line[j] === '"') {
      j++
      while (j < line.length && line[j] !== '"') {
        if (line[j] === "\\" && j + 1 < line.length) j++
        value += line[j]
        j++
      }
      if (line[j] !== '"') throw new Error(`unclosed quote in: ${line}`)
      j++
    } else {
      while (j < line.length && line[j] !== " ") value += line[j++]
    }
    if (out.has(key)) throw new Error(`key "${key}" twice in: ${line}`)
    out.set(key, value)
    if (j < line.length && line[j] !== " ") throw new Error(`no space after ${key} in: ${line}`)
    i = j + 1
  }
  return out
}

interface Attempt {
  mode: string
  piece: number
  address: string
  placed: string
  right: string
  result: string
  memory: string
}

function cardMain(): string {
  return (mustFind("ResultText").getComponent("Component.Text") as Text).text
}

function cardLine2(): string {
  return (mustFind("ResultCameBackText").getComponent("Component.Text") as Text).text
}

@component
export class CaseLightPlacementLogScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    const linesAtOpen = main.placementLogLines.length
    expect(linesAtOpen, "no log line before any pass").toBe(0)
    const attempts: Attempt[] = []
    let missedThisPass = new Set<number>()
    let passMode = "practice"

    /** Drop the top letter at `slot` (or release it off the case for "off") and record the expected line. */
    const attempt = async (slot: number | "off"): Promise<number> => {
      const p = await waitForTopGrabbable(main)
      const address = cardText(p, "AddressText").text
      const ans = answerFor(main, p)
      const right = ans.slot === -2 ? "HOLD" : `${ans.slot}`
      let placed: string
      let want: string
      if (slot === "off") {
        await ix.releaseTopPieceInPlace(main)
        placed = "OFF"
        want = "off-case"
      } else {
        await ix.dropTopPieceAtSlot(main, slot)
        expect(main.lastDropSlot, `letter ${p} dropped in cell ${slot}`).toBe(slot)
        const holdCell = slot >= 36 && slot <= 39
        placed = holdCell ? "HOLD" : `${slot}`
        const isRight = ans.slot === -2 ? holdCell : slot === ans.slot
        want = isRight ? "correct" : ans.slot === -2 ? "refused-hold" : "miss"
      }
      expect(main.lastDropResult, `letter ${p} at ${placed}: result`).toBe(want)
      const memory = passMode === "recall" && want === "correct" && !missedThisPass.has(p) ? "1" : "0"
      if (want === "miss" || want === "refused-hold") missedThisPass.add(p)
      attempts.push({mode: passMode, piece: p, address, placed, right, result: want, memory})
      return p
    }

    // ── Practice: an off-case release and a refused hold on the way ─────────────────────
    await ix.pressButton("StartPracticeButton")
    passMode = "practice"
    missedThisPass = new Set<number>()
    let offDone = false
    let holdRefused = false
    while (main.mode === "practice") {
      const p = await waitForTopGrabbable(main)
      const a = answerFor(main, p)
      if (!offDone) {
        await attempt("off")
        offDone = true
        continue
      }
      if (a.slot === -2 && !holdRefused) {
        await attempt(23)
        holdRefused = true
        continue
      }
      await attempt(a.slot === -2 ? 37 : a.slot)
    }
    expect(offDone && holdRefused, "practice: one off-case release and one refused hold").toBe(true)

    // ── Recall 1: the opening letter missed once, the hold letter refused once ───────────
    const recallPass = async (button: string, label: string, holdToo: boolean): Promise<void> => {
      await ix.pressButton(button)
      expect(main.mode, `${label} started`).toBe("recall")
      passMode = "recall"
      missedThisPass = new Set<number>()
      const opener = main.topPieceIndex
      let openerMissed = false
      let holdDone = !holdToo
      while (main.mode === "recall") {
        const p = await waitForTopGrabbable(main)
        const a = answerFor(main, p)
        if (p === opener && !openerMissed) {
          await attempt(a.slot === -2 ? 23 : neighbourSlot(a.slot))
          openerMissed = true
          continue
        }
        if (a.slot === -2 && !holdDone) {
          await attempt(23)
          holdDone = true
          continue
        }
        await attempt(a.slot === -2 ? 37 : a.slot)
      }
      await waitUntil(() => main.isResultVisible, 2000, `${label}: card shown`)
    }
    await recallPass("StartRecallButton", "recall 1", true)
    const card1 = {main: cardMain(), line2: cardLine2()}
    await recallPass("AgainButton", "recall 2", false)
    const card2 = {main: cardMain(), line2: cardLine2()}

    // ── Route switch ───────────────────────────────────────────────────────────────────────
    await switchRoute(ix, main, 2, "route switch")
    await sleep(100)

    // ── Read the lines back ────────────────────────────────────────────────────────────────
    const lines = main.placementLogLines
    const parsed = lines.map((l) => parseLogLine(l))
    log(`PLACELOG ${lines.length} lines; session ${main.logSessionId}; ${attempts.length} attempts made; last line: ${lines[lines.length - 1]}`)
    expect(main.logLineCount, "logLineCount = lines written").toBe(lines.length)
    for (let i = 0; i < parsed.length; i++) {
      expect(parsed[i].get("seq"), `line ${i + 1}: seq advances by exactly one`).toBe(`${i + 1}`)
      expect(parsed[i].get("session"), `line ${i + 1}: session id`).toBe(main.logSessionId)
    }
    const placements = parsed.filter((f) => !f.has("event"))
    expect(placements.length, "one placement line per attempt").toBe(attempts.length)
    for (let i = 0; i < attempts.length; i++) {
      const f = placements[i]
      const a = attempts[i]
      const ctx = `attempt ${i + 1} (${a.mode}, letter ${a.piece})`
      expect(f.get("mode"), `${ctx}: mode`).toBe(a.mode)
      expect(f.get("piece"), `${ctx}: piece`).toBe(`${a.piece}`)
      expect(f.get("address"), `${ctx}: address = the letter's printed address`).toBe(a.address)
      expect(f.get("placed"), `${ctx}: placed = the cell the test dropped at`).toBe(a.placed)
      expect(f.get("right"), `${ctx}: right = the answer from the printed labels`).toBe(a.right)
      expect(f.get("result"), `${ctx}: result`).toBe(a.result)
      expect(f.get("memory"), `${ctx}: memory`).toBe(a.memory)
      expect(f.get("route"), `${ctx}: route`).toBe("1")
    }
    const kinds = {off: attempts.filter((a) => a.result === "off-case").length, miss: attempts.filter((a) => a.result === "miss").length, refused: attempts.filter((a) => a.result === "refused-hold").length, mem: attempts.filter((a) => a.memory === "1").length}
    log(`PLACELOG attempts: off-case ${kinds.off}, miss ${kinds.miss}, refused-hold ${kinds.refused}, memory=1 ${kinds.mem}`)
    expect(kinds.off >= 1 && kinds.miss >= 1 && kinds.refused >= 2, "control: the log covers off-case, miss and refused-hold lines").toBe(true)

    // Pass lines: start and end of each pass; the recall pass-end lines carry the drawn card.
    const starts = parsed.filter((f) => f.get("event") === "pass-start")
    const ends = parsed.filter((f) => f.get("event") === "pass-end")
    expect(starts.length === 3 && ends.length === 3, `three pass-start and three pass-end lines (${starts.length}, ${ends.length})`).toBe(true)
    expect(JSON.stringify(starts.map((f) => f.get("mode"))), "pass modes").toBe(JSON.stringify(["practice", "recall", "recall"]))
    expect(ends[0].get("score") === "" && ends[0].get("cameback") === "", "practice pass-end: no score or came-back").toBe(true)
    expect(ends[1].get("score"), "recall 1 pass-end score= equals the drawn card").toBe(card1.main)
    expect(ends[1].get("cameback"), "recall 1 pass-end cameback= equals the drawn card").toBe(card1.line2)
    expect(ends[2].get("score"), "recall 2 pass-end score= equals the drawn card").toBe(card2.main)
    expect(ends[2].get("cameback"), "recall 2 pass-end cameback= equals the drawn card").toBe(card2.line2)

    // Recount from the lines alone: memory=1 and recall placements over the session reproduce the drawn card.
    const recount = (upTo: number) => {
      let x = 0
      let y = 0
      let comeBack = 0
      for (let i = 0; i <= upTo; i++) {
        const f = parsed[i]
        if (f.get("event") === "route-switch") {
          x = 0
          y = 0
        }
        if (f.get("event") === "pass-start") comeBack = 0
        if (f.has("event") || f.get("mode") !== "recall") continue
        if (f.get("result") === "correct") {
          y++
          if (f.get("memory") === "1") x++
        } else if (f.get("result") === "miss" || f.get("result") === "refused-hold") comeBack++
      }
      return {x, y, comeBack}
    }
    const end1 = parsed.indexOf(ends[1])
    const end2 = parsed.indexOf(ends[2])
    const r1 = recount(end1)
    const r2 = recount(end2)
    log(`PLACELOG recount: after recall 1 ${r1.x} of ${r1.y}, came back ${r1.comeBack} (card "${card1.main}" / "${card1.line2}"); after recall 2 ${r2.x} of ${r2.y}, came back ${r2.comeBack} (card "${card2.main}" / "${card2.line2}")`)
    expect(expectedResult(r1.x, r1.y), "recount after recall 1 = the drawn card").toBe(card1.main)
    expect(`Came back: ${r1.comeBack}`, "recall 1 come-backs from the lines = the drawn card").toBe(card1.line2)
    expect(expectedResult(r2.x, r2.y), "recount after recall 2 = the drawn card").toBe(card2.main)
    expect(`Came back: ${r2.comeBack}`, "recall 2 come-backs from the lines = the drawn card").toBe(card2.line2)

    // Route switch: one line, from Route 1 to Route 2, and the count starts again.
    const sw = parsed[parsed.length - 1]
    expect(sw.get("event"), "the newest line is the route switch").toBe("route-switch")
    expect(sw.get("from") === "1" && sw.get("route") === "2", `route-switch line from=1 route=2 (from=${sw.get("from")} route=${sw.get("route")})`).toBe(true)
    const r3 = recount(parsed.length - 1)
    expect(r3.x === 0 && r3.y === 0, "after the switch the recount starts again at 0 of 0").toBe(true)
    expect(main.unaidedCount + main.totalCount, "and so does the product's score").toBe(0)
    await hideLeafOverlay()
  }
}
