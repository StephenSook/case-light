// Owns: all session state (mode, pass order, top/held piece, lit slot, helped/unaided/total) and every right/wrong decision.
// Talks to: CaseLightBundle, CaseLightHighlight, CaseLightViewCue, CaseLightCaseLabelsUI, CaseLightControlsUI, CaseLightCaseMesh, CaseLightRipple, CaseLightAudio, CaseLightPace, CaseLightExitUI, CaseLightMixUp (all wired as @inputs).
// Must not: draw anything itself or create text.
// Size: long because it is the one owner of session state and the whole LEAF read-out surface; drawing, layout and audio live in the focused modules.

/**
 * Rules (from devpost/design-brief.md):
 *   Practice: the right separation glows only while the piece is in hand; no score.
 *   Recall: nothing glows unless the user misses. After a miss the piece comes back to the hand
 *     and the right separation stays lit (edge arrow if it is not fully in the display) until
 *     placed; that piece counts as helped, not unaided.
 *   Hold piece: note "Hold: set this piece aside" only while in hand; accepted only in the HOLD
 *     block; dropped in any other cell it is refused like a miss and the HOLD block glows.
 *   End of recall: the score card ("From memory: X of Y this session" by default; helped
 *     letters never count), hidden after resultSeconds or when a Start button is pressed. With
 *     it, an exit: "Again" (a new recall pass, as if Start recall were pressed) or "Done" (idle,
 *     nothing glowing, counts kept). The exit stays until one is chosen or a Start is pressed.
 *     The one-time hint hides on the first Start press.
 *   One pinch, one press: a Start press within startGuardSeconds (0.6 s) of Again or Done is
 *     ignored, and every Start and exit button acts on a release only if the pinch started on it.
 *   Practice cue ladder (practiceLadder, off by default): each address's practice cue steps down
 *     a rung after a right practice placement (slot glow, then its whole row, then a band over
 *     both playable rows) and back up one rung after a practice miss. Off: the exact separation
 *     glows on every practice pass. Recall never uses it.
 *   Mix-up lines (mixUpLines, on by default): after a recall pass ends, one thin line per address
 *     missed in that pass, from the cell it was dropped in to its right cell. Never during a pass;
 *     cleared by Again, Done or any Start press.
 * A drop counts as "over a separation" from where the user is looking: the eye-to-piece ray is
 * intersected with the case face (see CaseGeometry.projectToFace). Released anywhere else, the
 * piece just goes back to the hand with no count.
 *
 * Optional drill pace (off by default): the Drill pace toggle switches a thin light that steps
 * one separation per letter-time along the playable cells. It is independent of the pass: it
 * changes no count, glow, arrow or sound.
 *
 * Test surface (LEAF): read-only getters below, the pure slotWorldPosition / step helpers, and
 * three logic-level hooks that run the same handlers as real input: grabTopPiece(),
 * dropHeldPieceAtSlot(slot) and dropHeldPieceAtWorld(pos). Real SIK grabs go through the same
 * onGrabbed / onReleased paths. togglePace() is the same path as pressing Drill pace.
 */

import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"
import { CaseLightBundle, LETTER_H, LETTER_W, PieceMoveArgs, PRINT_W } from "./CaseLightBundle"
import { CaseLightCaseLabelsUI } from "./CaseLightCaseLabelsUI"
import { CaseLightCaseMesh } from "./CaseLightCaseMesh"
import { CaseLightControlsUI } from "./CaseLightControlsUI"
import { CaseLightExitUI } from "./CaseLightExitUI"
import { CaseLightMixUp, MixUpPair } from "./CaseLightMixUp"
import { CaseGeometry, HOLD_BLOCK_SLOT, HOLD_CELLS, NO_SLOT, SEP_PITCH_CM } from "./CaseLightGeometry"
import { CaseLightHighlight } from "./CaseLightHighlight"
import { buildBundle, practiceOrder, recallOrder, SamplePiece } from "./CaseLightRoute"
import { CaseLightAudio } from "./CaseLightAudio"
import { CaseLightPace } from "./CaseLightPace"
import { CaseLightRipple } from "./CaseLightRipple"
import { CASELIGHT_VERSION } from "./CaseLightVersion"
import { CaseLightViewCue } from "./CaseLightViewCue"

export type CaseLightMode = "idle" | "practice" | "recall"
export type DropResult = "none" | "correct" | "miss" | "refused-hold" | "off-case"
export type CueKind = "slot" | "row" | "shelf" | "none"
/** Practice ladder rungs: 0 slot glow, 1 row glow, 2 shelf band. */
const LADDER_TOP_RUNG = 2

/** How far a placed letter sticks out of its separation toward the user (cm). */
const PLACED_STICK_OUT_CM = 3
const LETTER_LENGTH_CM = LETTER_W
const LETTER_HEIGHT_CM = LETTER_H

