// Owns: the LEAF check of v0.6 item 10 (Case check) and item 11 (the recall miss tone is spatial): after a recall pass the Case check button is offered; pressed, exactly 2 letters are drawn in wrong cells (read from where the letters are drawn, against cell positions taken from the printed labels); a wrong pinch is refused and changes nothing; a pinch on a misplaced cell finds it (outline drawn) and a second pinch on it changes nothing; Veteran mode is refused during a check; both found gives "Case check: 2 of 2 found" under an unchanged score line; a second check ended early with Done gives "Case check: 1 of 2 found"; the placement log's case-check lines match what was done.
// Talks to: CaseLightLeafSupport (real SIK drops, the LEAF SIK interactor's pinchAt, real UIKit presses, printed-label answers, cue and playback reads), CaseLightNotesSupport (a pinned note through the real chooser), CaseLightPlacementLogScenario.parseLogLine (the tester's own log reader), CaseLightVeteranUI read-only getter, CaseLightMain read-only getters, drawn objects Piece_n / Label_n / HoldLabel / ResultText / ResultCameBackText / CaseCheckButton / CaseCheckMarks / SnapOutline / MissSource.
// Must not: import CaseLightCaseCheck or CaseLightLog, call product commands or test hooks (startCaseCheck is never called; the button is pressed), or change product state except through real input.

/**
 * Cell geometry is the test's own: each labelled cell's centre across is where its printed number
 * label (Label_<slot>) is drawn, and a row is the band above that row's labels. A letter is "in"
 * the labelled cell whose label is nearest across (within half a cell pitch) in the row band its
 * drawn position falls in; the hold letter is in the HOLD block when it is nearest the HOLD label.
 * Positive control: before the check every letter is read as standing in its own cell (the answer
 * from the printed labels, CaseLightLeafSupport.answerFor).
 * Item 11 rides on the recall miss of pass 1: the miss tone comes from the answer cell that lights.
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {nextFrame, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {CaseLightMain} from "../CaseLightMain"
import {CaseLightVeteranUI} from "../CaseLightVeteranUI"
import {CaseLightLeafInteractor, Playback, answerFor, drawnWorldBox, expectCue, expectPlayback, expectedResult, hideLeafOverlay, labelText, log, mustFind, neighbourSlot, pollPlayback, waitForReady, waitForTopGrabbable, waitUntil} from "./CaseLightLeafSupport"
import {REMINDERS, pick, pinchSlotOpens, slotTarget} from "./CaseLightNotesSupport"
import {parseLogLine} from "./CaseLightPlacementLogScenario"

const NOTE_SLOT = 20
const HOLD = -2
const NONE = -1

/** Cell positions read from the drawn labels, in case-local cm. */
interface OwnCells {
  inv: mat4
  x: Map<number, number>
  rowY: number[]
  pitch: number
  holdX: number
}

function readCells(main: CaseLightMain): OwnCells {
  const inv = main.caseRoot.getTransform().getInvertedWorldTransform()
  const x = new Map<number, number>()
  const ys: number[] = []
  for (let s = 0; s < 80; s++) {
    const t = labelText(s)
    if (!t || !t.getSceneObject().isEnabledInHierarchy || t.text.length === 0) continue
    const p = inv.multiplyPoint(t.getSceneObject().getTransform().getWorldPosition())
    x.set(s, p.x)
    ys[Math.floor(s / 40)] = p.y
  }
  const gaps: number[] = []
  x.forEach((xs, s) => {
    const n = x.get(s + 1)
    if (n !== undefined && Math.floor(s / 40) === Math.floor((s + 1) / 40)) gaps.push(Math.abs(n - xs))
  })
  gaps.sort((a, b) => a - b)
  const pitch = gaps[Math.floor(gaps.length / 2)]
  const holdX = inv.multiplyPoint(mustFind("HoldLabel").getTransform().getWorldPosition()).x
  expect(x.size >= 70 && gaps.length > 50 && pitch > 0.5, `own cells: ${x.size} labelled cells, pitch ${pitch ? pitch.toFixed(2) : "?"} cm from ${gaps.length} neighbour pairs`).toBe(true)
  expect(ys[1] > ys[0], `own cells: upper row labels above lower row labels (${ys[0].toFixed(2)}, ${ys[1].toFixed(2)})`).toBe(true)
  return {inv, x, rowY: ys, pitch, holdX}
}

