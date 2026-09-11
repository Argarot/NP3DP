# Product requirements

**Status: approved for implementation on 11 September 2026.** The product manager authorized building with logged defaults for low-impact decisions, discussion for major decisions, a visible result each session, and current documentation. Hardware facts, distribution licensing and numerical physical-accuracy targets remain open as recorded in [decisions](decisions.md). [Implementation status](status.md) distinguishes built capabilities from acceptance gates.

## Purpose

Create an experimental deposition studio that expands what existing 3D printers can make through deliberately designed geometry, extrusion, movement, pauses, cooling, and material behavior. Makers should build with arches, triangles, bridges, sagging strands, free-space loops, sinusoidal walls, and combinations of these methods. Each family needs meaningful controls and previews of both motion and the predicted printed result.

Creative freedom takes priority over guaranteed print success. A failed or unstable print is an acceptable experimental outcome; incorrect command generation or a misleading claim about the preview is a software defect. The product is a procedural design and manufacturing environment, with continuous vase printing as one supported strategy rather than a universal constraint.

The first physical reference remains an open decorative vase on the product manager's Prusa MINI+, with a 0.4 mm nozzle and white or black eSUN PLA, for dry use or a liner. That reference anchors initial testing; it does not define the ceiling of the product.

## Confirmed requirements

- Web application as the intended product form.
- Serve the app from GitHub with source available in the local checkout. GitHub Pages plus a local development server is the proposed implementation.
- Reuse existing PrusaSlicer/SuperSlicer profiles where appropriate; do not recreate a complete printer/material database.
- Parametric control of overall geometry, including base/top diameter and curvature.
- Non-circular cross-sections and twist in the first release.
- An experimental playground with freely combined Z/radial/speed/extrusion effects in the first release.
- Design recipe download/upload with selected recipes versioned through normal Git workflow; no automatic in-app commits.
- A 3D representation of the design and generation of custom G-code.
- Continuous vase paths where appropriate, plus intentional starts, stops, travel, anchoring, and staged deposition where a method requires them.
- Arches, triangular/chevron structures, sinusoidal walls, sagging loops, pause-and-move bridging, and free-space loop deposition as explicit generative methods with sliders.
- Accurate physical simulation of filament behavior as a required development track, with progressively measured fidelity and a useful printed-result preview from early versions.
- Multi-printer compatibility as a required roadmap capability, using reusable profiles and printer-specific execution behavior.
- Integrated lamp brackets and socket interfaces as required roadmap capabilities, alongside vases, lampshades, and baskets.
- Favor options and experimentation over guaranteed print stability; show process uncertainty without restricting editing to proven presets.
- Research, documented scope, milestones, gates, visual explanations, and licensing discipline.
- The product manager controls major decisions. The lead developer logs reversible defaults, implements, and reviews delegated work.

These are product requirements, including those scheduled after the first alpha. Milestone timing and numerical acceptance targets remain proposals until approved. Later scheduling does not make a required capability an excluded feature.

## Proposed initial user and workflow

The first tester is the product manager using a desktop browser and the confirmed MINI configuration. Public self-service use follows evidence from that workflow.

1. Select the recorded printer/material profile.
2. Choose an overall form, cross-section, curvature, and twist; define where structures and their anchor regions belong.
3. Choose or combine deposition methods and adjust their geometry and process sliders, optionally starting from a reference recipe.
4. Scrub the motion timeline and inspect the predicted printed structure, including intended gaps, sag, and contact. See the simulation model, its accuracy scope, and uncertain regions.
5. Generate a small calibration sample when the chosen process parameters are untested.
6. Save the project recipe and download a checked export plus its validation information.
7. Print manually, record the result, and associate it with the exact recipe and profile revision.

## Foundation and proposed early-alpha requirements

