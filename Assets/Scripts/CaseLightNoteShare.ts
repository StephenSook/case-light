// Owns: the rules for sharing the veteran's reminders between people in a Connected Lenses session: when anything is shared at all, what one shared note carries (a slot id and a reminder text, nothing else), and how a received note is checked and applied to the local note store.
// Talks to: CaseLightNotes (the fixed reminder texts and the note store), so plain node can run it; CaseLightNoteSync drives it.
// Must not: carry a name, a route, a house number or any free text, or touch a session, a scene object or a Lens global.

/**
 * Rules:
 *   Nothing is shared unless the person turned "Share notes" on AND a Connected Lenses session is
 *   ready AND it is not single player (shouldShare). Without a session (start mode Off, the usual
 *   solo case) the sharing code does nothing.
 *   A shared note is { slot, note }: slot is a separation 0..79, note is one of the three fixed
 *   reminders, or "" when the note on that slot was removed. Anything else is refused.
 *   A received note is applied to the receiver's notes of the route in use (the slot id is the only
 *   place data shared): a reminder pins (or replaces), "" removes. Applying the same note again
 *   changes nothing.
 */

import { isReminderText, NoteStore } from "./CaseLightNotes"

/** Separations on the case (two playable rows of 40). */
export const SHARED_SLOT_COUNT = 80

/** The note text of a shared removal. */
export const REMOVED_NOTE = ""

export interface SharedNote {
  slot: number
  /** A reminder text, or "" (REMOVED_NOTE) for a removal. */
  note: string
}

export interface ShareState {
  /** The person turned Share notes on. */
  sharingOn: boolean
  /** The session controller reports a ready session. */
  sessionReady: boolean
  /** The session is a single-player (mocked) one. */
  singleplayer: boolean
}

/** True only when notes may be sent and received now. */
export function shouldShare(s: ShareState): boolean {
  return s.sharingOn === true && s.sessionReady === true && s.singleplayer !== true
}

function validSlot(slot: unknown): slot is number {
  return typeof slot === "number" && Number.isInteger(slot) && slot >= 0 && slot < SHARED_SLOT_COUNT
}

function validNote(note: unknown): note is string {
  return typeof note === "string" && (note === REMOVED_NOTE || isReminderText(note))
}

/** The payload for one note change (null = remove), or null when slot or text cannot be shared. */
export function encodeNote(slot: number, note: string | null): SharedNote | null {
  const text = note === null ? REMOVED_NOTE : note
  if (!validSlot(slot) || !validNote(text)) return null
  return { slot, note: text }
}

/** A received payload checked field by field; null for anything that is not exactly { slot, note }. */
export function decodeNote(data: unknown): SharedNote | null {
  if (data === null || typeof data !== "object" || Array.isArray(data)) return null
  const keys = Object.keys(data as object).sort()
  if (keys.length !== 2 || keys[0] !== "note" || keys[1] !== "slot") return null
  const d = data as { slot: unknown; note: unknown }
  if (!validSlot(d.slot) || !validNote(d.note)) return null
  return { slot: d.slot, note: d.note }
}

/** Apply a received note to a store. Returns whether the store changed. */
export function applySharedNote(store: NoteStore, n: SharedNote): boolean {
  if (n.note === REMOVED_NOTE) return store.remove(n.slot)
  if (store.noteFor(n.slot) === n.note) return false
  return store.set(n.slot, n.note)
}

/** Every note in a store as shared notes, ascending by slot (what is sent when sharing starts or someone joins). */
export function allSharedNotes(store: NoteStore): SharedNote[] {
  const out: SharedNote[] = []
  for (const slot of store.slots()) {
    const n = encodeNote(slot, store.noteFor(slot))
    if (n) out.push(n)
  }
  return out
}
