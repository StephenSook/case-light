// Owns: all session state (mode, pass order, top/held piece, lit slot, helped/unaided/total) and every right/wrong decision.
// Talks to: CaseLightBundle, CaseLightHighlight, CaseLightViewCue, CaseLightCaseLabelsUI, CaseLightControlsUI, CaseLightCaseMesh, CaseLightRipple, CaseLightAudio, CaseLightPace, CaseLightExitUI, CaseLightMixUp, CaseLightPlacement, CaseLightVeteran, CaseLightRouteUI (all wired as @inputs); CaseLightRoute (route data and the route choice rule); CaseLightLog (placement log lines, printed here); CaseLightDemo (the demo replay's recorded steps and checks); CaseLightCaseCheck (the Case check rules); CaseLightSlotPinch (the shared slot-pinch target, made here).
// Must not: draw anything itself or create text.
// Size: long because it is the one owner of session state and the whole LEAF read-out surface; drawing, layout and audio live in the focused modules.

/**
 * Rules (from devpost/design-brief.md):
 *   Practice: the right separation glows only while the piece is in hand; no score.
 *   Recall: nothing glows unless the user misses. A miss lights the right separation (edge arrow
 *     if it is not fully in the display) and the letter counts as helped for the rest of the pass.
 *     It comes back sooner (CaseLightPassLogic): it goes back into the bundle with exactly two
 *     other letters before it (to the end if fewer are left). The light stays until another
 *     letter is picked up or the missed one is placed; when the letter comes back it is unlit
 *     (it is asked again from memory). A letter placed from memory in two completed recall
 *     passes in a row is retired until Done and left out of later recall passes; when every
 *     letter is retired, Start recall (or Again) shows "All letters learned / Done starts over"
 *     with the exit instead of a pass. Practice passes are unchanged.
 *   Hold piece: note "Hold: set this piece aside" only while in hand; accepted only in the HOLD
 *     block; dropped in any other cell it is refused like a miss and the HOLD block glows.
 *   End of recall: the score card ("From memory: X of Y this session" by default; helped
 *     letters never count; a second line "Came back: N", the pass's come-backs), hidden after
 *     resultSeconds or when a Start button is pressed. With
 *     it, an exit: "Again" (a new recall pass, as if Start recall were pressed) or "Done" (idle,
 *     nothing glowing, counts kept). The exit stays until one is chosen or a Start is pressed.
 *     The one-time hint hides on the opening Start press.
 *   One pinch, one press: a Start press within startGuardSeconds (0.6 s) of Again or Done is
 *     ignored, and every Start and exit button acts on a release only if the pinch started on it.
 *   Practice cue ladder (practiceLadder, off by default): each address's practice cue steps down
 *     a rung after a right practice placement (slot glow, then its whole row, then a band over
 *     both playable rows) and back up one rung after a practice miss. Off: the exact separation
 *     glows on every practice pass. Recall never uses it.
 *   Mix-up lines (mixUpLines, on by default): after a recall pass ends, one thin line per address
 *     missed in that pass, from the cell it was dropped in to its right cell. Never during a pass;
 *     cleared by Again, Done or any Start press.
 *   Case check (optional, offered after a recall pass ends): a "Case check" button above Again /
 *     Done. Pressed, 2 letters of the pass are drawn standing in wrong cells (CaseLightCaseCheck
 *     picks them from the pass number) and the trainee pinches cells with the same slot pinch as
 *     Veteran mode (CaseLightSlotPinch). A pinch on a misplaced letter's cell finds it (outlined);
 *     any other cell gets a short cue (low tone from that cell, a brief outline) and changes
 *     nothing; a found cell pinched again changes nothing. It ends when both are found, or with
 *     Again, Done or a Start press: the card's second line then reads "Case check: N of 2 found"
 *     (after Done it stays up for resultSeconds). It never changes the score, come-backs,
 *     retirement or notes; letters still in wrong cells go back to their own cells on Done.
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
import { CaseLightPlacement, PlacementKind } from "./CaseLightPlacement"
import { missLitAfterGrab, PassQueue, Retirement, SessionScore, withoutRetired } from "./CaseLightPassLogic"
import { CaseLightVeteran } from "./CaseLightVeteran"
import { CASE_CHECK_COUNT, CaseCheckRound, caseCheckCardText as caseCheckLine, chooseMisplaced, Misplaced } from "./CaseLightCaseCheck"
import { SlotPinchTarget } from "./CaseLightSlotPinch"
import { CaseGeometry, HOLD_BLOCK_SLOT, HOLD_CELLS, NO_SLOT, SEP_PITCH_CM } from "./CaseLightGeometry"
import { CaseLightHighlight } from "./CaseLightHighlight"
import { buildBundle, cellLabels, chooseRoute, DEFAULT_ROUTE, holdAddressOf, practiceOrder, recallOrder, RouteId, routeStreets, SamplePiece } from "./CaseLightRoute"
import { CaseLightRouteUI } from "./CaseLightRouteUI"
import { CaseCheckEnd, formatCaseCheckEnd, formatCaseCheckPinch, formatCaseCheckStart, formatPassEnd, formatPassStart, formatPlacement, formatRouteSwitch, LogBuffer, LogHead, LogResult, placedToken, randomToken, rightToken, sessionId } from "./CaseLightLog"
import { attemptMismatch, DEMO_LABEL_TEXT, DemoScene, dropCellOf, formatDemoLine, passEndMismatch, recordedReplay, replaySessionId, ReplayStep, sceneOf } from "./CaseLightDemo"
import { CaseLightAudio } from "./CaseLightAudio"
import { CaseLightPace } from "./CaseLightPace"
import { CaseLightRipple } from "./CaseLightRipple"
import { CASELIGHT_VERSION } from "./CaseLightVersion"
import { CaseLightViewCue } from "./CaseLightViewCue"

export type CaseLightMode = "idle" | "practice" | "recall"
/** Lens starts in this script run, for the placement log's session id. */
let lensStarts = 0
export type DropResult = "none" | "correct" | "miss" | "refused-hold" | "off-case"
export type CueKind = "slot" | "row" | "shelf" | "none"
/** Practice ladder rungs: 0 slot glow, 1 row glow, 2 shelf band. */
const LADDER_TOP_RUNG = 2
/** Demo replay: a letter is shown in hand this long before it moves, then carried this long to its release (s). */
const DEMO_HOLD_S = 0.5
const DEMO_CARRY_S = 0.6

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
  @allowUndefined
  @hint("Optional: put the case on a real wall (Place on wall / Place in front of me). Nothing moves unless the user asks")
  placement: CaseLightPlacement

  @input
  @allowUndefined
  @hint("Optional: Veteran mode, where a veteran pins sorting reminders on slots (letters pause while it is on)")
  veteran: CaseLightVeteran

  @input
  @allowUndefined
  @hint("Optional: today's route choice (Route 1 | Route 2), usable only between passes")
  routePicker: CaseLightRouteUI

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

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Demo</span>')
  @ui.group_start("Demo")
  @input
  @hint("Demo replay (off for every normal session; never save it on): at Lens start, replays one recorded real run (data/demo_replay_s1-g3nddr.log, a LEAF run with real SIK input in the preview) through the same handlers a hand reaches, under a 'Demo replay' label, and stops on any result that differs from the recording")
  demoReplay: boolean = false
  @ui.group_end

  private geo: CaseGeometry | null = null
  private pieces: SamplePiece[] = []
  private ready = false

  private _mode: CaseLightMode = "idle"
  private order: number[] = []
  /** The live pass (queue, helped set, come-backs); null before the opening pass. */
  private pass: PassQueue | null = null
  private retirement: Retirement | null = null
  private score = new SessionScore()
  /** Today's route (Route 1 by default; the picker switches it between passes). */
  private _route: RouteId = DEFAULT_ROUTE
  private _routeSwitches = 0
  /** Placement log (CaseLightLog): one id per Lens start, a line counter, a pass counter. */
  private readonly logToken = randomToken(Math.random)
  /** "s<n>-<token>" for live play, "r<n>-<token>" for a demo replay (set at start). */
  private logSession: string = sessionId(++lensStarts, this.logToken)
  /** Demo replay state (CaseLightDemo has the steps and the checks). */
  private demoSteps: ReplayStep[] = []
  private demoIndex = -1
  private demoActive = false
  private demoScenes: string[] = []
  private _demoStopReason = ""
  private demoTimer: DelayedCallbackEvent | null = null
  private demoCarry: { step: ReplayStep; piece: number; from: vec3; to: vec3; t0: number } | null = null
  private logSeq = 0
  private logPass = 0
  private readonly logBuffer = new LogBuffer()
  /** Letter whose answer is lit after its miss, or -1. */
  private missLitPiece = -1
  private _allRetiredShown = false
  private _heldPiece = -1
  private _lastSoundName: "chime" | "miss" | "" = ""
  private _lastSoundSlot = NO_SLOT
  private _soundPlays = 0
  private _litSlot = NO_SLOT
  private _snapPreviewSlot = NO_SLOT
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
  /** The shared slot-pinch target (Veteran mode and Case check), made in onStart. */
  private slotPinch: SlotPinchTarget | null = null
  /** Case check: the letters planned at the last recall pass end, the round, and its state. */
  private caseCheckPlan: Misplaced[] = []
  private caseCheck: CaseCheckRound | null = null
  private _caseCheckActive = false
  private _caseCheckOffered = false
  private _caseCheckCardText = ""
  private caseCheckFlash: DelayedCallbackEvent | null = null
  private caseCheckFlashSlot = NO_SLOT
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
    return this._mode !== "idle" && this.pass && !this.pass.done ? this.pass.top : -1
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
    return this.score.unaided
  }

  /** Recall pieces placed after a miss (the slot was lit for them), this session. */
  get helpedCount(): number {
    return this.score.helped
  }

  /** Recall pieces placed this session (Y in "Unaided: X/Y"). */
  get totalCount(): number {
    return this.score.total
  }

  get recallPassCount(): number {
    return this._recallPasses
  }

  /** Pieces placed so far in the current pass. */
  get placedThisPass(): number {
    return this.pass ? this.pass.placedCount : 0
  }

  /** The order the current (or latest) pass started with, top letter at index 0. */
  get bundleOrder(): number[] {
    return this.order.slice()
  }

  // ── Retrieval practice read-outs (CaseLightPassLogic) ──────────────────────────────────

  /** The live queue: letters still in the bundle, top letter at index 0 (empty between passes). */
  get currentPassOrder(): number[] {
    return this._mode !== "idle" && this.pass ? this.pass.queue : []
  }

  /** Times a missed letter came back in the current (or latest) recall pass. */
  get comeBackCount(): number {
    return this.pass ? this.pass.comeBackCount : 0
  }

  /** True when this letter was missed in the current (or latest) pass. */
  isHelpedThisPass(pieceIndex: number): boolean {
    return this.pass ? this.pass.isHelped(pieceIndex) : false
  }

  /** Letters retired (placed from memory in two recall passes in a row) since Done. */
  get retiredCount(): number {
    return this.retirement ? this.retirement.retiredCount : 0
  }

  isRetired(pieceIndex: number): boolean {
    return this.retirement ? this.retirement.isRetired(pieceIndex) : false
  }

  /** Completed recall passes in a row this letter was placed from memory (0 after a miss or Done). */
  retireStreakOf(pieceIndex: number): number {
    return this.retirement ? this.retirement.streakOf(pieceIndex) : 0
  }

  get isAllRetired(): boolean {
    return this.retirement ? this.retirement.allRetired : false
  }

  /** True while the "All letters learned" card is the one shown. */
  get isAllRetiredCardShown(): boolean {
    return this._allRetiredShown && this.isResultVisible
  }

  /** The score card's second line as set (e.g. "Came back: 2"). */
  get cameBackText(): string {
    return this.caseLabels ? this.caseLabels.cameBackString : ""
  }

  get isCameBackVisible(): boolean {
    return this.caseLabels ? this.caseLabels.isCameBackVisible : false
  }

  /** True while a letter is shown in the bundle or the case (false for a retired letter during recall). */
  isPieceShown(pieceIndex: number): boolean {
    return this.bundle ? this.bundle.isShown(pieceIndex) : false
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

  /** True while the one-time "Pinch Start practice" hint shows (until a Start press). */
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

  // ── Wall placement read-outs (all pass through CaseLightPlacement; defaults when not wired) ──

  /** True while Place on wall is on (aiming at walls). */
  get placementMode(): boolean {
    return this.placement ? this.placement.isPlacing : false
  }

  /** Placements made since the Lens opened (on a wall or in front of the user). */
  get placementCount(): number {
    return this.placement ? this.placement.placementCount : 0
  }

  /** "none", "wall" or "front": how the case was last placed. */
  get lastPlacementKind(): PlacementKind {
    return this.placement ? this.placement.lastPlacementKind : "none"
  }

  /** World hit point of the latest wall placement, or null. */
  get lastPlacementHit(): vec3 | null {
    return this.placement ? this.placement.lastPlacementHit : null
  }

  /** Surface normal (toward the user) of the latest wall placement, or null. */
  get lastPlacementNormal(): vec3 | null {
    return this.placement ? this.placement.lastPlacementNormal : null
  }

  /** True when the latest pinch while aiming was refused (not a wall). */
  get lastPlacementRefused(): boolean {
    return this.placement ? this.placement.lastPlacementRefused : false
  }

  get placementRefusedCount(): number {
    return this.placement ? this.placement.refusedCount : 0
  }

  /** Why the latest pinch while aiming did not place the case: "not-wall", "too-far", "too-close", "no-hit" or "none". */
  get lastPlacementRefuseReason(): string {
    return this.placement ? this.placement.lastRefuseReason : "none"
  }

  /** Where the case face points (world, unit). */
  get caseFaceNormalWorld(): vec3 {
    return this.caseRoot ? this.caseRoot.getTransform().getWorldTransform().multiplyDirection(new vec3(0, 0, 1)).normalize() : vec3.zero()
  }

  /** The case's up (world, unit). */
  get caseUpWorld(): vec3 {
    return this.caseRoot ? this.caseRoot.getTransform().getWorldTransform().multiplyDirection(new vec3(0, 1, 0)).normalize() : vec3.zero()
  }

  /** Bottom playable shelf's board top above the eye right now (cm; negative = below the eye). */
  get lowerShelfAboveEyeCm(): number {
    return this.placement ? this.placement.lowerShelfAboveEyeCm : 0
  }

  /** The same height at the opening pose, measured when the Lens opened (cm). */
  get openLowerShelfAboveEyeCm(): number {
    return this.placement ? this.placement.openLowerShelfAboveEyeCm : 0
  }

  /** While aiming: "wall" (outline shown), "not-wall" (warning ring) or "none". */
  get wallAimState(): "wall" | "not-wall" | "none" {
    return this.placement ? this.placement.aimState : "none"
  }

  // ── Veteran mode read-outs (CaseLightVeteran + CaseLightNotes; defaults when not wired) ──

  /** True while Veteran mode is on (letters paused, slot pinches open the reminder chooser). */
  get veteranMode(): boolean {
    return this.veteran ? this.veteran.isOn : false
  }

  /** The reminder pinned on a slot, or null. */
  noteForSlot(slot: number): string | null {
    return this.veteran ? this.veteran.noteForSlot(slot) : null
  }

  /** True while this slot's reminder card is on screen. */
  isNoteShown(slot: number): boolean {
    return this.veteran ? this.veteran.isNoteShown(slot) : false
  }

  /** Slots with a pinned reminder, ascending. */
  noteSlots(): number[] {
    return this.veteran ? this.veteran.noteSlots() : []
  }

  /** The reminder chooser's visible labels, top to bottom (empty while it is closed). */
  get noteChooserOptions(): string[] {
    return this.veteran ? this.veteran.chooserOptionLabels : []
  }

  get isNoteChooserOpen(): boolean {
    return this.veteran ? this.veteran.isChooserOpen : false
  }

  /** The slot whose chooser is open, or -1. */
  get noteChooserSlot(): number {
    return this.veteran ? this.veteran.selectedSlot : NO_SLOT
  }

  /** Slot pinches taken in Veteran mode (each opened the chooser). */
  get slotPinchCount(): number {
    return this.veteran ? this.veteran.slotPinchCount : 0
  }

  // ── Route read-outs ──────────────────────────────────────────────────────────────────────

  /** Today's route: 1 or 2. */
  get routeId(): RouteId {
    return this._route
  }

  /** The route's street names, in case order. */
  get routeStreetNames(): string[] {
    return routeStreets(this._route).map((st) => st.name)
  }

  /** True while the route picker takes a press (no pass running). */
  get isRoutePickerEnabled(): boolean {
    return this.routePicker ? this.routePicker.isEnabled : false
  }

  /** The route the picker shows as selected (DEFAULT_ROUTE when not wired). */
  get routePickerShownRoute(): RouteId {
    return this.routePicker ? this.routePicker.shownRoute : DEFAULT_ROUTE
  }

  /** The hold letter's address on today's route. */
  get holdAddress(): string {
    return holdAddressOf(this._route)
  }

  /** Route switches taken since the Lens opened. */
  get routeSwitchCount(): number {
    return this._routeSwitches
  }

  // ── Placement log read-outs (CaseLightLog) ──────────────────────────────────────────────

  /** The placement log lines printed this session (CASELIGHT_LOG v1), oldest dropped past 400. */
  get placementLogLines(): string[] {
    return this.logBuffer.lines
  }

  /** This Lens start's session id in the log (a counter and a random token). */
  get logSessionId(): string {
    return this.logSession
  }

  /** Log lines written this session (the last seq). */
  get logLineCount(): number {
    return this.logSeq
  }

  // ── Case check read-outs (CaseLightCaseCheck) ────────────────────────────────────────────

  /** True while a Case check runs (letters drawn in wrong cells, slot pinches taken). */
  get caseCheckActive(): boolean {
    return this._caseCheckActive
  }

  /** True while the Case check button is offered (after a recall pass ends, until used or the score view ends). */
  get caseCheckOffered(): boolean {
    return this._caseCheckOffered
  }

  /** True while the Case check button is on screen. */
  get isCaseCheckButtonVisible(): boolean {
    return this.exitControls ? this.exitControls.isCaseCheckVisible : false
  }

  /** The misplaced letters of the current (or last) Case check: letter, its address, the wrong cell it stands in, its own cell. */
  get caseCheckMisplaced(): Array<{ letter: number; address: string; wrongCell: number; rightCell: number }> {
    if (!this.caseCheck) return []
    return this.caseCheck.misplaced.map((m) => ({ letter: m.piece, address: this.addressOf(m.piece), wrongCell: m.wrongSlot, rightCell: m.rightSlot }))
  }

  /** Misplaced letters found so far in the current (or last) Case check. */
  get caseCheckFound(): number {
    return this.caseCheck ? this.caseCheck.foundCount : 0
  }

  /** Cells found so far, ascending. */
  get caseCheckFoundCells(): number[] {
    return this.caseCheck ? this.caseCheck.foundSlots : []
  }

  /** Pinches rejected (on a cell with no misplaced letter) in the current (or last) Case check. */
  get caseCheckRejectedCount(): number {
    return this.caseCheck ? this.caseCheck.rejectedCount : 0
  }

  /** The card line the last Case check ended with ("Case check: N of 2 found"), "" before one ends. */
  get caseCheckCardText(): string {
    return this._caseCheckCardText
  }

  /** Cells outlined as found right now. */
  get caseCheckOutlineCells(): number[] {
    return this.mixUps ? this.mixUps.checkOutlineCells : []
  }

  /** True while the shared slot-pinch target takes pinches. */
  get isSlotPinchLive(): boolean {
    return !!this.slotPinch && this.slotPinch.isLive
  }

  // ── Demo replay read-outs (CaseLightDemo) ────────────────────────────────────────────────

  /** True while a demo replay is playing (false before it starts, after it ends or stops). */
  get demoReplayActive(): boolean {
    return this.demoActive
  }

  /** True while the "Demo replay" label is on screen. */
  get demoLabelShown(): boolean {
    return this.controls ? this.controls.isDemoLabelShown : false
  }

  /** Scenes the demo replay has started so far, in order (the CASELIGHT_DEMO v1 scene= values). */
  get demoScenesSeen(): string[] {
    return this.demoScenes.slice()
  }

  /** Why the replay stopped early ("" when it did not). */
  get demoStopReason(): string {
    return this._demoStopReason
  }

  /** Steps in the replay (from the recording) and the one reached. */
  get demoStepCount(): number {
    return this.demoSteps.length
  }

  get demoStepIndex(): number {
    return this.demoIndex
  }

  /** The numbers printed under a separation on today's route ("2005\n2015", one number, or ""). */
  cellLabelTextOf(slot: number): string {
    return this.caseLabels ? this.caseLabels.cellLabelText(slot) : ""
  }

  /** The street names printed on the case, in case order. */
  get printedStreetNames(): string[] {
    return this.caseLabels ? this.caseLabels.streetNameStrings : []
  }

  /** The address printed on a letter (its card), for checking a switch relabelled the bundle. */
  printedAddressOf(pieceIndex: number): string {
    return this.bundle ? this.bundle.addressOf(pieceIndex) : ""
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
    // CaseLightRoute's order for this pass number, without the retired letters.
    const order = withoutRetired(recallOrder(this.pieces.length, this._recallPasses), (i) => this.isRetired(i))
    if (order.length === 0) {
      this.showAllRetired()
      return
    }
    this.beginPass("recall", order)
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

  /**
   * Today's route (the picker's path). Taken only between passes (chooseRoute): during a pass the
   * picker is greyed out and this refuses. A switch relabels the case and the bundle (same slots)
   * and starts the route fresh: score, come-backs, retirement and mix-ups reset; notes are per route.
   */
  selectRoute(route: number): boolean {
    if (!this.ready) return false
    // Not during a Case check (the picker is greyed out then too).
    if (this._caseCheckActive) {
      if (this.routePicker) this.routePicker.setRoute(this._route)
      return false
    }
    const choice = chooseRoute(this._route, route, this._mode)
    if (!choice.switched) {
      if (this.routePicker) this.routePicker.setRoute(this._route)
      return false
    }
    this.applyRoute(choice.route)
    return true
  }

  /** Exit "Again": the same as pressing Start recall (a clean new recall pass, new order). */
  exitAgain(): void {
    if (!this.ready) return
    this._lastExitPressAt = getTime()
    this.endCaseCheck("again")
    if (this.exitControls) this.exitControls.hide()
    this.startRecall()
  }

  /**
   * Case check (the button's path): 2 letters of the pass just ended are drawn in wrong cells and
   * the slot pinch goes live. Only while offered (after a recall pass, idle, not yet used).
   */
  startCaseCheck(): boolean {
    if (!this.ready || this._mode !== "idle" || this._caseCheckActive || !this._caseCheckOffered) return false
    const plan = this.caseCheckPlan
    if (plan.length === 0 || !this.slotPinch) return false
    // Slot pinches here mean Case check: Veteran mode goes off (notes are kept).
    if (this.veteran && this.veteran.isOn) this.veteran.setMode(false)
    this._caseCheckOffered = false
    if (this.exitControls) this.exitControls.setCaseCheckOffered(false)
    this.caseCheck = new CaseCheckRound(plan)
    this._caseCheckActive = true
    this._caseCheckCardText = ""
    // The case face is clear for the check: the card waits until it ends, mix-up marks go.
    if (this.resultHide) this.resultHide.enabled = false
    this.caseLabels.hideResult()
    this.clearMixUps()
    this.setLit(NO_SLOT)
    this.setSnapPreview(NO_SLOT)
    for (const m of plan) this.bundle.placeIn(m.piece, this.placedWorldPosition(m.wrongSlot, this.pieces[m.piece].side), this.placedWorldRotation())
    this.slotPinch.acquire("case-check")
    this.writeLog(formatCaseCheckStart(this.logHead(), plan.map((m) => m.wrongSlot)))
    return true
  }

  /**
   * Exit "Done": back to idle with nothing glowing (answer glow, label highlight, snap outline,
   * edge arrow, pace light, ripples all off). The hint stays hidden and every count is kept.
   */
  exitDone(): void {
    if (!this.ready) return
    this._lastExitPressAt = getTime()
    const checkEndedHere = this._caseCheckActive
    this.endCaseCheck("done")
    this.clearCaseCheckMarks(true)
    this._caseCheckOffered = false
    if (this.exitControls) this.exitControls.setCaseCheckOffered(false)
    if (this.exitControls) this.exitControls.hide()
    if (this.resultHide) this.resultHide.enabled = false
    this.caseLabels.hideResult()
    this._allRetiredShown = false
    // Done ends the session's retirement: every letter is back in later recall passes.
    if (this.retirement) this.retirement.reset()
    this._mode = "idle"
    this._heldPiece = -1
    this.missLitPiece = -1
    this.bundle.setActivePiece(-1)
    this.setLit(NO_SLOT)
    this.setSnapPreview(NO_SLOT)
    this.clearMixUps()
    if (this.pace && this.pace.isOn) {
      this.pace.setOn(false)
      this.controls.setPaceState(false, this.pace.rate, this.pace.lightColor)
    }
    if (this.ripples) this.ripples.stopAll()
    // A Case check ended by Done: its line stays readable on the card for resultSeconds.
    if (checkEndedHere) {
      this.caseLabels.showResultLine2(this._caseCheckCardText)
      if (this.resultHide) {
        this.resultHide.enabled = true
        this.resultHide.reset(this.resultSeconds)
      }
    }
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
    // A demo replay's log lines carry their own session prefix, so they are never read as live play.
    if (this.demoReplay) this.logSession = replaySessionId(lensStarts, this.logToken)
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
    this.pieces = buildBundle(this.bundleCount, this._route)

    this.caseMesh.build(this.geo, this.lineMaterial)
    this.caseLabels.build(this.geo)
    this.highlights.build(this.geo, this.lineMaterial)
    this.bundle.build(this.pieces, this.lineMaterial)
    this.viewCue.build(this.lineMaterial)
    if (this.ripples) this.ripples.build(this.lineMaterial)
    if (this.pace) this.pace.build(this.geo, this.lineMaterial)
    if (this.mixUps) this.mixUps.build(this.geo, this.lineMaterial)
    // Measured at the opening pose, before anything can move the case.
    if (this.placement) {
      this.placement.build(this.geo, this.lineMaterial)
      this.placement.onPlaced.add(() => this.configureStepPads())
    }
    // One slot-pinch target for the case face, shared by Veteran mode and Case check.
    this.slotPinch = new SlotPinchTarget(this.caseRoot, this.geo, this.veteran ? this.veteran.debugCollider : false)
    this.slotPinch.onSlotPinched.add((slot) => this.onCaseCheckPinch(slot))
    if (this.veteran) {
      this.veteran.build(this.geo, () => ({ mode: this._mode, litSlot: this._litSlot }), (slot) => this.setSnapPreview(slot), this.slotPinch)
      this.veteran.onModeChanged.add((on) => this.onVeteranMode(on))
    }
    if (this.routePicker) {
      this.routePicker.onPickRoute.add((r) => this.selectRoute(r))
      this.routePicker.setRoute(this._route)
    }
    this.rungs = this.pieces.map(() => 0)
    this.retirement = new Retirement(this.pieces.length)
    this.configureStepPads()

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
      this.exitControls.onCaseCheck.add(() => this.onCaseCheckButton())
    }
    if (this.pace) this.controls.setPaceState(false, this.pace.rate, this.pace.lightColor)

    this.resultHide = this.createEvent("DelayedCallbackEvent")
    this.resultHide.bind(() => this.caseLabels.hideResult())
    this.caseCheckFlash = this.createEvent("DelayedCallbackEvent")
    this.caseCheckFlash.bind(() => {
      if (this._snapPreviewSlot === this.caseCheckFlashSlot) this.setSnapPreview(NO_SLOT)
      this.caseCheckFlashSlot = NO_SLOT
    })

    this.order = practiceOrder(this.pieces.length)
    this.bundle.layout(this.order)
    this.ready = true
    print(`CaseLightMain: ready. ${this.pieces.length} pieces, ${this.geo.shelfCount} shelves, case mesh ${this.caseMesh.builtVertexCount} vertices, ${this.caseLabels.labelledCellCount} labelled cells.`)
    if (this.demoReplay) this.startDemoReplay()
  }

  /** step()'s default pads: one separation seen from the case's current distance (opening pose, or after a placement). */
  private configureStepPads(): void {
    if (!this.geo || !this.caseRoot) return
    const cam = WorldCameraFinderProvider.getInstance()
    const root = this.caseRoot.getTransform().getWorldPosition()
    const depth = -cam.getInvertedWorldTransform().multiplyPoint(root).z
    // Along the view axis at open (as before); straight-line distance if the case is not ahead.
    const caseDepth = depth > 1 ? depth : root.distance(cam.getWorldPosition())
    this.viewCue.configureCellPad(SEP_PITCH_CM / 2, this.geo.openingHeight / 2, caseDepth)
  }

  // ── Pass flow ──────────────────────────────────────────────────────────────────────────

  private beginPass(mode: CaseLightMode, order: number[]): void {
    // A pass needs its letters: starting one turns Veteran mode off (notes are kept).
    if (this.veteran && this.veteran.isOn) this.veteran.setMode(false)
    // A Start press ends a running Case check (its line is logged; the new pass hides the card).
    this.endCaseCheck("start")
    this.resetCaseCheck()
    this.caseLabels.hideResult()
    if (this.exitControls) this.exitControls.hide()
    this.controls.hideHint()
    this._mode = mode
    this.order = order
    this.pass = new PassQueue(order)
    this.missLitPiece = -1
    this._allRetiredShown = false
    this._heldPiece = -1
    this._lastDropResult = "none"
    this._lastDropSlot = NO_SLOT
    this._lastDropPiece = -1
    this.setLit(NO_SLOT)
    this.setSnapPreview(NO_SLOT)
    this.passMixUps.clear()
    this.clearMixUps()
    this.bundle.layout(order)
    this.activateTop()
    this.logPass++
    this.writeLog(formatPassStart(this.logHead(), order.length))
  }

  private onGrabbed(piece: number): void {
    if (this._mode === "idle" || piece !== this.topPieceIndex || this.veteranMode) return
    this._heldPiece = piece
    this.bundle.setCardHeld(piece, true)
    if (this.ripples) this.ripples.play(this.bundle.takePinchPoint(piece))
    if (this._mode === "practice") this.showPracticeCue(piece)
    // Recall: nothing new lights on grab, and any grab puts out the answer a miss lit, the missed
    // letter's own return included, so every come-back is a fresh try in the dark.
    if (this._mode === "recall" && this.missLitPiece >= 0) {
      this.missLitPiece = missLitAfterGrab(this.missLitPiece, piece)
      if (this.missLitPiece < 0) this.setLit(NO_SLOT)
    }
  }

  private onDragMoved(args: PieceMoveArgs): void {
    if (this._mode === "idle" || args.piece !== this.topPieceIndex || this.veteranMode) return
    this.setSnapPreview(this.slotSeenAt(args.worldPosition))
  }

  private onReleased(args: PieceMoveArgs): void {
    const piece = args.piece
    // Veteran mode pauses the pass: no letter is placed and nothing advances.
    if (this._mode === "idle" || piece !== this.topPieceIndex || this.veteranMode) return
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
      this.logPlacement(piece, NO_SLOT, "off-case", false)
      this.afterNotPlaced(piece, false)
      this.bundle.returnToHand(piece, () => this.activateTop())
      return
    }

    const correct = isHold ? this.geo!.isHoldSlot(slot) : slot === target
    if (correct) {
      this._lastDropResult = "correct"
      this.bundle.placeIn(piece, this.placedWorldPosition(slot, isHold ? -1 : this.pieces[piece].side), this.placedWorldRotation())
      if (this.ripples) this.ripples.play(this.slotWorldPosition(slot))
      // Chime from where the letter went: its separation, or the HOLD block for the hold piece.
      this.playCue("chime", isHold ? HOLD_BLOCK_SLOT : slot)
      const placed = this.pass!.placeTop()
      if (this._mode === "recall") this.score.add(placed.helped)
      this.logPlacement(piece, slot, "correct", this._mode === "recall" && !placed.helped)
      this.missLitPiece = -1
      if (this._mode === "practice" && this.practiceLadder) this.rungs[piece] = Math.min(LADDER_TOP_RUNG, this.rungs[piece] + 1)
      this.setLit(NO_SLOT)
      this.advance()
      return
    }

    // Wrong separation: snap into it (so the drop is visible), then back to the hand.
    this._lastDropResult = isHold ? "refused-hold" : "miss"
    this.logPlacement(piece, slot, isHold ? "refused-hold" : "miss", false)
    if (this._mode === "practice" && this.practiceLadder) this.rungs[piece] = Math.max(0, this.rungs[piece] - 1)
    // Recall: keep the address's opening wrong drop for the mix-up lines on the score view.
    if (this._mode === "recall" && !this.passMixUps.has(piece)) this.passMixUps.set(piece, { dropped: slot, right: target, address: this.addressOf(piece) })
    if (this._mode === "recall") {
      // Comes back sooner: helped for the rest of the pass, back in the bundle behind two others.
      this.pass!.missTop()
      this.missLitPiece = piece
      this.setLit(target)
      this.bundle.requeue(this.pass!.queue)
      this.activateTop()
      this.bundle.snapThenReturn(piece, this.placedWorldPosition(slot, -1), this.placedWorldRotation(), () => this.activateTop(), true)
    } else {
      this.afterNotPlaced(piece, true)
      this.bundle.snapThenReturn(piece, this.placedWorldPosition(slot, -1), this.placedWorldRotation(), () => this.activateTop())
    }
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
    if (this._mode === "recall") {
      // A miss's answer stays lit only until the next pick-up (missLitPiece is -1 after it).
      this.setLit(this.missLitPiece === piece ? target : NO_SLOT)
    } else if (wasMiss && target === HOLD_BLOCK_SLOT) {
      // Hold piece refused: the HOLD block glows (practice too).
      this.setLit(HOLD_BLOCK_SLOT)
    } else {
      // Practice: the right separation glows only while the piece is in hand.
      this.setLit(NO_SLOT)
    }
  }

  private advance(): void {
    if (this.pass && !this.pass.done) {
      this.activateTop()
      return
    }
    const finished = this._mode
    this._mode = "idle"
    this.bundle.setActivePiece(-1)
    this.setLit(NO_SLOT)
    let newlyRetired: number[] = []
    if (finished === "recall") {
      // A completed recall pass: runs of from-memory placements, and who retires.
      const pass = this.pass!
      if (this.retirement) newlyRetired = this.retirement.recordPass(pass.startOrder, (i) => pass.isHelped(i))
      this.caseLabels.showResult(this.score.unaided, this.score.total, pass.comeBackCount)
      if (this.resultHide) {
        this.resultHide.enabled = true
        this.resultHide.reset(this.resultSeconds)
      }
      // Case check is offered when 2 letters of this pass can be drawn in wrong cells.
      this.caseCheckPlan = this.planCaseCheck(pass)
      this._caseCheckOffered = this.caseCheckPlan.length === CASE_CHECK_COUNT
      if (this.exitControls) this.exitControls.setCaseCheckOffered(this._caseCheckOffered)
      if (this.exitControls) this.exitControls.show()
      if (this.mixUps && this.mixUpLines) {
        const eyeLocal = this.caseRoot.getTransform().getInvertedWorldTransform().multiplyPoint(WorldCameraFinderProvider.getInstance().getWorldPosition())
        const spots = this.mixUps.show(Array.from(this.passMixUps.values()), eyeLocal)
        this.caseLabels.showMixUpLabels(spots, this.mixUps.lineColor)
      }
    }
    const cameBack = finished === "recall" && this.pass ? `, came back ${this.pass.comeBackCount}, retired ${newlyRetired.length} (now ${this.retiredCount})` : ""
    print(`CaseLightMain: ${finished} pass complete. Unaided ${this.score.unaided}, helped ${this.score.helped}, total ${this.score.total}${cameBack}.`)
    const end = this.logHead()
    end.mode = finished
    const recall = finished === "recall"
    this.writeLog(formatPassEnd(end, this.pass ? this.pass.placedCount : 0, recall ? this.caseLabels.resultString : "", recall ? this.caseLabels.cameBackString : ""))
  }

  /** The fields every log line starts with (takes the next seq). */
  private logHead(): LogHead {
    return { seq: ++this.logSeq, session: this.logSession, route: this._route, pass: this.logPass, mode: this._mode }
  }

  /** Print a log line (one per event, never per frame) and keep it for the read-out. */
  private writeLog(line: string): void {
    print(line)
    this.logBuffer.push(line)
  }

  private logPlacement(piece: number, slot: number, result: LogResult, memory: boolean): void {
    const holdCell = slot >= 0 && !!this.geo && this.geo.isHoldSlot(slot)
    this.writeLog(formatPlacement({ ...this.logHead(), piece, address: this.addressOf(piece), placed: placedToken(slot, holdCell), right: rightToken(this.targetSlotOf(piece)), result, memory }))
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

  /** Every letter is retired: no recall pass; the card says so and the exit (Again / Done) stays up. */
  private showAllRetired(): void {
    this.clearCaseCheckMarks(true)
    this._caseCheckOffered = false
    if (this.exitControls) this.exitControls.setCaseCheckOffered(false)
    this._mode = "idle"
    this._heldPiece = -1
    this.missLitPiece = -1
    this.controls.hideHint()
    this.bundle.setActivePiece(-1)
    this.setLit(NO_SLOT)
    this.setSnapPreview(NO_SLOT)
    this.clearMixUps()
    this.caseLabels.showAllRetired()
    this._allRetiredShown = true
    if (this.resultHide) {
      this.resultHide.enabled = true
      this.resultHide.reset(this.resultSeconds)
    }
    if (this.exitControls) this.exitControls.show()
    print("CaseLightMain: every letter is retired; recall has nothing left until Done.")
  }

  // ── Case check ─────────────────────────────────────────────────────────────────────────

  /** The Case check button: one pinch, one press (a Start press right after it is ignored too). */
  private onCaseCheckButton(): void {
    this._lastExitPressAt = getTime()
    this.startCaseCheck()
  }

  /** The 2 letters of a finished recall pass to draw in wrong cells (letters standing in the case only). */
  private planCaseCheck(pass: PassQueue): Misplaced[] {
    const targets = this.pieces.map((_, i) => this.targetSlotOf(i))
    const movable = pass.startOrder.filter((i) => this.bundle.isPlaced(i) && this.bundle.isShown(i))
    const labelled = cellLabels(this._route).map((c) => c.slot)
    return chooseMisplaced(targets, labelled, this._recallPasses, CASE_CHECK_COUNT, movable)
  }

  /**
   * A slot pinch while a Case check runs (the shared target's event; Veteran mode takes it only
   * while on, and the two are never on together). Found: chime and outline. Wrong: a short cue
   * only (low tone from the pinched cell, a brief outline on it). Again: nothing.
   */
  private onCaseCheckPinch(slot: number): void {
    const round = this.caseCheck
    if (!this._caseCheckActive || !round) return
    const result = round.pinch(slot)
    this.writeLog(formatCaseCheckPinch(this.logHead(), slot, result))
    if (result === "found") {
      this.playCue("chime", slot)
      if (this.ripples) this.ripples.play(this.slotWorldPosition(slot))
      if (this.mixUps) this.mixUps.showCheckOutlines(round.foundSlots)
      if (round.done) this.endCaseCheck("all-found")
    } else if (result === "wrong") {
      this.playCue("miss", slot)
      this.caseCheckFlashSlot = slot
      this.setSnapPreview(slot)
      if (this.caseCheckFlash) {
        this.caseCheckFlash.enabled = true
        this.caseCheckFlash.reset(0.4)
      }
    }
  }

  /**
   * End a running Case check: the slot pinch goes dark, the card's second line becomes
   * "Case check: N of 2 found" and the end is logged. Found outlines and the letters stay where
   * they are until Again, Done or a Start press (clearCaseCheckMarks).
   */
  private endCaseCheck(ended: CaseCheckEnd): void {
    const round = this.caseCheck
    if (!this._caseCheckActive || !round) return
    this._caseCheckActive = false
    if (this.slotPinch) this.slotPinch.release("case-check")
    if (this.caseCheckFlash) this.caseCheckFlash.enabled = false
    if (this.caseCheckFlashSlot !== NO_SLOT && this._snapPreviewSlot === this.caseCheckFlashSlot) this.setSnapPreview(NO_SLOT)
    this.caseCheckFlashSlot = NO_SLOT
    this._caseCheckCardText = caseCheckLine(round.foundCount, round.total)
    this.writeLog(formatCaseCheckEnd(this.logHead(), round.foundCount, round.total, round.rejectedCount, ended, this._caseCheckCardText))
    this.caseLabels.showResultLine2(this._caseCheckCardText)
    if (this.resultHide) {
      this.resultHide.enabled = true
      this.resultHide.reset(this.resultSeconds)
    }
    if (this.routePicker) this.routePicker.setEnabled(this._mode === "idle")
  }

  /** Found outlines off; with restore, letters still standing in wrong cells go back to their own cells. */
  private clearCaseCheckMarks(restore: boolean): void {
    if (this.mixUps) this.mixUps.clearCheckOutlines()
    if (!restore || !this.caseCheck || !this.geo) return
    for (const m of this.caseCheck.misplaced) {
      if (this.bundle.isPlaced(m.piece)) this.bundle.placeIn(m.piece, this.placedWorldPosition(m.rightSlot, this.pieces[m.piece].side), this.placedWorldRotation())
    }
  }

  /** A new pass or route: no Case check offered, none remembered (the bundle is laid out again). */
  private resetCaseCheck(): void {
    this.clearCaseCheckMarks(false)
    this._caseCheckOffered = false
    if (this.exitControls) this.exitControls.setCaseCheckOffered(false)
    this.caseCheckPlan = []
    this.caseCheck = null
    this._caseCheckCardText = ""
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
    // A pinned reminder shows with its lit slot (practice target, or recall answer after a miss).
    if (this.veteran) this.veteran.refresh()
    // The route can change only between passes: the picker is live exactly while idle.
    if (this.routePicker) this.routePicker.setEnabled(this._mode === "idle" && !this._caseCheckActive)
  }

  private applyRoute(route: RouteId): void {
    const fromRoute = this._route
    this._route = route
    this._routeSwitches++
    this.pieces = buildBundle(this.bundleCount, route)
    this.bundle.relabel(this.pieces)
    this.caseLabels.setRoute(route)
    this.caseMesh.setRoute(route)
    if (this.veteran) this.veteran.setRoute(route)
    // A fresh start on the new route: score, come-backs, retirement, mix-ups, ladder rungs.
    this.score = new SessionScore()
    this.pass = null
    this._recallPasses = 0
    if (this.retirement) this.retirement.reset()
    this.passMixUps.clear()
    this.clearMixUps()
    this.resetCaseCheck()
    if (this.resultHide) this.resultHide.enabled = false
    this.caseLabels.hideResult()
    if (this.exitControls) this.exitControls.hide()
    this._allRetiredShown = false
    this.missLitPiece = -1
    this._heldPiece = -1
    this._lastDropResult = "none"
    this._lastDropSlot = NO_SLOT
    this._lastDropPiece = -1
    this.rungs = this.pieces.map(() => 0)
    this.setLit(NO_SLOT)
    this.setSnapPreview(NO_SLOT)
    this.order = practiceOrder(this.pieces.length)
    this.bundle.layout(this.order)
    if (this.routePicker) this.routePicker.setRoute(route)
    // The on-screen score starts again on the new route: a log reader resets its count here.
    this.writeLog(formatRouteSwitch(this.logHead(), fromRoute))
    print(`CaseLightMain: route ${route} (${this.routeStreetNames.join(", ")}); score, come-backs and retirement reset.`)
  }

  // ── Demo replay player ─────────────────────────────────────────────────────────────────
  // Each recorded step goes through the handler real input reaches: the Start buttons' handler
  // (onStartButton), the grab handler (grabTopPiece runs onGrabbed), the drag handler (onDragMoved,
  // every frame of the carry) and the release handler (dropHeldPieceAtWorld runs onReleased at the
  // recorded release point). After each attempt and pass end the product's own result is compared
  // with the recording; any difference stops the replay with a reason.

  private startDemoReplay(): void {
    this.demoSteps = recordedReplay()
    this.demoIndex = 0
    this.demoActive = true
    this.controls.showDemoLabel(DEMO_LABEL_TEXT)
    this.logDemo("replay-start", 0)
    this.demoTimer = this.createEvent("DelayedCallbackEvent")
    this.demoTimer.bind(() => this.runDemoStep())
    this.createEvent("UpdateEvent").bind(() => this.updateDemoCarry())
    this.demoTimer.reset(1.5)
  }

  private runDemoStep(): void {
    if (!this.demoActive) return
    const step = this.demoSteps[this.demoIndex]
    const n = this.demoIndex + 1
    if (!step) {
      this.endDemo(n)
      return
    }
    const scene = sceneOf(step)
    if (step.kind === "start") {
      if (scene) this.logDemo(scene, n)
      this.onStartButton(step.mode)
      if (this._mode !== step.mode) return this.stopDemo(n, `seq ${step.seq}: Start ${step.mode} did not start a pass`)
      this.nextDemo(1.4)
    } else if (step.kind === "attempt") {
      const top = this.topPieceIndex
      if (top !== step.piece) return this.stopDemo(n, `seq ${step.seq}: letter ${top} is on top, the recording has letter ${step.piece}`)
      if (scene) this.logDemo(scene, n)
      if (!this.grabTopPiece()) return this.stopDemo(n, `seq ${step.seq}: letter ${step.piece} could not be picked up`)
      this.demoCarry = { step, piece: step.piece, from: this.bundle.pieceWorldPosition(step.piece), to: this.demoReleasePoint(dropCellOf(step.placed)), t0: getTime() + DEMO_HOLD_S }
    } else if (step.kind === "pass-end") {
      const recall = step.mode === "recall"
      const why = this._mode !== "idle" ? `seq ${step.seq}: the pass has not ended` : passEndMismatch(step, this.pass ? this.pass.placedCount : 0, recall ? this.caseLabels.resultString : "", recall ? this.caseLabels.cameBackString : "")
      if (why) return this.stopDemo(n, why)
      if (scene) this.logDemo(scene, n)
      this.nextDemo(recall ? 3.5 : 1.2)
    } else {
      this.endDemo(n)
    }
  }

  /** Carry the letter in hand to the recorded release point (the drag handler sees every frame), then release it there. */
  private updateDemoCarry(): void {
    const c = this.demoCarry
    if (!c || !this.demoActive) return
    const k = (getTime() - c.t0) / DEMO_CARRY_S
    if (k < 0) return
    const pos = vec3.lerp(c.from, c.to, Math.min(1, k))
    const obj = this.bundle.pieceObject(c.piece)
    if (obj) obj.getTransform().setWorldPosition(pos)
    this.onDragMoved({ piece: c.piece, worldPosition: pos })
    if (k < 1) return
    this.demoCarry = null
    this.dropHeldPieceAtWorld(c.to)
    const slot = this._lastDropSlot
    const placed = placedToken(slot, slot >= 0 && !!this.geo && this.geo.isHoldSlot(slot))
    const why = attemptMismatch(c.step, c.piece, this._lastDropResult, placed)
    if (why) return this.stopDemo(this.demoIndex + 1, why)
    const r = c.step.kind === "attempt" ? c.step.result : ""
    this.nextDemo(r === "miss" || r === "refused-hold" ? 1.8 : r === "off-case" ? 1.0 : 0.6)
  }

  /** Where a recorded release lands: on the eye ray to the cell, just in front of the case; or well above it for OFF. */
  private demoReleasePoint(cell: number): vec3 {
    if (cell < 0) return this.caseRoot.getTransform().getWorldTransform().multiplyPoint(new vec3(0, 60, 20))
    const world = this.slotWorldPosition(cell)
    const cam = WorldCameraFinderProvider.getInstance().getWorldPosition()
    return cam.add(world.sub(cam).uniformScale(0.92))
  }

  private nextDemo(seconds: number): void {
    this.demoIndex++
    if (this.demoTimer) this.demoTimer.reset(seconds)
  }

  /** The replay reached its end: the last score card stays up, and so does the label. */
  private endDemo(step: number): void {
    this.logDemo("replay-end", step)
    this.demoActive = false
    if (this.resultHide) this.resultHide.enabled = false
  }

  /** The product did something the recording did not: say so and stop (never carry on quietly). */
  private stopDemo(step: number, reason: string): void {
    this._demoStopReason = reason
    this.logDemo("stopped", step, reason)
    this.demoActive = false
    this.demoCarry = null
  }

  private logDemo(scene: DemoScene, step: number, reason: string = ""): void {
    this.demoScenes.push(scene)
    print(formatDemoLine(this.logSession, scene, step, reason))
  }

  /** Make the top letter grabbable, unless Veteran mode has paused the letters. */
  private activateTop(): void {
    this.bundle.setActivePiece(this.veteranMode ? -1 : this.topPieceIndex)
  }

  /**
   * Veteran mode keeps slot pinches and letter drops apart: on, no letter can be grabbed (the
   * pass waits, nothing advances); off, the top letter is grabbable again. It cannot come on
   * while a letter is in hand.
   */
  private onVeteranMode(on: boolean): void {
    // Not while a letter is in hand, nor during a Case check (its slot pinches are the check's).
    if (on && (this._heldPiece >= 0 || this._caseCheckActive)) {
      this.veteran.setMode(false)
      return
    }
    if (!on) this.setSnapPreview(NO_SLOT)
    this.activateTop()
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