| ID | Requirement | Acceptance evidence |
|---|---|---|
| R01 | Edit vase profiles with circular and non-circular sections, dimensions, curvature handles, and twist. | Controls and dimensions agree; invalid/degenerate contours produce useful errors; twisted contours and joins have reference fixtures. |
| R02 | Generate structurally distinct methods and compose geometry, speed, and extrusion controls. | Deterministic method selection/order/phase/units verified. Agreed alpha includes sinusoidal walls, triangles, arches, and an initial pause-and-move bridge sequence; sagging/free-space loops follow. |
| R03 | Preserve the intended deposition sequence, including continuous regions and deliberate interruptions. | No unintended jumps/travel/retractions; anchoring, dwell, extrusion, travel, cooling changes, and joins retain their intended order and state. |
| R04 | Provide nominal shape, commanded motion, estimated executed motion, and predicted deposited-structure views. | Commanded path agrees with export. Time scrub shows extrusion/pauses/travel; the material view distinguishes unsupported spans and sag from the nozzle path, with declared model limits. |
| R05 | Show dimensions, estimated filament use, and bounded/qualified duration estimates. | Volume is checked against numerical fixtures; duration is labeled as an estimate unless calibrated to firmware execution. |
| R06 | Check the complete planned job and classify diagnostics by meaning. | Malformed or unresolvable instructions rejected; machine and deposition bounds distinguished. Expected sag, intentional gaps, uncertain bonding and untested parameters reported as experimental outcomes, not automatically rejected as defects. |
| R07 | Produce text G-code for the recorded MINI firmware/profile. | Independently parsed output matches the planned modal state, trajectory, and extrusion within agreed tolerances. |
| R08 | Save/load a versioned editable project. | Round trip preserves geometry, parameters, and profile references; unsupported versions fail clearly or migrate explicitly. |
| R09 | Generate reproducible calibration samples. | A sample and its recorded result identify engine, recipe, firmware, material, and printer/profile revisions. |
| R10 | Keep the editor usable during expensive work. | Progress/cancel works; UI remains responsive on the agreed reference machine and job; resource ceilings fail gracefully. |
| R11 | Record dependency/license provenance and release validation. | Exact dependency versions, licenses, notices, build checks, test evidence, and known limitations are present before release. |
| R12 | Provide accessible labeled controls and actionable diagnostics. | Keyboard flow, numeric inputs, focus, and error explanations are checked in the chosen browser. |
| R13 | Import baseline printer/material settings from an explicitly supported slicer profile format. | Versioned fixture mapping handles required fields, inheritance/flattening rules, units, compatibility, and unknown fields; unresolved required settings block export. |
| R14 | Build for GitHub Pages and local execution. | Identical engine output in both modes; repository subpath, assets/workers, refresh behavior, and reproducible build checked. |
| R15 | Let users place and repeat deposition primitives over regions or between anchors, beyond an external perimeter. | At least one recipe contains independently defined anchored spans and explicit timed events; it cannot be implemented solely as a perimeter offset. |
| R16 | Provide named, unit-aware sliders for every implemented method and local parameter envelopes. | Editing a parameter regenerates the recipe, motion and material preview consistently; unsupported combinations and unchanged physical parameters are explained. |

Thresholds for numerical error, geometric simplification, response latency, job size, dimensions, and physical print quality must be agreed before the corresponding gate. They are intentionally not invented here. “Within printer limits” means limits in an identified profile and their stated assumptions, not universal validation.

## Deposition methods and controls

The engine must represent geometry, time/process events, and relationships between deposited strands. Sinusoidal modulation is one primitive family. The proposed controls below describe functional intent; final UI groupings and parameter ranges are part of the design review.

