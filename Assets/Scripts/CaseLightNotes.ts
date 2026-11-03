// Owns: the veteran's sorting reminders as data: the three fixed reminder texts, one note per slot and per route (pick again replaces, Remove note clears), the chooser's option list, and the rule for which notes show.
// Talks to: nothing (pure TypeScript: no imports, no scene objects, no Lens globals), so plain node can run it; CaseLightVeteran drives it.
// Must not: accept free text, name a house number, or say anything about homes or residents (the texts are fixed below).

/**
 * Rules:
 *   A note is one of exactly three fixed reminders. One note per slot; a new pick replaces it;
 *   "Remove note" (offered only when the slot has one) clears it. Notes stay when Veteran mode is
 *   switched off and when Done is pressed: they belong to the veteran, not to a pass. Each route
 *   has its own notes (RouteNotes); switching back to a route restores its notes.
 *   Which notes show (notesToShow):
 *     Veteran mode on: every note (the veteran is pinning and reviewing them).
 *     Practice: the note of the lit target slot, while it is lit.
 *     Recall: the note of a slot lit as the answer after a miss, while it is lit (CaseLightMain
 *       lights a recall slot only after a miss, and turns it off when the next letter is picked
 *       up or the missed letter is placed).
 *     Idle: none.
 */

export const REMINDER_TEXTS: readonly string[] = ["Check the street name", "Odd side up, even side back", "Read the whole number"]
export const REMOVE_NOTE_LABEL = "Remove note"

export type NoteViewMode = "idle" | "practice" | "recall"

export interface NoteView {
  mode: NoteViewMode
  /** Lit slot: 0..79, or a negative value for none / the HOLD block. */
  litSlot: number
  veteranMode: boolean
}

export function isReminderText(text: string): boolean {
  return REMINDER_TEXTS.indexOf(text) >= 0
}

/** One note per slot, from the fixed reminder texts only. */
export class NoteStore {
  private notes = new Map<number, string>()

  /** Pin a reminder on a slot (replacing any). Returns false (and changes nothing) for any other text. */
  set(slot: number, text: string): boolean {
    if (!Number.isInteger(slot) || slot < 0 || !isReminderText(text)) return false
    this.notes.set(slot, text)
    return true
  }

  remove(slot: number): boolean {
    return this.notes.delete(slot)
  }

  has(slot: number): boolean {
    return this.notes.has(slot)
  }

  noteFor(slot: number): string | null {
    const t = this.notes.get(slot)
    return t === undefined ? null : t
  }

  /** Slots with a note, ascending. */
  slots(): number[] {
    return Array.from(this.notes.keys()).sort((a, b) => a - b)
  }

  get count(): number {
    return this.notes.size
  }

  /** Apply a chooser pick to a slot: a reminder pins (or replaces), Remove note clears. Returns whether anything changed. */
  applyPick(slot: number, label: string): boolean {
    if (label === REMOVE_NOTE_LABEL) return this.remove(slot)
    if (this.noteFor(slot) === label) return false
    return this.set(slot, label)
  }
}

/** One store per route: each route keeps its own reminders, and switching back restores them. */
export class RouteNotes {
  private stores = new Map<number, NoteStore>()

  storeFor(route: number): NoteStore {
    let st = this.stores.get(route)
    if (!st) {
      st = new NoteStore()
      this.stores.set(route, st)
    }
    return st
  }
}

/** The chooser's options for a slot, in order: the three reminders, then Remove note only if the slot has one. */
export function chooserOptions(store: NoteStore, slot: number): string[] {
  const out = REMINDER_TEXTS.slice()
  if (store.has(slot)) out.push(REMOVE_NOTE_LABEL)
  return out
}

/** Slots whose note shows right now (ascending). */
export function notesToShow(store: NoteStore, view: NoteView): number[] {
  if (view.veteranMode) return store.slots()
  if (view.mode === "idle") return []
  if (view.litSlot >= 0 && store.has(view.litSlot)) return [view.litSlot]
  return []
}
