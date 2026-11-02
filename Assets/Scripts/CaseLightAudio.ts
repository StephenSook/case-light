// Owns: the two short cue sounds (soft chime, low miss tone) and where in space they play from.
// Talks to: CaseLightMain, which calls playAt(kind, worldPoint); SIK's WorldCameraFinderProvider (to add a listener to the camera).
// Must not: decide when a cue plays or hold session state; nothing in the Lens may depend on hearing these.

/**
 * Two AudioComponents on child sources ChimeSource and MissSource. Before each play the source is
 * moved to the cell the cue refers to, and spatial audio (position + distance effects) is on, so
 * the sound comes from that cell, including a cell outside the glasses' view. Playback mode is
 * LowLatency because the cues answer the user's own drop (ls-clad:specs-audio), set in
 * OnStartEvent. Specs ignores the Mix to Snap flag (always on); the Lens Studio preview recording
 * may not capture Lens audio, so CaseLightMain also exposes read-outs of every cue.
 */

import WorldCameraFinderProvider from "SpectaclesInteractionKit.lspkg/Providers/CameraProvider/WorldCameraFinderProvider"

export type CueKind = "chime" | "miss"

@component
export class CaseLightAudio extends BaseScriptComponent {
  @ui.label('<span style="color: #60A5FA;">CaseLightAudio - chime on a right drop, low tone on a miss</span>')
  @ui.separator
  @ui.label('<span style="color: #60A5FA;">References</span>')
  @ui.group_start("References")
  @input
  @hint("Short soft chime played from the cell a letter snapped into correctly")
  chimeTrack: AudioTrackAsset

  @input
  @hint("Short low tone played from the right cell after a miss (or the HOLD block after a refused hold drop)")
  missTrack: AudioTrackAsset
  @ui.group_end

  @ui.separator
  @ui.label('<span style="color: #60A5FA;">Settings</span>')
  @ui.group_start("Settings")
  @input
  @widget(new SliderWidget(0, 1, 0.05))
  @hint("Cue volume (kept quiet: the cues are a bonus, never required)")
  volume: number = 0.5

  @input
  @hint("Play the cues spatially from the cell they refer to")
  spatial: boolean = true
  @ui.group_end

  private chime: AudioComponent | null = null
  private miss: AudioComponent | null = null
  private played = 0

  /** Cues issued since the Lens began. */
  get cuesPlayed(): number {
    return this.played
  }

  onAwake(): void {
    this.chime = this.makeSource("ChimeSource", this.chimeTrack)
    this.miss = this.makeSource("MissSource", this.missTrack)
    this.createEvent("OnStartEvent").bind(() => {
      // Playback mode is script-only and belongs in OnStartEvent (ls-clad:specs-audio).
      for (const a of [this.chime, this.miss]) {
        if (a) a.playbackMode = Audio.PlaybackMode.LowLatency
      }
      this.ensureListener()
    })
  }

  /** Play a cue from a world point. Returns false when the cue has no track. */
  playAt(kind: CueKind, worldPoint: vec3): boolean {
    const a = kind === "chime" ? this.chime : this.miss
    if (!a || !a.audioTrack) return false
    a.getSceneObject().getTransform().setWorldPosition(worldPoint)
    if (a.isPlaying()) a.stop(false)
    a.play(1)
    this.played++
    return true
  }

  private makeSource(name: string, track: AudioTrackAsset): AudioComponent {
    const so = global.scene.createSceneObject(name)
    so.setParent(this.sceneObject)
    const a = so.createComponent("Component.AudioComponent") as AudioComponent
    if (track) a.audioTrack = track
    a.volume = this.volume
    a.spatialAudio.enabled = this.spatial
    if (this.spatial) {
      a.spatialAudio.positionEffect.enabled = true
      a.spatialAudio.distanceEffect.enabled = true
      a.spatialAudio.distanceEffect.type = Audio.DistanceCurveType.Inverse
      a.spatialAudio.distanceEffect.minDistance = 30
      a.spatialAudio.distanceEffect.maxDistance = 400
    }
    return a
  }

  /** Spatial audio is heard relative to an AudioListenerComponent; put one on the camera if none exists. */
  private ensureListener(): void {
    if (!this.spatial) return
    const camObj = WorldCameraFinderProvider.getInstance().getComponent().getSceneObject()
    if (camObj.getComponent("Component.AudioListenerComponent")) return
    camObj.createComponent("Component.AudioListenerComponent")
  }
}
