// Owns: the placement log's line format (CASELIGHT_LOG v1): one line per placement attempt and per pass start, pass end, route switch, Case check start, Case check pinch and Case check end; the session id shape; and a capped in-memory buffer of lines.
// Talks to: nothing (pure TypeScript: no imports, no scene objects, no Lens globals), so plain node can run it; CaseLightMain writes the lines and devpost/tools/summarize_session.py reads them back.
// Must not: carry personal data (no names, no clock-derived ids), read the scene, or print (CaseLightMain prints).

/**
 * Every line starts with LOG_PREFIX and is a list of key=value fields separated by single spaces;
 * a value with spaces is double-quoted (a double quote or backslash inside it is escaped with a
 * backslash). Field order is fixed so a line can be compared as text:
 *
 *   placement:    seq session route pass mode piece address placed right result memory
 *   pass-start:   seq session route pass mode event=pass-start pieces
 *   pass-end:     seq session route pass mode event=pass-end placed score cameback
 *   route-switch: seq session route pass mode event=route-switch from
 *   case-check-start: seq session route pass mode event=case-check-start letters cells
 *   case-check:       seq session route pass mode event=case-check cell result
 *   case-check-end:   seq session route pass mode event=case-check-end found of rejected ended card
 *
 * placed is a separation number, HOLD (a cell of the HOLD block) or OFF (released off the case);
 * right is a separation number or HOLD. memory=1 only for a right recall placement that counts as
 * from memory (the letter was not missed earlier in the pass). score and cameback carry the
 * score card's on-screen text at the end of a recall pass, and are empty after a practice pass.
 * A route switch starts the on-screen score again, so a reader resets its count there.
 * Case check lines carry the pass number of the recall pass it follows and mode=idle; they are not
 * placements and never touch the score. cells lists the wrong cells (comma separated); a pinch's
 * result is found, wrong or again; ended is all-found, again, done or start; card is the card line.
 */

export const LOG_PREFIX = "CASELIGHT_LOG v1"
export const LOG_CAP = 400

export type LogMode = "practice" | "recall" | "idle"
export type LogResult = "correct" | "miss" | "refused-hold" | "off-case"

/** Fields every line carries. */
export interface LogHead {
  seq: number
  session: string
  route: number
  /** Pass number within the session (practice and recall passes both count), 0 before the opening pass. */
  pass: number
  mode: LogMode
}

export interface PlacementFields extends LogHead {
  piece: number
  address: string
  placed: string
  right: string
  result: LogResult
  memory: boolean
}

/** A value as it appears after key=: bare when it has no space or quote, double-quoted otherwise. */
export function logValue(value: string | number): string {
  const s = `${value}`
  if (s.length > 0 && !/[\s"\\]/.test(s)) return s
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
}

function head(h: LogHead): string {
  return `${LOG_PREFIX} seq=${h.seq} session=${logValue(h.session)} route=${h.route} pass=${h.pass} mode=${h.mode}`
}

/** Where a letter was released: a separation number, HOLD for a cell of the HOLD block, OFF for no cell. */
export function placedToken(slot: number, isHoldCell: boolean): string {
  if (slot < 0) return "OFF"
  return isHoldCell ? "HOLD" : `${slot}`
}

/** Where a letter belongs: a separation number, or HOLD for the hold letter (target -2). */
export function rightToken(target: number): string {
  return target < 0 ? "HOLD" : `${target}`
}

/** One placement attempt. */
export function formatPlacement(f: PlacementFields): string {
  return `${head(f)} piece=${f.piece} address=${logValue(f.address)} placed=${f.placed} right=${f.right} result=${f.result} memory=${f.memory ? 1 : 0}`
}

export function formatPassStart(h: LogHead, pieces: number): string {
  return `${head(h)} event=pass-start pieces=${pieces}`
}

/** placed = letters placed in the pass; score and cameBack = the card's text (empty after practice). */
export function formatPassEnd(h: LogHead, placed: number, score: string, cameBack: string): string {
  return `${head(h)} event=pass-end placed=${placed} score=${logValue(score)} cameback=${logValue(cameBack)}`
}

export function formatRouteSwitch(h: LogHead, fromRoute: number): string {
  return `${head(h)} event=route-switch from=${fromRoute}`
}

export type CaseCheckLogResult = "found" | "wrong" | "again"
export type CaseCheckEnd = "all-found" | "again" | "done" | "start"

/** A Case check began with these wrong cells. */
export function formatCaseCheckStart(h: LogHead, wrongCells: readonly number[]): string {
  return `${head(h)} event=case-check-start letters=${wrongCells.length} cells=${wrongCells.length > 0 ? wrongCells.join(",") : "none"}`
}

/** One Case check pinch on a cell. */
export function formatCaseCheckPinch(h: LogHead, cell: number, result: CaseCheckLogResult): string {
  return `${head(h)} event=case-check cell=${cell} result=${result}`
}

/** A Case check ended: found of total, pinches rejected, how it ended and the card line. */
export function formatCaseCheckEnd(h: LogHead, found: number, total: number, rejected: number, ended: CaseCheckEnd, card: string): string {
  return `${head(h)} event=case-check-end found=${found} of=${total} rejected=${rejected} ended=${ended} card=${logValue(card)}`
}

/** A short random token of lowercase letters and digits, from a [0, 1) source (Math.random in the Lens). */
export function randomToken(random: () => number, length: number = 6): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789"
  let out = ""
  for (let i = 0; i < length; i++) out += chars[Math.min(chars.length - 1, Math.floor(random() * chars.length))]
  return out
}

/** Session id: a start counter and a random token, e.g. "s1-k3x9q2". Nothing about the person or the clock. */
export function sessionId(counter: number, token: string): string {
  return `s${counter}-${token}`
}

/** The most recent lines, oldest dropped past the cap. */
export class LogBuffer {
  private items: string[] = []
  private readonly cap: number

  constructor(cap: number = LOG_CAP) {
    this.cap = Math.max(1, Math.floor(cap))
  }

  push(line: string): void {
    this.items.push(line)
    if (this.items.length > this.cap) this.items.splice(0, this.items.length - this.cap)
  }

  get lines(): string[] {
    return this.items.slice()
  }

  get count(): number {
    return this.items.length
  }
}