@component
export class CaseLightMain extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">CaseLightMain - practice / recall drill at a real-size case</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Case root: the world-fixed practice case (move this to move the case, tray and buttons)")
  caseRoot: SceneObject

  @input
  @hint("Case line art (MeshBuilder)")
  caseMesh: CaseLightCaseMesh

  @input
  @hint("Label strips, caption and session result text")
  caseLabels: CaseLightCaseLabelsUI

  @input
  @hint("Answer glow and snap outline")
  highlights: CaseLightHighlight

  @input
  @hint("Bundle tray and sample letters")
  bundle: CaseLightBundle

  @input
  @hint("Start practice / Start recall buttons")
  controls: CaseLightControlsUI

  @input
  @hint("Display rectangle and edge arrow")
  viewCue: CaseLightViewCue

  @input
  @allowUndefined
  @hint("Ring ripple where a pinch lands and where a letter snaps in (optional)")
  ripples: CaseLightRipple

  @input
  @allowUndefined
  @hint("Chime on a right drop, low tone on a miss, played from the cell they refer to (optional)")
  sounds: CaseLightAudio

  @input
  @allowUndefined
  @hint("Optional drill pace light, switched by the Drill pace toggle (off by default)")
  pace: CaseLightPace

  @input
  @allowUndefined
  @hint("Again / Done buttons shown with the score card at the end of a recall pass")
  exitControls: CaseLightExitUI

  @input
  @allowUndefined
  @hint("Mix-up lines drawn on the score view after a recall pass (needs mixUpLines on)")
  mixUps: CaseLightMixUp

  @input
  @hint("Unlit vertex-colour material used for all line art (SimpleVertexBaseColor)")
  lineMaterial: Material
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(4, 8, 1))
  @hint("Total shelves in the case (two are playable; the rest are faint outlines). A standard city case has 6.")
  shelfCount: number = 6

  @input
  @widget(new SliderWidget(2, 12, 1))
  @hint("Pieces in the sample bundle (always includes the hold piece)")
  bundleCount: number = 8

  @input
  @widget(new SliderWidget(1, 20, 0.5))
  @hint("Seconds the end-of-recall result stays on the case")
  resultSeconds: number = 5

  @input
  @hint("Practice cue ladder: each address's practice cue fades a rung after a right placement (slot, then row, then shelf band) and comes back a rung after a miss. Off = the exact separation glows on every practice pass")
  practiceLadder: boolean = false

  @input
  @hint("After a recall pass, draw a thin line from each missed address's wrong cell to its right cell, outline both cells and label them (cleared by Again, Done or any Start)")
  mixUpLines: boolean = true

  @input
  @widget(new SliderWidget(0, 2, 0.05))
  @hint("A Start button press this soon after Again or Done is ignored, so one pinch can never press an exit button and then a Start button (0 = off)")
  startGuardSeconds: number = 0.6
  @ui.group_end

  private geo: CaseGeometry | null = null
  private pieces: SamplePiece[] = []
  private ready = false

  private _mode: CaseLightMode = "idle"
  private order: number[] = []
  private cursor = 0
  private helpedThisPiece = false
  private _heldPiece = -1
  private _lastSoundName: "chime" | "miss" | "" = ""
  private _lastSoundSlot = NO_SLOT
  private _soundPlays = 0
  private _litSlot = NO_SLOT
  private _snapPreviewSlot = NO_SLOT
  private _unaided = 0
  private _helped = 0
  private _total = 0
  private _recallPasses = 0
  private _lastDropSlot = NO_SLOT
  private _lastDropResult: DropResult = "none"
  private _lastDropPiece = -1
  private resultHide: DelayedCallbackEvent | null = null
  private rungs: number[] = []
  private _cueKind: CueKind = "none"
  /** This recall pass's mix-ups: the opening wrong drop of each missed address. */
  private passMixUps = new Map<number, MixUpPair>()
  /** getTime() of the last Again / Done press, or -1. */
  private _lastExitPressAt = -1
  private _ignoredStartPresses = 0

  // ── Read-only state (for tests and other scripts) ───────────────────────────────────────

  get isReady(): boolean {
    return this.ready
  }

  get mode(): CaseLightMode {
    return this._mode
  }

  /** Piece currently in hand (bundle index), or -1. */
  get heldPieceIndex(): number {
    return this._heldPiece
  }

  /** Piece on top of the bundle (the next one to sort), or -1 between passes. */
  get topPieceIndex(): number {
    return this._mode !== "idle" && this.cursor < this.order.length ? this.order[this.cursor] : -1
  }

  /** SceneObject name of the top piece ("Piece_<index>"), or "". */
  get topPieceName(): string {
    const i = this.topPieceIndex
    return i >= 0 ? `Piece_${i}` : ""
  }

  /** Lit slot: -1 none, -2 the HOLD block, 0..79 a separation. */
  get litSlotIndex(): number {
    return this._litSlot
  }

  get isGlowVisible(): boolean {
    return this.highlights ? this.highlights.isGlowVisible : false
  }

  /** Label lit with the glow (the number label under the lit cell): 0..79, -2 the HOLD label, -1 none. */
  get litLabelSlot(): number {
    return this.caseLabels ? this.caseLabels.litLabelSlot : NO_SLOT
  }

  /** True when this separation's own number label is lit (only ever the lit cell's label). */
  isLabelLit(slot: number): boolean {
    return this.caseLabels ? this.caseLabels.isLabelLit(slot) : false
  }

  /** True while the letter in hand shows as a plain white card (no cyan on it). */
  get isHeldCardPlain(): boolean {
    const held = this.heldPieceIndex
    return held >= 0 && this.bundle.isCardLookHeld(held)
  }

  /** Separation the held piece would snap to right now (thin outline), or -1. */
  get snapPreviewSlotIndex(): number {
    return this._snapPreviewSlot
  }

  /** Recall pieces placed right with no help, this session. */
  get unaidedCount(): number {
    return this._unaided
  }

  /** Recall pieces placed after a miss (the slot was lit for them), this session. */
  get helpedCount(): number {
    return this._helped
  }

  /** Recall pieces placed this session (Y in "Unaided: X/Y"). */
  get totalCount(): number {
    return this._total
  }

  get recallPassCount(): number {
    return this._recallPasses
  }

  /** Pieces placed so far in the current pass. */
  get placedThisPass(): number {
    return this.cursor
  }

  get bundleOrder(): number[] {
    return this.order.slice()
  }

  get pieceCount(): number {
    return this.pieces.length
  }

  /** Sample letter size and its print width (cm): one source for tests (CaseLightBundle). */
  get letterWidthCm(): number {
    return LETTER_W
  }

  get letterHeightCm(): number {
    return LETTER_H
  }

  get printWidthCm(): number {
    return PRINT_W
  }

  /** Requested capital height of the held letter's address (cm); the font renders about 0.93 of it. */
  get addressCapHeightCm(): number {
    return this.bundle ? this.bundle.addressCapHeightCm : 0
  }

  get isHoldNoteVisible(): boolean {
    const held = this.heldPieceIndex
    return held >= 0 && this.bundle.isNoteVisible(held)
  }

  /** True while the held piece's large address is shown. */
  get isAddressVisible(): boolean {
    const held = this.heldPieceIndex
    return held >= 0 && this.bundle.isAddressVisible(held)
  }

  get isEdgeArrowVisible(): boolean {
    return this.viewCue ? this.viewCue.isArrowVisible : false
  }

  get isResultVisible(): boolean {
    return this.caseLabels ? this.caseLabels.isResultVisible : false
  }

  get resultText(): string {
    return this.caseLabels ? this.caseLabels.resultString : ""
  }

  get lastDropSlot(): number {
    return this._lastDropSlot
  }

  get lastDropResult(): DropResult {
    return this._lastDropResult
  }

  /** True while the one-time "Pinch Start practice" hint shows (until the first Start press). */
  get isHintVisible(): boolean {
    return this.controls ? this.controls.isHintVisible : false
  }

  /** True while the second hint line ("Practice, then the case goes dark.") shows; same rule as the hint. */
  get isHintLine2Visible(): boolean {
    return this.controls ? this.controls.isHintLine2Visible : false
  }

  /** True while the hold gloss ("HOLD: mail kept at the office") shows under the hold note. */
  get isHoldGlossVisible(): boolean {
    const held = this.heldPieceIndex
    return held >= 0 && this.bundle.isGlossVisible(held)
  }

  /** Last cue played: "chime" (right drop), "miss" (miss or refused hold drop), or "" before any. */
  get lastSoundName(): "chime" | "miss" | "" {
    return this._lastSoundName
  }

  /** Where the last cue played from: a separation 0..79, -2 for the HOLD block, -1 before any. */
  get lastSoundSlot(): number {
    return this._lastSoundSlot
  }

  /** Cues played since the Lens began (counts only cues actually issued to the audio sources). */
  get soundPlayCount(): number {
    return this._soundPlays
  }

  /** True while the drill pace light runs (Drill pace toggle on). */
  get isPaceOn(): boolean {
    return this.pace ? this.pace.isOn : false
  }

  /** Drill pace rate in letters (separations) per minute; 0 if the pace is not wired. */
  get paceLettersPerMinute(): number {
    return this.pace ? this.pace.rate : 0
  }

  /** Separation the pace light is on (0..79, delivery order), or -1 while off. */
  get paceSweepIndex(): number {
    return this.pace ? this.pace.sweepIndex : NO_SLOT
  }

  /** Seconds since the pace was switched on (0 while off). The light's clock. */
  get paceElapsedSeconds(): number {
    return this.pace ? this.pace.elapsedSeconds : 0
  }

  /** Separations the pace light has advanced since it was switched on, not wrapped at 80. */
  get paceStepCount(): number {
    return this.pace ? this.pace.stepCount : 0
  }

  /** Seconds per separation at the current rate (60 / paceLettersPerMinute). */
  get paceSecondsPerSeparation(): number {
    return this.pace ? this.pace.secondsPerSeparation : 0
  }

  /** True while the pace light is drawn. */
  get isPaceLightVisible(): boolean {
    return this.pace ? this.pace.isLightVisible : false
  }

  /** True while the "drill pace N/min" caption is on screen. */
  get isPaceLabelVisible(): boolean {
    return this.controls ? this.controls.isPaceLabelVisible : false
  }

  /** The pace caption text, e.g. "drill pace 18/min". */
  get paceLabelText(): string {
    return this.controls ? this.controls.paceLabelText : ""
  }

  /** The Lens version shown in the start view (one constant: CaseLightVersion.CASELIGHT_VERSION). */
  get versionText(): string {
    const shown = this.caseLabels ? this.caseLabels.versionString : ""
    return shown.length > 0 ? shown : CASELIGHT_VERSION
  }

  /** True while the Again / Done exit is on screen (after a recall pass, until a choice or a Start press). */
  get isExitVisible(): boolean {
    return this.exitControls ? this.exitControls.isVisible : false
  }

  /** True when the practice cue ladder is switched on (Inspector: practiceLadder). */
  get isPracticeLadderOn(): boolean {
    return this.practiceLadder
  }

  /** Practice cue rung for a piece: 0 slot glow, 1 row glow, 2 shelf band. -1 for an unknown piece. */
  ladderRungOf(pieceIndex: number): number {
    return pieceIndex >= 0 && pieceIndex < this.rungs.length ? this.rungs[pieceIndex] : -1
  }

  /** The cue on the case right now: "slot" (a separation or the HOLD block glows), "row", "shelf" or "none". */
  get cueKind(): CueKind {
    return this._cueKind
  }

  /** Mix-up lines on screen right now. */
  get mixUpLineCount(): number {
    return this.mixUps ? this.mixUps.lineCount : 0
  }

  /** Mix-up lines on screen: each from the slot an address was dropped in to its right slot (-2 = HOLD block). */
  get mixUpPairs(): MixUpPair[] {
    return this.mixUps ? this.mixUps.shownPairs : []
  }

  get isMixUpVisible(): boolean {
    return this.mixUps ? this.mixUps.isVisible : false
  }

  /**
   * Each shown mix-up: its two cells (both outlined; right = -2 for the HOLD block), its two label
   * strings (the words, on one line) and the labels' world positions.
   */
  get mixUpDetails(): Array<{ dropped: number; right: number; outlineCells: number[]; droppedLabel: string; rightLabel: string; droppedLabelWorld: vec3 | null; rightLabelWorld: vec3 | null }> {
    if (!this.mixUps || !this.mixUps.isVisible) return []
    const labels = this.caseLabels.mixUpLabelReadouts
    return this.mixUps.shownPairs.map((p, i) => {
      const d = labels.find((l) => l.pair === i && l.end === "dropped")
      const r = labels.find((l) => l.pair === i && l.end === "right")
      return { dropped: p.dropped, right: p.right, outlineCells: [p.dropped, p.right], droppedLabel: d ? d.words : "", rightLabel: r ? r.words : "", droppedLabelWorld: d ? d.world : null, rightLabelWorld: r ? r.world : null }
    })
  }

  /** Mix-up end labels on screen right now (two per shown mix-up). */
  get mixUpLabelCount(): number {
    return this.caseLabels ? this.caseLabels.mixUpLabelCount : 0
  }

  /** Gaps cut into the mix-up line and outlines where a label falls (0 when none are shown). */
  get mixUpLineBreakCount(): number {
    return this.mixUps ? this.mixUps.lineBreaksForLabels : 0
  }

  /** getTime() (seconds) of the last Again or Done press, or -1 before any. */
  get lastExitPressTime(): number {
    return this._lastExitPressAt
  }

  /** Start button presses ignored because they came within startGuardSeconds of Again or Done. */
  get ignoredStartPressCount(): number {
    return this._ignoredStartPresses
  }

  /** Button releases ignored because the same pinch did not start on that button (Start and exit buttons). */
  get ignoredStrayReleaseCount(): number {
    return (this.controls ? this.controls.ignoredStrayReleaseCount : 0) + (this.exitControls ? this.exitControls.ignoredStrayReleaseCount : 0)
  }

  /** Ripples started since the Lens began (one per grab, one per snap). 0 if ripples are not wired. */
  get ripplesPlayed(): number {
    return this.ripples ? this.ripples.ripplesPlayed : 0
  }

  get lastDropPiece(): number {
    return this._lastDropPiece
  }

  /** Correct target of a piece: a separation 0..79, or -2 for the HOLD block. */
  targetSlotOf(pieceIndex: number): number {
    const p = this.pieces[pieceIndex]
    return p ? p.target : NO_SLOT
  }

  isHoldPiece(pieceIndex: number): boolean {
    return this.targetSlotOf(pieceIndex) === HOLD_BLOCK_SLOT
  }

  addressOf(pieceIndex: number): string {
    const p = this.pieces[pieceIndex]
    return p ? p.address : ""
  }

  isPiecePlaced(pieceIndex: number): boolean {
    return this.bundle ? this.bundle.isPlaced(pieceIndex) : false
  }

  /** World position of a separation's opening centre (0..79) or of the HOLD block (-2). */
  slotWorldPosition(slotOrHold: number): vec3 {
    if (!this.geo || !this.caseRoot) return vec3.zero()
    const local = this.geo.targetCenterLocal(slotOrHold)
    if (!local) return vec3.zero()
    return this.caseRoot.getTransform().getWorldTransform().multiplyPoint(local)
  }

  /**
   * Pure in-view test (delegates to the view cue): true = some part of a one-separation target
   * centred at (yawDeg, pitchDeg) is outside the display, so the arrow shows. Optional pads give
   * the target's angular half-size; they default to one separation seen from the start position
   * (see stepPadDeg). Pass 0, 0 to test a single point.
   */
  step(yawDeg: number, pitchDeg: number, padYawDeg?: number, padPitchDeg?: number): boolean {
    if (!this.viewCue) return false
    return this.viewCue.step(yawDeg, pitchDeg, padYawDeg ?? this.viewCue.defaultPadYawDeg, padPitchDeg ?? this.viewCue.defaultPadPitchDeg)
  }

  /** step()'s default pads (deg): x = yaw half-width, y = pitch half-height of one separation. */
  get stepPadDeg(): vec2 {
    return this.viewCue ? new vec2(this.viewCue.defaultPadYawDeg, this.viewCue.defaultPadPitchDeg) : vec2.zero()
  }

  /** Angular half-size (deg) of the lit target as measured this frame (0, 0 when nothing is lit). */
  get litTargetPadDeg(): vec2 {
    return this.viewCue ? new vec2(this.viewCue.lastPadYawDeg, this.viewCue.lastPadPitchDeg) : vec2.zero()
  }

  /** World corners of a separation (0..79) or the HOLD block (-2): the area the arrow waits for. */
  targetCornersWorld(slotOrHold: number): vec3[] {
    if (!this.geo || !this.caseRoot) return []
    const c = this.geo.targetCenterLocal(slotOrHold)
    if (!c) return []
    const hw = (slotOrHold === HOLD_BLOCK_SLOT ? SEP_PITCH_CM * HOLD_CELLS : SEP_PITCH_CM) / 2
    const hh = this.geo.openingHeight / 2
    const m = this.caseRoot.getTransform().getWorldTransform()
    return [
      m.multiplyPoint(new vec3(c.x - hw, c.y - hh, c.z)),
      m.multiplyPoint(new vec3(c.x + hw, c.y - hh, c.z)),
      m.multiplyPoint(new vec3(c.x + hw, c.y + hh, c.z)),
      m.multiplyPoint(new vec3(c.x - hw, c.y + hh, c.z))
    ]
  }

  /** Separation under a world point as seen from the eye, or -1 (same math as a real drop). */
  slotUnderWorldPoint(worldPoint: vec3): number {
    return this.slotSeenAt(worldPoint)
  }

  // ── Commands ───────────────────────────────────────────────────────────────────────────

  startPractice(): void {
    if (!this.ready) return
    this.beginPass("practice", practiceOrder(this.pieces.length))
  }

  startRecall(): void {
    if (!this.ready) return
    this.beginPass("recall", recallOrder(this.pieces.length, this._recallPasses))
    this._recallPasses++
  }

  /** Drill pace on/off: same path as pressing the Drill pace toggle. Changes nothing else. */
  togglePace(): void {
    if (!this.controls) return
    if (!this.ready || !this.pace) {
      // Nothing to run: put the toggle back to off so it never shows a state that is not true.
      this.controls.setPaceState(false, this.pace ? this.pace.rate : 18)
      return
    }
    this.pace.setOn(!this.pace.isOn)
    this.controls.setPaceState(this.pace.isOn, this.pace.rate, this.pace.lightColor)
  }

  /** Exit "Again": the same as pressing Start recall (a clean new recall pass, new order). */
  exitAgain(): void {
    if (!this.ready) return
    this._lastExitPressAt = getTime()
    if (this.exitControls) this.exitControls.hide()
    this.startRecall()
  }

  /**
   * Exit "Done": back to idle with nothing glowing (answer glow, label highlight, snap outline,
   * edge arrow, pace light, ripples all off). The hint stays hidden and every count is kept.
   */
  exitDone(): void {
    if (!this.ready) return
    this._lastExitPressAt = getTime()
    if (this.exitControls) this.exitControls.hide()
    if (this.resultHide) this.resultHide.enabled = false
    this.caseLabels.hideResult()
    this._mode = "idle"
    this._heldPiece = -1
    this.bundle.setActivePiece(-1)
    this.setLit(NO_SLOT)
    this.setSnapPreview(NO_SLOT)
    this.clearMixUps()
    if (this.pace && this.pace.isOn) {
      this.pace.setOn(false)
      this.controls.setPaceState(false, this.pace.rate, this.pace.lightColor)
    }
    if (this.ripples) this.ripples.stopAll()
  }

  /** Test hook: same path as a real pinch on the top piece. Returns false if nothing to grab. */
  grabTopPiece(): boolean {
    const top = this.topPieceIndex
    if (top < 0 || this.bundle.activePieceIndex !== top) return false
    this.onGrabbed(top)
    return true
  }

  /** Test hook: let go of the held (or top) piece over a separation, same path as a real drop. */
  dropHeldPieceAtSlot(slot: number): void {
    const world = this.slotWorldPosition(slot)
    const cam = WorldCameraFinderProvider.getInstance().getWorldPosition()
    // A point a little in front of the face on the eye ray, so the projection lands on the slot.
    const toward = world.sub(cam)
    const point = cam.add(toward.uniformScale(0.92))
    this.dropHeldPieceAtWorld(point)
  }

  /** Test hook: let go of the held (or top) piece at a world position. */
  dropHeldPieceAtWorld(worldPos: vec3): void {
    let piece = this.heldPieceIndex >= 0 ? this.heldPieceIndex : this.topPieceIndex
    if (piece < 0) return
    this.onReleased({ piece, worldPosition: worldPos })
  }

  // ── Lifecycle ──────────────────────────────────────────────────────────────────────────

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.onStart())
  }

  private onStart(): void {
    // Exactly once per Lens start (onStart runs once).
    print(`Lens Opened: ${CASELIGHT_VERSION}`)
    const missing: string[] = []
    if (!this.caseRoot) missing.push("caseRoot")
    if (!this.caseMesh) missing.push("caseMesh")
    if (!this.caseLabels) missing.push("caseLabels")
    if (!this.highlights) missing.push("highlights")
    if (!this.bundle) missing.push("bundle")
    if (!this.controls) missing.push("controls")
    if (!this.viewCue) missing.push("viewCue")
    if (!this.lineMaterial) missing.push("lineMaterial")
    if (missing.length > 0) {
      print("CaseLightMain: required @input not wired: " + missing.join(", "))
      return
    }

    this.geo = new CaseGeometry(this.shelfCount)
    this.pieces = buildBundle(this.bundleCount)

    this.caseMesh.build(this.geo, this.lineMaterial)
    this.caseLabels.build(this.geo)
    this.highlights.build(this.geo, this.lineMaterial)
    this.bundle.build(this.pieces, this.lineMaterial)
    this.viewCue.build(this.lineMaterial)
    if (this.ripples) this.ripples.build(this.lineMaterial)
    if (this.pace) this.pace.build(this.geo, this.lineMaterial)
    if (this.mixUps) this.mixUps.build(this.geo, this.lineMaterial)
    this.rungs = this.pieces.map(() => 0)
    // step()'s default pads: one separation seen from the start position.
    const startCam = WorldCameraFinderProvider.getInstance()
    const caseDepth = -startCam.getInvertedWorldTransform().multiplyPoint(this.caseRoot.getTransform().getWorldPosition()).z
    this.viewCue.configureCellPad(SEP_PITCH_CM / 2, this.geo.openingHeight / 2, caseDepth)

    this.bundle.onGrab.add((i) => this.onGrabbed(i))
    this.bundle.onDragMove.add((a) => this.onDragMoved(a))
    this.bundle.onRelease.add((a) => this.onReleased(a))
    this.controls.onStartPractice.add(() => this.onStartButton("practice"))
    this.controls.onStartRecall.add(() => this.onStartButton("recall"))
    this.controls.onTogglePace.add(() => this.togglePace())
    this.controls.setBackingColor(this.caseLabels.backingColor)
    if (this.exitControls) {
      this.exitControls.onAgain.add(() => this.exitAgain())
      this.exitControls.onDone.add(() => this.exitDone())
    }
    if (this.pace) this.controls.setPaceState(false, this.pace.rate, this.pace.lightColor)

    this.resultHide = this.createEvent("DelayedCallbackEvent")
    this.resultHide.bind(() => this.caseLabels.hideResult())

    this.order = practiceOrder(this.pieces.length)
    this.bundle.layout(this.order)
    this.ready = true
    print(`CaseLightMain: ready. ${this.pieces.length} pieces, ${this.geo.shelfCount} shelves, case mesh ${this.caseMesh.builtVertexCount} vertices, ${this.caseLabels.labelledCellCount} labelled cells.`)
  }

  // ── Pass flow ──────────────────────────────────────────────────────────────────────────

  private beginPass(mode: CaseLightMode, order: number[]): void {
    this.caseLabels.hideResult()
    if (this.exitControls) this.exitControls.hide()
    this.controls.hideHint()
    this._mode = mode
    this.order = order
    this.cursor = 0
    this.helpedThisPiece = false
    this._heldPiece = -1
    this._lastDropResult = "none"
    this._lastDropSlot = NO_SLOT
    this._lastDropPiece = -1
    this.setLit(NO_SLOT)
    this.setSnapPreview(NO_SLOT)
    this.passMixUps.clear()
    this.clearMixUps()
    this.bundle.layout(order)
    this.bundle.setActivePiece(this.topPieceIndex)
  }

  private onGrabbed(piece: number): void {
    if (this._mode === "idle" || piece !== this.topPieceIndex) return
    this._heldPiece = piece
    this.bundle.setCardHeld(piece, true)
    if (this.ripples) this.ripples.play(this.bundle.takePinchPoint(piece))
    if (this._mode === "practice") this.showPracticeCue(piece)
    // Recall: nothing new lights on grab; a lit slot from an earlier miss stays lit.
  }

  private onDragMoved(args: PieceMoveArgs): void {
    if (this._mode === "idle" || args.piece !== this.topPieceIndex) return
    this.setSnapPreview(this.slotSeenAt(args.worldPosition))
  }

  private onReleased(args: PieceMoveArgs): void {
    const piece = args.piece
    if (this._mode === "idle" || piece !== this.topPieceIndex) return
    this._heldPiece = -1
    this.bundle.setCardHeld(piece, false)
    this.setSnapPreview(NO_SLOT)

    const slot = this.slotSeenAt(args.worldPosition)
    this._lastDropPiece = piece
    this._lastDropSlot = slot
    const target = this.targetSlotOf(piece)
    const isHold = target === HOLD_BLOCK_SLOT

    if (slot === NO_SLOT) {
      this._lastDropResult = "off-case"
      this.afterNotPlaced(piece, false)
      this.bundle.returnToHand(piece, () => this.bundle.setActivePiece(this.topPieceIndex))
      return
    }

    const correct = isHold ? this.geo!.isHoldSlot(slot) : slot === target
    if (correct) {
      this._lastDropResult = "correct"
      this.bundle.placeIn(piece, this.placedWorldPosition(slot, isHold ? -1 : this.pieces[piece].side), this.placedWorldRotation())
      if (this.ripples) this.ripples.play(this.slotWorldPosition(slot))
      // Chime from where the letter went: its separation, or the HOLD block for the hold piece.
      this.playCue("chime", isHold ? HOLD_BLOCK_SLOT : slot)
      if (this._mode === "recall") {
        if (this.helpedThisPiece) this._helped++
        else this._unaided++
        this._total++
      }
      if (this._mode === "practice" && this.practiceLadder) this.rungs[piece] = Math.min(LADDER_TOP_RUNG, this.rungs[piece] + 1)
      this.setLit(NO_SLOT)
      this.advance()
      return
    }

    // Wrong separation: snap into it (so the drop is visible), then back to the hand.
    this._lastDropResult = isHold ? "refused-hold" : "miss"
    if (this._mode === "practice" && this.practiceLadder) this.rungs[piece] = Math.max(0, this.rungs[piece] - 1)
    // Recall: keep the address's opening wrong drop for the mix-up lines on the score view.
    if (this._mode === "recall" && !this.passMixUps.has(piece)) this.passMixUps.set(piece, { dropped: slot, right: target, address: this.addressOf(piece) })
    this.afterNotPlaced(piece, true)
    this.bundle.snapThenReturn(piece, this.placedWorldPosition(slot, -1), this.placedWorldRotation(), () => this.bundle.setActivePiece(this.topPieceIndex))
    if (this.ripples) this.ripples.play(this.slotWorldPosition(slot))
    // Low tone from the answer: the right separation, or the HOLD block for a refused hold piece,
    // so the sound also points toward an answer that is out of view.
    this.playCue("miss", target)
  }

  /** Play a cue from a separation (0..79) or the HOLD block (-2) and record it for tests. */
  private playCue(kind: "chime" | "miss", slotOrHold: number): void {
    if (!this.sounds) return
    if (!this.sounds.playAt(kind, this.slotWorldPosition(slotOrHold))) return
    this._lastSoundName = kind
    this._lastSoundSlot = slotOrHold
    this._soundPlays++
  }

  /** Glow rules after a release that did not place the piece. */
  private afterNotPlaced(piece: number, wasMiss: boolean): void {
    const target = this.targetSlotOf(piece)
    if (wasMiss && this._mode === "recall") this.helpedThisPiece = true
    if (this._mode === "recall") {
      // Stays lit after a miss until placed; otherwise nothing glows.
      this.setLit(this.helpedThisPiece ? target : NO_SLOT)
    } else if (wasMiss && target === HOLD_BLOCK_SLOT) {
      // Hold piece refused: the HOLD block glows (practice too).
      this.setLit(HOLD_BLOCK_SLOT)
    } else {
      // Practice: the right separation glows only while the piece is in hand.
      this.setLit(NO_SLOT)
    }
  }

  private advance(): void {
    this.cursor++
    this.helpedThisPiece = false
    if (this.cursor < this.order.length) {
      this.bundle.setActivePiece(this.topPieceIndex)
      return
    }
    const finished = this._mode
    this._mode = "idle"
    this.bundle.setActivePiece(-1)
    this.setLit(NO_SLOT)
    if (finished === "recall") {
      this.caseLabels.showResult(this._unaided, this._total)
      if (this.resultHide) {
        this.resultHide.enabled = true
        this.resultHide.reset(this.resultSeconds)
      }
      if (this.exitControls) this.exitControls.show()
      if (this.mixUps && this.mixUpLines) {
        const eyeLocal = this.caseRoot.getTransform().getInvertedWorldTransform().multiplyPoint(WorldCameraFinderProvider.getInstance().getWorldPosition())
        const spots = this.mixUps.show(Array.from(this.passMixUps.values()), eyeLocal)
        this.caseLabels.showMixUpLabels(spots, this.mixUps.lineColor)
      }
    }
    print(`CaseLightMain: ${finished} pass complete. Unaided ${this._unaided}, helped ${this._helped}, total ${this._total}.`)
  }

  // ── Helpers ────────────────────────────────────────────────────────────────────────────

  /** A Start button press from the UI: ignored within startGuardSeconds of an Again / Done press. */
  private onStartButton(kind: "practice" | "recall"): void {
    if (this._lastExitPressAt >= 0 && getTime() - this._lastExitPressAt < this.startGuardSeconds) {
      this._ignoredStartPresses++
      return
    }
    if (kind === "practice") this.startPractice()
    else this.startRecall()
  }

  /** Mix-up lines, outlines and their labels off. */
  private clearMixUps(): void {
    if (this.mixUps) this.mixUps.clear()
    if (this.caseLabels) this.caseLabels.clearMixUpLabels()
  }

  /** Practice cue on grab: the exact separation, or (ladder on) the cue for this address's rung. */
  private showPracticeCue(piece: number): void {
    const target = this.targetSlotOf(piece)
    const rung = this.practiceLadder ? this.ladderRungOf(piece) : 0
    if (rung <= 0) {
      this.setLit(target)
      return
    }
    // A row or band cue: no exact slot, no label highlight and no edge arrow (they would give the cell away).
    this.setLit(NO_SLOT)
    const kind = rung === 1 ? "row" : "shelf"
    this.highlights.showRegion(kind, target)
    this._cueKind = kind
  }

  private setLit(slotOrHold: number): void {
    this.highlights.hideRegion()
    this._cueKind = slotOrHold === NO_SLOT ? "none" : "slot"
    this._litSlot = slotOrHold
    // The lit cell's own number label lights with it (the HOLD label for the HOLD block).
    this.caseLabels.setLitLabel(slotOrHold, this.highlights.glowColor)
    if (slotOrHold === NO_SLOT) {
      this.highlights.hideGlow()
      this.viewCue.setTarget(null)
    } else {
      this.highlights.showGlow(slotOrHold)
      // The arrow waits for the whole lit cell (or the whole HOLD block), not just its centre.
      this.viewCue.setTargetCell(this.slotWorldPosition(slotOrHold), this.targetCornersWorld(slotOrHold))
    }
  }

  private setSnapPreview(slot: number): void {
    this._snapPreviewSlot = slot
    if (slot === NO_SLOT) this.highlights.hideSnapOutline()
    else this.highlights.showSnapOutline(slot)
  }

  /** Separation under a world point, seen from the current eye position. */
  private slotSeenAt(worldPoint: vec3): number {
    if (!this.geo || !this.caseRoot) return NO_SLOT
    const inv = this.caseRoot.getTransform().getInvertedWorldTransform()
    const eye = inv.multiplyPoint(WorldCameraFinderProvider.getInstance().getWorldPosition())
    const p = inv.multiplyPoint(worldPoint)
    const hit = this.geo.projectToFace(eye, p)
    if (!hit) return NO_SLOT
    return this.geo.slotAtFacePoint(hit.x, hit.y)
  }

  /** Where a letter stands in a separation: on the shelf, edge on, sticking out a little. */
  private placedWorldPosition(slot: number, side: number): vec3 {
    const geo = this.geo!
    const local = side === 0 || side === 1 ? geo.slotSideLocal(slot, side) : geo.slotCenterLocal(slot)
    const shelf = geo.shelfOfSlot(slot)
    const y = geo.boardTopY(shelf) + LETTER_HEIGHT_CM / 2 + 0.3
    const z = PLACED_STICK_OUT_CM - LETTER_LENGTH_CM / 2
    return this.caseRoot.getTransform().getWorldTransform().multiplyPoint(new vec3(local.x, y, z))
  }

  /** Edge on: the letter's long side runs into the separation (case-local -Z). */
  private placedWorldRotation(): quat {
    const caseRot = this.caseRoot.getTransform().getWorldRotation()
    return caseRot.multiply(quat.angleAxis(Math.PI / 2, vec3.up()))
  }
}
