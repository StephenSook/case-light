// Owns: the opening pinch hint's drawing: the 3D Hints package's right hand playing PinchNear at the bundle's top letter, and hiding it for good.
// Talks to: CaseLightMain (play(letter), hide(); read-outs), the 3D Hints package's InteractionHintController (playHintAnimation), SIK's WorldCameraFinderProvider (the eye, for the roll axis), its own SceneObject PinchHintAnchor (a child of BundleTray, so the hint moves with the case).
// Must not: decide when the hint shows or ends (CaseLightMain asks CaseLightPinchHintRule), touch any letter, or create text.

/**
 * The package controller (PinchHint, a child of this anchor) resets its own local position to zero
 * every time it plays, so this anchor carries the placement: play() scales the anchor to handScale,
 * turns it (swingDeg about the vertical, then rollDeg about the eye's line to the pinch spot, both
 * from the tray's orientation) and moves it so that the hand's pinch lands on the top letter at
 * pinchSpotCm (in the letter's own frame). The defaults were chosen from the hand's full drawn
 * extent (every skinned vertex, wrist and forearm included) over a whole loop: the right hand
 * reaches in from the right, its forearm foreshortened, and at every frame it stays at least 0.3 deg
 * clear of the version tag, the caption and its credit line, the start hint and every button
 * (about 0.9 deg measured; extra-pinch-hint asserts it). hide() switches the controller's
 * SceneObject off, which stops the animation and hides both hands; nothing here switches it back on.
 */

import { HandAnimationsLibrary, HandMode, InteractionHintController } from "3D Hints.lspkg/Scripts/InteractionHintController"
import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"

/**
 * Where the package's right-hand PinchNear clip closes the pinch, in the controller's own frame (cm):
 * the midpoint of the index and thumb tips at the pinch, measured in the 5.23.2 preview (tips 0.8 cm
 * apart there). A property of the package's animation, not a design choice.
 */
const PINCH_IN_HINT_FRAME_CM = new vec3(-0.1, 9.79, -25.16)
/** Loops passed to the package: it plays until the rule ends it (about 1.5 s a loop, so this never runs out in a session). */
const LOOPS_UNTIL_ENDED = 100000

@component
export class CaseLightPinchHintUI extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">CaseLightPinchHintUI - opening pinch hint at the top letter</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("The 3D Hints package's controller (the PinchHint object under this anchor; its Auto Play stays off)")
  hint: InteractionHintController
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input("vec3", "{4,-2,0.8}")
  @hint("Where the hand pinches the top letter, in the letter's own frame (cm): right of the address, just off the letter's face so the fingertips show")
  pinchSpotCm: vec3

  @input
  @widget(new SliderWidget(0.2, 1, 0.01))
  @hint("Size of the hint hand (1 = life size at the letter). 0.35 keeps the whole hand, forearm included, clear of the caption, version tag, start hint and buttons; re-run extra-pinch-hint after any change")
  handScale: number = 0.35

  @input
  @widget(new SliderWidget(-180, 180, 1))
  @hint("Turn of the hand about the eye's line to the pinch spot, in degrees (negative turns it counterclockwise as seen, so the arm comes in from the right)")
  rollDeg: number = -45

  @input
  @widget(new SliderWidget(-90, 90, 1))
  @hint("Turn of the hand about the vertical through the pinch spot, in degrees (positive swings the forearm to the right, so it shows foreshortened)")
  swingDeg: number = 30

  @input
  @widget(new SliderWidget(0.5, 2, 0.05))
  @hint("Speed of the pinch animation (1 = the package's own speed)")
  speed: number = 1
  @ui.group_end

  private _playing = false
  private _target: vec3 | null = null

  /** True from play() until hide(). */
  get isPlaying(): boolean {
    return this._playing
  }

  /** True while the hand is drawn (the controller's SceneObject is on in the hierarchy). */
  get isDrawn(): boolean {
    return !!this.hint && this.hint.getSceneObject().isEnabledInHierarchy
  }

  /** The world point the pinch was aimed at when it started (null before play()). */
  get targetWorld(): vec3 | null {
    return this._target
  }

  /** Play PinchNear on the right hand so its pinch lands on `letter` at pinchSpotCm. */
  play(letter: SceneObject): boolean {
    if (!this.hint || !letter || this._playing) return false
    const target = letter.getTransform().getWorldTransform().multiplyPoint(this.pinchSpotCm)
    const eye = WorldCameraFinderProvider.getInstance().getWorldPosition()
    const parent = this.sceneObject.getParent()
    const base = parent ? parent.getTransform().getWorldRotation() : quat.quatIdentity()
    const swing = quat.angleAxis((this.swingDeg * Math.PI) / 180, vec3.up())
    const roll = quat.angleAxis((this.rollDeg * Math.PI) / 180, target.sub(eye).normalize())
    const rotation = roll.multiply(swing).multiply(base)
    const t = this.sceneObject.getTransform()
    t.setWorldRotation(rotation)
    t.setWorldScale(vec3.one().uniformScale(this.handScale))
    t.setWorldPosition(target.sub(rotation.multiplyVec3(PINCH_IN_HINT_FRAME_CM.uniformScale(this.handScale))))
    this.hint.getSceneObject().enabled = true
    this.hint.playHintAnimation(HandMode.Right, HandAnimationsLibrary.Right.PinchNear, LOOPS_UNTIL_ENDED, this.speed)
    this._target = target
    this._playing = true
    return true
  }

  /** Stop and hide the hand for the rest of the session. */
  hide(): void {
    this._playing = false
    if (this.hint) this.hint.getSceneObject().enabled = false
  }
}
