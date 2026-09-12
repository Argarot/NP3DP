# Session 005 — shaped vase and distinct-method test batch

Date: 12 September 2026. App/prepared engine 0.4.0; wall engine 0.2.0; recipe schema 1, project/setup schema 2; MINI adapter unchanged at `mini-5.1.2/2`.

## Delivered result

Three new numbered studies follow the reported A/B successes: 07 Mini vase B, 08 Arch coupon and 09 Held span V2. They are available as editable projects and prepared G-code/report downloads from the app's test bench. [Print guide](../guides/next-prints.md) · [Generated software evidence](../evidence/session-005-calibration.json).

The miniature preserves B's wave/process settings and adds a modest taper, belly and height. The arch test uses a 4.2 mm collar and 6 mm of 0.20 mm staggered arches. The held-span comparison uses that collar followed by 480 straight chords, each with a stationary deposit and 0.10 s hold; it deliberately has zero lift. Original 01–06 recipes, machine files and observation records are preserved.

The test bench now separates new unprinted studies, reported successful A/B references and historical experiments. Prepared download settings are clearly distinguished from editable exports. Per-study foundation configuration is shared between batch generation and app loading. No new backend, dependency, hardware target or license commitment.

## Geometry and implementation corrections

- A new bounded inspector measures XYZ separation between actual emitted extrusion chords at matched polar angles one revolution apart. It handles transition, wall, rim and partial turns; monotone rotation may be clockwise or counter-clockwise. It validates stationary event positions and excludes their volumes. Reversals, ambiguous polar paths, travel, lifted zero-angle posts and resource excess return applicability reasons.
- The panel plots nominal within-diameter coverage by turn and exposes the per-turn distances. This is a sampled geometric comparison, not filament physics, contact probability or nozzle clearance. Reports consume the same prepared events as preview/export.
- The old lifted bridge retraces each post while extruding, and aligned lifts at or above pitch can meet prior posts. Explicit advisory diagnostics describe both issues without changing old recipe parameters.
- Review of 08's proposed finish rim found a ~0.0065 mm centreline approach to the arch path. The delivered 08 explicitly disables the rim; 07/09 keep one. This choice is reflected in app loading, projects, compiled jobs and tests.
- Floating-point accumulated phase created an extra deposit/dwell at a numerically zero-length final bridge interval. A shared scale-aware endpoint tolerance now drives phase interval preflight and emission. The 09 fixture has exactly 480 deposits/holds/spans and 481 anchor markers, while real partial motifs remain. This numerical correction accounts for the wall engine version change; persisted field meanings are unchanged.
- Prepared files are generated together, independently audited, then published with projects/reports and a manifest. Regression tests recompile and compare exact public G-code bytes and report/manifest hashes, preventing stale downloads from passing CI. `.gitattributes` preserves machine-file bytes on Windows.

## Decisions, status and validation

E30–E34 in [decisions](../decisions.md) record the study defaults, phase correction, geometry scope and direct downloads. G0 remains passed; G1–G5 remain open. A/B are reported successful; **07–09 have not been printed**. No physical timing, dimensions, repeatability or simulation accuracy is claimed.

Final local checks pass: TypeScript, 186 tests / 16 files in 31.17 seconds, production build, nine Chromium workflows in 1.1 minutes and the unchanged 105-package/six-runtime-notice license check. Browser tests cover all prepared downloads and editor exports, old recipe workflows, profile changes, worker freshness/recovery and mobile widths. All 133 local Markdown links resolve. The workbench and method diagram were visually inspected; the diagram's Bezier controls were corrected to match its actual midpoint heights. Deployment evidence is recorded in [current status](../status.md). The [method review](../evidence/session-005-method-review.md) records independent mathematical review and its limitations.

Team ownership: lead studies, core phase correction, integration/UI, regression/delivery checks and documentation; Sol emitted-path inspector/tests; Sol independent method geometry/sequence review; Terra batch CLI. Source/profile code was not vendored.

Published implementation [be0609e](https://github.com/Argarot/NP3DP/commit/be0609ecf46674b2d5480f811dd8ce1ffe251a74) passed [GitHub CI and Pages deployment](https://github.com/Argarot/NP3DP/actions/runs/34696255162). Post-deployment checks verify 16 live resources against local production bytes, including all three G-code files, projects, reports and manifest; see [deployment evidence](../evidence/session-005-deployment.json). The development server was stopped after verification. GitHub Pages hosting and the license decision remain unchanged.

## Next session

1. Record the actual 07–09 results against their filenames/settings and reports; compare shape, endpoints and elapsed time.
2. Refine the relevant failed or marginal transition, using separate changes to geometry, deposition and timing. Preserve successful/failed observations separately.
3. Design a versioned lifted-span sequence with independently controlled deposition and return/travel phases, avoiding implicit double extrusion of posts. Then prepare a short unsupported-span/loop experiment with explicit attachment regions.
4. Continue measured nozzle-envelope work and define the first filament-solver calibration/validation targets with the product manager. Lamp hardware and second-printer inputs remain decisions for their milestones.
