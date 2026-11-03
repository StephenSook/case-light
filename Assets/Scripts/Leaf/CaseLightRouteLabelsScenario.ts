// Owns: the LEAF check of v0.6 feature 4 (today's route) outside a pass: Route 1 by default; a real press on Route 2 relabels all 75 cells, the street names and the 8 letters to the second data file (one-number cells print one number), the caption and OpenStreetMap credit show on both routes, Veteran notes are kept per route, and Route 1 comes back exactly.
// Talks to: CaseLightLeafSupport (real UIKit presses and slot pinches), CaseLightRouteSupport and CaseLightRouteFixture (the data files as expectations), CaseLightNotesSupport (pin a note), CaseLightMain read-only getters (routeId, routePickerShownRoute, isRoutePickerEnabled, routeSwitchCount, noteForSlot).
// Must not: import CaseLightRoute's tables or functions, call product commands or test hooks, or change product state except through real input.

/**
 * Expectations come from data/case_light_route_osm.json and data/case_light_route_osm_b.json
 * (copied into CaseLightRouteFixture by the tester's own script, SHA-256 in its header), read
 * against the printed labels. Positive control: on Route 1 the same checks pass and read Route 1
 * numbers, so a Route 2 label check is not passing on stale text; the one-number check also sees
 * Route 1's single one-number cell (78).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {CaseLightLeafInteractor, hideLeafOverlay, log, mustFind, waitForReady, waitUntil} from "./CaseLightLeafSupport"
import {REMINDERS, pick, pinchSlotOpens} from "./CaseLightNotesSupport"
import {expectCaption, expectLetters, expectRouteLabels, expectStreetNames, fixture, switchRoute} from "./CaseLightRouteSupport"

const NOTE_SLOT = 20

function oneNumberSlots(route: number): number[] {
  return fixture(route).cells.filter((c) => c.right === null).map((c) => c.slot)
}

@component
export class CaseLightRouteLabelsScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()

    // Route 1 by default: everything matches the Route 1 data (positive control for every detector).
    expect(main.routeId, "Route 1 by default").toBe(1)
    expect(main.routePickerShownRoute, "the picker shows Route 1").toBe(1)
    expect(main.isRoutePickerEnabled, "the picker takes a press between passes").toBe(true)
    expectRouteLabels(main, 1, "Route 1 at open")
    expectStreetNames(main, 1, "Route 1 at open")
    expectLetters(main, 1, "Route 1 at open")
    expectCaption(1, "Route 1 at open")
    const r1Label0 = (mustFind("Label_0").getComponent("Component.Text") as Text).text

    // Switch to Route 2 (real press).
    await switchRoute(ix, main, 2, "to Route 2")
    expectRouteLabels(main, 2, "Route 2")
    expect((mustFind("Label_0").getComponent("Component.Text") as Text).text !== r1Label0, `control: Label_0 changed from Route 1's "${r1Label0.replace("\n", "/")}"`).toBe(true)
    expectStreetNames(main, 2, "Route 2")
    expectLetters(main, 2, "Route 2")
    expectCaption(2, "Route 2")
    const ones = oneNumberSlots(2)
    expect(JSON.stringify(ones), "Route 2's data has one-number cells 45, 52, 74, 78").toBe(JSON.stringify([45, 52, 74, 78]))
    for (const s of ones) {
      const t = (mustFind(`Label_${s}`).getComponent("Component.Text") as Text).text
      expect(/^\d+$/.test(t), `Route 2 cell ${s} prints exactly one number ("${t.replace("\n", "/")}")`).toBe(true)
    }
    const two = fixture(2).cells.filter((c) => c.right !== null)
    let twoOk = 0
    for (const c of two) if (/^\d+\n\d+$/.test((mustFind(`Label_${c.slot}`).getComponent("Component.Text") as Text).text)) twoOk++
    expect(twoOk, "control: every other Route 2 cell prints two numbers").toBe(two.length)

    // Notes are kept per route: one on slot 20 on each route, different texts.
    await ix.pressButton("VeteranModeButton")
    await waitUntil(() => main.veteranMode, 1000, "Veteran mode on (Route 2)")
    await pinchSlotOpens(ix, main, NOTE_SLOT, "Route 2 note")
    await pick(ix, main, REMINDERS[0], "Route 2 note")
    await ix.pressButton("VeteranModeButton")
    await waitUntil(() => !main.veteranMode, 1000, "Veteran mode off (Route 2)")
    expect(main.noteForSlot(NOTE_SLOT), "control: Route 2 has its note on slot 20").toBe(REMINDERS[0])

    await switchRoute(ix, main, 1, "back to Route 1")
    expect(main.noteForSlot(NOTE_SLOT), "Route 1 does not carry Route 2's note").toBe(null)
    await ix.pressButton("VeteranModeButton")
    await waitUntil(() => main.veteranMode, 1000, "Veteran mode on (Route 1)")
    await pinchSlotOpens(ix, main, NOTE_SLOT, "Route 1 note")
    await pick(ix, main, REMINDERS[2], "Route 1 note")
    await ix.pressButton("VeteranModeButton")
    await waitUntil(() => !main.veteranMode, 1000, "Veteran mode off (Route 1)")

    await switchRoute(ix, main, 2, "Route 2 again")
    expect(main.noteForSlot(NOTE_SLOT), "Route 2 kept its own note").toBe(REMINDERS[0])
    await switchRoute(ix, main, 1, "Route 1 again")
    expect(main.noteForSlot(NOTE_SLOT), "Route 1 kept its own note").toBe(REMINDERS[2])

    // Route 1 comes back exactly.
    expectRouteLabels(main, 1, "Route 1 after two round trips")
    expectStreetNames(main, 1, "Route 1 after two round trips")
    expectLetters(main, 1, "Route 1 after two round trips")
    expectCaption(1, "Route 1 after two round trips")
    expect(JSON.stringify(oneNumberSlots(1)), "control: Route 1's data has one one-number cell (78)").toBe(JSON.stringify([78]))
    expect(main.routeSwitchCount, "four switches").toBe(4)
    log("ROUTE labels done")
    await hideLeafOverlay()
  }
}
