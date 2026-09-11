# Session 001 — first working deposition workbench

Date: 11 September 2026. Product-manager instruction: begin implementation, keep the code adaptable, make low-impact defaults explicit, produce a visible result each session, and maintain the next-session plan and documentation.

## Delivered implementation

- Static TypeScript/React/Vite app with an interactive Three.js viewport.
- Circle, ellipse and rounded-square forms, taper/belly and actual rotated-section twist.
- Four independent method families: continuous waves, piecewise triangular spans, quadratic arches, and deposit/hold/rise/span/fall bridges.
- Weighted height bands, geometric and process sliders, five examples, versioned files, strict validation and undo/redo.
- Separate form, commanded path and nominal strand-volume views. Partial-event playback handles a span in progress and growing stationary volume.
- Bounded generation, terminated obsolete workers, result/recipe pairing, background draft generation, deterministic serialization and a separate modal audit.
- Self-hosted fonts, exact dependency inventory and runtime notices, automated checks, GitHub Pages workflow and developer/user documents.

This is an engineering preview. A wall draft cannot yet be sent to the printer as a complete job. The design Z origin and +90/+90 draft offset are recorded conventions, not a confirmed machine setup. Ripple can command below the reference plane; this is explicitly diagnosed rather than silently changed.

## Review findings resolved

1. **Twist semantics:** non-circular contours were initially reparameterized rather than rotated. XY rotation now happens after local-section construction; axis/bounds tests verify it.
2. **Band amplitude:** the initial whole-band taper suppressed requested amplitude through most of the height. Blending now spans one motif at each edge with a full-amplitude interior.
3. **Resource baseline:** the initial sampling estimate rejected the default example. The logged 0.6 mm density heuristic fits all five studies; the 100,000-event cap remains explicit.
4. **Stale results/errors:** results keep their generating recipe, errors are request-scoped, and obsolete workers are terminated. A new valid edit recovers from a resource failure.
5. **Preview timing:** long segments and stationary deposits originally appeared complete before the nozzle/volume reached them. Current events now render fractionally.
6. **Export rounding:** positive values could become zero during formatting. Per-event representability checks now fail explicitly; exact zero-volume deposits become comments. Parsed quantities/time are compared with per-event rounding accounting.
7. **UI responsiveness:** large export/audit work moved to a worker. The renderer builds only the selected representation and draws on change instead of continuously when idle. This resolved the initial headless-browser timeouts.
8. **Export identity:** the dialog now captures a fixed recipe/path pair and prevents global undo from changing its source accidentally.
9. **Zero-length bridge moves:** zero lift/radial settings retain meaningful spans and timed phases without emitting fake moving extrusion.
10. **Layout:** constrained grid sizing now keeps timeline and statistics inside the desktop workspace; smaller viewports use a scrollable layout.

## Evidence

- Local strict TypeScript check and **65 unit/integration/geometry tests** pass.
- **Four browser journeys** pass against the production build. They cover all five studies, generated drafts/playback, save/import, invalid-version rejection without state loss, rapid edits, resource-error recovery and desktop/mobile bounds.
- Browser inspection shows the multi-band study and working camera/controls. Optional WebMCP read/load was validated through the browser, including a rejected future-version recipe that left the design unchanged.
- Exact lockfile inventory: **105 packages**, including optional platform packages; **six runtime notices**. Runtime licenses are MIT/OFL. Lightning CSS's MPL development dependency is explicitly recorded separately.
- [Single-pass local measurements](../evidence/session-001-measurements.json) record generation/export timings and event counts. They are observations, not agreed acceptance thresholds or physical predictions.
- [Implementation commit `775fd96`](https://github.com/Argarot/NP3DP/commit/775fd96b0483b4ad3606430a0dc0d80a2d9b0276) was pushed to the existing repository. The [verification and Pages workflow](https://github.com/Argarot/NP3DP/actions/runs/34646268100) passed all checks and deployed [the live workbench](https://argarot.github.io/NP3DP/).
- Hosted browser inspection verified the repository subpath, lazy viewport, generation and export workers, Method sampler, audited draft preview and enabled download controls. No console errors were reported. A manual embedded-browser download-event wait timed out; receipt of that particular download is unconfirmed. Actual download/file-content checks passed in the local and CI Chromium suites.

No hardware printing, motion clearance test, material calibration or physical validation was performed. No G1–G5 physical gate is marked complete.

## Decisions and teamwork

Product instructions are D17–D19; delegated defaults E01–E11 are in [decisions](../decisions.md). Runtime code is independently authored or imported through reviewed dependencies, with no copied slicer/profile source. The original product distribution license remains undecided.

The lead owned the application checkout, integration, UI, lifecycle/performance fixes, delivery and documentation. Sol handled bounded engine/export implementation and an independent integration review; Terra handled recipe validation/presets and cross-module tests. Contributions were made outside the application checkout and integrated centrally, without nested delegation.

## Next-session plan

Target a visible printer-profile and calibration-output workflow. First record the actual firmware/material/hotend facts; implement narrow profile import and a normalized machine/material adapter; add planar foundation, wall transition and finish; extend machine/flow diagnostics; and produce independently checked full output for the resolved setup. Prepare a supervised control print and a measurement record for later span/material calibration.

The accurate-filament, free-space-loop, integrated-hardware and multi-printer roadmap remains required. This session established reusable event and preview boundaries for those additions; it did not implement or validate them.
