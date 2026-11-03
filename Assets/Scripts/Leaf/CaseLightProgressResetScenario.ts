// Owns: the LEAF check of item A2's reset: at Lens start after extra-progress-welcome (which leaves the saved keys in place), the welcome is up; Veteran mode on hides the welcome and Reset progress (no collider of theirs left on, and the eye ray toward slot 61 meets the slot-pinch target) and Veteran mode off brings them back with the same two lines; Reset progress removes our keys and only ours, hides the welcome and the button, and is logged; nothing else in the store is touched.
// Talks to: CaseLightLeafSupport (real UIKit presses), CaseLightNotesSupport (pinchSlotOpens: the same real slot pinch and wording as extra-veteran-notes' check c), CaseLightProgressSupport (the test's own store reading), CaseLightMain read-only getters (placementLogLines, progressWelcomeShown, progressWelcomeLines, veteranMode, isNoteChooserOpen), drawn objects by name (WelcomeProgress, WelcomeLine1, WelcomeLine2, ResetProgressButton, VeteranModeButton).
// Must not: import CaseLightProgress, CaseLightProgressStore or CaseLightLog, write to or clear the store, call product commands or test hooks, or change product state except through real input.

/**
 * Third of a chain: extra-progress-save leaves progress, extra-progress-welcome reads it and leaves
 * the keys, this one resets it. Without the keys it fails at once with "run extra-progress-save and
 * extra-progress-welcome immediately before this scenario".
 * Veteran mode: its slot pinches reach cells behind the welcome panel, so the panel (and every
 * collider under it, its backplate's interaction plane included) must be off while Veteran mode is
 * on. The slot pinch opens the note chooser; turning Veteran mode off closes it, pinning nothing.
 * Controls: the welcome and the button are shown before the press, and our keys are present.
 * Every other key in the store (if any) must survive the reset: Reset removes only our keys.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {CaseLightMain} from "../CaseLightMain"
import {CaseLightLeafInteractor, hideLeafOverlay, log, mustFind, waitForReady} from "./CaseLightLeafSupport"
import {pinchSlotOpens} from "./CaseLightNotesSupport"
import {LAST_KEY, ROUTE1_KEY, logStore, ourStoreKeys, shown, shownText, storeHas} from "./CaseLightProgressSupport"

/** A cell of the upper row, behind the welcome panel (the same cell as extra-veteran-notes' check c). */
const SLOT_BEHIND_WELCOME = 61

/** Colliders under WelcomeProgress that could take a ray right now (on, and their object on in the hierarchy). */
function liveWelcomeColliders(): string[] {
  const out: string[] = []
  const walk = (o: SceneObject) => {
    const cs = o.getComponents("Physics.ColliderComponent") as ColliderComponent[]
    for (const c of cs) if (c.enabled && o.isEnabledInHierarchy) out.push(o.name)
    for (let i = 0; i < o.getChildrenCount(); i++) walk(o.getChild(i))
  }
  walk(mustFind("WelcomeProgress"))
  return out
}

function lastLogLine(main: CaseLightMain): string {
  const lines = main.placementLogLines
  return lines.length > 0 ? lines[lines.length - 1] : ""
}

function otherKeys(): string[] {
  const ours = ourStoreKeys()
  return global.persistentStorageSystem.store
    .getAllKeys()
    .filter((k) => ours.indexOf(k) < 0)
    .sort()
}

@component
export class CaseLightProgressResetScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    logStore("at open")
    if (!storeHas(ROUTE1_KEY) || !storeHas(LAST_KEY)) throw new Error("run extra-progress-save and extra-progress-welcome immediately before this scenario")
    const before = ourStoreKeys()
    const others = otherKeys()
    log(`PROGRESS reset: our keys before ${JSON.stringify(before)}, other keys ${JSON.stringify(others)}`)
    expect(before.length >= 2, "control: our keys are present before the press").toBe(true)
    expect(main.progressWelcomeShown && shown("WelcomeProgress") && shown("ResetProgressButton"), "control: the welcome and Reset progress are shown at open").toBe(true)
    const lines = [shownText("WelcomeLine1"), shownText("WelcomeLine2")]
    const liveAtOpen = liveWelcomeColliders()
    log(`PROGRESS welcome at open: ${JSON.stringify(lines)}; live colliders under it ${JSON.stringify(liveAtOpen)}`)
    expect(liveAtOpen.length > 0, "control: the shown welcome has live colliders (its backplate, Reset progress)").toBe(true)

    // ── Veteran mode on: the welcome goes, so the cells behind it take the slot pinch ────
    await ix.pressButton("VeteranModeButton")
    expect(main.veteranMode, "Veteran mode is on").toBe(true)
    expect(shown("WelcomeProgress") || shown("ResetProgressButton") || main.progressWelcomeShown, "Veteran mode on hides the welcome and Reset progress").toBe(false)
    const liveVeteran = liveWelcomeColliders()
    log(`PROGRESS Veteran on: live colliders under the welcome ${JSON.stringify(liveVeteran)}`)
    expect(liveVeteran.length, "no collider under the hidden welcome takes a ray").toBe(0)
    await pinchSlotOpens(ix, main, SLOT_BEHIND_WELCOME, `pinch on slot ${SLOT_BEHIND_WELCOME} (upper row) with Veteran mode on`)

    // ── Veteran mode off: the welcome is back, same two lines ────────────────────────────
    await ix.pressButton("VeteranModeButton")
    expect(main.veteranMode || main.isNoteChooserOpen, "Veteran mode is off and its chooser closed").toBe(false)
    const back = [shownText("WelcomeLine1"), shownText("WelcomeLine2")]
    log(`PROGRESS Veteran off: welcome ${JSON.stringify(back)}`)
    expect(main.progressWelcomeShown && shown("WelcomeProgress") && shown("ResetProgressButton"), "Veteran mode off brings the welcome and Reset progress back").toBe(true)
    expect(JSON.stringify(back), "the same two lines").toBe(JSON.stringify(lines))
    expect(JSON.stringify(main.progressWelcomeLines), "the read-out matches").toBe(JSON.stringify(lines))
    expect(JSON.stringify(ourStoreKeys()), "Veteran mode changes no saved key").toBe(JSON.stringify(before))

    await ix.pressButton("ResetProgressButton")
    logStore("after Reset progress")
    expect(JSON.stringify(ourStoreKeys()), "Reset progress removes our keys").toBe("[]")
    expect(JSON.stringify(otherKeys()), "Reset progress leaves every other key").toBe(JSON.stringify(others))
    expect(shown("WelcomeProgress") || shown("ResetProgressButton") || main.progressWelcomeShown, "the welcome and Reset progress are hidden").toBe(false)
    const reset = lastLogLine(main)
    log(`PROGRESS log: ${reset}`)
    expect(reset.indexOf(`event=progress-reset removed=${before.length}`) >= 0, `the reset is logged (${before.length} keys removed)`).toBe(true)
    await hideLeafOverlay()
  }
}
