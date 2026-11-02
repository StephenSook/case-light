// Owns: the LEAF check for the optional drill pace: off by default, the Drill pace toggle turns it on and off, the "drill pace 18/min" caption shows only while on, the light steps at 18 per minute (within 5%), and toggling it changes no other state.
// Talks to: CaseLightLeafSupport (real SIK/UIKit input and assertions), CaseLightMain read-only getters (pace read-outs, counts, glow), DrillPaceButton / PaceLight / PaceLabelText by name.
// Must not: call CaseLightMain's test hooks or commands (togglePace included), or change product state except through real input; the one exception is pace.lettersPerMinute, raised for the wrap check and put back to 18 in a finally.

/**
 * Product behaviour (builder, verified in CaseLightPace.ts / CaseLightControlsUI.ts): the pace
 * step is computed from elapsed time (steps = seconds * rate / 60), not counted per frame.
 *
 * Input: REAL (LEAF SIK interactor): Start recall, one miss so a cell is lit, then the Drill pace
 * toggle is pressed with a real UIKit trigger, twice.
 * Positive controls: the default-off state is recorded before the opening press and asserted only
 * after the light and caption have been seen ON; "caption hidden" after the second press comes
 * after it was seen shown.
 * Rate: the frame time of each paceStepCount change is recorded, and the rate is computed from the
 * time between two changes at least 6 steps apart (not a count over a fixed window).
 * Wrap: with the rate raised to 180/min (restored to 18 in a finally), every separation the light
 * settles on is checked in the case's own frame: x on that separation's centre, y on the bottom of
 * its opening (both from CaseLightMain's slot position and cell corners, not from the pace code),
 * including 39 -> 40 (lower row end to upper row start) and 79 -> 0 (wrap back to the lower row).
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {nextFrame} from "Leaf.lspkg/Utils/common/Utils"
import {CaseLightMain} from "../CaseLightMain"
import {hideLeafOverlay, CaseLightLeafInteractor, targetOf, expectGlowAt, fmt, log, mustFind, neighbourSlot, waitForReady, waitForTopGrabbable, waitUntil} from "./CaseLightLeafSupport"

const EXPECTED_RATE = 18
const MIN_STEPS = 6

interface Snapshot {
  mode: string
  lit: number
  glow: boolean
  arrow: boolean
  unaided: number
  helped: number
  total: number
  sounds: number
  held: number
  placed: number
  top: number
  order: string
  lastDrop: string
}

function snap(main: CaseLightMain): Snapshot {
  return {
    mode: main.mode,
    lit: main.litSlotIndex,
    glow: main.isGlowVisible,
    arrow: main.isEdgeArrowVisible,
    unaided: main.unaidedCount,
    helped: main.helpedCount,
    total: main.totalCount,
    sounds: main.soundPlayCount,
    held: main.heldPieceIndex,
    placed: main.placedThisPass,
    top: main.topPieceIndex,
    order: JSON.stringify(main.bundleOrder),
    lastDrop: main.lastDropResult,
  }
}

function paceOff(main: CaseLightMain) {
  return {
    on: main.isPaceOn,
    sweep: main.paceSweepIndex,
    light: main.isPaceLightVisible,
    lightObj: mustFind("PaceLight").enabled,
    label: main.isPaceLabelVisible,
    steps: main.paceStepCount,
    elapsed: main.paceElapsedSeconds,
  }
}

@component
export class CaseLightDrillPaceScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()

    // Default state, recorded now and asserted after the positive control below.
    const atStart = paceOff(main)

    // Recall with one miss, so a cell is lit while the toggle is pressed.
    await ix.pressButton("StartRecallButton")
    expect(main.mode, "recall started").toBe("recall")
    const p = await waitForTopGrabbable(main)
    const target = targetOf(main, p)
    await ix.dropTopPieceAtSlot(main, neighbourSlot(target))
    expect(main.lastDropResult, "deliberate miss").toBe("miss")
    await waitForTopGrabbable(main)
    expectGlowAt(main, target, "answer lit after the miss (before the toggle)")
    const before = snap(main)

    // Press Drill pace (real UIKit trigger): ON.
    await ix.pressButton("DrillPaceButton")
    await nextFrame()
    const caption = mustFind("PaceLabelText").getComponent("Component.Text") as Text
    expect(main.isPaceOn, "isPaceOn after the press").toBe(true)
    expect(main.isPaceLightVisible, "isPaceLightVisible while on").toBe(true)
    expect(mustFind("PaceLight").enabled, "PaceLight scene object enabled while on").toBe(true)
    expect(main.isPaceLabelVisible, "isPaceLabelVisible while on").toBe(true)
    expect(caption.enabled, "PaceLabelText Text component enabled while on").toBe(true)
    expect(main.paceLabelText, "paceLabelText").toBe("drill pace 18/min")
    expect(caption.text, "caption on screen").toBe("drill pace 18/min")
    expect(main.paceLettersPerMinute, "paceLettersPerMinute").toBe(EXPECTED_RATE)
    expect(Math.abs(main.paceSecondsPerSeparation - 60 / EXPECTED_RATE) < 1e-6, "paceSecondsPerSeparation = 60 / rate").toBe(true)
    expect(main.paceSweepIndex >= 0, "paceSweepIndex while on").toBe(true)

    // Off by default (asserted now that the detectors have seen it on).
    log(`PACE default: ${JSON.stringify(atStart)}`)
    expect(atStart.on, "pace off by default").toBe(false)
    expect(atStart.sweep, "paceSweepIndex off by default").toBe(-1)
    expect(atStart.light || atStart.lightObj, "pace light hidden by default").toBe(false)
    expect(atStart.label, "pace caption hidden by default").toBe(false)
    expect(atStart.steps, "paceStepCount 0 by default").toBe(0)

    // Toggling it on changed nothing else.
    const after = snap(main)
    log(`PACE state before toggle ${JSON.stringify(before)} after ${JSON.stringify(after)}`)
    expect(JSON.stringify(after), "no other state changed by turning the pace on").toBe(JSON.stringify(before))

    // Rate: frame time of each step change; rate from two changes MIN_STEPS or more apart.
    const changes: {k: number; t: number}[] = []
    let last = main.paceStepCount
    const deadline = getTime() + (MIN_STEPS + 3) * (60 / EXPECTED_RATE) + 3
    while (getTime() < deadline) {
      await nextFrame()
      const k = main.paceStepCount
      if (k !== last) {
        changes.push({k, t: getTime()})
        expect(k - last, `paceStepCount advances one at a time (from ${last} to ${k})`).toBe(1)
        expect(main.paceSweepIndex, "paceSweepIndex follows the step count").toBe(k % 80)
        last = k
        if (changes.length > 1 && changes[changes.length - 1].k - changes[0].k >= MIN_STEPS) break
      }
    }
    expect(changes.length >= 2, `saw step changes (${changes.length})`).toBe(true)
    const earliest = changes[0]
    const lastChange = changes[changes.length - 1]
    const steps = lastChange.k - earliest.k
    expect(steps >= MIN_STEPS, `measured over ${steps} steps`).toBe(true)
    const rate = (steps / (lastChange.t - earliest.t)) * 60
    const intervals = changes.slice(1).map((c, i) => (c.t - changes[i].t).toFixed(3))
    log(`PACE changes at k=${changes.map((c) => c.k).join(",")}; intervals ${intervals.join(", ")} s; rate ${rate.toFixed(3)}/min over ${steps} steps (${(lastChange.t - earliest.t).toFixed(3)} s)`)
    expect(Math.abs(rate - EXPECTED_RATE) / EXPECTED_RATE <= 0.05, `measured rate ${rate.toFixed(3)}/min within 5% of ${EXPECTED_RATE}`).toBe(true)

    // The light sits on the separation the sweep names.
    await nextFrame()
    await nextFrame()
    const i = main.paceSweepIndex
    const dx = Math.abs(mustFind("PaceLight").getTransform().getWorldPosition().x - main.slotWorldPosition(i).x)
    expect(dx < 0.3, `PaceLight on separation ${i} (dx ${dx.toFixed(2)} cm)`).toBe(true)

    // Row change and wrap: 39 -> 40 and 79 -> 0, at a raised rate (restored in finally).
    const fast = 180
    const seen: number[] = []
    const checked = new Map<number, string>()
    let wrapped = false
    try {
      main.pace.lettersPerMinute = fast
      const inv = main.caseRoot.getTransform().getInvertedWorldTransform()
      let prev = -9
      const end = getTime() + 45
      while (getTime() < end) {
        await nextFrame()
        const k = main.paceStepCount
        const idx = main.paceSweepIndex
        if (idx !== prev) {
          prev = idx
          continue
        }
        // Same separation two frames running: the light has had its update for this index.
        if (seen.length === 0 || seen[seen.length - 1] !== idx) {
          seen.push(idx)
          const lp = inv.multiplyPoint(mustFind("PaceLight").getTransform().getWorldPosition())
          const ls = inv.multiplyPoint(main.slotWorldPosition(idx))
          const ys = main.targetCornersWorld(idx).map((c) => inv.multiplyPoint(c).y)
          const half = (Math.max(...ys) - Math.min(...ys)) / 2
          const ex = Math.abs(lp.x - ls.x)
          const ey = Math.abs(lp.y - (ls.y - half))
          expect(ex < 0.1 && ey < 0.1, `PaceLight at separation ${idx}: off by x ${ex.toFixed(3)} y ${ey.toFixed(3)} cm (light ${fmt(lp)}, cell ${fmt(ls)}, half opening ${half.toFixed(2)})`).toBe(true)
          if (idx === 39 || idx === 40 || idx === 79 || idx === 0) checked.set(idx, `${fmt(lp)}`)
          if (k >= 80 && idx === 0) {
            wrapped = true
            break
          }
        }
      }
    } finally {
      main.pace.lettersPerMinute = EXPECTED_RATE
    }
    log(`PACE wrap: visited ${seen.length} separations, ${seen.slice(0, 3).join(",")}..${seen.slice(-4).join(",")}; light at 39 ${checked.get(39)}, 40 ${checked.get(40)}, 79 ${checked.get(79)}, 0 ${checked.get(0)}`)
    expect(wrapped, "light reached step 80 and wrapped to separation 0").toBe(true)
    const at = (n: number) => seen.indexOf(n)
    expect(at(39) >= 0 && at(40) > at(39), "the light was seen settled on 39, then on 40").toBe(true)
    expect(at(79) > at(40) && at(0) > at(79), "the light was seen settled on 79, then back on 0").toBe(true)
    let skipped = 0
    for (let n = 1; n < seen.length; n++) if (seen[n] !== (seen[n - 1] + 1) % 80) skipped++
    log(`PACE wrap: ${skipped} separations not observed settled (frame timing, not asserted)`)
    expect(main.paceLettersPerMinute, "rate restored").toBe(EXPECTED_RATE)

    // Press again: OFF. Caption and light hidden (after being seen shown), nothing else changed.
    await ix.pressButton("DrillPaceButton")
    await nextFrame()
    await waitUntil(() => !main.isPaceOn, 2000, "pace off after the second press")
    expect(main.isPaceLightVisible, "isPaceLightVisible after turning off").toBe(false)
    expect(mustFind("PaceLight").enabled, "PaceLight scene object after turning off").toBe(false)
    expect(main.isPaceLabelVisible, "isPaceLabelVisible after turning off").toBe(false)
    expect(caption.enabled, "PaceLabelText Text component after turning off").toBe(false)
    expect(main.paceSweepIndex, "paceSweepIndex after turning off").toBe(-1)
    expect(JSON.stringify(snap(main)), "no other state changed by the pace on/off").toBe(JSON.stringify(before))
    log("PACE done")
    await hideLeafOverlay()
  }
}
