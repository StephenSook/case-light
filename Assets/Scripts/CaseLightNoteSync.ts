// Owns: sharing the veteran's reminders in a Connected Lenses session: the Share notes on/off state, asking the Sync Kit for a session when the person turns it on, one SyncEntity (made only once a multiplayer session is ready) that sends each note change, and every note when sharing starts or someone joins, applying received notes, the solo-start state log, and read-only state for tests.
// Talks to: SpectaclesSyncKit (SessionController, SyncEntity, NetworkIdOptions), CaseLightNoteShare (the sharing rules), CaseLightVeteran (onLocalNoteChanged, applySharedNote, sharedNotesNow) and its CaseLightVeteranUI (the Share notes toggle beside Veteran mode: onToggleShareNotes, setShareNotesState), CaseLightMain (logNoteShare).
// Must not: share anything without Share notes on and a ready multiplayer session, send a name, a route or any free text, change the note rules or saved progress, or start a session on its own (only a Share notes press, or the Sync Kit's own StartMultiplayer launch, starts one).

/**
 * Solo is untouched: the Sync Kit's start mode is Off, so no session exists until the person turns
 * Share notes on (or the Lens was launched into multiplayer, e.g. from Active Nearby, which the Sync
 * Kit handles itself). Until a multiplayer session is ready no SyncEntity exists, nothing is sent,
 * and the Veteran notes work exactly as before.
 * What travels: one networked event per note change, { slot, note } (CaseLightNoteShare), sent to
 * the others only (never echoed back here). Session persistence only; nothing is stored in the
 * cloud. A received note is applied to the route in use and shows on its slot like a local note.
 * Each sent and each received note writes one CASELIGHT_LOG line (event=note-sent, note-received).
 */

import { SessionController } from "SpectaclesSyncKit.lspkg/Core/SessionController"
import { SyncEntity } from "SpectaclesSyncKit.lspkg/Core/SyncEntity"
import { NetworkIdOptions } from "SpectaclesSyncKit.lspkg/Core/NetworkIdTools"
import { NetworkIdType } from "SpectaclesSyncKit.lspkg/Core/NetworkIdType"
import { NetworkMessage } from "SpectaclesSyncKit.lspkg/Core/NetworkMessage"
import { CaseLightVeteranUI } from "./CaseLightVeteranUI"
import { CaseLightMain } from "./CaseLightMain"
import { decodeNote, SharedNote, shouldShare } from "./CaseLightNoteShare"
import { CaseLightVeteran } from "./CaseLightVeteran"

/** The one networked event name (scoped to this entity's network id). */
const NOTE_EVENT = "note"
/** A fixed id, so every person's copy of this entity is the same one. */
const NETWORK_ID = "CaseLightSharedNotes"
/** SessionController's internal state, by its numeric value (the enum is not exported). */
const STATE_NAMES = ["NotInitialized", "Initialized", "Ready", "WaitingForInvite"]