| Method | Proposed geometry sliders | Proposed process sliders and preview needs |
|---|---|---|
| Sinusoidal walls / weave | Amplitude, wavelength/count, phase, pitch, radial/Z mix | Speed, extrusion factor; show turn contact, gaps and local descent. |
| Triangles / chevrons | Span, height, angle, pitch, corner radius, alternation | Segment speed/extrusion and vertex dwell; distinguish a sharp commanded vertex from a physically rounded or softened result. |
| Arches | Anchor separation, rise, curvature, orientation, repetition | Anchor deposition, speed/flow profile, cooling and timing; distinguish commanded arch from material sag or stretching. |
| Pause-and-move bridges | Span, anchor position, offset and lift | Anchor time, dwell/cooling time, move speed, extrusion during each phase; show the sequence and predicted bridge shape. |
| Sagging loops | Anchor spacing, target droop, loop spacing, orientation | Deposited length/overfeed, flow, movement, temperature/cooling; show predicted sag and uncertainty. Target droop is design intent, not a guarantee of exact inversion. |
| Free-space loops | Loop size, tilt, trajectory, spacing and attachment pattern | Extrusion, speed, pauses and cooling; predict evolving unsupported strands, contact and collapse within the model's scope. |

Compose these methods across height bands, around a form, or between anchors. Support explicit process phases such as anchor, extrude-and-move, dwell, travel, and reconnect. A dwell and stationary extrusion are distinct operations. Cooling, pressure history and deposition timing belong in the recipe and prediction model where supported; they cannot be replaced by deforming XYZ coordinates alone.

Continuous vase mode is a useful option for suitable regions. A method may deliberately interrupt it to form a bridge, attachment, or separate structural region. Tested reference recipes remain starting points, not creative limits.

Choose one primary spacing convention for the initial UI: wave count is simple but changes feature spacing with circumference; physical wavelength is intuitive for feature size but complicates phase alignment over changing profiles. Settle this during the profile/pattern design review. Do not expose two contradictory controls without explaining which one governs generation.

An experimental method must not inherit a “tested” label from another combination. Store evidence separately from preset names. The recommended export policy preserves experimental parameter choices without silently clamping them back to successful prints. Unsupported spans, likely collapse, uncertain adhesion or uncertain simulation are visible advisory results. Malformed instructions, unresolved essential machine state, and established violations of machine travel/command limits remain a separate class of engineering errors. Exact handling of uncertain printhead contact remains an approval decision; intended strand contact is part of the method.

## Required later capabilities and traceability

| ID | Required capability | Proposed milestone | Acceptance direction |
|---|---|---|---|
| R17 | Sagging and free-space loop deposition, including timed anchor/bridge strategies | M6, with initial bridging in the alpha | User-controlled recipes, coherent process sequence, predicted material behavior, and recorded physical examples with both successful and failed regions. |
| R18 | Accurate physical simulation of filament | Early approximation in M3/M4; validated higher fidelity in M7 | Compare predicted shape and dynamics with independent measured prints; quantify error and applicability instead of claiming universal accuracy. |
| R19 | Integrated lamp brackets and socket interfaces | M8 | Parametric hardware features integrated with the decorative structure and toolpath plan; fit/retention/access/clearance evidence for selected fittings. A separate adapter alone does not satisfy this requirement. |
| R20 | Multi-printer compatibility | Interfaces in M1; additional tested hardware in M9 | Re-target the same recipe through distinct profiles/dialects, recompute timing/physics, and verify output and physical results on a second printer before claiming tested compatibility. |

## Preview and physical simulation

Provide four distinct, connected representations: design intent, commanded tool motion, estimated executed motion, and predicted deposited material. The material view must evolve during timeline playback and can differ visibly from the nozzle trajectory. For example, a strand deposited between anchors may sag while its nozzle path is straight.

The early preview should be quantitatively useful within a documented scope, with progressive refinement after slider changes. A geometric bead display may be a baseline or fallback, but it must not be presented as the complete solution for bridges, loops, or sag. Proposed next levels are calibrated deposition/span approximations and a dynamic model accounting for relevant cooling, gravity, tension/stretch, flow/pressure response, and contact. The eventual accuracy target is a required engineering objective, not an excluded feature.

For each prediction, retain the solver/model version, source process profile, calibrated domain, and evidence. Display uncertainty or an explicit unsupported-model state outside that domain; do not invent numerical confidence. Let users run experiments outside the prediction domain and record observations.

Define accuracy before accepting a model: compare measured versus predicted sag/strand centerline, deposited width or diameter, anchor/contact locations, openings, and time-dependent shape where relevant. Separate calibration prints from held-out validation prints and include failing cases. Set numerical tolerances and interactive/quality-mode latency budgets at the relevant gate. No exact tolerance is approved yet.

