// Owns: the mastery map's scene-free rules: each letter's state from its latest recall event (unseen, weak, learned), kept per route; a playable row's state and counts from its letters; and the row label wording from templates.
// Talks to: nothing (pure TypeScript: no imports, no scene objects, no Lens globals), so plain node can run it; CaseLightMain records recall events into it and CaseLightMasteryView draws what it reports.
// Must not: touch SceneObjects, read the clock, or know where anything is drawn.

/**
 * Rules (the wordings are the defaults; each is a parameter):
 *   Letter state, per route, from that letter's LATEST recall event this session:
 *     "unseen"  no recall miss and no recall placement yet;
 *     "weak"    the latest event was a recall miss, or a recall placement of a letter that was
 *               helped in that pass (so a miss then its come-back placed right stays weak);
 *     "learned" the latest event was a recall placement from memory.
 *   Practice events change nothing. Nothing here is cleared by Done or a route switch; only a new
 *   map (a fresh Lens start) starts empty. Each route keeps its own letters.
 *   Row: the 2 playable rows; a target 0..39 is row 0, 40..79 row 1, and the hold letter (target
 *   -2, the HOLD block, cells 36 to 39 of row 0) is row 0. A row's state takes the worst of its
 *   letters in this order: any weak letter makes it "weak"; otherwise any unseen letter makes it
 *   "unseen"; otherwise (every letter learned) it is "learned". A row with no letters is "unseen".
 *   Label: "From memory" (the state keeps its internal name "learned"; the word avoids claiming a letter is learned after one placement); "Review {n}" with n = weak letters; "Not tried {n}" with n = unseen letters.
 */

export type MasteryState = "unseen" | "weak" | "learned"
export type MasteryMode = "practice" | "recall" | "idle"

export const ROWS = 2
export const SEPS_PER_ROW = 40
/** The hold letter's target (the HOLD block). */
export const HOLD_TARGET = -2

export const LEARNED_TEMPLATE = "From memory"
export const REVIEW_TEMPLATE = "Review {n}"
export const NOT_TRIED_TEMPLATE = "Not tried {n}"

export interface RowCounts {
  learned: number
  weak: number
  unseen: number
}

export interface LabelTemplates {
  learned: string
  review: string
  notTried: string
}

export const DEFAULT_TEMPLATES: LabelTemplates = { learned: LEARNED_TEMPLATE, review: REVIEW_TEMPLATE, notTried: NOT_TRIED_TEMPLATE }

/** Playable row of a target: the HOLD block (and any negative target) is row 0. */
export function rowOfTarget(target: number, sepsPerRow: number = SEPS_PER_ROW): number {
  return target < 0 ? 0 : Math.floor(target / sepsPerRow)
}

/** A row's state from its counts: weak, then unseen, then learned. */
export function rowStateOf(counts: RowCounts): MasteryState {
  if (counts.weak > 0) return "weak"
  if (counts.unseen > 0) return "unseen"
  if (counts.learned > 0) return "learned"
  return "unseen"
}

/** The row label for a state and its counts: "From memory", "Review {n}" (n weak) or "Not tried {n}" (n unseen). */
export function rowLabel(state: MasteryState, counts: RowCounts, templates: LabelTemplates = DEFAULT_TEMPLATES): string {
  if (state === "learned") return templates.learned
  if (state === "weak") return templates.review.split("{n}").join(`${counts.weak}`)
  return templates.notTried.split("{n}").join(`${counts.unseen}`)
}

/** Every letter's state, per route, for the session. */
export class MasteryMap {
  readonly letterCount: number
  private readonly routes = new Map<number, MasteryState[]>()

  constructor(letterCount: number) {
    this.letterCount = Math.max(0, Math.floor(letterCount))
  }

  private statesFor(route: number): MasteryState[] {
    let s = this.routes.get(route)
    if (!s) {
      s = []
      for (let i = 0; i < this.letterCount; i++) s.push("unseen")
      this.routes.set(route, s)
    }
    return s
  }

  /** A letter's state on a route ("unseen" for a letter or route never recorded). */
  letterState(route: number, piece: number): MasteryState {
    const s = this.routes.get(route)
    if (!s || piece < 0 || piece >= s.length) return "unseen"
    return s[piece]
  }

  /** A recall miss (a wrong cell, or the hold letter refused): the letter is weak. Practice is ignored. */
  recordMiss(route: number, piece: number, mode: MasteryMode = "recall"): void {
    if (mode !== "recall" || piece < 0 || piece >= this.letterCount) return
    this.statesFor(route)[piece] = "weak"
  }

  /** A recall placement: learned when from memory, weak when the letter was helped in that pass. Practice is ignored. */
  recordPlacement(route: number, piece: number, fromMemory: boolean, mode: MasteryMode = "recall"): void {
    if (mode !== "recall" || piece < 0 || piece >= this.letterCount) return
    this.statesFor(route)[piece] = fromMemory ? "learned" : "weak"
  }

  /** Counts for a row: targets[i] is letter i's target on this route (a separation, or -2 for the hold letter). */
  rowCounts(route: number, targets: readonly number[], row: number): RowCounts {
    const out: RowCounts = { learned: 0, weak: 0, unseen: 0 }
    targets.forEach((t, i) => {
      if (rowOfTarget(t) !== row) return
      out[this.letterState(route, i)]++
    })
    return out
  }

  rowState(route: number, targets: readonly number[], row: number): MasteryState {
    return rowStateOf(this.rowCounts(route, targets, row))
  }

  /** Routes with at least one recorded event. */
  get routesRecorded(): number[] {
    return Array.from(this.routes.keys()).sort((a, b) => a - b)
  }
}
