// Owns: the practice route (real house numbers on four streets, one per case cell side), the sample bundle and pass orders.
// Talks to: nothing (pure data); read by CaseLightMain, CaseLightCaseMesh and CaseLightCaseLabelsUI.
// Must not: touch the scene or hold session state.

/**
 * The house numbers and street names are real: they come from OpenStreetMap (data/case_light_route_osm.json,
 * (c) OpenStreetMap contributors, ODbL 1.0, see data/ATTRIBUTION.md), four streets near Kennesaw State
 * University. Only homes are used, and only each home's number and street: no resident information. This
 * is practice mail on a case laid out like one, not a USPS route. The Lens says so in its caption.
 *
 * Order follows USPS handbook M-41 224.12: on each street, the odd side ascending, then the even side
 * descending. Two numbers per separation (left, then right) across slots 0..35 and 40..78; slot 79 is
 * empty and the HOLD block (36..39) has no numbers.
 *
 * The hold piece is 3553 FREY LAKE RD, a number that exists on that street in neither OpenStreetMap nor
 * the county's active address list (project rule: exception cards only on numbers that do not exist), so
 * its only accepted place is the HOLD block. The other pieces keep the slots and sides of the earlier
 * invented sample, so the case geometry the tests use did not move.
 *
 * The table between the markers is written by data/make_route_table.py from the JSON.
 */

import { HOLD_BLOCK_SLOT, SEPS_PER_SHELF } from "./CaseLightGeometry"

export interface Street {
  name: string
}

/** A run of consecutive cells of one street on one shelf (where its street name is printed). */
export interface StreetRun {
  street: number
  /** Slot index of the run's leftmost separation. */
  firstSlot: number
  /** Number of separations in the run. */
  cells: number
}

export interface CellLabel {
  slot: number
  street: number
  left: number
  /** Right-side house number, or null when the separation has only one delivery. */
  right: number | null
  /** Separation that starts a block: a new street, side of the street or hundred. */
  blockStart: boolean
}

