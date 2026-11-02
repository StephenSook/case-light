---
status: approved
---

# Design brief: CaseLight

<!-- Filled in by plan-lens from the learner's interview. Use the learner's words. Mark any value they didn't choose as (default). -->
<!-- Source: Stephen's answers, relayed by his other session at his request (research/PLAN-LENS-ANSWERS.md, 2026-11-02). HOLD block change and sign-off typed by Stephen, 2026-11-02. -->

## The one spatial moment
I'm standing at a real-size mail case with a bundle of letters in my hand. I take the top letter and put it where I think it goes, from memory. The case stays dark. If I'm right, nothing happens and I take the next one. If I'm wrong, the right slot lights up, and if that slot is off to the side where I can't see it, a small arrow at the edge of my view points to it and goes away as I turn my head.

It is a practice drill for new city mail carriers learning their case: up to 240 one-inch slots, four to six shelves of 40, which the handbook says to memorise two rows at a time. The first pass is practice with the slots lit, the second pass is recall with the case dark.

## Why it belongs on glasses
- Uses: draws in the world, leaves your body free.
- Why it's better than the phone or laptop version: both my hands are full of mail, my eyes have to stay on the case, and the case is wider than what I can see at once. A phone would need a third hand.

## Product or overlay
- Type: product. On real glasses this would sit on a real case; for this Lens the practice case and the sample bundle are the experience.
- What the real version would sense: the address on the letter in my hand.
- Stand-in for the preview: grabbing the top piece is the read. The piece shows its sample address in big print ("1482 MAIN ST"). All addresses are a made-up sample route: no real house numbers, and no post office logos or names anywhere in the Lens.

## Where things live
- Where the user is looking during the main task: at the case, about arm's length away, with the piece in hand.
- Case: stands in front of the user at about 55 to 60 cm, world-fixed where the user starts (default). The top playable row is a little below eye level.
- Shelves: the full case is shown. Total shelf count is a setting, default 6 (a standard city case is 6 shelves of 40, 240 cells, per USPS handbooks M-41 and M-39). Overall case about 122 cm wide and 190 cm tall. Two shelves are playable and labelled, each 40 separations at real size (one inch, about 2.5 cm, wide), so each shelf is about 1 m wide, much wider than the glasses' view. The other shelves are faint unlabelled outlines and do nothing; they sit above and below the playable pair (default). Shelves are 15 cm (6 in) apart; shelf depth about 30 cm (reported, not verified). "Dark" means no slot is lit: the case itself is drawn in thin light lines so it stays visible on the additive display (default).
- Separation labels: each separation keeps its small label the whole time, including the neighbours, because a real carrier reads those too. Labels follow the handbook: a label strip under every cell, normally two house numbers per cell; each street has its own colour, a heavy line between streets, and the street name in larger type at the start of each block. Use light colours so they show on the additive display (default colours).
- Two addresses per slot: a separation can hold up to two addresses, one on the left side and one on the right, like the handbook says. A piece snaps to the correct side (default).
- Sample route: runs in delivery order, left to right along each shelf (default).
- Bundle tray: waist height, to the user's left of the case.
- HOLD block: a labelled "HOLD" block of cells on the case, at the right end of the lower playable shelf (default), like the cells the handbook reserves for hold mail. 4 cells wide (default). It is the only place the hold piece is accepted.
- Held piece: shows its address in large print, about 3 cm tall text, facing the user (default).
- Display rectangle (for the video): the preview shows a rectangle for what the glasses actually display, dimmed outside it. Size it from Snap's display table: about 23 cm wide by 38 cm tall at 55 cm, which is about 23.6 degrees wide. The hackathon guide says about 32 degrees wide, so make the width a setting, starting at 23.6 degrees (default).
- Buttons: Start practice and Start recall on the ledge at the left end, next to the bundle tray, each about 10 cm by 5 cm (default).
- Caption: a small persistent caption "Preview: sample letters" on the front edge of the ledge, not floating in front of the face (default placement).

## Hands and input
- Pick up: pinch to grab the top piece of the bundle.
- Sort: drag it to a separation and let go; it snaps to the nearest one.
- Hold: drag the hold piece to the HOLD block and let go.
- Start a pass: pinch the Start practice or Start recall button.
- While dragging, the separation the piece would snap to gets a thin outline (default). That outline is not the answer glow.
- Targets are big and highlight when aimed at.
- No custom gestures and no voice.
- The veteran's note for one address is already pinned in the sample data (author mode can come later).

## When things show
- Nothing floats in front of the user's face.
- Practice pass: the right slot glows only while the piece is in hand.
- Recall pass: nothing glows unless the user misses. After a miss, the piece comes back to the hand, and the right slot stays lit (with the edge arrow if it is off the display) until the user places it there. That piece counts as helped, not unaided.
- Edge arrow: shows at the edge of the display rectangle, on the side of the lit slot, only while that slot is outside the rectangle; hides once it is inside.
- Hold note: one sample address carries a veteran's hold note. It shows "Hold: set this piece aside" only while that piece is in hand. The right place for it is the HOLD block, not its own slot. If it is dropped in any other cell, it is refused like a miss and the HOLD block glows (default).
- Bundle: 8 pieces, including the hold piece. The count is a setting. The recall pass reuses the same 8 in a new order.
- End: after the last piece of the recall pass, the top of the case shows "Unaided: X/Y this session", then gets out of the way after about 5 seconds or when a Start button is pressed (default). Practice pieces all have the glow, so practice shows no score (default).
- Caption "Preview: sample letters" stays on the whole time.
- If something needs attention out of view: the small edge arrow. Sound comes later.

