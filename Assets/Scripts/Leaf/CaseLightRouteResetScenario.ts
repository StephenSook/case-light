// Owns: the LEAF check that the route picker is greyed out and refuses during a pass, and that a switch between passes starts the new route fresh: score, came-back count, retirement, mix-up lines, the card and the exit all reset, and every letter is back for recall.
// Talks to: CaseLightLeafSupport (real SIK drops and UIKit presses), CaseLightRecallSupport (the test's own pass model and player), CaseLightRouteSupport (real route switch), CaseLightRoute.recallOrder (the brief's pass order), CaseLightMain read-only getters.
// Must not: import CaseLightRoute's tables, call product commands or test hooks, or change product state except through real input.

import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {recallOrder} from "../CaseLightRoute"
import {CaseLightLeafInteractor, hideLeafOverlay, log, mustFind, waitForReady, waitUntil} from "./CaseLightLeafSupport"
import {OwnModel, playRecallPass} from "./CaseLightRecallSupport"
import {switchRoute} from "./CaseLightRouteSupport"

function routeButtonInactive(route: number): boolean {
  const b = mustFind(`RouteButton_${route}`).getComponent(Button.getTypeName()) as Button
  return b.inactive
}

@component
export class CaseLightRouteResetScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    const n = main.pieceCount
    const model = new OwnModel(n)
    expect(main.isRoutePickerEnabled, "control: the picker is live between passes").toBe(true)
    expect(routeButtonInactive(2), "control: Route 2 button not greyed while idle").toBe(false)

    // Route 1, recall pass 1: every letter from memory.
    await ix.pressButton("StartRecallButton")
    model.startPass()
    await playRecallPass(ix, main, model, "Route 1 recall 1")

    // Recall 2 (Again): the picker is greyed out and refuses a press during the pass.
    await ix.pressButton("AgainButton")
    const o0 = model.startPass()[0]
    expect(main.mode, "recall 2 running").toBe("recall")
    expect(main.isRoutePickerEnabled, "during a pass: the picker is not live").toBe(false)
    expect(routeButtonInactive(2), "during a pass: Route 2 button greyed out").toBe(true)
    const switches = main.routeSwitchCount
    let pressed = "pressed"
    try {
      await ix.pressButton("RouteButton_2")
    } catch (e) {
      pressed = `not pressable (${e})`
    }
    await sleep(200)
    log(`ROUTE reset: Route 2 press during recall 2: ${pressed}; route ${main.routeId}, switches +${main.routeSwitchCount - switches}, mode ${main.mode}`)
    expect(main.routeId, "during a pass: the route stays Route 1").toBe(1)
    expect(main.routeSwitchCount, "during a pass: no switch").toBe(switches)
    expect(main.routePickerShownRoute, "during a pass: the picker still shows Route 1").toBe(1)
    expect(main.mode, "during a pass: the pass goes on").toBe("recall")
    // Rest of recall 2: its top letter missed once (came-back, a mix-up line, a helped letter).
    const t2 = await playRecallPass(ix, main, model, "Route 1 recall 2", (p, k) => p === o0 && k === 0)
    expect(t2.comeBacks, "recall 2: one come-back").toBe(1)

    // Before the switch: everything to reset is set (positive controls).
    await waitUntil(() => main.isExitVisible && main.isRoutePickerEnabled, 2000, "exit after recall 2, picker live again")
    expect(routeButtonInactive(2), "between passes: Route 2 button live again").toBe(false)
    const before = {u: main.unaidedCount, h: main.helpedCount, t: main.totalCount, retired: main.retiredCount, passes: main.recallPassCount, card: main.isResultVisible}
    log(`ROUTE reset before the switch: ${JSON.stringify(before)}; ours from memory ${model.fromMemory}, helped ${model.helped}, total ${model.total}, retired ${model.retiredCount}`)
    expect(before.u === model.fromMemory && before.h === model.helped && before.t === model.total, "control: the score is our tally (15 of 16)").toBe(true)
    expect(before.retired, "control: letters from memory in both passes retired").toBe(model.retiredCount)
    expect(before.retired > 0 && before.card && before.passes === 2, "control: retired letters, a card and two passes before the switch").toBe(true)
    expect(main.comeBackCount, "control: came back 1 before the switch").toBe(1)
    expect(main.mixUpLineCount, "control: one mix-up line before the switch").toBe(1)

    // The switch starts Route 2 fresh.
    await switchRoute(ix, main, 2, "switch after recall 2")
    log(`ROUTE reset after the switch: unaided ${main.unaidedCount}, helped ${main.helpedCount}, total ${main.totalCount}, came back ${main.comeBackCount}, retired ${main.retiredCount}, passes ${main.recallPassCount}, mix-up lines ${main.mixUpLineCount}, card ${main.isResultVisible}, exit ${main.isExitVisible}`)
    expect(main.unaidedCount + main.helpedCount + main.totalCount, "the score resets on a switch").toBe(0)
    expect(main.comeBackCount, "came-back count resets").toBe(0)
    expect(main.retiredCount, "retirement resets").toBe(0)
    expect(main.mixUpLineCount, "mix-up lines cleared").toBe(0)
    expect(main.isResultVisible || main.isExitVisible, "card and exit hidden").toBe(false)
    expect(main.mode, "idle on the new route").toBe("idle")
    for (let i = 0; i < n; i++) expect(main.isPieceShown(i), `letter ${i} back in the bundle`).toBe(true)
    await ix.pressButton("StartRecallButton")
    expect(JSON.stringify(main.bundleOrder), "Route 2 recall starts at the brief's pass 0 order with every letter").toBe(JSON.stringify(recallOrder(n, 0)))
    log("ROUTE reset done")
    await hideLeafOverlay()
  }
}