export interface SamplePiece {
  /** Address printed on the piece, e.g. "2195 FAIRWAYS CT". */
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

interface Candidate {
  street: number
  number: number
  hold: boolean
}

// BEGIN GENERATED ROUTE TABLE (data/make_route_table.py; do not edit by hand)
export const STREETS: Street[] = [{ name: "FAIRWAYS CT" }, { name: "LEE CT" }, { name: "FREY LAKE RD" }, { name: "TRIBUTARY CT" }]

/** [slot, street, left number, right number or null, blockStart], in delivery order. */
const CELLS: [number, number, number, number | null, boolean][] = [
  [0, 0, 2005, 2015, true],
  [1, 0, 2025, 2035, false],
  [2, 0, 2045, 2055, false],
  [3, 0, 2065, 2075, false],
  [4, 0, 2085, 2095, false],
  [5, 0, 2105, 2115, true],
  [6, 0, 2125, 2135, false],
  [7, 0, 2145, 2155, false],
  [8, 0, 2165, 2175, false],
  [9, 0, 2185, 2195, false],
  [10, 0, 2205, 2215, true],
  [11, 0, 2225, 2235, false],
  [12, 0, 2245, 2255, false],
  [13, 0, 2265, 2275, false],
  [14, 0, 2285, 2295, false],
  [15, 0, 2305, 2315, true],
  [16, 0, 2325, 2335, false],
  [17, 0, 2345, 2355, false],
  [18, 0, 2310, 2300, true],
  [19, 0, 2290, 2280, true],
  [20, 0, 2270, 2260, false],
  [21, 0, 2250, 2240, false],
  [22, 0, 2230, 2220, false],
  [23, 0, 2210, 2200, false],
  [24, 0, 2190, 2180, true],
  [25, 0, 2170, 2160, false],
  [26, 0, 2150, 2140, false],
  [27, 0, 2130, 2120, false],
  [28, 0, 2110, 2100, false],
  [29, 0, 2090, 2080, true],
  [30, 0, 2070, 2060, false],
  [31, 0, 2050, 2040, false],
  [32, 0, 2030, 2020, false],
  [33, 0, 2010, 2000, false],
  [34, 1, 3455, 3457, true],
  [35, 1, 3459, 3461, false],
  [40, 1, 3463, 3465, false],
  [41, 1, 3467, 3469, false],
  [42, 1, 3471, 3473, false],
  [43, 1, 3475, 3477, false],
  [44, 1, 3479, 3481, false],
  [45, 1, 3504, 3502, true],
  [46, 1, 3500, 3498, false],
  [47, 1, 3496, 3494, true],
  [48, 1, 3492, 3490, false],
  [49, 1, 3488, 3486, false],
  [50, 1, 3484, 3482, false],
  [51, 1, 3480, 3478, false],
  [52, 1, 3476, 3474, false],
  [53, 1, 3470, 3466, false],
  [54, 1, 3464, 3462, false],
  [55, 2, 3551, 3561, true],
  [56, 2, 3571, 3581, false],
  [57, 2, 3591, 3611, false],
  [58, 2, 3621, 3631, true],
  [59, 2, 3641, 3651, false],
  [60, 2, 3661, 3671, false],
  [61, 2, 3681, 3691, false],
  [62, 2, 3701, 3711, true],
  [63, 2, 3721, 3731, false],
  [64, 2, 3741, 3751, false],
  [65, 2, 3761, 3771, false],
  [66, 2, 3790, 3740, true],
  [67, 2, 3730, 3720, false],
  [68, 2, 3716, 3710, false],
  [69, 2, 3700, 3694, false],
  [70, 2, 3690, 3670, true],
  [71, 2, 3660, 3610, false],
  [72, 2, 3600, 3590, false],
  [73, 3, 1453, 1455, true],
  [74, 3, 1463, 1465, false],
  [75, 3, 1464, 1462, true],
  [76, 3, 1460, 1458, false],
  [77, 3, 1456, 1454, false],
  [78, 3, 1452, null, false],
]

/** Bundle pieces in practice order. The hold piece's number does not exist on its street. */
const CANDIDATES: Candidate[] = [
  { street: 0, number: 2195, hold: false },
  { street: 1, number: 3498, hold: false },
  { street: 2, number: 3581, hold: false },
  { street: 0, number: 2355, hold: false },
  { street: 3, number: 1460, hold: false },
  { street: 2, number: 3553, hold: true },
  { street: 0, number: 2200, hold: false },
  { street: 0, number: 2035, hold: false },
  { street: 2, number: 3681, hold: false },
  { street: 1, number: 3475, hold: false },
  { street: 0, number: 2260, hold: false },
  { street: 2, number: 3730, hold: false },
]
// END GENERATED ROUTE TABLE

export const HOLD_NOTE_TEXT = "Hold: set this piece aside"
/** Plain gloss under the hold note, for someone who has never cased mail. */
export const HOLD_GLOSS_TEXT = "HOLD: mail kept at the office"

/** Every labelled (non-HOLD) separation with its house numbers, in delivery order. */
export function cellLabels(): CellLabel[] {
  return CELLS.map((c) => ({ slot: c[0], street: c[1], left: c[2], right: c[3], blockStart: c[4] }))
}

/** Runs of one street per shelf, in delivery order (lower playable shelf 0..39, upper 40..79). */
export function streetRuns(): StreetRun[] {
  const out: StreetRun[] = []
  for (const c of CELLS) {
    const last = out.length > 0 ? out[out.length - 1] : null
    const sameShelf = last !== null && Math.floor(last.firstSlot / SEPS_PER_SHELF) === Math.floor(c[0] / SEPS_PER_SHELF)
    if (last !== null && sameShelf && last.street === c[1] && last.firstSlot + last.cells === c[0]) last.cells++
    else out.push({ street: c[1], firstSlot: c[0], cells: 1 })
  }
  return out
}

/** Column indices (0..40) per row where a heavy divider marks a change of street. */
export function streetBoundaryColumns(row: number): number[] {
  const out: number[] = []
  let prevStreet = -1
  for (const c of CELLS) {
    if (Math.floor(c[0] / SEPS_PER_SHELF) !== row) continue
    const col = c[0] % SEPS_PER_SHELF
    if (prevStreet !== -1 && c[1] !== prevStreet && col > 0) out.push(col)
    prevStreet = c[1]
  }
  return out
}

/** Separation and side for a street + house number, or null if it is not on the route. */
export function findAddress(street: number, houseNumber: number): { slot: number; side: number } | null {
  for (const c of CELLS) {
    if (c[1] !== street) continue
    if (c[2] === houseNumber) return { slot: c[0], side: 0 }
    if (c[3] === houseNumber) return { slot: c[0], side: 1 }
  }
  return null
}

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
    if (c.hold) {
      if (findAddress(c.street, c.number)) throw new Error(`CaseLightRoute: hold piece is a real number on the route: ${address}`)
      return { address, target: HOLD_BLOCK_SLOT, side: 0, note: HOLD_NOTE_TEXT, gloss: HOLD_GLOSS_TEXT }
    }
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
