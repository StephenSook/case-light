// Owns: the invented sample route (streets, blocks, house numbers per cell), the sample bundle and pass orders.
// Talks to: nothing (pure data); read by CaseLightMain, CaseLightCaseMesh and CaseLightCaseLabelsUI.
// Must not: touch the scene or hold session state.

/**
 * All addresses are made up for a training preview: generic street names, no town, no real
 * route. Labelled "Preview: sample letters" in the Lens. The hold piece uses a house number
 * that does not exist on its street in this sample route (project rule for exception cards),
 * so its only accepted place is the HOLD block.
 *
 * Delivery order runs left to right along each shelf, lower playable shelf then upper.
 */

import { HOLD_BLOCK_SLOT, SEPS_PER_SHELF } from "./CaseLightGeometry"

export interface Street {
  name: string
}

export interface Block {
  street: number
  /** Slot index of the block's leftmost separation. */
  firstSlot: number
  /** Number of separations in the block. */
  cells: number
  /** House number on the left side of the block's leftmost separation. */
  firstNumber: number
  /** House-number step between consecutive addresses on this side of the street. */
  step: number
}

export interface CellLabel {
  slot: number
  street: number
  left: number
  right: number
  blockStart: boolean
}

export interface SamplePiece {
  /** Address printed on the piece, e.g. "1482 MAIN ST". */
  address: string
  /** Correct separation, or HOLD_BLOCK_SLOT for the hold piece. */
  target: number
  /** 0 = left side of the separation, 1 = right side (ignored for the hold piece). */
  side: number
  /** Veteran's note pinned to this address, or null. */
  note: string | null
  /** Short plain gloss shown under the note (what HOLD means), or null. */
  gloss: string | null
}

// Short street names keep every sample address on one line at full 3 cm print on the letter.
export const STREETS: Street[] = [{ name: "MAIN ST" }, { name: "ELM AVE" }, { name: "BIRCH LN" }, { name: "OAK CT" }]

/** Blocks in delivery order. Lower shelf slots 0..35 (36..39 are HOLD), upper shelf 40..79. */
export const BLOCKS: Block[] = [
  { street: 0, firstSlot: 0, cells: 14, firstNumber: 1444, step: 2 },
  { street: 0, firstSlot: 14, cells: 8, firstNumber: 1500, step: 2 },
  { street: 1, firstSlot: 22, cells: 14, firstNumber: 201, step: 2 },
  { street: 1, firstSlot: 40, cells: 10, firstNumber: 301, step: 2 },
  { street: 2, firstSlot: 50, cells: 14, firstNumber: 102, step: 2 },
  { street: 3, firstSlot: 64, cells: 16, firstNumber: 601, step: 2 }
]

export const HOLD_NOTE_TEXT = "Hold: set this piece aside"
/** Plain gloss under the hold note, for someone who has never cased mail. */
export const HOLD_GLOSS_TEXT = "HOLD: mail kept at the office"

/** Every labelled (non-HOLD) separation with its two house numbers. */
export function cellLabels(): CellLabel[] {
  const out: CellLabel[] = []
  for (const b of BLOCKS) {
    for (let i = 0; i < b.cells; i++) {
      out.push({
        slot: b.firstSlot + i,
        street: b.street,
        left: b.firstNumber + b.step * (2 * i),
        right: b.firstNumber + b.step * (2 * i + 1),
        blockStart: i === 0
      })
    }
  }
  return out
}

/** Column indices (0..40) per row where a heavy divider marks a change of street. */
export function streetBoundaryColumns(row: number): number[] {
  const out: number[] = []
  let prevStreet = -1
  for (const b of BLOCKS) {
    const bRow = b.firstSlot < SEPS_PER_SHELF ? 0 : 1
    if (bRow !== row) continue
    const col = b.firstSlot % SEPS_PER_SHELF
    if (prevStreet !== -1 && b.street !== prevStreet && col > 0) out.push(col)
    prevStreet = b.street
  }
  return out
}

/** Separation and side for a street + house number, or null if it is not on the sample route. */
export function findAddress(street: number, houseNumber: number): { slot: number; side: number } | null {
  for (const b of BLOCKS) {
    if (b.street !== street) continue
    const offset = houseNumber - b.firstNumber
    if (offset < 0 || offset % b.step !== 0) continue
    const k = offset / b.step
    if (k >= b.cells * 2) continue
    return { slot: b.firstSlot + Math.floor(k / 2), side: k % 2 }
  }
  return null
}

interface Candidate {
  street: number
  number: number
  hold: boolean
}

/**
 * Sample bundle candidates in practice order. Spread across both shelves so some targets sit
 * inside the glasses' view from the start position and some sit far to the side.
 * Index 5 is the hold piece (238 ELM AVE: ELM AVE cells hold odd numbers only).
 */
const CANDIDATES: Candidate[] = [
  { street: 0, number: 1482, hold: false },
  { street: 1, number: 327, hold: false },
  { street: 2, number: 128, hold: false },
  { street: 0, number: 1514, hold: false },
  { street: 3, number: 649, hold: false },
  { street: 1, number: 238, hold: true },
  { street: 1, number: 207, hold: false },
  { street: 0, number: 1450, hold: false },
  { street: 2, number: 146, hold: false },
  { street: 1, number: 313, hold: false },
  { street: 0, number: 1526, hold: false },
  { street: 3, number: 613, hold: false }
]

export const MAX_BUNDLE = CANDIDATES.length
export const MIN_BUNDLE = 2

/** The sample bundle for a bundle-count setting. Always contains the hold piece. */
export function buildBundle(count: number): SamplePiece[] {
  const n = Math.max(MIN_BUNDLE, Math.min(MAX_BUNDLE, Math.round(count)))
  const holdIndex = CANDIDATES.findIndex((c) => c.hold)
  const chosen = CANDIDATES.slice(0, n)
  if (!chosen.some((c) => c.hold)) chosen[n - 1] = CANDIDATES[holdIndex]
  return chosen.map((c) => {
    const address = `${c.number} ${STREETS[c.street].name}`
    if (c.hold) return { address, target: HOLD_BLOCK_SLOT, side: 0, note: HOLD_NOTE_TEXT, gloss: HOLD_GLOSS_TEXT }
    const found = findAddress(c.street, c.number)
    if (!found) throw new Error(`CaseLightRoute: sample address not on route: ${address}`)
    return { address, target: found.slot, side: found.side, note: null, gloss: null }
  })
}

/** Practice order: the bundle as listed. */
export function practiceOrder(n: number): number[] {
  const out: number[] = []
  for (let i = 0; i < n; i++) out.push(i)
  return out
}

/**
 * Recall order: the same pieces in a new order (deterministic per pass number so tests can
 * predict it). Never identical to the practice order.
 */
export function recallOrder(n: number, passNumber: number): number[] {
  const order = practiceOrder(n)
  let seed = (1103515245 * (passNumber + 7) + 12345) >>> 0
  for (let i = n - 1; i > 0; i--) {
    seed = (1103515245 * seed + 12345) >>> 0
    const j = seed % (i + 1)
    const tmp = order[i]
    order[i] = order[j]
    order[j] = tmp
  }
  const same = order.every((v, i) => v === i)
  if (same && n > 1) order.push(order.shift() as number)
  return order
}
