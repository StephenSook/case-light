// Owns: the scene-free rule for which Start button is drawn as the next step (the primary action).
// Talks to: CaseLightMain (primaryAction getter), tests/next-step.test.mjs.
// Must not: touch any scene object, or decide anything but the next step.

/** The Start button drawn as the next step. */
export type PrimaryAction = "practice" | "recall" | "none"

/**
 * During a pass: "none" (neither Start button is the next step). Between passes: "practice" until a
 * practice pass has finished on today's route, then "recall". CaseLightMain clears the practiced
 * flag on Done and on a route switch, so practice is the next step again.
 */
export function primaryActionFor(mode: string, practicedOnRoute: boolean): PrimaryAction {
  if (mode !== "idle") return "none"
  return practicedOnRoute ? "recall" : "practice"
}
