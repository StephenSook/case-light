// Owns: the test's OWN model of v0.6 feature 2 (come back sooner, helped for the pass, retirement across recall passes, the session tally) and a real-input recall pass player that checks the product's queue against that model before every drop.
// Talks to: CaseLightLeafSupport (real SIK drops, independent answers), CaseLightRoute.recallOrder (the pass order the brief defines), CaseLightMain read-only getters (bundleOrder, currentPassOrder, topPieceIndex, lastDropResult, lastDropSlot, mode).
// Must not: import CaseLightPassLogic (the model here is written independently), call product commands or test hooks, or change product state except through real input.

/**
 * The rule, as written by the coordinator and modelled here from scratch:
 *   A recall miss marks that letter helped for the rest of the pass and puts it back in the bundle
 *   with exactly GAP (2) other letters before it, or at the end if fewer remain.
 *   After a COMPLETED recall pass, a letter placed from memory in 2 passes in a row is retired and
 *   left out of later recall passes; a helped pass resets its run. Done clears retirement.
 *   The score counts only letters placed from memory (unaided); total counts every placement.
 */
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {CaseLightMain} from "../CaseLightMain"
import {recallOrder} from "../CaseLightRoute"
import {CaseLightLeafInteractor, dropSlotFor, neighbourSlot, targetOf, waitForTopGrabbable} from "./CaseLightLeafSupport"

export const GAP = 2
export const RETIRE_RUN = 2

/** Our model of where a missed top letter goes: exactly GAP others before it, or the end. */
export function modelComeBack(queue: number[]): number[] {
  if (queue.length === 0) return []
  const missed = queue[0]
  const rest = queue.slice(1)
  const at = Math.min(GAP, rest.length)
  return rest.slice(0, at).concat([missed], rest.slice(at))
}

/** A wrong cell for a letter (cell 23 for the hold piece, the neighbour separation otherwise). */
export function wrongCellFor(main: CaseLightMain, piece: number): number {
  const t = targetOf(main, piece)
  return t === -2 ? 23 : neighbourSlot(t)
}

/** Our model of retirement across recall passes, and the session tally. */
export class OwnModel {
  readonly n: number
  passesStarted = 0
  streak: number[]
  retired: boolean[]
  fromMemory = 0
  helped = 0
  total = 0

  constructor(n: number) {
    this.n = n
    this.streak = new Array(n).fill(0)
    this.retired = new Array(n).fill(false)
  }

  get retiredCount(): number {
    return this.retired.filter((r) => r).length
  }

  /** Start order of the pass being played (set by startPass). */
  currentStart: number[] = []

  /** The order the next recall pass must start with: the brief's order for this pass number, without retired letters. */
  nextStartOrder(): number[] {
    return recallOrder(this.n, this.passesStarted).filter((p) => !this.retired[p])
  }

  /** Call right after a press that started a recall pass: counts the pass and returns its expected start order. */
  startPass(): number[] {
    this.currentStart = this.nextStartOrder()
    this.passesStarted++
    return this.currentStart.slice()
  }

  /** A completed pass: runs and retirement for every letter it presented. Returns the newly retired. */
  completePass(presented: number[], helpedSet: Set<number>): number[] {
    const newly: number[] = []
    for (const p of presented) {
      if (this.retired[p]) continue
      this.streak[p] = helpedSet.has(p) ? 0 : this.streak[p] + 1
      if (this.streak[p] >= RETIRE_RUN) {
        this.retired[p] = true
        newly.push(p)
      }
    }
    return newly
  }

  done(): void {
    this.streak = this.streak.map(() => 0)
    this.retired = this.retired.map(() => false)
  }
}

export interface DropInfo {
  piece: number
  /** How many times this letter was on top before in this pass (0 = its opening presentation). */
  k: number
  queueBefore: number[]
  slot: number
  result: string
  queueAfter: number[]
}

export interface PassTally {
  startOrder: number[]
  fromMemory: number
  helped: number
  comeBacks: number
  helpedSet: Set<number>
  drops: DropInfo[]
  /** Letters our model retires after this completed pass. */
  newlyRetired: number[]
}

/**
 * Play the recall pass that has just started, with real drops, to its end. `missAt(piece, k,
 * queueBefore)` says whether the k-th presentation of `piece` is dropped in a wrong cell. Before
 * every drop the product's top letter and live queue must equal our model; after a miss the model
 * applies modelComeBack. missAt may return a cell number: that exact wrong cell is used. `onDrop`
 * runs after each drop and `beforeDrop` just before it (for extra checks).
 */
export async function playRecallPass(
  ix: CaseLightLeafInteractor,
  main: CaseLightMain,
  model: OwnModel,
  ctx: string,
  missAt: (piece: number, k: number, queueBefore: number[]) => boolean | number = () => false,
  onDrop?: (d: DropInfo) => void | Promise<void>,
  beforeDrop?: (piece: number, k: number, queueBefore: number[]) => void | Promise<void>,
): Promise<PassTally> {
  expect(main.mode, `${ctx}: a recall pass is running`).toBe("recall")
  const startOrder = model.currentStart.slice()
  expect(JSON.stringify(main.bundleOrder), `${ctx}: pass order = the brief's recallOrder for pass ${model.passesStarted - 1} without retired letters`).toBe(JSON.stringify(startOrder))
  let queue = startOrder.slice()
  const seen = new Map<number, number>()
  const helpedSet = new Set<number>()
  const drops: DropInfo[] = []
  let fromMemory = 0
  let helped = 0
  let comeBacks = 0
  let guard = 0
  while (queue.length > 0) {
    if (guard++ > 60) throw new Error(`${ctx}: pass did not end after 60 drops`)
    const p = await waitForTopGrabbable(main)
    expect(p, `${ctx}: top letter = our model's top`).toBe(queue[0])
    expect(JSON.stringify(main.currentPassOrder), `${ctx}: live queue = our model (before dropping ${p})`).toBe(JSON.stringify(queue))
    const k = seen.get(p) ?? 0
    seen.set(p, k + 1)
    const before = queue.slice()
    const plan = missAt(p, k, before)
    const miss = plan !== false
    const slot = typeof plan === "number" ? plan : miss ? wrongCellFor(main, p) : dropSlotFor(main, p)
    if (beforeDrop) await beforeDrop(p, k, before)
    await ix.dropTopPieceAtSlot(main, slot)
    expect(main.lastDropSlot, `${ctx}: letter ${p} dropped in cell ${slot}`).toBe(slot)
    const result = main.lastDropResult
    if (miss) {
      expect(result === "miss" || result === "refused-hold", `${ctx}: letter ${p} wrong drop is a miss (${result})`).toBe(true)
      helpedSet.add(p)
      queue = modelComeBack(queue)
      comeBacks++
    } else {
      expect(result, `${ctx}: letter ${p} placed`).toBe("correct")
      queue.shift()
      if (helpedSet.has(p)) helped++
      else fromMemory++
    }
    const d = {piece: p, k, queueBefore: before, slot, result, queueAfter: queue.slice()}
    drops.push(d)
    if (onDrop) await onDrop(d)
  }
  expect(main.mode, `${ctx}: pass over`).toBe("idle")
  model.fromMemory += fromMemory
  model.helped += helped
  model.total += fromMemory + helped
  const newlyRetired = model.completePass(startOrder, helpedSet)
  return {startOrder, fromMemory, helped, comeBacks, helpedSet, drops, newlyRetired}
}
