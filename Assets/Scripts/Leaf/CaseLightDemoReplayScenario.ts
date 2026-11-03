// Owns: the LEAF check of the demo replay (queue item 9) with the demoReplay input on for this run only: every scene starts in the recorded order, the "Demo replay" label is drawn on every sampled frame of the replay, every replayed placement has the recorded piece, cell and result, both recall cards equal the recording, the replay's session id starts with "r", and the replay ends without a stop.
// Talks to: CaseLightDemoFixture (the recording, cut from data/demo_replay_s1-g3nddr.log by the tester's script), CaseLightPlacementLogScenario.parseLogLine (the tester's own log reader), CaseLightMain read-only getters (demoReplay input value, demoReplayActive, demoScenesSeen, demoStopReason, placementLogLines, logSessionId), drawn objects DemoReplayLabel / ResultText / ResultCameBackText.
// Must not: import CaseLightDemo, call product commands or test hooks, or change product state (the replay plays itself; this scenario only watches).

/**
 * The input is turned on outside LEAF before this run (the CaseLight script's demoReplay set through
 * the Lens Studio MCP scene tool, never saved) and back off after it; the scenario fails at once,
 * by name, if the Lens started without it. Expected scenes come from the recording and the rule as
 * written: replay-start; practice-start / recall-start at each pass start; for an attempt, come-back
 * when a recall letter was missed earlier in that pass, else miss, refused-hold or off-case (a right
 * placement starts no scene); result at a recall pass end, pass-end at a practice pass end;
 * replay-end at the route switch. The sampler (own LateUpdateEvent) reads the drawn label and the
 * drawn score card on every frame from this scenario's start (the replay's 1.5 s lead-in) to the
 * replay's end.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {hideLeafOverlay, log, mustFind, waitForReady, waitUntil} from "./CaseLightLeafSupport"
import {RECORDING_LINES} from "./CaseLightDemoFixture"
import {parseLogLine} from "./CaseLightPlacementLogScenario"

const MIN_FRAMES = 600
const LABEL = "Demo replay"

/** The scenes the recording must start, in order (the rule above, applied to the recorded lines). */
export function expectedScenes(lines: string[]): string[] {
  const out = ["replay-start"]
  let missed = new Set<string>()
  for (const l of lines) {
    const f = parseLogLine(l)
    const ev = f.get("event")
    if (ev === "pass-start") {
      missed = new Set<string>()
      out.push(f.get("mode") === "practice" ? "practice-start" : "recall-start")
    } else if (ev === "pass-end") {
      out.push(f.get("mode") === "recall" ? "result" : "pass-end")
    } else if (ev === "route-switch") {
      out.push("replay-end")
      break
    } else {
      const piece = f.get("piece") as string
      const result = f.get("result")
      if (f.get("mode") === "recall" && missed.has(piece)) out.push("come-back")
      else if (result === "miss" || result === "refused-hold" || result === "off-case") out.push(result)
      if (result === "miss" || result === "refused-hold") missed.add(piece)
    }
  }
  return out
}

@component
export class CaseLightDemoReplayScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    if (!main.demoReplay) throw new Error("Precondition failed: the CaseLight script's demoReplay input is off. This scenario needs it on for this run only (set before the Lens starts, never saved).")

    const label = mustFind("DemoReplayLabel")
    const labelText = label.getComponent("Component.Text") as Text
    const result = mustFind("ResultText")
    const resultText = result.getComponent("Component.Text") as Text
    const line2 = mustFind("ResultCameBackText").getComponent("Component.Text") as Text
    let frames = 0
    let labelMissing = 0
    let earliestMissing = -1
    const cardsSeen: string[] = []
    let ended = false
    const ev = this.createEvent("LateUpdateEvent")
    ev.bind(() => {
      if (ended) return
      frames++
      const drawn = label.isEnabledInHierarchy && labelText.text === LABEL
      if (!drawn) {
        labelMissing++
        if (earliestMissing < 0) earliestMissing = frames
      }
      if (result.isEnabledInHierarchy) {
        const c = `${resultText.text} / ${line2.text}`
        if (cardsSeen[cardsSeen.length - 1] !== c) cardsSeen.push(c)
      }
    })
    try {
      await waitUntil(() => {
        const s = main.demoScenesSeen
        return !main.demoReplayActive && s.length > 0 && (s[s.length - 1] === "replay-end" || s[s.length - 1] === "stopped")
      }, 240000, "the replay ends (replay-end or stopped)")
    } finally {
      ended = true
      ev.enabled = false
    }

    const want = expectedScenes(RECORDING_LINES)
    const seen = main.demoScenesSeen
    log(`DEMO ${frames} frames sampled, label missing on ${labelMissing}${earliestMissing >= 0 ? ` (earliest frame ${earliestMissing})` : ""}; scenes ${JSON.stringify(seen)}; stop reason "${main.demoStopReason}"; session ${main.logSessionId}; cards seen ${JSON.stringify(cardsSeen)}`)
    expect(main.demoStopReason, "the replay ran to its end: no stop reason").toBe("")
    expect(JSON.stringify(seen), "every scene started, in the recorded order").toBe(JSON.stringify(want))
    expect(frames >= MIN_FRAMES, `at least ${MIN_FRAMES} frames sampled (${frames})`).toBe(true)
    expect(labelMissing, `the "${LABEL}" label is drawn on every sampled frame${earliestMissing >= 0 ? ` (missing from frame ${earliestMissing})` : ""}`).toBe(0)

    // The replay's own log lines against the recording.
    expect(/^r\d+-/.test(main.logSessionId), `the replay session id starts with "r" (${main.logSessionId})`).toBe(true)
    const lines = main.placementLogLines.map((l) => parseLogLine(l))
    for (const f of lines) expect((f.get("session") as string).charAt(0), `replay log line ${f.get("seq")}: session starts with "r"`).toBe("r")
    const recorded = RECORDING_LINES.map((l) => parseLogLine(l))
    const recPlace = recorded.filter((f) => !f.has("event"))
    const repPlace = lines.filter((f) => !f.has("event"))
    expect(repPlace.length, "one replayed placement line per recorded placement").toBe(recPlace.length)
    for (let i = 0; i < recPlace.length; i++) {
      const r = recPlace[i]
      const p = repPlace[i]
      const ctx = `placement ${i + 1} (recorded seq ${r.get("seq")})`
      expect(p.get("piece"), `${ctx}: piece`).toBe(r.get("piece"))
      expect(p.get("placed"), `${ctx}: placed`).toBe(r.get("placed"))
      expect(p.get("result"), `${ctx}: result`).toBe(r.get("result"))
    }
    const recEnds = recorded.filter((f) => f.get("event") === "pass-end" && f.get("mode") === "recall")
    const repEnds = lines.filter((f) => f.get("event") === "pass-end" && f.get("mode") === "recall")
    expect(repEnds.length, "two recall pass ends").toBe(2)
    for (let k = 0; k < 2; k++) {
      expect(repEnds[k].get("score"), `recall pass ${k + 1}: card = the recording`).toBe(recEnds[k].get("score"))
      expect(repEnds[k].get("cameback"), `recall pass ${k + 1}: came-back line = the recording`).toBe(recEnds[k].get("cameback"))
      const drawn = `${recEnds[k].get("score")} / ${recEnds[k].get("cameback")}`
      expect(cardsSeen.indexOf(drawn) >= 0, `recall pass ${k + 1}: the recorded card "${drawn}" was drawn`).toBe(true)
    }
    await hideLeafOverlay()
  }
}