@component
export class CaseLightNoteSync extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">CaseLightNoteSync - share Veteran notes in a Connected Lenses session</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Veteran mode: the notes this shares and the notes it receives (its UI holds the Share notes toggle)")
  veteran: CaseLightVeteran

  @input
  @hint("The orchestrator (writes the note-sent and note-received log lines)")
  main: CaseLightMain
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Debug</span>')
  @ui.group_start("Debug")
  @input
  @hint("Seconds after Lens start for the second session-state log line (the solo evidence); 0 logs only at start")
  @widget(new SliderWidget(0, 30, 1))
  soloCheckSeconds: number = 5
  @ui.group_end

  /** Kept current for runtime inspection: the same facts as the getters, as one line. */
  stateReport: string = "not started"

  private sharingOn = false
  private requested = false
  private failed = false
  private entity: SyncEntity | null = null
  private entityReady = false
  private sent = 0
  private received = 0
  private rejected = 0
  private ignored = 0
  private last = ""

  // ── Read-only state ─────────────────────────────────────────────────────────────────────

  /** True while Share notes is on (the person's choice; nothing is shared without a session). */
  get isSharing(): boolean {
    return this.sharingOn
  }

  /** True when notes are actually being sent and received now. */
  get isActive(): boolean {
    return this.entityReady && shouldShare({ sharingOn: this.sharingOn, sessionReady: this.sessionReady(), singleplayer: this.singleplayer() })
  }

  /** "no session", "starting", "failed", "single player" or "multiplayer". */
  get sessionState(): string {
    const sc = SessionController.getInstance()
    if (sc.getIsReady()) return sc.isSingleplayer() ? "single player" : "multiplayer"
    if (this.failed) return "failed"
    return sc.getSession() !== null || this.requested ? "starting" : "no session"
  }

  get sentCount(): number {
    return this.sent
  }

  get receivedCount(): number {
    return this.received
  }

  /** Received payloads refused by the rules (not exactly a slot and a reminder). */
  get rejectedCount(): number {
    return this.rejected
  }

  /** The notes this person holds now on the route in use, "slot=text" joined by " | " (empty when none). */
  get heldNotes(): string {
    return this.veteran ? this.veteran.sharedNotesNow().map((n) => `${n.slot}=${n.note}`).join(" | ") : ""
  }

  /** The last note received, "slot=text" ("" for a removal), or empty. */
  get lastReceived(): string {
    return this.last
  }

  /** The Sync Kit's session facts, for logs and tests. */
  get sessionReport(): string {
    const sc = SessionController.getInstance()
    const session = sc.getSession()
    const state = sc.getState() as unknown as number
    let launched = false
    try {
      launched = global.launchParams.getBool("StartMultiplayer")
    } catch (e) {
      launched = false
    }
    return `startMode=${sc.getStartMode()} launchStartMultiplayer=${launched} state=${STATE_NAMES[state] || state} isSingleplayer=${sc.isSingleplayer()} session=${session === null ? "none" : "exists"} ready=${sc.getIsReady()} users=${sc.getUsers().length} connectedLensModule=${sc.connectedLensModuleToUse ? "set" : "none"}`
  }

  /** The Share notes toggle's panel (the Veteran mode panel), or null when not wired. */
  private get toggleUI(): CaseLightVeteranUI | null {
    return this.veteran && this.veteran.ui ? this.veteran.ui : null
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────────────────────

  onAwake(): void {
    this.createEvent("OnStartEvent").bind(() => this.onStart())
  }

  private onStart(): void {
    const ui = this.toggleUI
    if (ui) {
      ui.onToggleShareNotes.add(() => this.setSharing(!this.sharingOn))
      ui.setShareNotesState(false)
    }
    if (this.veteran) this.veteran.onLocalNoteChanged.add((n) => this.onLocalNote(n))
    const sc = SessionController.getInstance()
    // Never fires without a session (start mode Off and no StartMultiplayer launch).
    sc.notifyOnReady(() => this.onSessionReady())
    sc.onUserJoinedSession.add(() => this.onPeerJoined())
    sc.onConnectionFailed.add((code: string) => this.onFailed(code))
    this.report("start")
    if (this.soloCheckSeconds > 0) {
      const later = this.createEvent("DelayedCallbackEvent")
      later.bind(() => this.report(`${this.soloCheckSeconds} s after start`))
      later.reset(this.soloCheckSeconds)
    }
  }

  // ── Commands ────────────────────────────────────────────────────────────────────────────

  /** Share notes on or off (the toggle's path). On asks the Sync Kit for a session if there is none yet. */
  setSharing(on: boolean): void {
    this.sharingOn = on
    if (this.toggleUI) this.toggleUI.setShareNotesState(on)
    if (on) {
      const sc = SessionController.getInstance()
      if (!sc.getIsReady() && sc.getSession() === null && !this.requested) {
        this.requested = true
        this.failed = false
        // Start mode Off: one attempt, failures come back through onConnectionFailed.
        sc.startMultiplayer()
      } else if (this.isActive) {
        this.sendAll()
      }
    }
    this.report(on ? "share notes on" : "share notes off")
  }

  // ── Internals ───────────────────────────────────────────────────────────────────────────

  private sessionReady(): boolean {
    return SessionController.getInstance().getIsReady()
  }

  private singleplayer(): boolean {
    return SessionController.getInstance().isSingleplayer()
  }

  private onSessionReady(): void {
    const sc = SessionController.getInstance()
    if (sc.isSingleplayer()) {
      this.report("session ready, single player: not sharing")
      return
    }
    // A Lens launched into multiplayer (Active Nearby) shares from the start.
    let launched = false
    try {
      launched = global.launchParams.getBool("StartMultiplayer")
    } catch (e) {
      launched = false
    }
    if (launched && !this.sharingOn) {
      this.sharingOn = true
      if (this.toggleUI) this.toggleUI.setShareNotesState(true)
    }
    if (this.entity) return
    const entity = new SyncEntity(this, null, false, "Session", new NetworkIdOptions(NetworkIdType.Custom, NETWORK_ID))
    this.entity = entity
    entity.onEventReceived.add(NOTE_EVENT, (msg: NetworkMessage<unknown>) => this.onReceived(msg))
    entity.notifyOnReady(() => {
      this.entityReady = true
      this.report("shared-notes entity ready")
      if (this.isActive) this.sendAll()
    })
    this.report("session ready, multiplayer")
  }

  private onPeerJoined(): void {
    // Someone joined: send every note, so a late joiner sees them (networked events are not replayed).
    if (this.isActive) this.sendAll()
  }

  private onFailed(code: string): void {
    if (!this.requested) return
    this.requested = false
    this.failed = true
    this.sharingOn = false
    if (this.toggleUI) this.toggleUI.setShareNotesState(false)
    this.report(`session failed (${code})`)
  }

  private onLocalNote(n: SharedNote): void {
    if (!this.isActive) return
    this.send(n)
  }

  private sendAll(): void {
    if (!this.veteran) return
    for (const n of this.veteran.sharedNotesNow()) this.send(n)
  }

  private send(n: SharedNote): void {
    if (!this.entity) return
    // Exactly the slot and the reminder text, to the others only.
    this.entity.sendEvent(NOTE_EVENT, { slot: n.slot, note: n.note }, true)
    this.sent++
    if (this.main) this.main.logNoteShare("sent", n.slot, n.note)
    this.updateReport()
  }

  private onReceived(msg: NetworkMessage<unknown>): void {
    const sc = SessionController.getInstance()
    if (msg.senderConnectionId && msg.senderConnectionId === sc.getLocalConnectionId()) return
    if (!this.isActive) {
      this.ignored++
      this.updateReport()
      return
    }
    const n = decodeNote(msg.data)
    if (!n) {
      this.rejected++
      this.updateReport()
      return
    }
    if (this.veteran) this.veteran.applySharedNote(n)
    this.received++
    this.last = `${n.slot}=${n.note}`
    if (this.main) this.main.logNoteShare("received", n.slot, n.note)
    this.updateReport()
  }

  private updateReport(): void {
    this.stateReport = `sharing=${this.sharingOn} active=${this.isActive} session=${this.sessionState} sent=${this.sent} received=${this.received} rejected=${this.rejected} ignored=${this.ignored} held=[${this.heldNotes}] last=[${this.last}]`
  }

  private report(when: string): void {
    this.updateReport()
    print(`NOTESYNC ${when}: ${this.sessionReport}; ${this.stateReport}`)
  }
}
