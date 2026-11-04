// Owns: the learning curve's scene-free rules: one point per completed recall pass (that pass's letters placed from memory of letters placed), kept per route, newest last, at most HISTORY_MAX; the small JSON value and its defensive parsing; appending a pass; the score label and caption text; where each point goes across the curve (oldest left); and when the curve shows.
// Talks to: CaseLightProgress (the history key; pure), so plain node can run it; CaseLightMain reads and writes the store through CaseLightProgressStore and calls these rules; CaseLightHistoryView draws what they give.
// Must not: touch any store itself, read the clock, or know where the curve stands in the scene.

/**
 * Value (version 1; the version is in the key): caselight.v1.history.<route> = [{"x":X,"y":Y}, ...],
 * oldest at the start, at most HISTORY_MAX entries, each a whole-number score with 0 <= x <= y and y > 0.
 * Parsing never throws: a missing value is no history (not bad); bad JSON, a value that is not such
 * a list, or a list longer than HISTORY_MAX is no history for that route and is reported as bad.
 * A pass's point is the change in the session score over that pass (letters placed from memory,
 * letters placed); a pass with no placement adds nothing.
 * The curve shows only when the route in use has history and the drill pace caption is not up (it
 * stands where the caption stands). With nothing saved, nothing is drawn, caption included.
 */

import { historyKey } from "./CaseLightProgress"

/** One point: letters placed from memory (x) of letters placed (y) in one recall pass (the same shape as CaseLightProgress's SavedScore). */
export interface HistoryScore {
  x: number
  y: number
}

export const HISTORY_MAX = 5
/** The curve's one caption; the points carry the score labels. */
export const HISTORY_CAPTION = "Recall passes"

export interface HistoryDecoded {
  value: HistoryScore[] | null
  bad: boolean
}

export interface HistoryLoad {
  /** Routes with history only: route id to its points, oldest at the start. */
  history: Map<number, HistoryScore[]>
  /** Keys whose values were there but unusable (treated as no history). */
  badKeys: string[]
}

function wholeScore(v: unknown): HistoryScore | null {
  if (v === null || typeof v !== "object" || Array.isArray(v)) return null
  const o = v as { x?: unknown; y?: unknown }
  const whole = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0
  if (!whole(o.x) || !whole(o.y)) return null
  const x = o.x as number
  const y = o.y as number
  if (x > y || y === 0) return null
  return { x, y }
}

/** A route's history from its value; "" is no value (not bad). */
export function decodeHistory(json: string): HistoryDecoded {
  if (json === "") return { value: null, bad: false }
  let v: unknown
  try {
    v = JSON.parse(json)
  } catch (e) {
    return { value: null, bad: true }
  }
  if (!Array.isArray(v) || v.length > HISTORY_MAX) return { value: null, bad: true }
  const out: HistoryScore[] = []
  for (const item of v) {
    const s = wholeScore(item)
    if (!s) return { value: null, bad: true }
    out.push(s)
  }
  return { value: out, bad: false }
}

export function encodeHistory(list: readonly HistoryScore[]): string {
  return JSON.stringify(list.map((s) => ({ x: s.x, y: s.y })))
}

/** The list with this pass's score added at the end, keeping the newest `max`. */
export function appendHistory(list: readonly HistoryScore[] | null, score: HistoryScore, max: number = HISTORY_MAX): HistoryScore[] {
  const out = (list ? list.slice() : []).concat([{ x: score.x, y: score.y }])
  return out.length > max ? out.slice(out.length - max) : out
}

/** A pass's point: the session score's change over the pass, or null when nothing was placed. */
export function passScore(unaidedBefore: number, totalBefore: number, unaidedAfter: number, totalAfter: number): HistoryScore | null {
  const x = unaidedAfter - unaidedBefore
  const y = totalAfter - totalBefore
  if (!Number.isInteger(x) || !Number.isInteger(y) || y <= 0 || x < 0 || x > y) return null
  return { x, y }
}

/** The label on a point: "x/y". */
export function scoreLabel(s: HistoryScore): string {
  return `${s.x}/${s.y}`
}

/** Read every route's history through `read` (it returns "" for a missing key). Never throws. */
export function loadHistory(read: (key: string) => string, routes: readonly number[]): HistoryLoad {
  const history = new Map<number, HistoryScore[]>()
  const badKeys: string[] = []
  for (const r of routes) {
    const key = historyKey(r)
    let raw = ""
    try {
      const v = read(key)
      raw = typeof v === "string" ? v : ""
    } catch (e) {
      raw = ""
    }
    const d = decodeHistory(raw)
    if (d.bad) badKeys.push(key)
    if (d.value && d.value.length > 0) history.set(r, d.value)
  }
  return { history, badKeys }
}

/**
 * Where each point goes in the curve's own frame (cm, centred): point i of the list (oldest at the start)
 * stands in slot i of HISTORY_MAX slots across `width`, left to right; its height is its score's
 * share (x / y) of `height`, from the bottom of the plot.
 */
export function curvePoints(list: readonly HistoryScore[], width: number, height: number): { x: number; y: number }[] {
  const slot = width / HISTORY_MAX
  return list.slice(0, HISTORY_MAX).map((s, i) => ({ x: -width / 2 + slot * (i + 0.5), y: -height / 2 + height * (s.x / s.y) }))
}

/** True when the curve is drawn: the route in use has history and the drill pace caption is not up. */
export function curveVisible(list: readonly HistoryScore[] | null, paceCaptionUp: boolean): boolean {
  return !!list && list.length > 0 && !paceCaptionUp
}
