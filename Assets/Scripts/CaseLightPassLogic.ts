// Owns: the drill's scene-free rules: the live pass queue (top letter at index 0), the comes-back rule for a recall miss, the per-pass helped set, the retire rule across recall passes, the session score, and the score-card wording from templates.
// Talks to: nothing (pure TypeScript: no imports, no scene objects, no Lens globals), so plain node can run it; CaseLightMain drives it and CaseLightCaseLabelsUI formats the card with it.
// Must not: touch SceneObjects, read the clock, or know where anything is drawn.

/**
 * Rules (the numbers are the defaults; each is a parameter):
 *   Comes back: in a recall pass, a letter dropped in a wrong cell goes back into the bundle so
 *     that exactly COME_BACK_GAP (2) other letters come before it; with fewer left, it goes to the
 *     end. Every such return counts once in the pass's came-back number.
 *   Helped: a miss marks only that letter as helped, for the rest of the pass, even if it is later
 *     placed right. Placing a helped letter counts as placed, not from memory.
 *   Answer light: a miss lights its answer until the next letter is picked up. Every come-back is
 *     a fresh try, so the missed letter itself comes back dark too, even when it is the very next
 *     letter (the last one left). The light changes nothing in the score: it stays helped.
 *   Retire: a letter placed from memory in RETIRE_AFTER_PASSES (2) completed recall passes in a
 *     row is retired until reset() (CaseLightMain resets on Done). A completed recall pass where
 *     it was helped breaks the run. Practice passes and recall passes left unfinished change
 *     nothing. Retired letters are left out of later recall orders.
 *   Score: "from memory" counts letters placed without help; "placed" counts every recall
 *     placement; both run for the whole session.
 */

export const COME_BACK_GAP = 2
export const RETIRE_AFTER_PASSES = 2

/**
 * Where a missed top letter re-enters the queue: the new queue with queue[0] moved so that exactly
 * `gap` other letters come before it (or to the end when fewer than `gap` others remain).
 */
export function comeBackQueue(queue: readonly number[], gap: number = COME_BACK_GAP): number[] {
  if (queue.length === 0) return []
  const missed = queue[0]
  const rest = queue.slice(1)
  const at = Math.min(Math.max(0, Math.floor(gap)), rest.length)
  return [...rest.slice(0, at), missed, ...rest.slice(at)]
}

/**
 * The letter whose miss answer is still lit after `grabbedPiece` is picked up in recall, or -1.
 * Any pick-up clears it, the missed letter's own return included.
 */
export function missLitAfterGrab(missLitPiece: number, grabbedPiece: number): number {
  return grabbedPiece >= 0 ? -1 : missLitPiece
}

/** A recall order without the retired letters (the order of the others is kept). */
export function withoutRetired(order: readonly number[], isRetired: (piece: number) => boolean): number[] {
  return order.filter((p) => !isRetired(p))
}

/** One pass: the live queue (top letter at index 0), what was placed, who was helped, and how often a letter came back. */
export class PassQueue {
  readonly startOrder: readonly number[]
  private live: number[]
  private helped = new Set<number>()
  private placed = 0
  private comeBacks = 0
  private readonly gap: number

  constructor(order: readonly number[], gap: number = COME_BACK_GAP) {
    this.startOrder = order.slice()
    this.live = order.slice()
    this.gap = gap
  }

  /** The letters still in the bundle, top letter at index 0. */
  get queue(): number[] {
    return this.live.slice()
  }

  /** The top letter, or -1 when the pass is done. */
  get top(): number {
    return this.live.length > 0 ? this.live[0] : -1
  }

  get done(): boolean {
    return this.live.length === 0
  }

  get placedCount(): number {
    return this.placed
  }

  /** How many times a missed letter went back into the bundle this pass. */
  get comeBackCount(): number {
    return this.comeBacks
  }

  isHelped(piece: number): boolean {
    return this.helped.has(piece)
  }

  /** Helped letters this pass, in the pass's starting order. */
  get helpedLetters(): number[] {
    return this.startOrder.filter((p) => this.helped.has(p))
  }

  /** The top letter was placed right. Returns whether it counts as helped. */
  placeTop(): { piece: number; helped: boolean } {
    const piece = this.top
    if (piece < 0) return { piece: -1, helped: false }
    this.live.shift()
    this.placed++
    return { piece, helped: this.helped.has(piece) }
  }

  /** The top letter missed (recall): helped for the rest of the pass, and it comes back. Returns its new queue index. */
  missTop(): number {
    const piece = this.top
    if (piece < 0) return -1
    this.helped.add(piece)
    this.live = comeBackQueue(this.live, this.gap)
    this.comeBacks++
    return this.live.indexOf(piece)
  }
}

/** Runs of unaided recall passes per letter, and who is retired. */
export class Retirement {
  private streaks: number[]
  private retired: boolean[]
  private readonly after: number

  constructor(pieceCount: number, retireAfterPasses: number = RETIRE_AFTER_PASSES) {
    this.streaks = new Array(pieceCount).fill(0)
    this.retired = new Array(pieceCount).fill(false)
    this.after = Math.max(1, Math.floor(retireAfterPasses))
  }

  isRetired(piece: number): boolean {
    return !!this.retired[piece]
  }

  /** Completed recall passes in a row this letter was placed from memory. */
  streakOf(piece: number): number {
    return this.streaks[piece] ?? 0
  }

  get retiredCount(): number {
    return this.retired.filter((r) => r).length
  }

  get allRetired(): boolean {
    return this.retired.length > 0 && this.retired.every((r) => r)
  }

  /** Retired letters, in index order. */
  get retiredLetters(): number[] {
    const out: number[] = []
    this.retired.forEach((r, i) => {
      if (r) out.push(i)
    })
    return out
  }

  /** A completed recall pass: update each presented letter's run. Returns the letters retired by it. */
  recordPass(presented: readonly number[], wasHelped: (piece: number) => boolean): number[] {
    const newly: number[] = []
    for (const p of presented) {
      if (p < 0 || p >= this.streaks.length || this.retired[p]) continue
      this.streaks[p] = wasHelped(p) ? 0 : this.streaks[p] + 1
      if (this.streaks[p] >= this.after) {
        this.retired[p] = true
        newly.push(p)
      }
    }
    return newly
  }

  reset(): void {
    this.streaks = this.streaks.map(() => 0)
    this.retired = this.retired.map(() => false)
  }
}

/** Session score: letters placed from memory, placed with help, and placed in all. */
export class SessionScore {
  unaided = 0
  helped = 0
  total = 0

  add(wasHelped: boolean): void {
    if (wasHelped) this.helped++
    else this.unaided++
    this.total++
  }
}

/** Score-card main line: {x} = from memory, {y} = placed. */
export function formatScore(template: string, unaided: number, total: number): string {
  return template.split("{x}").join(`${unaided}`).split("{y}").join(`${total}`)
}

/** Score-card came-back line: {n} = times a missed letter came back this pass. */
export function formatCameBack(template: string, comeBacks: number): string {
  return template.split("{n}").join(`${comeBacks}`)
}