Keep the GitHub-hosted app and local run path. Evaluate browser workers/WASM and progressive fidelity first; if a high-fidelity solver requires a local companion or server, present measured cost/latency tradeoffs for a product decision rather than assuming new infrastructure.

## Features without a current milestone commitment

Arbitrary mesh import/general slicing, cloud accounts, billing, galleries, public share links, and direct printer-network control remain undecided. They are separate from the required experimental deposition, simulation, multi-printer and integrated hardware capabilities. Product claims such as universal print stability, watertightness, load capacity or lamp-assembly compatibility require evidence for the relevant use; they do not determine which experimental tools users may access.

## Export semantics

The editable project recipe preserves intent. G-code is the manufacturing instruction output for a specific profile. A validation report records the checks, assumptions, unresolved issues, and physical-test status.

A nominal STL export is optional pending the product decision. It must say whether it represents the outer design envelope or an estimated deposited body. Re-slicing that mesh is not expected to reproduce the original speed/extrusion pattern. A closed mesh is also not proof of a water-holding print.

## Slicer profile reuse

Propose PrusaSlicer 2.9-style exported configuration as the first compatibility target; evaluate SuperSlicer and newer formats through explicit adapters. Import a reviewed subset of settings, report omissions, and preserve source/version provenance. Resolve required macros and compatibility rules or reject them; never pass unresolved slicer placeholders into G-code.

Non-planar clearance, contact, pitch/amplitude/frequency limits, and physical test status are our extensions. Importing a profile for another printer does not promote that printer to validated support. Bundle upstream profile files only after their specific licensing route is settled.

## Physical acceptance

Agree one small reference vase and an observable woven appearance target before process validation. Define acceptable dimensions, strand bonding, opening size, base adhesion, stability, finish quality, and print completion. Capture photos and measurements associated with the generated recipe.

Separate feature availability, prediction accuracy, and recipe repeatability. Experimental generators can be released with documented untested ranges and recorded failures; they do not need every permitted combination to print successfully. A “tested recipe” label requires repeatability evidence on its stated setup. A failed print can teach the process model without automatically blocking release of its generator. Incorrect command generation, missing required controls, or unjustified preview claims still fail the corresponding software gate.

An alpha must demonstrate methods beyond sine-deformed walls. Required alpha families are sinusoidal walls, triangles, arches and an initial pause-and-move bridge. Proposed acceptance evidence includes a useful non-sinusoidal structure plus a timed anchored-span example, traceable to recipe and preview. Sagging/free-space loops follow in M6. Higher-fidelity simulation, integrated hardware, and multi-printer acceptance have their own gates.

## Product risks and responses

| Risk | Proposed response |
|---|---|
| Convincing preview with inaccurate physical behavior | Show measured prediction error/scope, validate against held-out prints, and distinguish predicted material from commanded motion. |
| Printhead hits earlier strands | Time-ordered envelope checks, conservative hardware profile, then supervised physical tests. |
| Firmware smooths away intended speed effects | Treat motion planning and extrusion response as process calibration, not just coordinates. |
| Freely combined parameters produce unstable prints | Preserve creative controls, explain outcomes, and provide controlled experiments and useful reference recipes. |
| The engine reduces every method to perimeter deformation | Represent anchored paths, process events and material-state predictions; require non-sinusoidal and timed-span demonstrations. |
| High-fidelity simulation exceeds interactive compute budgets | Provide progressive modes, benchmark the solver early, and seek a decision before adding external compute. |
| Late licensing constraints force rework | Decide dependency route before incorporation and review exact versions. |
| Scope grows into a full slicer/CAD product | Keep extensions behind explicit change decisions with impact on gates. |

## Approval record

Pending. Resolve the [decision log](decisions.md), select numeric acceptance targets at their designated gates, and approve this document's scope before any application code starts. Approval may explicitly delegate routine engineering choices while retaining product scope changes for the product manager.
