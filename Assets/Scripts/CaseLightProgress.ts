// Owns: the saved progress's scene-free rules: the storage keys and their small JSON values (per route: the rows learned; the last session score), defensive parsing, the merge of this session's row states into what was saved, when the last score is replaced, when the welcome panel shows, and the welcome wording from templates.
// Talks to: nothing (pure TypeScript: no imports, no scene objects, no Lens globals), so plain node can run it; CaseLightMain reads and writes the store through CaseLightProgressStore and calls these rules.
// Must not: touch any store itself, read the clock, or know where anything is drawn.

/**
 * Keys and values (version 1; the version is in the key):
 *   caselight.v1.route.<id>  {"rows":[r, ...]}   playable rows learned on that route (0, 1), ascending
 *   caselight.v1.last        {"x":X,"y":Y}       the last session score: from memory X of Y placed
 * Merge at save, per row of the current route, from this session's mastery row state:
 *   "learned" saves the row as learned; "weak" saves it as not learned; "unseen" keeps what was saved.
 * The last score is replaced only when this session has a recall placement (total > 0).
 * Parsing never throws: missing values are no progress for that key; bad JSON, a value of the wrong
 * shape, another version ("v" other than 1), or rows out of range are no progress for that key and
 * are reported as bad, so the caller can log them. Keys of another version are never read.
 * Welcome (only when there is progress): line 1 "Welcome back. Last time: {x} of {y} from memory"
 * ("Welcome back." when no score was saved); line 2 "Route {r}: {n} of 2 rows learned" for today's route.
 * When it shows (welcomeVisible): progress was saved at Lens start, the opening Start press has not
 * happened, Reset progress has not been pressed, the mastery map has not been shown (it takes the
 * case face), and Veteran mode is off. Veteran mode on hides it, because its panel stands on the
 * case face in front of the cells a veteran pinches; Veteran mode off brings it back while the
 * other conditions still hold.
 */

export const KEY_PREFIX = "caselight.v1."
export const LAST_KEY = "caselight.v1.last"
export const PROGRESS_ROWS = 2

export type ProgressRowState = "unseen" | "weak" | "learned"

export interface SavedScore {
  x: number
  y: number
}

export interface Progress {
  /** Saved routes only: route id to its learned rows (ascending, possibly empty). */
  routes: Map<number, number[]>
  last: SavedScore | null
}

export interface Decoded<T> {
  value: T | null
  /** True when a value was there but could not be used. */
  bad: boolean
}

export interface LoadResult {
  progress: Progress
  /** Keys whose values were there but unusable (treated as no progress). */
  badKeys: string[]
}

export interface WelcomeTemplates {
  line1: string
  line1NoScore: string
  line2: string
}

export const DEFAULT_WELCOME: WelcomeTemplates = {
  line1: "Welcome back. Last time: {x} of {y} from memory",
  line1NoScore: "Welcome back.",
  line2: "Route {r}: {n} of 2 rows learned",
}

export function routeKey(route: number): string {
  return `${KEY_PREFIX}route.${route}`
}

/** Our own keys for these routes (every route key and the last-score key). */
export function ourKeys(routes: readonly number[]): string[] {
  return routes.map((r) => routeKey(r)).concat([LAST_KEY])
}

export function emptyProgress(): Progress {
  return { routes: new Map<number, number[]>(), last: null }
}

export function hasProgress(p: Progress): boolean {
  return p.last !== null || p.routes.size > 0
}

function parseObject(json: string): { obj: { [k: string]: unknown } | null; bad: boolean } {
  if (json === "") return { obj: null, bad: false }
  try {
    const v = JSON.parse(json)
    if (v === null || typeof v !== "object" || Array.isArray(v)) return { obj: null, bad: true }
    if ("v" in v && v.v !== 1) return { obj: null, bad: true }
    return { obj: v, bad: false }
  } catch (e) {
    return { obj: null, bad: true }
  }
}

/** Rows learned from a route value; "" is no value (not bad). */
export function decodeRoute(json: string): Decoded<number[]> {
  const p = parseObject(json)
  if (!p.obj) return { value: null, bad: p.bad }
  const rows = p.obj.rows
  if (!Array.isArray(rows)) return { value: null, bad: true }
  const out: number[] = []
  for (const r of rows) {
    if (typeof r !== "number" || !Number.isInteger(r) || r < 0 || r >= PROGRESS_ROWS) return { value: null, bad: true }
    if (out.indexOf(r) < 0) out.push(r)
  }
  out.sort((a, b) => a - b)
  return { value: out, bad: false }
}

