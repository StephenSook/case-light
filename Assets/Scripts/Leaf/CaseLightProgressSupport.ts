// Owns: the progress scenarios' own reading of the Lens's persistent store: our keys present, and each value parsed with the test's own JSON reading (not the product module).
// Talks to: the Lens persistent storage system (read only here), CaseLightLeafSupport (log, mustFind).
// Must not: import CaseLightProgress or CaseLightProgressStore, write to the store, or clear it.

import {log, mustFind} from "./CaseLightLeafSupport"

export const ROUTE1_KEY = "caselight.v1.route.1"
export const ROUTE2_KEY = "caselight.v1.route.2"
export const LAST_KEY = "caselight.v1.last"
const PREFIX = "caselight.v1."

function store(): GeneralDataStore {
  return global.persistentStorageSystem.store
}

/** Every key of ours in the store, sorted. */
export function ourStoreKeys(): string[] {
  return store().getAllKeys().filter((k) => k.indexOf(PREFIX) === 0).sort()
}

export function storeHas(key: string): boolean {
  return store().has(key)
}

/** A key's raw string ("" when missing). */
export function storeRaw(key: string): string {
  return store().has(key) ? store().getString(key) : ""
}

/** A key's value parsed by the test: null when missing, the string "bad" when it does not parse. */
export function storeJson(key: string): any {
  if (!store().has(key)) return null
  try {
    return JSON.parse(store().getString(key))
  } catch (e) {
    return "bad"
  }
}

export function logStore(ctx: string): void {
  log(`PROGRESS ${ctx}: keys ${JSON.stringify(ourStoreKeys())}; ${ROUTE1_KEY} ${storeRaw(ROUTE1_KEY) || "(none)"}; ${ROUTE2_KEY} ${storeRaw(ROUTE2_KEY) || "(none)"}; ${LAST_KEY} ${storeRaw(LAST_KEY) || "(none)"}`)
}

/** True while a named object is on screen (enabled in the hierarchy). */
export function shown(name: string): boolean {
  try {
    return mustFind(name).isEnabledInHierarchy
  } catch (e) {
    return false
  }
}

/** A drawn text's string ("" when missing or hidden). */
export function shownText(name: string): string {
  if (!shown(name)) return ""
  const t = mustFind(name).getComponent("Component.Text") as Text
  return t ? t.text : ""
}
