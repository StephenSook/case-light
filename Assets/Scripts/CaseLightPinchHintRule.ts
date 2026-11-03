// Owns: the opening pinch hint's rule: whether it shows at Lens start, and how it ends (only the grab of a letter ends it; once ended it never comes back).
// Talks to: nothing (pure TypeScript: no imports, no scene objects, no Lens globals), so plain node can run it; CaseLightMain asks it at Lens start and at every grab, release and Start press.
// Must not: touch the scene, the store or the clock, or know where the hint is drawn (CaseLightPinchHintUI draws it).

/**
 * Shown only on a run with no saved progress at Lens start (so the welcome panel is not shown), and
 * never in a demo replay (the replay plays itself; nobody is there to be shown a pinch). It shows
 * the grab of a letter, and no letter can be grabbed before a Start press (the bundle is inactive
 * while idle), so a Start press does NOT end it: it stays up through the opening Start press until
 * the grab of a letter, which ends it with "grab". The end is kept for the session: a release, a
 * later grab, a later Start press or Again changes nothing, so the hint never comes back. Not shown
 * at all: it stays "none".
 */

export type PinchHintEnd = "none" | "grab"
export type PinchHintEvent = "grab" | "release" | "start"

export interface PinchHintState {
  playing: boolean
  /** How it ended ("none" while it plays, or when it was never shown). */
  ended: PinchHintEnd
}

/** The hint's state at Lens start: playing only with no saved progress and no demo replay. */
export function openingPinchHint(hasSavedProgress: boolean, demoReplay: boolean): PinchHintState {
  return { playing: !hasSavedProgress && !demoReplay, ended: "none" }
}

/** The state after a grab, release or Start press: only a grab ends it, and nothing restarts it. */
export function nextPinchHint(state: PinchHintState, event: PinchHintEvent): PinchHintState {
  if (!state.playing) return { playing: false, ended: state.ended }
  if (event === "grab") return { playing: false, ended: "grab" }
  return { playing: true, ended: "none" }
}
