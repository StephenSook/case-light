// Owns: the one type size and look every Case Light button label uses (Start row, Options panel, Route, placement, Veteran mode, Share notes and its reminders, Again / Done / Case check, Reset progress), and the primary / secondary look of a label.
// Talks to: the UI scripts that build buttons (CaseLightControlsUI, CaseLightRouteUI, CaseLightExitUI, CaseLightPlacementUI, CaseLightVeteranUI), which call buttonLabel() and setLabelPrimary().
// Must not: size or place a button, decide which action is primary (CaseLightMain decides), or touch any text that is not a button label.

/**
 * One capital height for every button label, in cm, so no button reads louder than another by its
 * type. Labels wrap at spaces and never shrink to fit, so every label renders at this size; the
 * longest single word must fit its button's width (the LEAF check extra-control-labels measures it).
 * At the controls' 57 cm this is about 0.36 deg of capital height, above Snap's Specs "Button" type
 * size (39 at 110 cm, about 0.32 deg of capital height).
 */
export const BUTTON_CAP_CM = 0.36

// Text.size is the em-square height: em cm = size / 43.886; capitals are about 0.7 em.
const EM_PER_CM = 43.886
const CAP_PER_EM = 0.7
const LINE_SPACING = 0.9
const BUTTON_LABEL_Z = 0.08

/** The Text.size every button label uses. */
export const BUTTON_TEXT_SIZE = (BUTTON_CAP_CM / CAP_PER_EM) * EM_PER_CM

/** The primary action's label: Case Light's label-yellow (the start hint's colour), bold. */
export const PRIMARY_LABEL_COLOR = new vec4(1, 0.92, 0.6, 1)
export const PRIMARY_LABEL_WEIGHT = 700
/** Every other label: white, regular. */
export const SECONDARY_LABEL_COLOR = new vec4(1, 1, 1, 1)
export const SECONDARY_LABEL_WEIGHT = 500

/**
 * A button's label: a child SceneObject named "ButtonLabel" (tests find it by that name), centred,
 * at BUTTON_TEXT_SIZE, wrapping at spaces inside widthCm x heightCm, never shrunk. Secondary look.
 */
export function buttonLabel(parent: SceneObject, text: string, widthCm: number, heightCm: number): Text {
  const so = global.scene.createSceneObject("ButtonLabel")
  so.setParent(parent)
  so.getTransform().setLocalPosition(new vec3(0, 0, BUTTON_LABEL_Z))
  const t = so.createComponent("Component.Text") as Text
  t.text = text
  t.depthTest = true
  t.size = BUTTON_TEXT_SIZE
  t.horizontalAlignment = HorizontalAlignment.Center
  t.verticalAlignment = VerticalAlignment.Center
  t.horizontalOverflow = HorizontalOverflow.Wrap
  t.verticalOverflow = VerticalOverflow.Overflow
  t.lineSpacing = LINE_SPACING
  t.layoutRect = Rect.create(-widthCm / 2, widthCm / 2, -heightCm / 2, heightCm / 2)
  setLabelPrimary(t, false)
  return t
}

/** Primary look (label-yellow, bold) or secondary (white, regular). Same size either way. */
export function setLabelPrimary(t: Text, primary: boolean): void {
  t.textFill.color = primary ? PRIMARY_LABEL_COLOR : SECONDARY_LABEL_COLOR
  ;(t as Text & { weight?: number }).weight = primary ? PRIMARY_LABEL_WEIGHT : SECONDARY_LABEL_WEIGHT
}