export function encodeRoute(rows: readonly number[]): string {
  const out: number[] = []
  for (const r of rows) if (Number.isInteger(r) && r >= 0 && r < PROGRESS_ROWS && out.indexOf(r) < 0) out.push(r)
  out.sort((a, b) => a - b)
  return JSON.stringify({ rows: out })
}

/** The last score from its value; "" is no value (not bad). x and y are whole numbers with 0 <= x <= y and y > 0. */
export function decodeLast(json: string): Decoded<SavedScore> {
  const p = parseObject(json)
  if (!p.obj) return { value: null, bad: p.bad }
  const x = p.obj.x
  const y = p.obj.y
  const whole = (n: unknown) => typeof n === "number" && Number.isInteger(n) && n >= 0
  if (!whole(x) || !whole(y) || (x as number) > (y as number) || (y as number) === 0) return { value: null, bad: true }
  return { value: { x: x as number, y: y as number }, bad: false }
}

export function encodeLast(score: SavedScore): string {
  return JSON.stringify({ x: score.x, y: score.y })
}

/** Read our version-1 keys through `read` (it returns "" for a missing key). Never throws. */
export function loadProgress(read: (key: string) => string, routes: readonly number[]): LoadResult {
  const progress = emptyProgress()
  const badKeys: string[] = []
  for (const r of routes) {
    const key = routeKey(r)
    const d = decodeRoute(safeRead(read, key))
    if (d.bad) badKeys.push(key)
    if (d.value) progress.routes.set(r, d.value)
  }
  const last = decodeLast(safeRead(read, LAST_KEY))
  if (last.bad) badKeys.push(LAST_KEY)
  progress.last = last.value
  return { progress, badKeys }
}

function safeRead(read: (key: string) => string, key: string): string {
  try {
    const v = read(key)
    return typeof v === "string" ? v : ""
  } catch (e) {
    return ""
  }
}

/** The rows to save for a route: learned rows join, weak rows leave, unseen rows keep what was saved. */
export function mergeRows(saved: readonly number[] | null, states: readonly ProgressRowState[]): number[] {
  const out: number[] = []
  for (let r = 0; r < PROGRESS_ROWS; r++) {
    const state = states[r] ?? "unseen"
    const wasLearned = !!saved && saved.indexOf(r) >= 0
    if (state === "learned" || (state === "unseen" && wasLearned)) out.push(r)
  }
  return out
}

/** The last score to keep: this session's score when it has a recall placement, else what was saved. */
export function nextLast(saved: SavedScore | null, unaided: number, total: number): SavedScore | null {
  return total > 0 ? { x: unaided, y: total } : saved
}

/** What decides whether the welcome panel (and its Reset progress button) shows. */
export interface WelcomeConditions {
  /** Progress was saved when the Lens started. */
  savedAtStart: boolean
  /** The opening Start press has happened (a pass started). */
  startPressed: boolean
  /** Reset progress has been pressed. */
  resetPressed: boolean
  /** The mastery map has been shown (it takes the case face for good). */
  mapShown: boolean
  /** Veteran mode is on right now. */
  veteranOn: boolean
  /** The case has been placed (on a wall or in front of the user) since Lens start. */
  casePlaced: boolean
}

/**
 * The welcome shows only with saved progress, before the opening Start, Reset, the map or a
 * placement of the case, and while Veteran mode is off. (It stands on the case face over the
 * upper row's cells, which is fine only at the opening pose, before any letter is there.)
 */
export function welcomeVisible(c: WelcomeConditions): boolean {
  return c.savedAtStart && !c.startPressed && !c.resetPressed && !c.mapShown && !c.veteranOn && !c.casePlaced
}

/** The welcome lines for today's route, or [] when there is no progress. */
export function welcomeLines(p: Progress, route: number, templates: WelcomeTemplates = DEFAULT_WELCOME): string[] {
  if (!hasProgress(p)) return []
  const line1 = p.last ? fill(templates.line1, { x: p.last.x, y: p.last.y }) : templates.line1NoScore
  const rows = p.routes.get(route)
  const line2 = fill(templates.line2, { r: route, n: rows ? rows.length : 0 })
  return [line1, line2]
}

function fill(template: string, values: { [k: string]: number }): string {
  let out = template
  for (const k of Object.keys(values)) out = out.split(`{${k}}`).join(`${values[k]}`)
  return out
}
