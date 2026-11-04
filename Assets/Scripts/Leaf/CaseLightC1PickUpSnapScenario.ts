// Owns: the LEAF check for done criterion 1 (pinch picks up the top piece, its address shows large on a plain card, letting go snaps it into the separation) plus both Start hint lines and the version label.
// Talks to: CaseLightLeafSupport (real SIK/UIKit input and assertions), CaseLightMain read-only getters, scene objects by name (StartHint, StartHintLine2, VersionLabel, Piece_n, AddressText, SnapOutline).
// Must not: call CaseLightMain's test hooks or commands, or change product state except through real input.

/**
 * Done criterion 1 (devpost/design-brief.md):
 * "Pinching the top piece picks it up and shows its address in large print; letting go over a
 * separation snaps it into that separation."
 *
 * Input: REAL (LEAF SIK interactor). Start practice is a UIKit button press; the letters are
 * grabbed, moved and let go through SIK InteractableManipulation. No test hooks are called.
 * Positive controls: every "hidden / not" check comes after the same detector has seen the
 * thing shown (hint, hint line 2, address, plain card, placed, grabbable, held). After release
 * the letter's own mesh must be the tray look again (an untouched tray letter's mesh, after the
 * held look is seen to differ from it), and the held address is measured by its rendered box in
 * the letter's own frame (Text local box through its transform into the letter's space). The
 * letter size and print width come from CaseLightMain's getters, checked against the drawn letter
 * (letterDims); the rendered line box must be at least the requested capital height and sit
 * inside the print width. The brief's "about 3 cm" is logged beside the build's value.
 * Also: the version read-out and the VersionLabel text both read "v0.7".
 */
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {
  CaseLightLeafInteractor,
  addressBoxOnLetter,
  hideLeafOverlay,
  letterDims,
  targetOf,
  expectHint,
  expectHintLine2,
  fmt,
  log,
  mustFind,
  neighbourSlot,
  pieceInteractable,
  waitForReady,
  waitForTopGrabbable,
} from "./CaseLightLeafSupport"

/** What the design brief asks for the held address: "about 3 cm tall text". Logged against the build. */
const BRIEF_TEXT_CM = 3

function addressText(piece: number): Text {
  const card = mustFind(`Piece_${piece}`).getChild(0)
  for (let i = 0; i < card.getChildrenCount(); i++) {
    const c = card.getChild(i)
    if (c.name === "AddressText") return c.getComponent("Component.Text") as Text
  }
  throw new Error(`AddressText not found under Piece_${piece}`)
}

function pieceMesh(piece: number): RenderMesh {
  return (mustFind(`Piece_${piece}`).getComponent("Component.RenderMeshVisual") as RenderMeshVisual).mesh
}

