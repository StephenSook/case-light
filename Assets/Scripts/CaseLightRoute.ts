// Owns: the two practice routes (real house numbers, one per case cell side), the route choice rule, the sample bundle and pass orders.
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
 * The tables between the markers are written by data/make_route_table.py from the JSON files.
 * Route 2 (data/case_light_route_osm_b.json, eight streets about 2 km further west, same ODbL
 * terms) uses the same slots, sides and HOLD rule; its hold piece is 3053 SHIRLEY DR. Every function
 * here takes the route (default Route 1), so the case labels, the street breaks and the bundle all
 * come from one place.
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

/** Route 2 (OpenStreetMap API map call, bbox -84.622,34.028,-84.600,34.050, fetched 2026-11-02 about 14:28 ET). */
export const STREETS_ROUTE_2: Street[] = [{ name: "IRVIN CT" }, { name: "SHIRLEY DR" }, { name: "PINE HILL DR" }, { name: "DUVALL PL" }, { name: "DOUGLAS LN" }, { name: "MCGARITY LN" }, { name: "JEBS CT" }, { name: "TERRY LN NW" }]

/** [slot, street, left number, right number or null, blockStart], in delivery order. */
const CELLS_ROUTE_2: [number, number, number, number | null, boolean][] = [
  [0, 0, 2112, 2108, true],
  [1, 0, 2106, 2104, false],
  [2, 0, 2102, 2100, false],
  [3, 1, 3051, 3059, true],
  [4, 1, 3067, 3089, false],
  [5, 1, 3097, 3109, false],
  [6, 1, 3125, 3141, true],
  [7, 1, 3149, 3157, false],
  [8, 1, 3165, 3173, false],
  [9, 1, 3181, 3189, false],
  [10, 1, 3197, 3205, false],
  [11, 1, 3221, 3229, true],
  [12, 1, 3253, 3262, false],
  [13, 1, 3254, 3214, true],
  [14, 1, 3204, 3196, false],
  [15, 1, 3188, 3180, true],
  [16, 1, 3166, 3142, false],
  [17, 1, 3134, 3124, false],
  [18, 1, 3114, 3104, false],
  [19, 1, 3072, 3052, true],
  [20, 2, 3061, 3075, true],
  [21, 2, 3091, 3095, false],
  [22, 2, 3107, 3100, true],
  [23, 2, 3080, 3070, true],
  [24, 3, 3105, 3115, true],
  [25, 3, 3125, 3135, false],
  [26, 3, 3145, 3155, false],
  [27, 3, 3210, 3200, true],
  [28, 3, 3190, 3180, true],
  [29, 3, 3170, 3160, false],
  [30, 3, 3150, 3140, false],
  [31, 3, 3130, 3120, false],
  [32, 3, 3110, 3100, false],
  [33, 4, 3201, 3215, true],
  [34, 4, 3227, 3239, false],
  [35, 4, 3251, 3288, false],
  [40, 4, 3278, 3272, true],
  [41, 4, 3264, 3260, false],
  [42, 4, 3250, 3228, false],
  [43, 4, 3226, 3214, false],
  [44, 4, 3198, 3170, true],
  [45, 4, 3128, null, false],
  [46, 5, 3239, 3249, true],
  [47, 5, 3259, 3269, false],
  [48, 5, 3279, 3291, false],
  [49, 5, 3290, 3278, true],
  [50, 5, 3268, 3258, false],
  [51, 5, 3248, 3238, false],
  [52, 5, 3228, null, false],
  [53, 6, 2001, 2003, true],
  [54, 6, 2005, 2007, false],
  [55, 6, 2009, 2011, false],
  [56, 6, 2013, 2015, false],
  [57, 6, 2017, 2019, false],
  [58, 6, 2021, 2023, false],
  [59, 6, 2025, 2027, false],
  [60, 6, 2029, 2054, false],
  [61, 6, 2052, 2050, true],
  [62, 6, 2048, 2046, false],
  [63, 6, 2044, 2042, false],
  [64, 6, 2040, 2038, false],
  [65, 6, 2036, 2034, false],
  [66, 6, 2032, 2030, false],
  [67, 6, 2028, 2026, false],
  [68, 6, 2024, 2022, false],
  [69, 6, 2020, 2018, false],
  [70, 6, 2016, 2014, false],
  [71, 6, 2012, 2010, false],
  [72, 6, 2008, 2006, false],
  [73, 6, 2004, 2002, false],
  [74, 6, 2000, null, false],
  [75, 7, 3511, 3521, true],
  [76, 7, 3531, 3541, false],
  [77, 7, 3551, 3550, false],
  [78, 7, 3510, null, true],
]

