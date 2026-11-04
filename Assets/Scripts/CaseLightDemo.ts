// Owns: the demo replay's input (the recorded CASELIGHT_LOG v1 lines of one real run), turning them into replay steps, the checks that a replayed result matches the recorded one, the CASELIGHT_DEMO v1 line format and the replay session id shape.
// Talks to: nothing (pure TypeScript: no imports, no scene objects, no Lens globals), so plain node can run it; CaseLightMain plays the steps through the same handlers real input reaches.
// Must not: invent a run (the steps come only from the recorded lines), set drill state, read the scene, or print.

/**
 * The recording is session s1-g3nddr, copied verbatim into data/demo_replay_s1-g3nddr.log from the
 * Lens Studio log: a LEAF test run (extra-placement-log, passed, unmodified product) with real SIK
 * input in the Lens Studio preview, not a person wearing SPECS. Route 1, 8-letter bundle, a fresh
 * Lens start. It holds a practice pass (with a release off the case and a refused hold letter),
 * recall pass 1 (a miss and a refused hold, "From memory: 6 of 8 this session", "Came back: 2"),
 * recall pass 2 (a miss, "From memory: 13 of 16 this session", "Came back: 1"), then a route switch.
 * The replay plays the three passes and ends at the route switch.
 *
 * Every attempt keeps its recorded result and every recall pass end its recorded score text; a
 * player compares what the product does with them and stops (scene "stopped") on any difference.
 */

export const DEMO_PREFIX = "CASELIGHT_DEMO v1"
export const DEMO_LABEL_TEXT = "Demo replay"
/** A cell of the HOLD block, where a recorded placed=HOLD is released. */
export const HOLD_DROP_CELL = 37

