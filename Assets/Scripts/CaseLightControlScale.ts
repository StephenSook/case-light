// Owns: the eye the layout is designed for (the world origin, looking down -Z), the controls' design distance from it, and the rule that keeps the case's controls the same size as seen from the eye wherever the case is put: their scale is their eye distance over the design distance (clamped) while they are in front of the eye, held otherwise, and when a new scale is worth applying.
// Talks to: nothing (pure TypeScript: no imports, no scene objects, no Lens globals), so plain node can run it; CaseLightMain applies it to the CaseControls group every frame, and CaseLightPlacement takes the opening pose relative to the design eye.
// Must not: touch the scene or decide which objects are controls (CaseLightMain groups them and says why).

/**
 * The controls that ride with the case (the opening row and its Options panel, the route picker,
 * Place on wall and Veteran mode, Again / Done / Case check and the score card) sit in one group
 * whose origin is the anchor: on the case face, centred across, at the top of the caption strip,
 * below every control and above every cell and row label. Scaling the group about that point by
 * s = eye distance / design distance keeps every control's angular size and every angular gap
 * (for small angles), and moves the controls only away from the anchor, so they never come down over
 * the case's cells. The design distance is a property of the layout, not of where the head is when
 * the Lens starts: from the design eye to the anchor at the case's authored place (57.13 cm). With
 * the case at its opening pose in front of the eye, s is 1 and the opening layout is unchanged.
 * The scale follows the distance only while the group is in front of the eye (positive depth along
 * the view): behind the eye the controls have no angular size to keep, and the last scale is held
 * (in a preview whose camera starts past the case, growing them back there stalled the editor).
 */

/**
 * The eye the layout is authored for (cm, world): the world origin, looking down -Z, which is where
 * Spectacles puts the head when a Lens starts. The case's authored place and "Place in front of me"
 * are relative to it.
 */
export const DESIGN_EYE_CM: readonly number[] = [0, 0, 0]

/** The controls' design distance (cm): from the design eye to the group's anchor at its authored place. */
export function designDistanceCm(anchorAtAuthoredPlace: readonly number[], designEye: readonly number[] = DESIGN_EYE_CM): number {
  let sum = 0
  for (let i = 0; i < 3; i++) sum += (anchorAtAuthoredPlace[i] - designEye[i]) * (anchorAtAuthoredPlace[i] - designEye[i])
  return Math.sqrt(sum)
}

/** Smallest and largest scale applied (the wall placement allows 50 to 300 cm from the eye). */
export const MIN_CONTROL_SCALE = 0.5
export const MAX_CONTROL_SCALE = 6
/** A new scale is applied only when it differs from the current one by more than this (relative). */
export const RESCALE_TOLERANCE = 0.005

/** The controls' scale: eye distance over the design distance, clamped; 1 for unusable input. */
export function controlScale(eyeDistanceCm: number, designDistance: number): number {
  if (!(eyeDistanceCm > 0) || !(designDistance > 0) || !isFinite(eyeDistanceCm) || !isFinite(designDistance)) return 1
  const s = eyeDistanceCm / designDistance
  return Math.min(MAX_CONTROL_SCALE, Math.max(MIN_CONTROL_SCALE, s))
}

/** True when `next` differs from `current` by more than RESCALE_TOLERANCE (relative to current). */
export function shouldRescale(current: number, next: number): boolean {
  if (!(current > 0)) return true
  return Math.abs(next - current) / current > RESCALE_TOLERANCE
}

/**
 * The scale to apply this frame: `current` while the group is not in front of the eye
 * (depthAlongViewCm <= 0) or the change is within RESCALE_TOLERANCE, else controlScale(...).
 */
export function nextControlScale(current: number, eyeDistanceCm: number, depthAlongViewCm: number, designDistance: number): number {
  if (!(depthAlongViewCm > 0)) return current
  const s = controlScale(eyeDistanceCm, designDistance)
  return shouldRescale(current, s) ? s : current
}

/** Where a point of the group lands after scaling by s about the anchor: anchor + s * (point - anchor), per axis. */
export function scaledAbout(anchor: readonly number[], point: readonly number[], s: number): number[] {
  return point.map((p, i) => anchor[i] + s * (p - anchor[i]))
}