@component
export class CaseLightC1PickUpSnapScenario extends Scenario {
  async run(): Promise<void> {
    const main = await waitForReady()
    const ix = new CaseLightLeafInteractor()
    const dims = letterDims(main)
    const cap = main.addressCapHeightCm
    log(`C1 letter ${dims.w} x ${dims.h} cm, print width ${dims.print} cm, address capitals requested ${cap} cm (brief: about ${BRIEF_TEXT_CM} cm)`)

    // Version: the read-out and the label on screen agree on the build.
    const versionLabel = mustFind("VersionLabel").getComponent("Component.Text") as Text
    log(`C1 versionText="${main.versionText}" VersionLabel="${versionLabel.text}"`)
    expect(main.versionText, "versionText").toBe("v0.7")
    expect(versionLabel.text, "VersionLabel text").toBe("v0.7")

    // Idle: both hint lines show (positive controls), the letters cannot be picked up yet.
    expect(main.mode, "idle at start").toBe("idle")
    expectHint(main, true, "idle, before any Start press")
    expectHintLine2(main, true, "idle, before any Start press")
    const line2 = mustFind("StartHintLine2").getComponent("Component.Text") as Text
    expect(line2.text, "hint line 2 text").toBe("Practice, then the case goes dark.")
    const grabbableWhileIdle = !!pieceInteractable(0)

    await ix.pressButton("StartPracticeButton")
    expect(main.mode, "mode after pressing Start practice").toBe("practice")
    expectHint(main, false, "after the opening Start press")
    expectHintLine2(main, false, "after the opening Start press")
    const top = await waitForTopGrabbable(main)
    expect(top, "top piece of the practice bundle").toBe(0)
    // Positive control for the grabbable detector, then the idle observation.
    expect(!!pieceInteractable(0), "Piece_0 grabbable once practice starts").toBe(true)
    expect(grabbableWhileIdle, "Piece_0 grabbable while idle (before Start)").toBe(false)

    // --- Pick up the top piece: address shows in large print while in hand. ---
    const target = targetOf(main, top)
    let held = -9
    let addrEnabled = false
    let addrString = ""
    let addrSize = 0
    let addrVisibleGetter = false
    let plainWhileHeld = false
    // The piece's own mesh: held look, tray look (an untouched tray letter), and after release.
    let heldMesh = null as RenderMesh | null
    let trayMesh = null as RenderMesh | null
    let meshAfter = null as RenderMesh | null
    // The held address's rendered box, in the letter's own frame (the letter turns to face the eye,
    // so a world axis-aligned box would mix in its depth), and the Text's own local box.
    let addrLo = vec3.zero()
    let addrHi = vec3.zero()
    let textLocal = ""
    let snapPreview = -9
    let snapOutlineOn = false
    let placedAfter = false
    let posAfter = vec3.zero()
    await ix.dropTopPieceAtSlot(main, target, {
      onHeld: () => {
        held = main.heldPieceIndex
        const t = addressText(top)
        addrEnabled = t.getSceneObject().enabled
        addrString = t.text
        addrSize = t.size
        addrVisibleGetter = main.isAddressVisible
        plainWhileHeld = main.isHeldCardPlain
        heldMesh = pieceMesh(top)
        trayMesh = pieceMesh(main.pieceCount - 1)
        const box = addressBoxOnLetter(top)
        addrLo = box.lo
        addrHi = box.hi
        textLocal = box.textLocal
      },
      beforeRelease: () => {
        snapPreview = main.snapPreviewSlotIndex
        snapOutlineOn = mustFind("SnapOutline").enabled
      },
      afterRelease: () => {
        placedAfter = main.isPiecePlaced(top)
        posAfter = mustFind(`Piece_${top}`).getTransform().getWorldPosition()
        meshAfter = pieceMesh(top)
      },
    })
    // Held card: plain white card while in hand. After letting go the piece's OWN mesh is checked
    // (isHeldCardPlain reads the held piece, which is none after release, so it cannot fail there).
    expect(plainWhileHeld, "isHeldCardPlain while the letter is in hand").toBe(true)
    const hm = heldMesh
    const tm = trayMesh
    const am = meshAfter
    if (!hm || !tm || !am) throw new Error("piece meshes not captured")
    expect(hm.isSame(tm), "held look differs from the tray look (positive control)").toBe(false)
    expect(am.isSame(hm), `Piece_${top} mesh after release is still the held look`).toBe(false)
    expect(am.isSame(tm), `Piece_${top} mesh after release is the tray look again`).toBe(true)
    // Address as rendered, in the letter's frame (letter centred on its origin): the line box is at
    // least the requested capital height, it is narrower than the print width, and it sits on the letter.
    const ah = addrHi.y - addrLo.y
    const aw = addrHi.x - addrLo.x
    log(`C1 address box on the letter ${fmt(addrLo)}..${fmt(addrHi)} (w ${aw.toFixed(2)} h ${ah.toFixed(2)} cm); Text local box ${textLocal}`)
    expect(ah >= cap, `rendered address line height ${ah.toFixed(2)} cm covers the requested ${cap} cm capitals`).toBe(true)
    expect(ah < dims.h, `rendered address height ${ah.toFixed(2)} cm fits on the ${dims.h} cm letter`).toBe(true)
    expect(aw > dims.print / 3 && aw <= dims.print, `rendered address width ${aw.toFixed(2)} cm fits the ${dims.print} cm print width`).toBe(true)
    const onCard = addrLo.x >= -dims.w / 2 && addrHi.x <= dims.w / 2 && addrLo.y >= -dims.h / 2 && addrHi.y <= dims.h / 2
    expect(onCard, `rendered address sits on the held letter (${fmt(addrLo)}..${fmt(addrHi)})`).toBe(true)
    log(`C1 held=${held} addr="${addrString}" enabled=${addrEnabled} Text.size=${addrSize.toFixed(1)} snapPreview=${snapPreview}`)
    log(`C1 BRIEF: the brief asks for about ${BRIEF_TEXT_CM} cm address text; this build requests ${cap} cm capitals (line box ${ah.toFixed(2)} cm)`)
    expect(held, "piece in hand after pinch").toBe(top)
    expect(addrEnabled, "AddressText enabled while in hand").toBe(true)
    expect(addrVisibleGetter, "isAddressVisible while in hand").toBe(true)
    expect(addrString, "address printed on the held piece").toBe(main.addressOf(top))
    expect(addrString, "address of piece 0 (a real house number from OpenStreetMap)").toBe("2195 FAIRWAYS CT")
    expect(snapPreview, "thin snap outline on the separation under the piece").toBe(target)
    expect(snapOutlineOn, "SnapOutline scene object enabled while aimed").toBe(true)

    // --- Let go over the separation: it snaps into that separation. ---
    expect(main.lastDropResult, "drop result").toBe("correct")
    expect(main.lastDropSlot, "drop slot").toBe(target)
    expect(placedAfter, "piece placed right after release").toBe(true)
    expect(main.isPiecePlaced(top), "piece stays placed").toBe(true)
    expect(main.heldPieceIndex, "nothing in hand after release").toBe(-1)
    expect(addressText(top).getSceneObject().enabled, "address hidden after letting go").toBe(false)
    expect(main.isAddressVisible, "isAddressVisible after letting go").toBe(false)
    const c = main.slotWorldPosition(target)
    log(`C1 placed at ${fmt(posAfter)} slot ${target} opening centre ${fmt(c)}`)
    expect(Math.abs(posAfter.x - c.x) < 1.27, `placed piece inside separation ${target} across (dx ${(posAfter.x - c.x).toFixed(2)})`).toBe(true)
    expect(Math.abs(posAfter.y - c.y) < 6.1, `placed piece inside separation ${target} up/down (dy ${(posAfter.y - c.y).toFixed(2)})`).toBe(true)
    expect(posAfter.z < c.z && posAfter.z > c.z - 30, `placed piece inside the separation depth (z ${posAfter.z.toFixed(2)})`).toBe(true)

    // --- The next piece: address hidden before pick-up (after the positive control above). ---
    const top2 = await waitForTopGrabbable(main)
    expect(addressText(top2).getSceneObject().enabled, `Piece_${top2} address hidden before pick-up`).toBe(false)

    // --- A drop over a different separation also snaps into THAT separation (then returns). ---
    const wrong = neighbourSlot(targetOf(main, top2))
    let snapPos = vec3.zero()
    let addr2Held = false
    await ix.dropTopPieceAtSlot(main, wrong, {
      onHeld: () => {
        addr2Held = addressText(top2).getSceneObject().enabled
      },
      afterRelease: () => {
        snapPos = mustFind(`Piece_${top2}`).getTransform().getWorldPosition()
      },
    })
    const w = main.slotWorldPosition(wrong)
    log(`C1 wrong drop piece ${top2} over slot ${wrong}: result=${main.lastDropResult} snapped at ${fmt(snapPos)} vs opening ${fmt(w)}`)
    expect(addr2Held, `Piece_${top2} address shows while in hand`).toBe(true)
    expect(main.lastDropSlot, "second drop slot").toBe(wrong)
    expect(Math.abs(snapPos.x - w.x) < 1.27, `snapped into separation ${wrong} (dx ${(snapPos.x - w.x).toFixed(2)})`).toBe(true)
    expect(Math.abs(snapPos.y - w.y) < 6.1, `snapped into separation ${wrong} (dy ${(snapPos.y - w.y).toFixed(2)})`).toBe(true)
    expect(main.isPiecePlaced(top2), "wrong separation does not keep the piece").toBe(false)
    const back = await waitForTopGrabbable(main)
    expect(back, "the same piece comes back to the bundle top").toBe(top2)
    expectHint(main, false, "hint stays hidden during the pass")
    expectHintLine2(main, false, "hint line 2 stays hidden during the pass")
    log("C1 done")
    await hideLeafOverlay()
  }
}