// BEGIN GENERATED DEMO RECORDING (data/make_demo_recording.py; do not edit by hand)
/** The recorded session, from data/demo_replay_s1-g3nddr.log. */
export const RECORDED_SESSION = "s1-g3nddr"
/** Its CASELIGHT_LOG v1 lines, from the prefix to the end of the line, unchanged, in log order. */
export const RECORDED_LINES: readonly string[] = [
  "CASELIGHT_LOG v1 seq=1 session=s1-g3nddr route=1 pass=1 mode=practice event=pass-start pieces=8",
  "CASELIGHT_LOG v1 seq=2 session=s1-g3nddr route=1 pass=1 mode=practice piece=0 address=\"2195 FAIRWAYS CT\" placed=OFF right=9 result=off-case memory=0",
  "CASELIGHT_LOG v1 seq=3 session=s1-g3nddr route=1 pass=1 mode=practice piece=0 address=\"2195 FAIRWAYS CT\" placed=9 right=9 result=correct memory=0",
  "CASELIGHT_LOG v1 seq=4 session=s1-g3nddr route=1 pass=1 mode=practice piece=1 address=\"3498 LEE CT\" placed=46 right=46 result=correct memory=0",
  "CASELIGHT_LOG v1 seq=5 session=s1-g3nddr route=1 pass=1 mode=practice piece=2 address=\"3581 FREY LAKE RD\" placed=56 right=56 result=correct memory=0",
  "CASELIGHT_LOG v1 seq=6 session=s1-g3nddr route=1 pass=1 mode=practice piece=3 address=\"2355 FAIRWAYS CT\" placed=17 right=17 result=correct memory=0",
  "CASELIGHT_LOG v1 seq=7 session=s1-g3nddr route=1 pass=1 mode=practice piece=4 address=\"1460 TRIBUTARY CT\" placed=76 right=76 result=correct memory=0",
  "CASELIGHT_LOG v1 seq=8 session=s1-g3nddr route=1 pass=1 mode=practice piece=5 address=\"3553 FREY LAKE RD\" placed=23 right=HOLD result=refused-hold memory=0",
  "CASELIGHT_LOG v1 seq=9 session=s1-g3nddr route=1 pass=1 mode=practice piece=5 address=\"3553 FREY LAKE RD\" placed=HOLD right=HOLD result=correct memory=0",
  "CASELIGHT_LOG v1 seq=10 session=s1-g3nddr route=1 pass=1 mode=practice piece=6 address=\"2200 FAIRWAYS CT\" placed=23 right=23 result=correct memory=0",
  "CASELIGHT_LOG v1 seq=11 session=s1-g3nddr route=1 pass=1 mode=practice piece=7 address=\"2035 FAIRWAYS CT\" placed=1 right=1 result=correct memory=0",
  "CASELIGHT_LOG v1 seq=12 session=s1-g3nddr route=1 pass=1 mode=practice event=pass-end placed=8 score=\"\" cameback=\"\"",
  "CASELIGHT_LOG v1 seq=13 session=s1-g3nddr route=1 pass=2 mode=recall event=pass-start pieces=8",
  "CASELIGHT_LOG v1 seq=14 session=s1-g3nddr route=1 pass=2 mode=recall piece=4 address=\"1460 TRIBUTARY CT\" placed=75 right=76 result=miss memory=0",
  "CASELIGHT_LOG v1 seq=15 session=s1-g3nddr route=1 pass=2 mode=recall piece=3 address=\"2355 FAIRWAYS CT\" placed=17 right=17 result=correct memory=1",
  "CASELIGHT_LOG v1 seq=16 session=s1-g3nddr route=1 pass=2 mode=recall piece=2 address=\"3581 FREY LAKE RD\" placed=56 right=56 result=correct memory=1",
  "CASELIGHT_LOG v1 seq=17 session=s1-g3nddr route=1 pass=2 mode=recall piece=4 address=\"1460 TRIBUTARY CT\" placed=76 right=76 result=correct memory=0",
  "CASELIGHT_LOG v1 seq=18 session=s1-g3nddr route=1 pass=2 mode=recall piece=6 address=\"2200 FAIRWAYS CT\" placed=23 right=23 result=correct memory=1",
  "CASELIGHT_LOG v1 seq=19 session=s1-g3nddr route=1 pass=2 mode=recall piece=1 address=\"3498 LEE CT\" placed=46 right=46 result=correct memory=1",
  "CASELIGHT_LOG v1 seq=20 session=s1-g3nddr route=1 pass=2 mode=recall piece=7 address=\"2035 FAIRWAYS CT\" placed=1 right=1 result=correct memory=1",
  "CASELIGHT_LOG v1 seq=21 session=s1-g3nddr route=1 pass=2 mode=recall piece=5 address=\"3553 FREY LAKE RD\" placed=23 right=HOLD result=refused-hold memory=0",
  "CASELIGHT_LOG v1 seq=22 session=s1-g3nddr route=1 pass=2 mode=recall piece=0 address=\"2195 FAIRWAYS CT\" placed=9 right=9 result=correct memory=1",
  "CASELIGHT_LOG v1 seq=23 session=s1-g3nddr route=1 pass=2 mode=recall piece=5 address=\"3553 FREY LAKE RD\" placed=HOLD right=HOLD result=correct memory=0",
  "CASELIGHT_LOG v1 seq=24 session=s1-g3nddr route=1 pass=2 mode=recall event=pass-end placed=8 score=\"From memory: 6 of 8 this session\" cameback=\"Came back: 2\"",
  "CASELIGHT_LOG v1 seq=25 session=s1-g3nddr route=1 pass=3 mode=recall event=pass-start pieces=8",
  "CASELIGHT_LOG v1 seq=26 session=s1-g3nddr route=1 pass=3 mode=recall piece=2 address=\"3581 FREY LAKE RD\" placed=57 right=56 result=miss memory=0",
  "CASELIGHT_LOG v1 seq=27 session=s1-g3nddr route=1 pass=3 mode=recall piece=3 address=\"2355 FAIRWAYS CT\" placed=17 right=17 result=correct memory=1",
  "CASELIGHT_LOG v1 seq=28 session=s1-g3nddr route=1 pass=3 mode=recall piece=4 address=\"1460 TRIBUTARY CT\" placed=76 right=76 result=correct memory=1",
  "CASELIGHT_LOG v1 seq=29 session=s1-g3nddr route=1 pass=3 mode=recall piece=2 address=\"3581 FREY LAKE RD\" placed=56 right=56 result=correct memory=0",
  "CASELIGHT_LOG v1 seq=30 session=s1-g3nddr route=1 pass=3 mode=recall piece=5 address=\"3553 FREY LAKE RD\" placed=HOLD right=HOLD result=correct memory=1",
  "CASELIGHT_LOG v1 seq=31 session=s1-g3nddr route=1 pass=3 mode=recall piece=6 address=\"2200 FAIRWAYS CT\" placed=23 right=23 result=correct memory=1",
  "CASELIGHT_LOG v1 seq=32 session=s1-g3nddr route=1 pass=3 mode=recall piece=7 address=\"2035 FAIRWAYS CT\" placed=1 right=1 result=correct memory=1",
  "CASELIGHT_LOG v1 seq=33 session=s1-g3nddr route=1 pass=3 mode=recall piece=1 address=\"3498 LEE CT\" placed=46 right=46 result=correct memory=1",
  "CASELIGHT_LOG v1 seq=34 session=s1-g3nddr route=1 pass=3 mode=recall piece=0 address=\"2195 FAIRWAYS CT\" placed=9 right=9 result=correct memory=1",
  "CASELIGHT_LOG v1 seq=35 session=s1-g3nddr route=1 pass=3 mode=recall event=pass-end placed=8 score=\"From memory: 13 of 16 this session\" cameback=\"Came back: 1\"",
  "CASELIGHT_LOG v1 seq=36 session=s1-g3nddr route=2 pass=3 mode=idle event=route-switch from=1",
]
// END GENERATED DEMO RECORDING

