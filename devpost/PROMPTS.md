# Prompt log: how each build round was started

How this Lens was built:
- I typed `plan-lens` and the final sign-off myself. My interview answers were drafted at my request by my planning chat, from my own research and the decisions I made there. The idea, the mom connection and the hold-block change are mine. I read the brief (`devpost/design-brief.md`) and approved it.
- The build ran in a Claude Code chat with CLAD and the Lens Studio MCP (the "builder chat").
- I planned and researched in a second Claude Code chat. The build prompts below were written there from my decisions and sent to the builder chat. Each one starts with "From the Mac orchestrator", so it's clear they weren't typed by me.

Times are Eastern, 2 November 2026. `devpost/BUILD_LOG.md` has one row per CLAD session: what was asked, what was done, tool calls and minutes.

## Typed by me in the builder chat

| Time | Prompt (verbatim) |
|---|---|
| 00:00 | `plan-lens` |
| 00:16 | "looks good, but put the hold piece in a labelled HOLD block of cells on the case instead of the aside tray. Then read CLAUDE.local.md and start the build in this chat: Read devpost/design-brief.md and build it for SPECS. Follow the brief closely. Get the basic flow working first, then add detail. Write and run LEAF tests for each done criterion, and tell me which pass." |

## Sent from my planning chat to the builder chat

| Time | What it asked for |
|---|---|
| 00:04 to 00:15 | My plan-lens answers (drafted from my research at my request), my decisions on the brief's defaults, two research corrections. The builder asked for the sign-off to come from me, so I typed it (above) |
| 01:53 | My answers to the builder's two questions, and the next build queue |
| 02:48 | Next pass: the edge arrow on head turns, depth, the drill |
| 03:20 to 03:36 | Small fixes from outside checks, one prompt each: onboarding, a performance trace and a clear exit, a five-second first-look test, the Snap publishing checklist (version label, icon, a way to repeat), Snap design best practices, target sizing, practice ladder and mix-up lines |
| 04:17 | Fix the issues an outside test-quality review found |
| 06:40 | Round 7: known issues, then the film stills |
| 08:29 | Two clarity fixes from the film stills |
| 11:49 | Record the decisions made for me under my delegation (they are in BUILD_LOG under "Confirmed on 2 November") |
| 13:43 | v0.5: real OpenStreetMap house numbers on four streets near KSU, keeping every practice slot |
| 14:23 | v0.6: put the case on a real wall, bring missed letters back sooner, notes at the slot |
| 14:25 | Notes at the slot become three sorting reminders that name no house number (the builder caught that a note about a real home would break the privacy rule) |
| 14:33 | Data for a second route ("today's route" picker), after a carrier's tip that new carriers are moved between routes |
| 14:50 to 15:13 | Moving the case keeps your progress; checked World Query facts; a queue of evidence and test items (a session log a stranger can recompute, unit tests in CI, a Python reference check, a demo replay mode, a case-check pass, README sections) |

The full text of every prompt is in the two local chat transcripts. The short descriptions above leave out operational notes such as memory limits, status pings and file paths.
