// Owns: the thin adapter around the Lens's persistent store (global.persistentStorageSystem.store) for CaseLight's own keys: read a string ("" when missing), write a string, remove one key, and the store-full callback.
// Talks to: CaseLightMain (makes it and passes the keys from CaseLightProgress); the Lens persistent storage system.
// Must not: clear the store (never store.clear()), touch any key it is not given, or parse anything.

/**
 * Every call is guarded: if the store is not there (or a call throws), reads give "" and writes do
 * nothing, so the drill never stops over storage. Only remove(key) deletes, one of our keys at a time.
 */
export class ProgressStore {
  private readonly store: GeneralDataStore | null

  /** onFull runs when the Lens reports the store full (set once, here). */
  constructor(onFull: () => void) {
    let s: GeneralDataStore | null = null
    try {
      s = global.persistentStorageSystem ? global.persistentStorageSystem.store : null
      if (s) s.onStoreFull = onFull
    } catch (e) {
      s = null
    }
    this.store = s
  }

  get available(): boolean {
    return !!this.store
  }

  read(key: string): string {
    if (!this.store) return ""
    try {
      return this.store.has(key) ? this.store.getString(key) : ""
    } catch (e) {
      return ""
    }
  }

  has(key: string): boolean {
    if (!this.store) return false
    try {
      return this.store.has(key)
    } catch (e) {
      return false
    }
  }

  /** Returns false when the write could not be made. */
  write(key: string, value: string): boolean {
    if (!this.store) return false
    try {
      this.store.putString(key, value)
      return true
    } catch (e) {
      return false
    }
  }

  /** Remove one of our keys (nothing else). Returns true when it was there. */
  remove(key: string): boolean {
    if (!this.store) return false
    try {
      if (!this.store.has(key)) return false
      this.store.remove(key)
      return true
    } catch (e) {
      return false
    }
  }
}
