// Owns: the one way CaseLight draws a subtle backing behind text (a UIKit RoundedRectangle: light, low-opacity tint, never black).
// Talks to: CaseLightCaseLabelsUI and CaseLightControlsUI, which call addBacking() and own visibility.
// Must not: hold state, create text, or decide when a backing shows.

/**
 * On Specs the display is additive: black is transparent, so a dark card behind text does
 * nothing on the glasses (and reads as a black box in recordings). A light tint at low opacity
 * adds a faint, even glow behind the words instead. Depth write is off so a backing never hides
 * anything behind it; it is created before its text so it draws underneath.
 *
 * Created with UIKit's RoundedRectangle visual (no collider, no Interactable), so a backing can
 * never catch a pinch meant for a letter or a button.
 */

import { RoundedRectangle, RoundedRectBlendMode } from "SpectaclesUIKit.lspkg/Scripts/Visuals/RoundedRectangle/RoundedRectangle"

/** Default tint: pale blue-white at 16% (a value is passed in by the callers' Inspector setting). */
export const DEFAULT_BACKING_COLOR = new vec4(0.85, 0.9, 1, 0.16)

export function addBacking(parent: SceneObject, name: string, widthCm: number, heightCm: number, color: vec4, localPos: vec3, cornerRadiusCm: number = 0.5): RoundedRectangle {
  const so = global.scene.createSceneObject(name)
  so.setParent(parent)
  so.getTransform().setLocalPosition(localPos)
  const rr = so.createComponent(RoundedRectangle.getTypeName()) as RoundedRectangle
  rr.gradient = false
  rr.blendMode = RoundedRectBlendMode.Normal
  rr.cornerRadius = cornerRadiusCm
  rr.backgroundColor = color
  rr.size = new vec2(widthCm, heightCm)
  // Initialize now (not on OnStart) so the backing can be hidden straight away and shown later.
  rr.initialize()
  rr.backgroundColor = color
  rr.renderMeshVisual.mainPass.depthWrite = false
  return rr
}

/** Resize a backing (cm). */
export function setBackingSize(rr: RoundedRectangle, widthCm: number, heightCm: number): void {
  rr.size = new vec2(widthCm, heightCm)
}