## Done criteria
Each one can be checked in Lens Studio's preview.
1. Pinching the top piece picks it up and shows its address in large print; letting go over a separation snaps it into that separation.
2. In practice, the right separation glows while the piece is in hand; when it is outside the display rectangle, an edge arrow points to it and hides once it is inside.
3. In recall, nothing glows before the drop; a wrong drop lights the right separation (with the arrow if needed) and that piece is counted as helped.
4. The held address shows "Hold: set this piece aside" only while that piece is in hand, and it is only accepted in the HOLD block.
5. After the last piece, the case shows "Unaided: X/Y this session", counting only pieces placed right with no help.

## Later (after the core passes)
- Author mode for writing veteran notes.
- More playable shelves.
- The confusion-pair drill (bringing back the two addresses I mixed up).
- Sound cues.
- Remembering progress between sessions.

Not in this Lens: reading real mail, real addresses or logos, voice, custom gestures, recording anyone. My mom is not in the Lens.

## Risks and open questions
- The preview uses a mouse, so it can't prove one-inch precision with real hands. One-inch slots are much smaller than the "few big targets" habit; snap-to-nearest carries it. Feel unproven, and I'll say so.
- Lens sound can't be recorded in the video, so the arrow is the main cue.
- The confusion-pair idea is a stretch goal only, if the core passes and the research supports it.
- At 55 to 60 cm the case sits at the near edge of comfortable viewing (the display focuses at about 1 m). Chosen for arm's reach. Feel unproven.
- Display width: Snap's design table gives about 23.6 degrees wide at 55 cm; the hackathon guide says about 32. Kept adjustable.
- Shelf depth is reported, not verified. Case size comes from USPS handbooks and surplus listings, not from measuring a real case.
- Carrier feedback from my mom's office is still pending. Nothing in this Lens claims it. If she or a carrier gives feedback, I quote them only with consent and without carrier names.

## Setup notes from research
- SIK has no drop-zone component. Snapping a piece into a separation is custom code on InteractableManipulation's onManipulationEnd; lock rotation and scale with setCanRotate(false) and setCanScale(false). (Checked in the installed SIK source.)
- Install the Asset Library package "Leaf" before running LEAF. Without it the LEAF panel fails with "MessagingBridge script asset not found". (From research/lens_api_answers.md.)
- A LEAF scenario cannot turn the head. Test the arrow logic in LEAF, and show the head turn with the MovePreviewCamera tool's rotate. (Reported, not checked here.)

## Build notes for CLAD
- Build for SPECS so it runs and can be demonstrated in Lens Studio's preview. No SPECS device is available.
- Use Spectacles Interaction Kit (SIK) and UI Kit for all interactions, so they work with the mouse in Interactive Preview and with LEAF.
- Build any stand-in exactly as described above, and keep it obvious in the scene.
- Use real-world scale in centimeters. Keep content inside the user's view during the main task.
- The display is additive: black renders as transparent. Don't rely on black or very dark content to be seen; keep text light and readable from where the user stands.
- Get the basic flow working first, then add detail.
- Write LEAF scenarios for each done criterion, run them in preview, and report which pass. Say which criteria have no test.
- Don't record, identify, or follow people.

## After the build: judge it
This part is for you, after CLAD finishes.

1. **Does it work?** Ask your agent which LEAF tests passed and which done criteria have no test.
2. **Walk around it.** Open the preview in Interactive Preview. Use WASD to move, Q and E to go down and up, and right-drag (or hold Shift) to look around. Clicking acts as a pinch. Stand where a user would and look at the task.
3. **Ask the three questions.**
   - Does it use what I'm looking at?
   - Does it put something in my space, where it belongs?
   - Does it free my hands or let me keep my eyes up?
   - Would it be just as good on a phone? If so, what would make it need the glasses?
4. **Check comfort.**
   - Everything I need is in view while I do the task. Nothing sits at the edges, behind me, or stuck to my face.
   - Every control is within reach of someone standing there.
   - Text reads easily from where I stand. No dark UI disappearing.
   - Things show when needed and get out of the way.
5. **Label what you know.** Write "logic proven" next to anything the tests and preview show working, and "feel unproven" next to anything only real glasses could tell you (comfort over time, real hand tracking, real recognition).
6. **Fix with design notes, not code.** Tell your agent what to change in design terms, for example: "Move the step card 15 cm lower and next to the pan. Make the Next button twice as big. Re-run the tests." If a fix takes under a minute, like nudging a panel, do it yourself in the scene.
7. **Submit.** Record a video under 3 minutes of your Lens in the preview, public on YouTube. Make your repo public with your Lens Studio project and this `devpost/` folder. Details are on the hackathon site: https://learn-specs.devpost.com/resources
