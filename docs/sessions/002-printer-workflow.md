# Session 002 — printer workflow and first-print preparation

Status: delivered as [engineering preview 0.2](https://argarot.github.io/NP3DP/), with local and CI verification. Continue from this record and [current status](../status.md).

## Product input

The product manager authorized the next long implementation session and scope expansion toward a real print. Confirmed: Prusa MINI family, firmware `5.1.2+13478`, unmodified hotend, 0.4 mm nozzle, eSUN PLA Basic in white or black. MINI versus MINI+ remains uncertain. First test sequence: a small calibration coupon, then a miniature woven vase.

## Delivered

- A Prepare print workspace with printer/material settings, foundation controls and four calibration studies.
- A bounded, reviewed flat PrusaSlicer configuration importer. Known fields map to normalized setup/process values; digest, source identifiers, mapped/ignored fields and overrides remain inspectable. Embedded scripts/macros do not run. Ambiguous or unresolved configurations fail explicitly.
- Version-1 project/setup files around unchanged schema-1 wall recipes. Whole-project undo/redo and imports are atomic. Worker results retain their exact recipe and foundation inputs; stale output cannot enable a new export.
- Concentric planar foundations for circular and non-circular shapes; a rising transition with extrusion scaled to the actual midpoint gap; an explicit pattern lead-in; optional unmodulated rim turns.
- A nominal material preview with volume-equivalent flattened foundation/transition/rim sections, circular wall strands and spherical stationary deposits. Partial playback does not show material ahead of the nozzle. This remains a geometric model, without calibrated physics.
- A MINI Buddy 5.1.2 full-job adapter: explicit modes and resets, temperature waits, homing/mesh, front purge, checked body, retract/lift/park and shutdown. Pressure advance is disabled; existing firmware input-shaper tuning is retained.
- Source diagnostics for bed/deposited width, reserved purge strip, Z/headroom, XY/Z component speeds and extrusion flow. Final text is interpreted independently and compared with quantized source totals. Malformed/unrepresentable output cannot be downloaded as a complete job.
- Portable calibration projects, local complete G-code/report files, a SHA-256 evidence manifest and a [first-print guide](../guides/first-print.md) with observation template.

The original design editor, four methods, height bands, examples and wall-only motion drafts remain available. No physical printing or direct printer connection occurred.

## Work allocation

Astra/root owned shared contracts, integration, UI, complete-job assembly, diagnostics, review and delivery. Sol handled pinned firmware research and independent audit hardening; a second Sol assignment implemented the foundation planner and preview geometry. Terra implemented setup validation, project persistence and flat-config import. Bounded contributions were developed outside the shared application checkout and integrated centrally, then tested together.

## Important findings and decisions

[Decisions D20–D23 and E12–E22](../decisions.md) record the session's user input and delegated defaults. The profile's MINIIS identifier describes input shaping and must not be mistaken for MINI+. Firmware research supports shared MINI-family commands while leaving the installed probe's behavior to its firmware.

Independent review found gaps in the first full-job audit: it did not require every startup/shutdown step or prove exact temperature waits. The hardened interpreter and 18 audit tests, including command mutations now reject omitted/changed clearance, acceleration, temperature, fan and finish commands. Adapter XY travel respects the selected XY ceiling. Foundation layer changes and adapter lifts use 2 mm/s; choosing a lower Z ceiling blocks the job rather than exceeding it silently.

A geometry review found that the rising transition initially used a full-height bead despite beginning at nearly zero gap. Its volume now ramps with the midpoint gap, tested against an analytic integral and first/last segment expectations. Another export check rejected tiny bridge moves lost to decimal rounding. The held-span specimen now starts above a 4 mm conventional collar; the representability check was preserved.

Default temperatures, purge quantity, speeds, flow model, cooling schedule, line contact and printhead clearance remain unvalidated physical choices. Uncertainty is reported without banning arbitrary designs in the editor.

A final sequential-import regression check prevents a new configuration's digest from being paired with old printer/filament identifiers or an old slicer version. Source provenance resets on every imported file while actual resolved setup values remain intact when omitted from the new file. The profile suite now contains 20 tests.

Unheated-bed handling is explicit: a first-layer target of 0 emits heater-off without `M190 R0`, which firmware otherwise treats as a cooling wait until its slope timeout. Positive targets retain their waits; a later body-temperature increase still waits. A regression fixture exercises disabled bed, subsequent heating and rejection of a reintroduced wait-to-zero. Default 60 °C calibration files are unchanged.

## Verification evidence

- Strict TypeScript: passed.
- Unit/integration/geometry suite: **133 tests in 10 files passed**.
- Production build: passed; separate generation/export workers and lazy viewport preserved.
- Chromium: **seven browser journeys** cover the original four workflows and three printer/project/import workflows, including downloaded checksum verification and unsupported-firmware blocking.
- All four calibration jobs pass the independent final-text audit and controlled-shutdown checks. [Manifest](../evidence/session-002-calibration.json) records exact hashes, sizes, settings-derived metrics and observed local compile times.
- [Audit review](../evidence/session-002-audit-review.md) and [source research](../research/mini-5.1.2-adapter.md) retain review evidence and primary references.

| Study | Events | G-code bytes | Commanded full-job time |
|---|---:|---:|---:|
| Control cup | 16,461 | 748,854 | 7 min 28 s |
| Wave coupon | 16,631 | 752,969 | 9 min 11 s |
| Mini woven vase | 68,480 | 3,117,836 | 38 min 31 s |
| Held-span coupon | 14,987 | 660,049 | 18 min 36 s |

Times exclude heating, homing, probing, acceleration and firmware planning. No physical completion time is claimed. Generated files live locally in `artifacts/session-002/`; editable projects are versioned in `examples/calibration/`. Run `npm run calibration` to regenerate using the app's compiler.

## Delivery evidence

Implementation commit `adb1ee5eeaec4cce2140ac7c5774b16a177da074` passed [the full GitHub workflow](https://github.com/Argarot/NP3DP/actions/runs/34651292454) and deployed successfully. The workflow ran dependency/notice checks, strict types, all 133 unit/integration tests, production build and seven browser journeys before Pages publication.

HTTP verification returned 200 for `/NP3DP/`, `index-BTthG0Xm.js`, `Viewport-Ceii2SVG.js`, `generate.worker-BoN7Qa_y.js` and `export.worker-dd5q_g_J.js`. The hosted application bundle contains the new Prepare print workspace. All four local machine files were regenerated in memory using the final compiler and matched their saved text and report SHA-256. No manual printer run or additional manual visual inspection is claimed. The hosted app was queued in the Codex browser panel for handoff.

The local and hosted application source is synchronized through the repository. This documentation follow-up changes evidence only; the physical print gate remains pending.

## Gate status

G0 remains passed for the independent implementation/dependency route. G1 still lacks agreed numerical targets and measured clearance geometry. G2 awaits an actual control print. The initial material solver, distinct-method physical demonstrations and alpha/release gates remain unfinished. M6–M9 remain required and have not been reduced to optional features.

## Next session

Review the first control print and its exact project/report, sheet, spool colour, photos and dimensions. Use the outcome to tune foundation/extrusion and prepare controlled wave comparisons, then the miniature vase. Begin time-ordered contact/clearance checks and a calibrated span/sag baseline, keeping a measured nozzle envelope and physics accuracy targets explicit. Develop free-space-loop sequencing alongside this evidence work. Validate an actual user-exported PrusaSlicer configuration and keep additional printer adapters behind the existing boundary.

Physical tests require the user's printer observations. They are not replaced by software checks, and independent software work can continue while those observations are pending.
