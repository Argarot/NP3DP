# Session 003 — attachment failure and printer usability

Date: 12 September 2026. App/prepared engine 0.3.0, MINI adapter `mini-5.1.2/2`, recipe schema 1, project/setup schema 2.

Subsequent feedback: A/B and printer preview/time display are now reported working; see [session 004](004-retry-feedback.md). This record preserves the implementation and evidence available at delivery.

## Evidence and diagnosis

The product manager confirms original calibration files were printed unchanged. Control 01 worked in one reported observation; wave 02 detached, and later studies were not attempted. Preserve session-002 projects, machine files and manifests as historical inputs. The failure photo remains supplied conversation evidence, not a calibrated measurement.

The original wave combines 0.60 mm pitch, 0.45 mm nominal strand, 0.30 mm Z amplitude and a 4 mm cubic startup envelope. At full amplitude the same-angle one-revolution gap spans 0–1.20 mm. During startup, sampled turn 2 spans approximately 0.519–0.678 mm, entirely beyond the nominal strand diameter. The photo is consistent with this failure mechanism; it does not establish that geometry was the only cause. The original startup already had G28/G29, a smaller purge and full fan after the foundation.

## Delivered changes

- Explicit retry A/B specimens, original failed-study notice, deferred later studies, and a [retry guide](../guides/retry-print.md). Experimental editing freedom remains intact.
- Restricted circular-wave attachment analysis calculated with the prepared build in the cancellable generation worker. UI and reports show nominal per-turn support and full-wave separation, with explicit limitations.
- First-layer elephant-foot inset on every foundation ring: exact circles and sampled convex-outline perpendicular offsets for ellipse/squircle. Later layers remain nominal; connectors are explicit travel events. Range 0–0.5 mm, new default 0.15 mm.
- Squircle foundations/transitions/rims use bounded adaptive phase sampling, including a rim beginning after a partial wall turn. Compensated outlines refine long miter segments and share counts with preflight. Circle retry G-code hashes remain unchanged by this correction.
- Project/setup v1 → v2 migration uses **0 mm** inset, preserving previous design intent. Recipe v1 is unchanged. Flat config import maps PrusaSlicer's `elefant_foot_compensation` with review/provenance.
- Deterministic nominal-deposition raster thumbnails encoded as 220×124 and 200×240 QOI for the pinned MINI LCD. Both stay before machine commands and inside the bounded header scan. No new dependency or copied upstream implementation.
- Final-text command timing, compact pre-print estimate and M73 P/R updates, refreshed after thermal/probe waits and regularly during the path; completion only after the finish motion barrier. Thermal/probing/dynamics durations remain excluded.
- Two moving purge segments, E8 then E10, across the reserved front strip. Feeds obey selected XY and flow ceilings. Independent audit requires the ordered purge, reset/lift, display metadata, timing-consistent progress and existing thermal/mesh/shutdown obligations.
- Startup review skips encoded image rows; generated files retain them. Local generation now writes the retry set to session-003 paths, leaving historical session-002 outputs untouched.

## Decisions, validation and gates

Engineering defaults are E23–E28 in [decisions](../decisions.md). No new scope, license, hosting service, hardware target or physics-accuracy commitment was made.

Initial validation found one new test expectation mismatch (migration rejection wording) and 5-second timeout failures across CPU-heavy old/new export fixtures under concurrent load. The wording assertion was corrected; test workers are bounded to two, numerical-test timeout is 30 seconds, and immutable audit fixtures are compiled once per setup. These are test-harness changes, not performance acceptance or relaxed motion/geometry assertions. Focused integration then passed 90 tests.

Final check/build/browser/license evidence and deployment are recorded in [current status](../status.md); generated file checksums and measured compile times are in [session-003 calibration evidence](../evidence/session-003-calibration.json). No retry has been physically printed during this development session.

Final local TypeScript and 168 tests across 14 files pass; production build and unchanged 105-package/six-notice license inventory pass. Squircle property tests cover aspects 0.25, 1, 1.6 and 4 with partial wall turns and twist, and compare actual event lengths/continuity. The final complete generation retains the independently reviewed A/B G-code hashes. All 103 local Markdown links checked resolve.

Eight Chromium workflows pass in 37.8 seconds, including the retry/compensation/v1 migration journey and actual G-code downloads containing both LCD thumbnails and completion progress. Local final unit run: 19.15 seconds. Generated compile observations: A 1,455.41 ms and B 1,191.68 ms; these are one local timing sample each, not accepted performance targets.

Team ownership: lead integration and adapter/audit/UI/docs; Sol firmware metadata and independent display review; Sol attachment research and geometry review; Terra foundation/inset and bounded contour refinement. Contributions stayed outside the app checkout until lead review/integration.

Implementation commit [f76cfa4ae95260b82f3d7b21a6fb78e863b34808](https://github.com/Argarot/NP3DP/commit/f76cfa4ae95260b82f3d7b21a6fb78e863b34808) passed the full CI build/browser/license workflow and Pages deployment in [run 34687857110](https://github.com/Argarot/NP3DP/actions/runs/34687857110). Post-deployment HTTP checks returned 200 for the entry, main JS/CSS, viewport and both workers; all five asset byte hashes matched the final local production output. The task-owned development server was stopped after verification. GitHub Pages hosting was preserved as explicitly requested.

G0 remains passed for the selected independent-code route. G1–G5 remain open: the reported control is useful evidence but does not satisfy unagreed numerical thresholds, repeatability, printhead clearance or predictive accuracy. The failed wave is recorded as failed. M6–M9 remain required.

## Next session

1. Inspect retry A's attachment, purge, LCD preview/progress, base flare and elapsed time. Tie observations to its exact report/G-code.
2. If A attaches, compare B. If A fails, isolate contact/temperature/flow/cooling causes before widening gaps.
3. Use measurements to tune first-layer compensation and command-time estimates. Keep failed and successful observations separate from calibration/held-out validation claims.
4. Prepare a separate anchored-arch or held-span coupon, then the miniature vase when attachment supports it. Continue measured printhead-envelope and span/sag model work; free-space loops, physical simulation, integrated fittings and multi-printer support remain on the roadmap.
