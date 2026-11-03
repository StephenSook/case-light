// Owns: the LEAF check that the demo replay is off at a normal Lens start: the demoReplay input is false, no replay is active and no demo scene has started, the "Demo replay" label is not drawn on any frame, and a normal practice pass (real input) starts no replay and logs live ("s") session lines.
// Talks to: CaseLightLeafSupport (real SIK grabs and drops, real UIKit presses, independent answers), CaseLightPlacementLogScenario.parseLogLine (the tester's own log reader), CaseLightMain read-only getters (demoReplay input value, demoReplayActive, demoScenesSeen, logSessionId, placementLogLines), drawn objects DemoReplayLabel / StartHint.
// Must not: import CaseLightDemo, call product commands or test hooks, or change product state except through real input.

/**
 * The same drawn-label detector as extra-demo-replay (DemoReplayLabel enabled with the label text);
 * there it sees the label on every frame, here it must see it on none. Positive control in this
 * run: the start hint, drawn in the label's place, is seen by the same kind of check before the
 * opening Start press.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {CaseLightLeafInteractor, dropSlotFor, hideLeafOverlay, log, mustFind, waitForReady, waitForTopGrabbable} from "./CaseLightLeafSupport"
import {parseLogLine} from "./CaseLightPlacementLogScenario"

const MIN_FRAMES = 200

@component
export class CaseLightDemoOffScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    const label = mustFind("DemoReplayLabel")
    const labelText = label.getComponent("Component.Text") as Text
    const hint = mustFind("StartHint")

    expect(main.demoReplay, "the demoReplay input is off at a normal start").toBe(false)
    expect(main.demoReplayActive, "no replay active at start").toBe(false)
    expect(main.demoScenesSeen.length, "no demo scene at start").toBe(0)
    expect(/^s\d+-/.test(main.logSessionId), `live session id starts with "s" (${main.logSessionId})`).toBe(true)
    expect(hint.isEnabledInHierarchy, "control: the start hint is drawn in the label's place").toBe(true)

    let frames = 0
    let drawnFrames = 0
    let activeFrames = 0
    let sampling = true
    const ev = this.createEvent("LateUpdateEvent")
    ev.bind(() => {
      if (!sampling) return
      frames++
      if (label.isEnabledInHierarchy && labelText.text.length > 0) drawnFrames++
      if (main.demoReplayActive || main.demoScenesSeen.length > 0) activeFrames++
    })
    try {
      await ix.pressButton("StartPracticeButton")
      expect(main.mode, "practice started").toBe("practice")
      while (main.mode === "practice") {
        const p = await waitForTopGrabbable(main)
        await ix.dropTopPieceAtSlot(main, dropSlotFor(main, p), {maxStepCm: 1.5})
        expect(main.lastDropResult, `letter ${p} placed`).toBe("correct")
      }
    } finally {
      sampling = false
      ev.enabled = false
    }
    const lines = main.placementLogLines.map((l) => parseLogLine(l))
    log(`DEMO-OFF ${frames} frames sampled; label drawn on ${drawnFrames}, replay seen on ${activeFrames}; ${lines.length} log lines, sessions ${JSON.stringify(Array.from(new Set(lines.map((f) => f.get("session")))))}`)
    expect(frames >= MIN_FRAMES, `at least ${MIN_FRAMES} frames sampled (${frames})`).toBe(true)
    expect(drawnFrames, `the "Demo replay" label is drawn on no frame`).toBe(0)
    expect(activeFrames, "no replay and no demo scene on any frame of a normal practice pass").toBe(0)
    expect(lines.length > 0, "control: the practice pass wrote log lines").toBe(true)
    for (const f of lines) expect((f.get("session") as string).charAt(0), `log line ${f.get("seq")}: live session ("s")`).toBe("s")
    await hideLeafOverlay()
  }
}
