# Third-party notices and provenance

Everything in this repository that is not original work for Case Light, where it came from, and on what terms.
Where a license name is not stated by the source itself, this file says so instead of guessing.

## Data

| What | Where in this repo | Source | Terms |
|---|---|---|---|
| House numbers and street names, Route 1 (4 streets) and Route 2 (8 streets) near Kennesaw State University | `data/case_light_route_osm.json`, `data/case_light_route_osm_b.json`, the generated tables in `Assets/Scripts/CaseLightRoute.ts`, the test copies in `Assets/Scripts/Leaf/CaseLightRouteFixture.ts` and `tests/fixtures/` | OpenStreetMap API map calls on 2 November 2026 (bounding boxes in `data/ATTRIBUTION.md`) | (c) OpenStreetMap contributors, Open Database License (ODbL 1.0), https://www.openstreetmap.org/copyright. Credited in the Lens itself ("Address data (c) OpenStreetMap contributors"). |
| Case layout rules (40 one-inch separations per shelf, the delivery loop order) | encoded in the route generator and `CaseLightRoute.ts`; cited in `devpost/` | USPS handbooks M-41 and M-39 (public documents) | Facts cited, no text copied. This is practice mail, not a USPS route. |

## Lens Studio packages (installed from the Lens Studio Asset Library)

| Package | Version | Where | Publisher |
|---|---|---|---|
| Spectacles Interaction Kit (SIK) | package 2.0.0 (prints "SIK Version : 0.18.0" at runtime) | `Packages/SpectaclesInteractionKit.lspkg` | Snap Inc. |
| Spectacles UI Kit | 2.0.0 | `Packages/SpectaclesUIKit.lspkg` | Snap Inc. |
| LEAF (test framework) | 2.0.2 | `Packages/Leaf.lspkg` | Snap Inc. |
| AiPreviewAgent Inspect and Interact (preview test tooling) | 2.0.1 each | `Packages/AiPreviewAgentInspect.lspkg`, `Packages/AiPreviewAgentInteract.lspkg` | Snap Inc. |
| Bitmoji 3D (a declared dependency of LEAF 2.0.2, listed in LEAF's `package_dependencies.json`, used by LEAF's hand-and-body visualizer; the Lens itself does not use it) | 10.0.1 | `Packages/Bitmoji 3D.lsc` | Snap Inc. |
| Specs3DHandHints (the animated hand of the opening pinch hint; the Asset Library's newer "3D Hints" 4.0.0 was not used because it needs Interaction Kit and UI Kit 4.0.0) | 2.0.0 | `Packages/3D Hints.lspkg` | Snap Inc. |
| Utilities (a declared dependency of Specs3DHandHints 2.0.0) | 2.0.0 | `Packages/Utilities.lspkg` | Snap Inc. |
| SnapDecorators (a declared dependency of Specs3DHandHints 2.0.0) | 2.0.0 | `Packages/SnapDecorators.lspkg` | Snap Inc. |

Versions are as Lens Studio 5.23.2 reports them for this project. No LICENSE file and no license field was found inside any of these packages (every file in each archive searched on 2 November 2026, and the three hint packages on 3 November 2026), so they are used under the terms that ship with Lens Studio and each package, and this file does not name a license for them. One file inside SIK carries its own notice, quoted as written: `Package/Assets/Utils/OneEuroFilter.ts` in `Packages/SpectaclesInteractionKit.lspkg`, "Copyright 2019 Inria" and "BSD License https://opensource.org/licenses/BSD-3-Clause".

## From the tools used to build it

| What | Where | Source | Terms |
|---|---|---|---|
| Vertex colour material and shader for the case mesh | `Assets/SimpleVertexBaseColor.lspkg` | Bundled with CLAD's `mesh-builder-scripting` skill (ls-clad plugin) | The skill's files are marked "Copyright 2026 Specs Inc., SPDX-License-Identifier: Apache-2.0". |
| Environment map, device camera texture, render target | `Assets/Render/` (`Echopark.hdr` and two render assets) | Lens Studio 5.23.2's new-project defaults | Lens Studio's terms. |
| Lens icon | `icon.png`, `devpost/media/lens-icon.png` | Generated with Lens Studio's lens icon generator (the project is marked as having a generated icon) | Generated for this project. |
| Text font | none in the repo | Lens Studio's default font, used by the Text components | Lens Studio's terms. |
| Plan-lens interview skill | not stored in this repo | Devpost "Learn AR with SPECS" skill pack, run in Claude Code | The design brief it produced (`devpost/design-brief.md`) records Stephen's own answers. |

## Provenance at a glance

| Kind | What |
|---|---|
| New work for Case Light | All scripts in `Assets/Scripts/` (the Lens) and `Assets/Scripts/Leaf/` (its LEAF tests), the scene, the glow shader graph (`Assets/Materials/`), `data/` generators, `tools/`, `tests/`, `devpost/`. Written by the CLAD agents and the coordinating agent in Lens Studio, under Stephen's direction; every session is listed in `devpost/BUILD_LOG.md`. |
| Generated for this project | The two sounds in `Assets/GeneratedSFX/` (synthesised tones from a short Python script, no samples), the Lens icon, the demo replay recording (`data/demo_replay_s1-g3nddr.log`, copied from a LEAF test run's log). |
| Pre-existing, used as is | OpenStreetMap data (ODbL), the Lens Studio packages above, CLAD's vertex colour material, Lens Studio's default render assets and font. |

The project's own license is in `LICENSE` (MIT). It covers the new work above, not the third-party material listed here.
