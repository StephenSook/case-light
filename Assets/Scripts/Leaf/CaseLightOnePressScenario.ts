// Owns: the LEAF check of "one pinch, one press": a Start press within the Start guard after Again or Done is ignored and the same press after the guard works, and a button release whose pinch did not start on that button does nothing.
// Talks to: CaseLightLeafSupport (real SIK/UIKit input, strayReleaseOn, independent answers), CaseLightMain read-only getters (mode, ignoredStartPressCount, ignoredStrayReleaseCount, lastExitPressTime, startGuardSeconds, recallPassCount), Start / Again / Done buttons by name.
// Must not: call CaseLightMain's test hooks or commands (startPractice / startRecall included), or change product state except through real input.

/**
 * Builder change (verified in CaseLightMain.ts / CaseLightControlsUI.ts / CaseLightExitUI.ts): a
 * Start press from the UI within startGuardSeconds of an Again or Done press is ignored
 * (ignoredStartPressCount), and each button acts on its release only if the same pinch's
 * trigger-down armed it (ignoredStrayReleaseCount).
 *
 * Input: REAL (LEAF SIK interactor). Every press is a full hover, trigger-down, trigger-up on the
 * button. The stray release is also real SIK input: the pinch starts while aiming at nothing, the
 * aim moves onto the button while pinched, and the pinch ends there, so SIK sends that button a
 * TriggerEnd with no TriggerStart (the scenario checks which events the button actually got).
 * Positive controls: after the guard has passed, the same Start press does start a pass, with
 * ignoredStartPressCount unchanged; a normal press after the stray release does start a pass.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {CaseLightMain} from "../CaseLightMain"
import {CaseLightLeafInteractor, dropSlotFor, hideLeafOverlay, log, waitForReady, waitForTopGrabbable, waitUntil} from "./CaseLightLeafSupport"

async function sortAll(ix: CaseLightLeafInteractor, main: CaseLightMain, label: string): Promise<void> {
  while (main.mode === "recall") {
    const p = await waitForTopGrabbable(main)
    await ix.dropTopPieceAtSlot(main, dropSlotFor(main, p))
    expect(main.lastDropResult, `${label}: piece ${p} placed`).toBe("correct")
  }
  expect(main.isExitVisible, `${label}: Again / Done shown`).toBe(true)
}

@component
export class CaseLightOnePressScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    const guard = main.startGuardSeconds
    expect(guard > 0, `Start guard set (${guard} s)`).toBe(true)
    const pastGuard = async (what: string) => waitUntil(() => getTime() - main.lastExitPressTime > guard + 0.2, 4000, `Start guard passed after ${what}`)

    // Recall pass, then Again; Start practice pressed at once is ignored.
    await ix.pressButton("StartRecallButton")
    await sortAll(ix, main, "recall 1")
    await ix.pressButton("AgainButton")
    expect(main.mode, "Again starts a recall pass").toBe("recall")
    const orderAfterAgain = JSON.stringify(main.bundleOrder)
    const passesAfterAgain = main.recallPassCount
    let ign = main.ignoredStartPressCount
    let stray = main.ignoredStrayReleaseCount
    const gapAgain = (await ix.pressButtonTimed("StartPracticeButton")) - main.lastExitPressTime
    expect(gapAgain >= 0 && gapAgain < guard, `precondition: the Start press landed inside the guard (${gapAgain.toFixed(3)} s after Again)`).toBe(true)
    log(`ONE-PRESS Start practice pressed ${gapAgain.toFixed(2)} s after Again (guard ${guard.toFixed(2)} s): mode ${main.mode}, ignored ${main.ignoredStartPressCount - ign}`)
    expect(main.ignoredStartPressCount - ign, "Start press right after Again ignored (count +1)").toBe(1)
    expect(main.mode, "mode unchanged by the ignored press (recall)").toBe("recall")
    expect(JSON.stringify(main.bundleOrder), "bundle order unchanged by the ignored press").toBe(orderAfterAgain)
    expect(main.recallPassCount, "no new pass from the ignored press").toBe(passesAfterAgain)
    expect(main.ignoredStrayReleaseCount, "a full press is no stray release").toBe(stray)

    // Positive control: after the guard, the same press works.
    await pastGuard("Again")
    ign = main.ignoredStartPressCount
    const lateGap = (await ix.pressButtonTimed("StartPracticeButton")) - main.lastExitPressTime
    log(`ONE-PRESS Start practice pressed ${lateGap.toFixed(3)} s after Again: mode ${main.mode}`)
    expect(main.mode, "Start practice after the guard starts practice (positive control)").toBe("practice")
    expect(main.ignoredStartPressCount, "nothing ignored after the guard").toBe(ign)

    // Recall pass, then Done; Start recall pressed at once is ignored.
    await ix.pressButton("StartRecallButton")
    await sortAll(ix, main, "recall 2")
    await ix.pressButton("DoneButton")
    expect(main.mode, "Done goes idle").toBe("idle")
    const passesAfterDone = main.recallPassCount
    ign = main.ignoredStartPressCount
    const gapDone = (await ix.pressButtonTimed("StartRecallButton")) - main.lastExitPressTime
    expect(gapDone >= 0 && gapDone < guard, `precondition: the Start press landed inside the guard (${gapDone.toFixed(3)} s after Done)`).toBe(true)
    log(`ONE-PRESS Start recall pressed ${gapDone.toFixed(2)} s after Done (guard ${guard.toFixed(2)} s): mode ${main.mode}, ignored ${main.ignoredStartPressCount - ign}`)
    expect(main.ignoredStartPressCount - ign, "Start press right after Done ignored (count +1)").toBe(1)
    expect(main.mode, "mode unchanged by the ignored press (idle)").toBe("idle")
    expect(main.recallPassCount, "no new pass from the ignored press").toBe(passesAfterDone)

    // Stray release on Start practice, past the guard: only the arming can stop it.
    await pastGuard("Done")
    ign = main.ignoredStartPressCount
    stray = main.ignoredStrayReleaseCount
    const ev = await ix.strayReleaseOn("StartPracticeButton")
    log(`ONE-PRESS stray release on Start practice: TriggerStart ${ev.startFired}, TriggerEnd ${ev.endFired}; stray count +${main.ignoredStrayReleaseCount - stray}, mode ${main.mode}`)
    expect(ev.startFired, "the button saw no trigger-down from this pinch").toBe(false)
    expect(ev.endFired, "the button saw the release (TriggerEnd)").toBe(true)
    expect(main.ignoredStrayReleaseCount - stray, "stray release ignored (ignoredStrayReleaseCount +1)").toBe(1)
    expect(main.mode, "stray release starts nothing (idle)").toBe("idle")
    expect(main.ignoredStartPressCount, "the stray was not counted as a guarded Start press").toBe(ign)

    // Positive control: a full press on the same button now starts practice.
    await ix.pressButton("StartPracticeButton")
    expect(main.mode, "a full press after the stray starts practice (positive control)").toBe("practice")
    expect(main.ignoredStrayReleaseCount - stray, "the full press added no stray").toBe(1)
    log("ONE-PRESS done")
    await hideLeafOverlay()
  }
}