/** Which row band a case-local y falls in: 1 above the upper labels, 0 between the two label rows, -1 below. */
function rowOf(c: OwnCells, y: number): number {
  if (y > c.rowY[1]) return 1
  if (y > c.rowY[0]) return 0
  return -1
}

/** The labelled cell a drawn world point stands in (own geometry), HOLD for the HOLD block, NONE otherwise. */
function cellAt(c: OwnCells, world: vec3): number {
  const p = c.inv.multiplyPoint(world)
  const row = rowOf(c, p.y)
  if (row < 0) return NONE
  let best = NONE
  let bestD = 1e9
  c.x.forEach((xs, s) => {
    if (Math.floor(s / 40) !== row) return
    const d = Math.abs(p.x - xs)
    if (d < bestD) {
      bestD = d
      best = s
    }
  })
  if (bestD < c.pitch / 2) return best
  if (row === 0 && Math.abs(p.x - c.holdX) < 2.5 * c.pitch) return HOLD
  return NONE
}

function pieceWorld(i: number): vec3 {
  return mustFind(`Piece_${i}`).getTransform().getWorldPosition()
}

/** Everything a Case check pinch must not change, as a comparable string. */
function snapshot(main: CaseLightMain): string {
  const pos: string[] = []
  for (let i = 0; i < main.pieceCount; i++) {
    const p = pieceWorld(i)
    pos.push(`${p.x.toFixed(2)},${p.y.toFixed(2)},${p.z.toFixed(2)}`)
  }
  const retired: number[] = []
  for (let i = 0; i < main.pieceCount; i++) if (main.isRetired(i)) retired.push(i)
  const notes = main.noteSlots().map((s) => `${s}:${main.noteForSlot(s)}`)
  const r = mustFind("ResultText")
  const r2 = mustFind("ResultCameBackText")
  return JSON.stringify({
    found: main.caseCheckFound,
    foundCells: main.caseCheckFoundCells,
    score: [main.unaidedCount, main.helpedCount, main.totalCount],
    cameBacks: main.comeBackCount,
    retired,
    notes,
    card: [r.isEnabledInHierarchy, (r.getComponent("Component.Text") as Text).text, r2.isEnabledInHierarchy, (r2.getComponent("Component.Text") as Text).text],
    positions: pos,
  })
}

/** Field-by-field difference of two snapshots (for the failure message). */
function diff(a: string, b: string): string {
  const x = JSON.parse(a)
  const y = JSON.parse(b)
  const out: string[] = []
  for (const k of Object.keys(x)) if (JSON.stringify(x[k]) !== JSON.stringify(y[k])) out.push(`${k}: ${JSON.stringify(x[k])} -> ${JSON.stringify(y[k])}`)
  return out.length ? out.join("; ") : "none"
}

/** Letters drawn away from their own cell (own geometry), with where they are drawn. */
function offOwn(main: CaseLightMain, c: OwnCells, own: number[]): {letter: number; drawn: number}[] {
  const out: {letter: number; drawn: number}[] = []
  for (let i = 0; i < main.pieceCount; i++) {
    if (!main.isPieceShown(i)) continue
    const drawn = cellAt(c, pieceWorld(i))
    if (drawn !== own[i]) out.push({letter: i, drawn})
  }
  return out
}

/** Drawn vertices of CaseCheckMarks inside a cell's own band (across within half a pitch, up within its row band). */
function marksIn(c: OwnCells, slot: number): number {
  const so = mustFind("CaseCheckMarks")
  if (!so.isEnabledInHierarchy) return 0
  const xs = c.x.get(slot)
  if (xs === undefined) return 0
  const row = Math.floor(slot / 40)
  return drawnWorldBox("CaseCheckMarks").pts.map((p) => c.inv.multiplyPoint(p)).filter((p) => Math.abs(p.x - xs) < c.pitch / 2 && rowOf(c, p.y) === row).length
}

