// Owns: the LEAF check for the cue sounds: a chime from the snapped cell on a right drop, a miss tone from the answer cell on a miss, a miss tone from the HOLD block (-2) on a refused hold drop, a chime from -2 on an accepted one, nothing on an off-case release.
// Talks to: CaseLightLeafSupport (real SIK/UIKit input, expectCue), CaseLightMain read-only getters (lastSoundName, lastSoundSlot, soundPlayCount), ChimeSource / MissSource by name.
// Must not: call CaseLightMain's test hooks or commands, or change product state except through real input.

/**
 * Product behaviour (builder, verified in CaseLightMain.ts / CaseLightAudio.ts): every cue is
 * counted (soundPlayCount), named (lastSoundName) and placed (lastSoundSlot, and the source
 * object is moved to that cell before it plays). Lens audio cannot be heard in a LEAF run, so the
 * read-outs and the source positions are the evidence.
 *
 * Input: REAL (LEAF SIK interactor), one practice pass up to and including the hold piece.
 * Positive control: the counter is seen to move (+1 on piece 0's chime) before the off-case
 * release is asserted to add nothing.
 * Playback: from the frame the Lens handled the drop, the cue source's AudioComponent is polled
 * for up to 10 frames and must report isPlaying() (a re-played source can read false on the earliest
 * query in that frame and true on the next, seen at the hold refusal), with its audioTrack the
 * product's chimeTrack / missTrack asset, volume > 0, spatial audio on, and an
 * AudioListenerComponent on the camera object. Whether it is audible stays a manual check.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {CaseLightMain} from "../CaseLightMain"
import {hideLeafOverlay, CaseLightLeafInteractor, Playback, expectPlayback, pollPlayback, readPlayback, targetOf, expectCue, log, neighbourSlot, waitForReady, waitForTopGrabbable} from "./CaseLightLeafSupport"

const POLL_FRAMES = 10

/** Drop the top piece at `slot`; from the release frame, poll the `kind` source; assert and log its playback. */
async function dropAndHear(ix: CaseLightLeafInteractor, main: CaseLightMain, slot: number, kind: "chime" | "miss", ctx: string): Promise<void> {
  let atRelease = null as Playback | null
  let poll = null as Promise<{p: Playback; frame: number; reads: string[]}> | null
  await ix.dropTopPieceAtSlot(main, slot, {
    afterRelease: () => {
      atRelease = readPlayback(main, kind)
      poll = pollPlayback(main, kind, POLL_FRAMES)
    },
  })
  if (!poll) throw new Error(`${ctx}: playback poll not started (no release seen)`)
  const r = await (poll as Promise<{p: Playback; frame: number; reads: string[]}>)
  log(`SOUND ${ctx}: read at release ${JSON.stringify(atRelease)}; playing at poll frame ${r.frame} (${r.reads.join(" ")})`)
  expect(r.frame >= 0, `${ctx}: ${kind} source reports isPlaying() within ${POLL_FRAMES} frames of the drop`).toBe(true)
  expectPlayback(r.p, kind, ctx)
}

@component
export class CaseLightSoundCueScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()

    await ix.pressButton("StartPracticeButton")
    expect(main.mode, "practice started").toBe("practice")

    // Piece 0, right drop: one chime from its separation (positive control for the counter).
    const p0 = await waitForTopGrabbable(main)
    const t0 = targetOf(main, p0)
    let c = main.soundPlayCount
    await dropAndHear(ix, main, t0, "chime", `piece ${p0} right drop`)
    expect(main.lastDropResult, `piece ${p0} placed`).toBe("correct")
    expectCue(main, "chime", t0, c, `piece ${p0} right drop`)
    log(`SOUND chime from ${main.lastSoundSlot}, count ${main.soundPlayCount}`)

    // Piece 1, let go over the tray (off the case): no cue at all.
    const p1 = await waitForTopGrabbable(main)
    const t1 = targetOf(main, p1)
    c = main.soundPlayCount
    const lastName = main.lastSoundName
    const lastSlot = main.lastSoundSlot
    await ix.releaseTopPieceInPlace(main)
    expect(main.lastDropResult, `piece ${p1} released off the case`).toBe("off-case")
    expect(main.soundPlayCount - c, "off-case release adds no cue").toBe(0)
    expect(main.lastSoundName, "off-case release leaves the last cue name").toBe(lastName)
    expect(main.lastSoundSlot, "off-case release leaves the last cue place").toBe(lastSlot)

    // Piece 1, wrong cell: one miss tone from the ANSWER cell, not from where it was dropped.
    const wrong = neighbourSlot(t1)
    c = main.soundPlayCount
    await dropAndHear(ix, main, wrong, "miss", `piece ${p1} miss`)
    expect(main.lastDropResult, `piece ${p1} miss`).toBe("miss")
    expectCue(main, "miss", t1, c, `piece ${p1} dropped on ${wrong}`)
    log(`SOUND miss from ${main.lastSoundSlot} (dropped on ${wrong}), count ${main.soundPlayCount}`)

    // Piece 1, right cell: chime from that cell.
    c = main.soundPlayCount
    await ix.dropTopPieceAtSlot(main, t1)
    expect(main.lastDropResult, `piece ${p1} placed`).toBe("correct")
    expectCue(main, "chime", t1, c, `piece ${p1} right drop`)

    // Up to the hold piece: one chime per right drop.
    let guard = 0
    while (!main.isHoldPiece(main.topPieceIndex) && guard++ < 12) {
      const p = await waitForTopGrabbable(main)
      const t = targetOf(main, p)
      c = main.soundPlayCount
      await ix.dropTopPieceAtSlot(main, t)
      expect(main.lastDropResult, `piece ${p} placed`).toBe("correct")
      expectCue(main, "chime", t, c, `piece ${p} right drop`)
    }

    // Hold piece: refused in an ordinary cell -> miss from the HOLD block (-2);
    // accepted in the HOLD block -> chime from -2.
    const hold = await waitForTopGrabbable(main)
    expect(main.isHoldPiece(hold), "hold piece on top").toBe(true)
    c = main.soundPlayCount
    await dropAndHear(ix, main, 23, "miss", "hold piece refused in cell 23")
    expect(main.lastDropResult, "hold piece refused").toBe("refused-hold")
    expectCue(main, "miss", -2, c, "hold piece refused in cell 23")
    c = main.soundPlayCount
    await dropAndHear(ix, main, 37, "chime", "hold piece accepted in cell 37")
    expect(main.lastDropResult, "hold piece accepted").toBe("correct")
    expectCue(main, "chime", -2, c, "hold piece accepted in cell 37")
    log(`SOUND done: last ${main.lastSoundName} from ${main.lastSoundSlot}, count ${main.soundPlayCount}`)
    await hideLeafOverlay()
  }
}
