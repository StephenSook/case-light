// Owns: the route scenarios' checks against the tester's copy of the route data files: every printed cell label, the printed street names, the letters' printed addresses and answers, the caption and credit, and a real press on the route picker.
// Talks to: CaseLightRouteFixture (expected data), CaseLightLeafSupport (real UIKit presses, printed-label baseline, letter text helpers), CaseLightMain read-only getters (routeId, routePickerShownRoute, isRoutePickerEnabled, routeSwitchCount, cellLabelTextOf, printedStreetNames, printedAddressOf, holdAddress), scene objects Label_<slot> / StreetName_n / Caption / CreditText / Piece_n.
// Must not: import CaseLightRoute's route tables or functions, call product commands or test hooks, or change product state except through real input.

import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, nextFrame} from "Leaf.lspkg/Utils/common/Utils"
import {CaseLightMain} from "../CaseLightMain"
import {CaseLightLeafInteractor, cardText, log, mustFind, recordLabelBaseline, waitUntil} from "./CaseLightLeafSupport"
import {FixtureRoute, ROUTE_FIXTURE} from "./CaseLightRouteFixture"

export const CAPTION = "Practice mail, real house numbers"
export const CREDIT = "Not a USPS route. Address data (c) OpenStreetMap contributors"

export function fixture(route: number): FixtureRoute {
  const f = ROUTE_FIXTURE[route]
  if (!f) throw new Error(`no fixture for route ${route}`)
  return f
}

/** What a cell must print: "left\nright", or one number when the street ends there. */
export function expectedLabel(left: number, right: number | null): string {
  return right === null ? `${left}` : `${left}\n${right}`
}

/** The slot and side of an address on a route, from the fixture's cells (-2 for a number no cell carries: the hold letter). */
export function fixtureAnswer(route: number, address: string): {slot: number; side: number} {
  const f = fixture(route)
  const m = address.match(/^(\d+) (.+)$/)
  if (!m) throw new Error(`address not readable: "${address}"`)
  const n = parseInt(m[1], 10)
  const street = f.streets.indexOf(m[2])
  if (street < 0) throw new Error(`street "${m[2]}" is not on route ${route}`)
  for (const c of f.cells) {
    if (c.street !== street) continue
    if (c.left === n) return {slot: c.slot, side: 0}
    if (c.right === n) return {slot: c.slot, side: 1}
  }
  return {slot: -2, side: -1}
}

/** Press a route button for real and wait for the route; re-record the printed-label baseline (the labels are rebuilt). */
export async function switchRoute(ix: CaseLightLeafInteractor, main: CaseLightMain, route: number, ctx: string): Promise<void> {
  const before = main.routeSwitchCount
  await ix.pressButton(`RouteButton_${route}`)
  await waitUntil(() => main.routeId === route && main.routePickerShownRoute === route, 1500, `${ctx}: route ${route} taken`)
  expect(main.routeSwitchCount - before, `${ctx}: one route switch`).toBe(1)
  await nextFrame()
  await nextFrame()
  recordLabelBaseline()
}

/** Every one of the 75 cell labels reads the fixture's numbers; no other separation prints a label. */
export function expectRouteLabels(main: CaseLightMain, route: number, ctx: string): void {
  const f = fixture(route)
  const want = new Map<number, string>()
  for (const c of f.cells) want.set(c.slot, expectedLabel(c.left, c.right))
  let ok = 0
  let oneNumber = 0
  const bad: string[] = []
  for (let s = 0; s < 80; s++) {
    const so = findSceneObjectByName(`Label_${s}`)
    const w = want.get(s)
    if (w === undefined) {
      if (so) bad.push(`Label_${s} printed where the data has no cell`)
      continue
    }
    if (!so || !so.isEnabledInHierarchy) {
      bad.push(`Label_${s} missing`)
      continue
    }
    const text = (so.getComponent("Component.Text") as Text).text
    if (text !== w) bad.push(`Label_${s} "${text.replace("\n", "/")}" vs data "${w.replace("\n", "/")}"`)
    else ok++
    if (main.cellLabelTextOf(s) !== text) bad.push(`cellLabelTextOf(${s}) "${main.cellLabelTextOf(s)}" vs drawn "${text}"`)
    if (text.split("\n").length === 1) oneNumber++
  }
  log(`ROUTE ${ctx}: ${ok} of ${f.cells.length} cell labels match route ${route}'s data, ${oneNumber} print one number${bad.length ? `; MISMATCH ${bad.slice(0, 4).join("; ")}` : ""}`)
  expect(f.cells.length, `${ctx}: the data has 75 cells`).toBe(75)
  expect(bad.length === 0 && ok === 75, `${ctx}: every cell label matches route ${route}'s data${bad.length ? ` (${bad.slice(0, 3).join("; ")})` : ""}`).toBe(true)
}