/** A real pinch on a cell through the shared slot-pinch target; it must start and end on it. */
async function pinchCell(ix: CaseLightLeafInteractor, main: CaseLightMain, slot: number, ctx: string): Promise<void> {
  const target = slotTarget()
  expect(!!target, `${ctx}: the slot-pinch target takes pinches`).toBe(true)
  const r = await ix.pinchAt(target!, main.slotWorldPosition(slot))
  expect(r.hitOnTarget, `${ctx}: the eye ray toward cell ${slot} meets SlotPinchTarget (hit ${r.hitName})`).toBe(true)
  expect(r.startFired && r.endFired, `${ctx}: the pinch started and ended on the target`).toBe(true)
  await nextFrame()
}

@component
export class CaseLightCaseCheckScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    const vui = mustFind("VeteranControls").getComponent(CaseLightVeteranUI.getTypeName()) as CaseLightVeteranUI
    const button = mustFind("CaseCheckButton")
    const n = main.pieceCount
    const own: number[] = []
    for (let i = 0; i < n; i++) {
      const a = answerFor(main, i)
      own.push(a.slot === -2 ? HOLD : a.slot)
    }
    const cells = readCells(main)
    log(`CC own answers ${JSON.stringify(own)}; pitch ${cells.pitch.toFixed(2)} cm; label rows y ${cells.rowY.map((y) => y.toFixed(2)).join(", ")}`)

    // A pinned note, so "notes unchanged" has something to compare (Veteran mode on, pin, off).
    await ix.pressButton("VeteranModeButton")
    await waitUntil(() => main.veteranMode, 1000, "Veteran mode on to pin a note")
    await pinchSlotOpens(ix, main, NOTE_SLOT, "note")
    await pick(ix, main, REMINDERS[0], "note")
    await ix.pressButton("VeteranModeButton")
    await waitUntil(() => !main.veteranMode, 1000, "Veteran mode off before recall")
    expect(main.noteForSlot(NOTE_SLOT), "control: a note is pinned").toBe(REMINDERS[0])
    expect(main.caseCheckOffered || main.isCaseCheckButtonVisible || button.isEnabledInHierarchy, "before any recall pass: no Case check button").toBe(false)

    // ── Recall pass 1, real drops; the opening non-hold letter is missed once (item 11) ─────
    await ix.pressButton("StartRecallButton")
    expect(main.mode, "recall pass 1 started").toBe("recall")
    let missed = -1
    let missTone: {name: string; slot: number; lit: number; src: vec3; poll: Promise<{p: Playback; frame: number; reads: string[]}> | null} | null = null
    let guard = 0
    while ((main.mode as string) === "recall") {
      if (guard++ > 30) throw new Error("recall pass 1 did not end")
      const p = await waitForTopGrabbable(main)
      expect(main.caseCheckOffered || button.isEnabledInHierarchy, "during a pass: no Case check button").toBe(false)
      if (missed < 0 && own[p] >= 0) {
        missed = p
        const wrong = neighbourSlot(own[p])
        await ix.dropTopPieceAtSlot(main, wrong, {
          afterRelease: () => {
            missTone = {name: main.lastSoundName, slot: main.lastSoundSlot, lit: main.litSlotIndex, src: mustFind("MissSource").getTransform().getWorldPosition(), poll: pollPlayback(main, "miss", 10)}
          },
        })
        expect(main.lastDropResult, `letter ${p} dropped in cell ${wrong}: a recall miss`).toBe("miss")
      } else {
        await ix.dropTopPieceAtSlot(main, own[p] === HOLD ? 37 : own[p])
        expect(main.lastDropResult, `letter ${p} placed`).toBe("correct")
      }
    }

    // Item 11: the recall miss tone comes from the answer cell that lights, spatial, playing.
    const tone = missTone as unknown as {name: string; slot: number; lit: number; src: vec3; poll: Promise<{p: Playback; frame: number; reads: string[]}>} | null
    if (!tone) throw new Error("item 11: the recall miss was not captured")
    const played = await tone.poll
    const centre = main.slotWorldPosition(own[missed])
    const srcLocalX = cells.inv.multiplyPoint(tone.src).x
    log(`CC item 11: miss of letter ${missed} (answer ${own[missed]}): sound ${tone.name} at ${tone.slot}, lit ${tone.lit}, MissSource ${tone.src.distance(centre).toFixed(2)} cm from the cell centre, across ${Math.abs(srcLocalX - (cells.x.get(own[missed]) as number)).toFixed(2)} cm from its label; playing at frame ${played.frame} (${played.reads.join(" ")})`)
    expect(tone.name, "item 11: recall miss tone is the miss sound").toBe("miss")
    expect(tone.slot, `item 11: lastSoundSlot = the answer cell (${own[missed]}, from the printed labels)`).toBe(own[missed])
    expect(tone.lit, "item 11: the answer cell is the one that lights").toBe(own[missed])
    expect(tone.src.distance(centre) <= 1, `item 11: MissSource at the answer cell's centre (off by ${tone.src.distance(centre).toFixed(2)} cm)`).toBe(true)
    expect(Math.abs(srcLocalX - (cells.x.get(own[missed]) as number)) < cells.pitch / 2, "item 11: MissSource across inside the answer cell (own label geometry)").toBe(true)
    expect(played.frame >= 0 && played.frame <= 10, `item 11: MissSource isPlaying() within 10 frames (frame ${played.frame})`).toBe(true)
    expectPlayback(played.p, "miss", "item 11")

    // ── a. After the recall pass the button is offered ─────────────────────────────────────
    expect(main.mode, "pass 1 over").toBe("idle")
    expect(main.caseCheckOffered, "a. Case check offered after a recall pass").toBe(true)
    expect(main.isCaseCheckButtonVisible && button.isEnabledInHierarchy, "a. CaseCheckButton drawn").toBe(true)
    const card1 = (mustFind("ResultText").getComponent("Component.Text") as Text).text
    expect(card1, "the pass 1 card").toBe(expectedResult(n - 1, n))
    const placedAll = offOwn(main, cells, own)
    expect(JSON.stringify(placedAll), "control: before the check every letter is drawn in its own cell (own geometry)").toBe("[]")

    // ── b. Pressed: exactly 2 letters drawn in wrong cells ────────────────────────────────
    const logFrom = main.placementLogLines.length
    const passNo = parseLogLine(main.placementLogLines[logFrom - 1]).get("pass")
    await ix.pressButton("CaseCheckButton")
    await waitUntil(() => main.caseCheckActive, 1000, "Case check running after the button press")
    expect(main.caseCheckOffered || button.isEnabledInHierarchy, "b. the button goes once pressed").toBe(false)
    expect(main.isSlotPinchLive && !!slotTarget(), "b. the slot pinch is live").toBe(true)
    expect(main.isRoutePickerEnabled, "b. route picker greyed during a check").toBe(false)
    const off = offOwn(main, cells, own)
    log(`CC run 1: drawn away from own cells ${JSON.stringify(off)}; getter ${JSON.stringify(main.caseCheckMisplaced)}`)
    expect(off.length, "b. exactly 2 letters drawn away from their own cells").toBe(2)
    for (const o of off) {
      expect(own[o.letter] >= 0, `b. letter ${o.letter} is not the hold letter`).toBe(true)
      expect(o.drawn >= 0 && cells.x.has(o.drawn), `b. letter ${o.letter} drawn in a real labelled cell (${o.drawn})`).toBe(true)
      expect(o.drawn !== own[o.letter], `b. letter ${o.letter}'s cell ${o.drawn} is not its own (${own[o.letter]})`).toBe(true)
      expect(own.indexOf(o.drawn) < 0, `b. cell ${o.drawn} is no letter's own cell`).toBe(true)
    }
    const mis = main.caseCheckMisplaced
    expect(JSON.stringify(mis.map((m) => `${m.letter}:${m.wrongCell}:${m.rightCell}`).sort()), "b. getter = what is drawn").toBe(JSON.stringify(off.map((o) => `${o.letter}:${o.drawn}:${own[o.letter]}`).sort()))
    const w0 = mis[0].wrongCell
    const w1 = mis[1].wrongCell
    const r0 = own[mis[0].letter]

    // ── c. A wrong pinch (on the letter's own, now empty, cell) is refused and changes nothing ─
    const before = snapshot(main)
    const sounds0 = main.soundPlayCount
    const rejected0 = main.caseCheckRejectedCount
    await pinchCell(ix, main, r0, "c. wrong pinch")
    expectCue(main, "miss", r0, sounds0, "c. wrong pinch: low tone from that cell")
    expect(main.snapPreviewSlotIndex === r0 && mustFind("SnapOutline").enabled, "c. wrong pinch: brief outline on that cell").toBe(true)
    expect(main.caseCheckRejectedCount, "c. wrong pinch counted as rejected").toBe(rejected0 + 1)
    await sleep(700)
    expect(main.snapPreviewSlotIndex, "c. the brief outline is gone after 0.4 s").toBe(-1)
    const afterWrong = snapshot(main)
    expect(diff(before, afterWrong), "c. a wrong pinch changes nothing (found, score, retirement, notes, card, every letter's drawn position)").toBe("none")
    expect(main.caseCheckActive, "c. the check is still running").toBe(true)

    // ── d. A pinch on a misplaced cell finds it; again changes nothing ─────────────────────
    const sounds1 = main.soundPlayCount
    await pinchCell(ix, main, w0, "d. pinch on a misplaced cell")
    expect(main.caseCheckFound, "d. found 1").toBe(1)
    expectCue(main, "chime", w0, sounds1, "d. found: chime from that cell")
    expect(JSON.stringify(main.caseCheckOutlineCells), "d. outline on the found cell").toBe(JSON.stringify([w0]))
    const marks0 = marksIn(cells, w0)
    const marksElse = marksIn(cells, r0)
    log(`CC run 1: outline vertices in cell ${w0}: ${marks0}, in cell ${r0}: ${marksElse}`)
    expect(marks0 >= 8, `d. CaseCheckMarks drawn on cell ${w0} (${marks0} vertices)`).toBe(true)
    expect(marksElse, `d. no outline drawn on the wrongly pinched cell ${r0}`).toBe(0)
    const afterFound = snapshot(main)
    const rejected1 = main.caseCheckRejectedCount
    await pinchCell(ix, main, w0, "d. the found cell again")
    await sleep(200)
    expect(diff(afterFound, snapshot(main)), "d. pinching a found cell again changes nothing").toBe("none")
    expect(main.caseCheckRejectedCount, "d. again is not a rejection").toBe(rejected1)
    expect(JSON.stringify(main.caseCheckOutlineCells), "d. outline unchanged").toBe(JSON.stringify([w0]))

    // ── e. Veteran mode is refused during a check ───────────────────────────────────────────
    await ix.pressButton("VeteranModeButton")
    for (let i = 0; i < 5; i++) await nextFrame()
    expect(main.veteranMode || vui.isVeteranToggleOn, "e. Veteran mode refused during a check (control: the same press turned it on before)").toBe(false)
    expect(main.caseCheckActive && main.isSlotPinchLive, "e. the check keeps the slot pinch").toBe(true)
    expect(main.isNoteChooserOpen, "e. no reminder chooser").toBe(false)

    // ── f. Both found: "Case check: 2 of 2 found" under the unchanged score line ───────────
    await pinchCell(ix, main, w1, "f. the second misplaced cell")
    await waitUntil(() => !main.caseCheckActive, 1000, "f. the check ends when both are found")
    const line1 = (mustFind("ResultText").getComponent("Component.Text") as Text).text
    const line2 = (mustFind("ResultCameBackText").getComponent("Component.Text") as Text).text
    log(`CC run 1 end: card "${line1}" / "${line2}"`)
    expect(mustFind("ResultText").isEnabledInHierarchy && mustFind("ResultCameBackText").isEnabledInHierarchy, "f. card drawn").toBe(true)
    expect(line2, "f. card second line").toBe("Case check: 2 of 2 found")
    expect(line1, "f. From memory line unchanged").toBe(card1)
    expect(JSON.stringify([main.unaidedCount, main.helpedCount, main.totalCount]), "f. score unchanged").toBe(JSON.stringify(JSON.parse(before).score))
    expect(JSON.stringify(main.caseCheckOutlineCells), "f. both cells outlined").toBe(JSON.stringify([w0, w1].sort((a, b) => a - b)))
    expect(main.isSlotPinchLive || !!slotTarget(), "f. the slot pinch goes dark").toBe(false)
    expect(main.noteForSlot(NOTE_SLOT), "f. the note is kept").toBe(REMINDERS[0])

    // ── g. The log's case-check lines match what was done ──────────────────────────────────
    const run1 = main.placementLogLines.slice(logFrom).map((l) => parseLogLine(l))
    const want1 = [
      `case-check-start letters=2 cells=${w0},${w1}`,
      `case-check cell=${r0} result=wrong`,
      `case-check cell=${w0} result=found`,
      `case-check cell=${w0} result=again`,
      `case-check cell=${w1} result=found`,
      `case-check-end found=2 of=2 rejected=1 ended=all-found card=Case check: 2 of 2 found`,
    ]
    const got1 = run1.map((f) => readCheckLine(f))
    expect(JSON.stringify(got1), "g. log lines of run 1").toBe(JSON.stringify(want1))
    for (const f of run1) expect(`${f.get("mode")} ${f.get("pass")}`, `g. line ${f.get("seq")}: mode idle, the recall pass's number`).toBe(`idle ${passNo}`)

    // ── h. Run 2 (after Again and a full recall pass), ended early with Done ──────────────
    await ix.pressButton("AgainButton")
    expect(main.mode, "recall pass 2 started").toBe("recall")
    guard = 0
    while ((main.mode as string) === "recall") {
      if (guard++ > 30) throw new Error("recall pass 2 did not end")
      const p = await waitForTopGrabbable(main)
      await ix.dropTopPieceAtSlot(main, own[p] === HOLD ? 37 : own[p])
      expect(main.lastDropResult, `pass 2: letter ${p} placed`).toBe("correct")
    }
    await waitUntil(() => main.caseCheckOffered, 1000, "h. Case check offered again after pass 2")
    const card2 = (mustFind("ResultText").getComponent("Component.Text") as Text).text
    expect(card2, "h. the pass 2 card").toBe(expectedResult(2 * n - 1, 2 * n))
    const logFrom2 = main.placementLogLines.length
    await ix.pressButton("CaseCheckButton")
    await waitUntil(() => main.caseCheckActive, 1000, "h. second Case check running")
    const off2 = offOwn(main, cells, own)
    const mis2 = main.caseCheckMisplaced
    log(`CC run 2: drawn away ${JSON.stringify(off2)}; getter ${JSON.stringify(mis2)}`)
    expect(off2.length, "h. exactly 2 letters drawn away from their own cells").toBe(2)
    await pinchCell(ix, main, mis2[0].wrongCell, "h. one misplaced cell")
    expect(main.caseCheckFound, "h. found 1").toBe(1)
    await ix.pressButton("DoneButton")
    await waitUntil(() => !main.caseCheckActive, 1000, "h. Done ends the check")
    const d1 = (mustFind("ResultText").getComponent("Component.Text") as Text).text
    const d2 = (mustFind("ResultCameBackText").getComponent("Component.Text") as Text).text
    log(`CC run 2 end (Done): card "${d1}" / "${d2}"`)
    expect(mustFind("ResultCameBackText").isEnabledInHierarchy, "h. card drawn after Done").toBe(true)
    expect(d2, "h. card second line after Done").toBe("Case check: 1 of 2 found")
    expect(d1, "h. From memory line unchanged").toBe(card2)
    expect(JSON.stringify(offOwn(main, cells, own)), "h. after Done every letter is drawn in its own cell again").toBe("[]")
    const run2 = main.placementLogLines.slice(logFrom2).map((l) => readCheckLine(parseLogLine(l)))
    expect(JSON.stringify(run2), "h. log lines of run 2").toBe(JSON.stringify([`case-check-start letters=2 cells=${mis2[0].wrongCell},${mis2[1].wrongCell}`, `case-check cell=${mis2[0].wrongCell} result=found`, `case-check-end found=1 of=2 rejected=0 ended=done card=Case check: 1 of 2 found`]))
    expect(main.noteForSlot(NOTE_SLOT), "h. the note is kept").toBe(REMINDERS[0])
    log("CC done")
    await hideLeafOverlay()
  }
}

/** A case-check log line in a fixed short form (other lines are shown whole, so they fail the comparison). */
function readCheckLine(f: Map<string, string>): string {
  const ev = f.get("event")
  if (ev === "case-check-start") return `case-check-start letters=${f.get("letters")} cells=${f.get("cells")}`
  if (ev === "case-check") return `case-check cell=${f.get("cell")} result=${f.get("result")}`
  if (ev === "case-check-end") return `case-check-end found=${f.get("found")} of=${f.get("of")} rejected=${f.get("rejected")} ended=${f.get("ended")} card=${f.get("card")}`
  return `unexpected line: ${JSON.stringify(Array.from(f.entries()))}`
}