export type DemoScene = "replay-start" | "practice-start" | "recall-start" | "attempt" | "off-case" | "miss" | "refused-hold" | "come-back" | "result" | "pass-end" | "replay-end" | "stopped"

export type ReplayStep =
  | { kind: "start"; mode: "practice" | "recall"; pass: number; seq: number }
  | { kind: "attempt"; mode: "practice" | "recall"; piece: number; placed: string; right: string; result: string; comeBack: boolean; seq: number }
  | { kind: "pass-end"; mode: "practice" | "recall"; pass: number; placedCount: number; score: string; cameBack: string; seq: number }
  | { kind: "end"; seq: number }

/** key=value fields after the prefix; a double-quoted value is unescaped. Null when the line is not a log line. */
export function parseLogLine(line: string): { [key: string]: string } | null {
  const i = line.indexOf("CASELIGHT_LOG v1 ")
  if (i < 0) return null
  const rest = line.substring(i + "CASELIGHT_LOG v1 ".length)
  const out: { [key: string]: string } = {}
  const re = /(\w+)=("(?:[^"\\]|\\.)*"|\S*)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(rest)) !== null) {
    let v = m[2]
    if (v.length >= 2 && v.charAt(0) === '"' && v.charAt(v.length - 1) === '"') v = v.substring(1, v.length - 1).replace(/\\(.)/g, "$1")
    out[m[1]] = v
  }
  return out
}

/**
 * Replay steps from recorded lines, in seq order: pass starts, attempts and pass ends, until a
 * route switch or the end of the lines. An attempt by a letter already missed in the same recall
 * pass is marked as its come-back.
 */
export function buildReplay(lines: readonly string[]): ReplayStep[] {
  const recs = lines.map(parseLogLine).filter((r): r is { [key: string]: string } => r !== null)
  recs.sort((a, b) => Number(a.seq) - Number(b.seq))
  const steps: ReplayStep[] = []
  let missed = new Set<number>()
  for (const r of recs) {
    const seq = Number(r.seq)
    const mode = r.mode === "recall" ? "recall" : "practice"
    if (r.event === "route-switch") {
      steps.push({ kind: "end", seq })
      break
    }
    if (r.event === "pass-start") {
      missed = new Set<number>()
      steps.push({ kind: "start", mode, pass: Number(r.pass), seq })
    } else if (r.event === "pass-end") {
      steps.push({ kind: "pass-end", mode, pass: Number(r.pass), placedCount: Number(r.placed), score: r.score ?? "", cameBack: r.cameback ?? "", seq })
    } else if (r.result !== undefined) {
      const piece = Number(r.piece)
      const comeBack = mode === "recall" && missed.has(piece)
      if (mode === "recall" && (r.result === "miss" || r.result === "refused-hold")) missed.add(piece)
      steps.push({ kind: "attempt", mode, piece, placed: r.placed, right: r.right, result: r.result, comeBack, seq })
    }
  }
  if (steps.length === 0 || steps[steps.length - 1].kind !== "end") steps.push({ kind: "end", seq: recs.length > 0 ? Number(recs[recs.length - 1].seq) + 1 : 0 })
  return steps
}