/** Bundle pieces in practice order. The hold piece's number does not exist on its street. */
const CANDIDATES_ROUTE_2: Candidate[] = [
  { street: 1, number: 3189, hold: false },
  { street: 5, number: 3249, hold: false },
  { street: 6, number: 2015, hold: false },
  { street: 1, number: 3124, hold: false },
  { street: 7, number: 3531, hold: false },
  { street: 1, number: 3053, hold: true },
  { street: 2, number: 3070, hold: false },
  { street: 0, number: 2104, hold: false },
  { street: 6, number: 2052, hold: false },
  { street: 4, number: 3226, hold: false },
  { street: 2, number: 3075, hold: false },
  { street: 6, number: 2028, hold: false },
]
// END GENERATED ROUTE TABLE

export const HOLD_NOTE_TEXT = "Hold: set this piece aside"
/** Plain gloss under the hold note, for someone who has never cased mail. */
export const HOLD_GLOSS_TEXT = "HOLD: mail kept at the office"

// ── Routes ─────────────────────────────────────────────────────────────────────────────

/** Today's route: the trainee picks one before practice. Route 1 is the default. */
export type RouteId = 1 | 2
export const ROUTE_IDS: readonly RouteId[] = [1, 2]
export const DEFAULT_ROUTE: RouteId = 1

interface RouteTable {
  streets: Street[]
  cells: [number, number, number, number | null, boolean][]
  candidates: Candidate[]
}

const ROUTES: { [id: number]: RouteTable } = {
  1: { streets: STREETS, cells: CELLS, candidates: CANDIDATES },
  2: { streets: STREETS_ROUTE_2, cells: CELLS_ROUTE_2, candidates: CANDIDATES_ROUTE_2 }
}

export function isRouteId(n: number): n is RouteId {
  return ROUTE_IDS.indexOf(n as RouteId) >= 0
}

function table(route: RouteId): RouteTable {
  return ROUTES[route] ?? ROUTES[DEFAULT_ROUTE]
}

/** The picker's label for a route ("Route 1"). */
export function routeLabel(route: RouteId): string {
  return `Route ${route}`
}

/**
 * The route choice rule: a switch is taken only between passes (mode "idle") and only to a known,
 * different route. Returns the route in force afterwards and whether it changed.
 */
export function chooseRoute(current: RouteId, requested: number, mode: string): { route: RouteId; switched: boolean } {
  if (mode !== "idle" || !isRouteId(requested) || requested === current) return { route: current, switched: false }
  return { route: requested, switched: true }
}

/** The route's streets, in case order. */
export function routeStreets(route: RouteId = DEFAULT_ROUTE): Street[] {
  return table(route).streets.slice()
}

/** Every labelled (non-HOLD) separation with its house numbers, in delivery order. */
export function cellLabels(route: RouteId = DEFAULT_ROUTE): CellLabel[] {
  return table(route).cells.map((c) => ({ slot: c[0], street: c[1], left: c[2], right: c[3], blockStart: c[4] }))
}