/** The printed street names are the fixture's streets (every street printed, nothing else), and the getter lists them in case order. */
export function expectStreetNames(main: CaseLightMain, route: number, ctx: string): void {
  const f = fixture(route)
  const drawn = new Set<string>()
  for (let i = 0; i < 16; i++) {
    const so = findSceneObjectByName(`StreetName_${i}`)
    if (so && so.isEnabledInHierarchy) drawn.add((so.getComponent("Component.Text") as Text).text)
  }
  const drawnList = Array.from(drawn).sort()
  log(`ROUTE ${ctx}: printed street names ${JSON.stringify(drawnList)}; getter ${JSON.stringify(main.printedStreetNames)}`)
  expect(JSON.stringify(drawnList), `${ctx}: printed street names = route ${route}'s streets`).toBe(JSON.stringify(f.streets.slice().sort()))
  // A street that runs onto the next row prints its name again there: collapse repeats in a row.
  const inOrder = main.printedStreetNames.filter((s, i, a) => i === 0 || a[i - 1] !== s)
  expect(JSON.stringify(inOrder), `${ctx}: street names in case order`).toBe(JSON.stringify(f.streets))
}

/** Each letter prints the fixture's address for its place in the bundle (the data file's piece list, in order). */
export function expectLetters(main: CaseLightMain, route: number, ctx: string): void {
  const f = fixture(route)
  for (let i = 0; i < main.pieceCount; i++) {
    const printed = cardText(i, "AddressText").text
    expect(printed, `${ctx}: Piece_${i} prints route ${route}'s address`).toBe(f.pieces[i].address)
    expect(main.printedAddressOf(i), `${ctx}: printedAddressOf(${i})`).toBe(printed)
  }
  const hold = f.pieces.filter((p) => p.hold)
  expect(hold.length === 1 && main.holdAddress === hold[0].address, `${ctx}: hold letter is ${hold.length === 1 ? hold[0].address : "?"} (product ${main.holdAddress})`).toBe(true)
  expect(hold[0].address.indexOf(`${f.holdNumber} `), `${ctx}: hold address carries the data's hold number ${f.holdNumber}`).toBe(0)
}

/** The caption and the OpenStreetMap credit are shown; the credit names what the data file's attribution names. */
export function expectCaption(route: number, ctx: string): void {
  const cap = mustFind("Caption")
  const cred = mustFind("CreditText")
  const capText = (cap.getComponent("Component.Text") as Text).text
  const credText = (cred.getComponent("Component.Text") as Text).text
  log(`ROUTE ${ctx}: caption "${capText}" (shown ${cap.isEnabledInHierarchy}), credit "${credText}" (shown ${cred.isEnabledInHierarchy})`)
  expect(cap.isEnabledInHierarchy && cred.isEnabledInHierarchy, `${ctx}: caption and credit shown`).toBe(true)
  expect(capText, `${ctx}: caption wording`).toBe(CAPTION)
  expect(credText, `${ctx}: credit wording`).toBe(CREDIT)
  expect(fixture(route).attribution.indexOf("OpenStreetMap contributors") >= 0, `${ctx}: control: route ${route}'s data names "OpenStreetMap contributors" too`).toBe(true)
}
