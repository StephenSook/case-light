// Owns: the LEAF check of item A2's load half: at Lens start after extra-progress-save, the welcome's two lines read what the store holds (computed by the test from its own parse), the welcome and Reset progress are inside the display and clear of every opening neighbour (Reset progress at least 2 deg each way and at least 1 deg from each neighbour, Snap's guidance, and the whole welcome view passes the shared spacing check), a route switch at open redraws line 2 for that route, and the opening Start press hides both while the saved keys stay (extra-progress-reset runs next and needs them).
// Talks to: CaseLightLeafSupport (real UIKit presses, angle boxes, display rectangle), CaseLightTargetSpacing (the angular gap rule), CaseLightSpacingSupport (the shared census and view check), CaseLightProgressSupport (the test's own store reading and JSON parse), CaseLightMain read-only getters (routeId, placementLogLines, progressWelcomeShown, progressWelcomeLines), drawn objects by name (WelcomeLine1, WelcomeLine2, ResetProgressButton and the opening view's neighbours).
// Must not: import CaseLightProgress, CaseLightProgressStore or CaseLightLog, write to or clear the store, call product commands or test hooks, or change product state except through real input.

/**
 * Runs right after extra-progress-save (the Lens restarts in between; the store keeps its keys).
 * Without them it fails at once with "run extra-progress-save immediately before this scenario".
 * Expected wording, written here from the rule: "Welcome back. Last time: {x} of {y} from memory"
 * and "Route 1: {n} of 2 rows from memory", with x, y and n from the test's own parse of the store.
 * Controls: the welcome is shown at open and still shown after the route switch (and hidden after
 * the opening Start); the overlap test reports a box overlapping itself.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {CaseLightMain} from "../CaseLightMain"
import {MIN_TARGET_GAP_DEG, angularGap} from "../CaseLightTargetSpacing"
import {MIN_TARGET_DEG, checkView} from "./CaseLightSpacingSupport"
import {AngleBox, CaseLightLeafInteractor, angleBox, anglesOverlap, displaySpare, fmtBox, hideLeafOverlay, insideDisplay, log, roundedRectWorldCorners, textWorldCorners, waitForReady, waitUntil} from "./CaseLightLeafSupport"
import {LAST_KEY, ROUTE1_KEY, ROUTE2_KEY, logStore, shown, shownText, storeHas, storeJson} from "./CaseLightProgressSupport"

function optionalBox(label: string, make: () => vec3[]): {name: string; box: AngleBox} | null {
  try {
    return {name: label, box: angleBox(make())}
  } catch (e) {
    log(`PROGRESS neighbour ${label}: not measurable (${e})`)
    return null
  }
}

@component
export class CaseLightProgressWelcomeScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    logStore("at open")
    if (!storeHas(ROUTE1_KEY) || !storeHas(LAST_KEY)) throw new Error("run extra-progress-save immediately before this scenario")
    const route1 = storeJson(ROUTE1_KEY)
    const last = storeJson(LAST_KEY)
    expect(route1 !== "bad" && last !== "bad" && Array.isArray(route1.rows), "the saved values parse (test's own JSON reading)").toBe(true)
    expect(main.routeId, "the Lens opens on route 1").toBe(1)

    // ── The welcome reads what was saved ─────────────────────────────────────────────────
    const line1 = `Welcome back. Last time: ${last.x} of ${last.y} from memory`
    const line2 = `Route 1: ${route1.rows.length} of 2 rows from memory`
    log(`PROGRESS expected "${line1}" / "${line2}"; drawn "${shownText("WelcomeLine1")}" / "${shownText("WelcomeLine2")}"`)
    expect(main.progressWelcomeShown && shown("WelcomeProgress"), "control: the welcome is shown at open").toBe(true)
    expect(shownText("WelcomeLine1"), "welcome line 1 = the saved score").toBe(line1)
    expect(shownText("WelcomeLine2"), "welcome line 2 = route 1's saved rows").toBe(line2)
    expect(JSON.stringify(main.progressWelcomeLines), "welcome read-out").toBe(JSON.stringify([line1, line2]))
    expect(shown("ResetProgressButton"), "Reset progress is shown").toBe(true)
    const loaded = main.placementLogLines.filter((l) => l.indexOf("event=progress-loaded") >= 0)
    log(`PROGRESS log: ${loaded.length > 0 ? loaded[0] : "(none)"}`)
    expect(loaded.length === 1 && loaded[0].indexOf(`found=1`) >= 0 && loaded[0].indexOf(`x=${last.x} y=${last.y}`) >= 0, "one progress-loaded line with what was read").toBe(true)

    // ── Placement: inside the display at open, clear of every opening neighbour ─────────
    const items: {name: string; box: AngleBox}[] = [
      {name: "Reset progress button", box: angleBox(roundedRectWorldCorners("ResetProgressButton"))},
      {name: "welcome line 1", box: angleBox(textWorldCorners("WelcomeLine1"))},
      {name: "welcome line 2", box: angleBox(textWorldCorners("WelcomeLine2"))},
    ]
    const neighbours = [
      optionalBox("start hint (both lines and backing)", () => [...textWorldCorners("StartHint"), ...textWorldCorners("StartHintLine2"), ...roundedRectWorldCorners("StartHintBacking")]),
      optionalBox("Options button", () => roundedRectWorldCorners("OptionsButton")),
      optionalBox("Start practice button", () => roundedRectWorldCorners("StartPracticeButton")),
      optionalBox("Start recall button", () => roundedRectWorldCorners("StartRecallButton")),
      // Drill pace and Hide stand-in case: their places in the Options panel (drawn while it is open).
      optionalBox("Drill pace button", () => roundedRectWorldCorners("DrillPaceButton")),
      optionalBox("Show my case button", () => roundedRectWorldCorners("ShowMyCaseButton")),
      optionalBox("Hide stand-in case button", () => roundedRectWorldCorners("HideStandInButton")),
      // The caption's place is its backing (its Text is switched off while the pace is off, and an off Text has no usable box).
      optionalBox("drill pace caption's place", () => roundedRectWorldCorners("PaceLabelBacking")),
      optionalBox("Route 1 button", () => roundedRectWorldCorners("RouteButton_1")),
      optionalBox("Route 2 button", () => roundedRectWorldCorners("RouteButton_2")),
      optionalBox("Place on wall button", () => roundedRectWorldCorners("PlaceOnWallButton")),
      optionalBox("Veteran mode button", () => roundedRectWorldCorners("VeteranModeButton")),
      optionalBox("case caption (text and backing)", () => [...textWorldCorners("Caption"), ...roundedRectWorldCorners("CaptionBacking")]),
      optionalBox("version tag", () => [...textWorldCorners("VersionLabel"), ...roundedRectWorldCorners("VersionBacking")]),
    ]
    expect(neighbours.every((nb) => nb !== null), "every opening neighbour was measured").toBe(true)
    expect(anglesOverlap(items[0].box, items[0].box), "control: a box overlaps itself").toBe(true)
    for (const it of items) {
      log(`PROGRESS ${it.name}: ${fmtBox(it.box)}, spare ${displaySpare(it.box).toFixed(2)} deg`)
      expect(insideDisplay(it.box), `${it.name} inside the display at open (${fmtBox(it.box)})`).toBe(true)
      for (const nb of neighbours) {
        if (!nb) continue
        expect(anglesOverlap(it.box, nb.box), `${it.name} clear of the ${nb.name} (${fmtBox(nb.box)})`).toBe(false)
      }
    }
    // Reset progress is a pinch target: at least 1 deg from each neighbour (gap from the pure rule).
    const reset = items[0].box
    expect(angularGap(reset, reset) < 0, "control: the gap rule reads a box against itself as overlapping").toBe(true)
    const resetW = reset.maxYaw - reset.minYaw
    const resetH = reset.maxPitch - reset.minPitch
    log(`PROGRESS Reset progress size ${resetW.toFixed(2)} x ${resetH.toFixed(2)} deg`)
    expect(resetW >= MIN_TARGET_DEG && resetH >= MIN_TARGET_DEG, `Reset progress at least ${MIN_TARGET_DEG} deg each way (${resetW.toFixed(2)} x ${resetH.toFixed(2)} deg)`).toBe(true)
    for (const nb of neighbours) {
      if (!nb) continue
      const g = angularGap(reset, nb.box)
      log(`PROGRESS Reset progress to the ${nb.name}: ${g.toFixed(2)} deg`)
      expect(g >= MIN_TARGET_GAP_DEG, `Reset progress at least ${MIN_TARGET_GAP_DEG} deg from the ${nb.name} (${g.toFixed(2)} deg)`).toBe(true)
    }
    // The whole welcome view: every pinchable button, Reset progress among them (the Options panel
    // is built open for UIKit and settles closed on the opening LateUpdate).
    await waitUntil(() => !shown("OptionsPanel"), 2000, "the Options panel settled closed at open")
    checkView("welcome view", {required: ["ResetProgressButton", "OptionsButton", "StartPracticeButton", "StartRecallButton", "ShowMyCaseButton", "RouteButton_1", "RouteButton_2"], absent: ["DrillPaceButton", "HideStandInButton"]})

    // ── A route switch redraws line 2 for the new route (line 1 stays) ───────────────────
    const route2 = storeJson(ROUTE2_KEY)
    const route2Rows = route2 && route2 !== "bad" && Array.isArray(route2.rows) ? route2.rows.length : 0
    await ix.pressButton("RouteButton_2")
    await waitUntil(() => main.routeId === 2, 2000, "route 2 after the Route 2 press")
    const line2r2 = `Route 2: ${route2Rows} of 2 rows from memory`
    log(`PROGRESS after Route 2: "${shownText("WelcomeLine1")}" / "${shownText("WelcomeLine2")}" (expected line 2 "${line2r2}")`)
    expect(main.progressWelcomeShown && shown("WelcomeProgress"), "the welcome stays up after a route switch at open").toBe(true)
    expect(shownText("WelcomeLine1"), "line 1 unchanged by the route switch").toBe(line1)
    expect(shownText("WelcomeLine2"), "line 2 redrawn for route 2").toBe(line2r2)
    await ix.pressButton("RouteButton_1")
    await waitUntil(() => main.routeId === 1, 2000, "route 1 after the Route 1 press")
    expect(shownText("WelcomeLine2"), "line 2 back to route 1").toBe(line2)

    // ── The opening Start press hides the welcome and Reset progress; the keys stay ───────
    await ix.pressButton("StartPracticeButton")
    await waitUntil(() => main.mode === "practice", 2000, "practice after the opening Start press")
    expect(shown("WelcomeProgress") || shown("ResetProgressButton") || main.progressWelcomeShown, "the opening Start hides the welcome and Reset progress").toBe(false)
    logStore("after the opening Start")
    expect(storeHas(ROUTE1_KEY) && storeHas(LAST_KEY), "Start does not touch the saved keys (extra-progress-reset needs them next)").toBe(true)
    await hideLeafOverlay()
  }
}
