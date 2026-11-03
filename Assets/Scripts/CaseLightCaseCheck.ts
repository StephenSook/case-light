// Owns: the Case check rules: which 2 letters start in wrong cells (deterministic from the pass number), whether a pinched cell is found, wrong or found again, and the card text "Case check: N of 2 found".
// Talks to: nothing (pure TypeScript: no imports, no scene objects, no Lens globals), so plain node can run it; CaseLightMain draws the letters, takes the pinches and shows the card.
// Must not: touch the drill's score, retirement or notes, read the scene, or print.

/**
 * Case check is an optional pass after a recall pass: 2 letters of the bundle are drawn standing
 * in wrong cells and the trainee pinches the cells they are in.
 *   Choosing (chooseMisplaced): only letters with a separation of their own (never the hold letter)
 *   that the caller can move (the letters standing in the case). With n such letters and pass
 *   number p, the letters are eligible[p mod n] and
 *   eligible[(p mod n + 1 + p mod (n - 1)) mod n] (always two different letters). Each goes to a
 *   real labelled cell of the route that is empty (no letter of the bundle belongs there) and not
 *   its own: of those, ordered by distance from its own cell (on a tie the right-hand one comes before),
 *   the (p mod 3)-th, so the mistake is a near miss and differs from pass to pass.
 *   Pinching (CaseCheckRound.pinch): the cell a misplaced letter stands in is "found" the opening
 *   time and "again" after; any other cell is "wrong" and changes nothing but the rejected count.
 */

export const CASE_CHECK_COUNT = 2

export interface Misplaced {
  /** Bundle index of the letter. */
  piece: number
  /** The wrong cell it is drawn in. */
  wrongSlot: number
  /** Its own cell. */
  rightSlot: number
}

export type CheckResult = "found" | "wrong" | "again"

/**
 * The letters that start misplaced. targets[i] is letter i's own cell (negative for the hold
 * letter); labelledSlots are the route's labelled cells; movable (optional) lists the letters that
 * may be chosen (default: every letter). A wrong cell is never any bundle letter's own cell. Empty
 * when fewer than `count` letters qualify.
 */
export function chooseMisplaced(targets: readonly number[], labelledSlots: readonly number[], passNumber: number, count: number = CASE_CHECK_COUNT, movable?: readonly number[]): Misplaced[] {
  const eligible: number[] = []
  targets.forEach((t, i) => {
    if (t >= 0 && (!movable || movable.indexOf(i) >= 0)) eligible.push(i)
  })
  const n = eligible.length
  if (n < count || count < 1) return []
  const p = Math.max(0, Math.floor(passNumber))
  const picks: number[] = [eligible[p % n]]
  if (count >= 2) picks.push(eligible[(p % n + 1 + (n > 1 ? p % (n - 1) : 0)) % n])
  for (let k = 2; k < count; k++) {
    const next = eligible.find((i) => picks.indexOf(i) < 0)
    if (next === undefined) return []
    picks.push(next)
  }
  const occupied = new Set<number>(targets.filter((t) => t >= 0))
  const used = new Set<number>()
  const out: Misplaced[] = []
  for (const piece of picks) {
    const right = targets[piece]
    const free = labelledSlots.filter((s) => s !== right && !occupied.has(s) && !used.has(s))
    if (free.length === 0) return []
    free.sort((a, b) => {
      const d = Math.abs(a - right) - Math.abs(b - right)
      return d !== 0 ? d : b - a
    })
    const wrong = free[Math.min(free.length - 1, p % 3)]
    used.add(wrong)
    out.push({ piece, wrongSlot: wrong, rightSlot: right })
  }
  return out
}

/** One Case check: which misplaced cells are found, and how many pinches were rejected. */
export class CaseCheckRound {
  readonly misplaced: readonly Misplaced[]
  private found = new Set<number>()
  private rejected = 0

  constructor(misplaced: readonly Misplaced[]) {
    this.misplaced = misplaced.slice()
  }

  /** A pinch on a cell: found (a misplaced letter's cell, the opening time), again (already found) or wrong. */
  pinch(slot: number): CheckResult {
    const hit = this.misplaced.some((m) => m.wrongSlot === slot)
    if (!hit) {
      this.rejected++
      return "wrong"
    }
    if (this.found.has(slot)) return "again"
    this.found.add(slot)
    return "found"
  }

  get foundCount(): number {
    return this.found.size
  }

  get total(): number {
    return this.misplaced.length
  }

  get rejectedCount(): number {
    return this.rejected
  }

  get done(): boolean {
    return this.total > 0 && this.found.size >= this.total
  }

  isFound(slot: number): boolean {
    return this.found.has(slot)
  }

  /** Found cells, ascending. */
  get foundSlots(): number[] {
    return Array.from(this.found.values()).sort((a, b) => a - b)
  }
}

/** The card's Case check line. */
export function caseCheckCardText(found: number, total: number = CASE_CHECK_COUNT): string {
  return `Case check: ${found} of ${total} found`
}