/** The replay of the recorded session. */
export function recordedReplay(): ReplayStep[] {
  return buildReplay(RECORDED_LINES)
}

/** The scene a step starts (attempts that are a plain right placement have none of their own). */
export function sceneOf(step: ReplayStep): DemoScene | null {
  switch (step.kind) {
    case "start":
      return step.mode === "practice" ? "practice-start" : "recall-start"
    case "attempt":
      if (step.comeBack) return "come-back"
      if (step.result === "miss") return "miss"
      if (step.result === "refused-hold") return "refused-hold"
      if (step.result === "off-case") return "off-case"
      return null
    case "pass-end":
      return step.mode === "recall" ? "result" : "pass-end"
    case "end":
      return "replay-end"
  }
}

/** The scenes a full replay passes through, in order (replay-start included). */
export function replayScenes(steps: readonly ReplayStep[]): DemoScene[] {
  const out: DemoScene[] = ["replay-start"]
  for (const s of steps) {
    const sc = sceneOf(s)
    if (sc) out.push(sc)
  }
  return out
}

/** Where to release a recorded attempt: a cell number, HOLD_DROP_CELL for HOLD, or -1 for OFF (off the case). */
export function dropCellOf(placed: string): number {
  if (placed === "OFF") return -1
  if (placed === "HOLD") return HOLD_DROP_CELL
  const n = Number(placed)
  return Number.isInteger(n) && n >= 0 ? n : -1
}

/** Null when the replayed attempt matches the recording, else the reason it does not. */
export function attemptMismatch(step: ReplayStep, topPiece: number, actualResult: string, actualPlaced: string): string | null {
  if (step.kind !== "attempt") return null
  if (topPiece !== step.piece) return `seq ${step.seq}: letter ${topPiece} is on top, the recording has letter ${step.piece}`
  if (actualResult !== step.result) return `seq ${step.seq}: result ${actualResult}, recorded ${step.result}`
  if (actualPlaced !== step.placed) return `seq ${step.seq}: placed ${actualPlaced}, recorded ${step.placed}`
  return null
}

/** The count at the end of a card's second line ("Tried again: 2" -> "2"), or the whole line when it has none. */
function cardCount(line: string): string {
  const m = /(\d+)\s*$/.exec(line)
  return m ? m[1] : line
}

/**
 * Null when a replayed pass end shows the recorded score text, else the reason. The card's second
 * line is compared by its count: the recording was made when it read "Came back: N", and the card
 * now reads "Tried again: N" (same count, new words).
 */
export function passEndMismatch(step: ReplayStep, actualPlaced: number, actualScore: string, actualCameBack: string): string | null {
  if (step.kind !== "pass-end") return null
  if (actualPlaced !== step.placedCount) return `seq ${step.seq}: ${actualPlaced} placed, recorded ${step.placedCount}`
  if (actualScore !== step.score) return `seq ${step.seq}: score "${actualScore}", recorded "${step.score}"`
  if (cardCount(actualCameBack) !== cardCount(step.cameBack)) return `seq ${step.seq}: "${actualCameBack}", recorded "${step.cameBack}"`
  return null
}

/** One scene-start line; reason only on a stop. */
export function formatDemoLine(session: string, scene: DemoScene, step: number, reason: string = ""): string {
  const base = `${DEMO_PREFIX} session=${session} source=${RECORDED_SESSION} scene=${scene} step=${step}`
  return reason ? `${base} reason="${reason.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"` : base
}

/** Replay sessions get their own id prefix ("r"), so their placement lines are never read as live play. */
export function replaySessionId(counter: number, token: string): string {
  return `r${counter}-${token}`
}

export function isReplaySession(session: string): boolean {
  return /^r\d+-/.test(session)
}