/** Runs of one street per shelf, in delivery order (lower playable shelf 0..39, upper 40..79). */
export function streetRuns(route: RouteId = DEFAULT_ROUTE): StreetRun[] {
  const out: StreetRun[] = []
  for (const c of table(route).cells) {
    const last = out.length > 0 ? out[out.length - 1] : null
    const sameShelf = last !== null && Math.floor(last.firstSlot / SEPS_PER_SHELF) === Math.floor(c[0] / SEPS_PER_SHELF)
    if (last !== null && sameShelf && last.street === c[1] && last.firstSlot + last.cells === c[0]) last.cells++
    else out.push({ street: c[1], firstSlot: c[0], cells: 1 })
  }
  return out
}

/** Column indices (0..40) per row where a heavy divider marks a change of street. */
export function streetBoundaryColumns(row: number, route: RouteId = DEFAULT_ROUTE): number[] {
  const out: number[] = []
  let prevStreet = -1
  for (const c of table(route).cells) {
    if (Math.floor(c[0] / SEPS_PER_SHELF) !== row) continue
    const col = c[0] % SEPS_PER_SHELF
    if (prevStreet !== -1 && c[1] !== prevStreet && col > 0) out.push(col)
    prevStreet = c[1]
  }
  return out
}

/** Separation and side for a street + house number, or null if it is not on the route. */
export function findAddress(street: number, houseNumber: number, route: RouteId = DEFAULT_ROUTE): { slot: number; side: number } | null {
  for (const c of table(route).cells) {
    if (c[1] !== street) continue
    if (c[2] === houseNumber) return { slot: c[0], side: 0 }
    if (c[3] === houseNumber) return { slot: c[0], side: 1 }
  }
  return null
}

export const MAX_BUNDLE = CANDIDATES.length
export const MIN_BUNDLE = 2

/**
 * The sample bundle for a bundle-count setting on a route. Always contains the hold piece. Both
 * routes list their practice pieces on the same slots and sides, so the same count gives the same
 * slots on either route; only the addresses differ.
 */
export function buildBundle(count: number, route: RouteId = DEFAULT_ROUTE): SamplePiece[] {
  const t = table(route)
  const n = Math.max(MIN_BUNDLE, Math.min(t.candidates.length, Math.round(count)))
  const holdIndex = t.candidates.findIndex((c) => c.hold)
  const chosen = t.candidates.slice(0, n)
  if (!chosen.some((c) => c.hold)) chosen[n - 1] = t.candidates[holdIndex]
  return chosen.map((c) => {
    const address = `${c.number} ${t.streets[c.street].name}`
    if (c.hold) {
      if (findAddress(c.street, c.number, route)) throw new Error(`CaseLightRoute: hold piece is a real number on the route: ${address}`)
      return { address, target: HOLD_BLOCK_SLOT, side: 0, note: HOLD_NOTE_TEXT, gloss: HOLD_GLOSS_TEXT }
    }
    const found = findAddress(c.street, c.number, route)
    if (!found) throw new Error(`CaseLightRoute: sample address not on route: ${address}`)
    return { address, target: found.slot, side: found.side, note: null, gloss: null }
  })
}

/** The hold piece's address on a route (the letter accepted only in the HOLD block). */
export function holdAddressOf(route: RouteId = DEFAULT_ROUTE): string {
  const t = table(route)
  const c = t.candidates.find((x) => x.hold)
  return c ? `${c.number} ${t.streets[c.street].name}` : ""
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
 *
 * Note on the shuffle: 1103515245 * seed can exceed 2^53, so JavaScript rounds the product before
 * `>>> 0`. The order is therefore a deterministic double-precision linear congruential shuffle,
 * not the textbook exact 32-bit one (8 letters, pass 0: [4, 3, 2, 6, 1, 7, 5, 0], as played; exact
 * integers would give [2, 7, 4, 1, 0, 3, 6, 5]). Kept on purpose: every LEAF run was proven on these
 * orders, and tools/export_reference_fixtures.py reproduces them in Python doubles for the unit tests.
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
