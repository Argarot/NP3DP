# Decision log

## Confirmed by the product manager

| ID | Decision | Consequence |
|---|---|---|
| D01 | Research and scope first; agree a PRD before implementation. | Completed through discovery; implementation was authorized in D17. |
| D02 | Initial printer was described as MINI+ with 0.4 mm nozzle and white or black eSUN PLA. | Superseded by the more precise hardware facts and variant correction in D21–D22. |
| D03 | First demonstration is a woven-looking decorative vase with small visible gaps, for dry use or a liner. | This is the first reference object; integrated lamp hardware is a required later capability under D12. |
| D04 | Distribution model is undecided. | Keep the project license open and evaluate permissive reuse first. |
| D05 | Use an orchestrating lead and appropriately sized subagents. | Delegate bounded work, then integrate and review it centrally. |
| D06 | Ask about product decisions; explain consequences and recommend a default. | Revised by D18: low-impact defaults may proceed when logged; major decisions still need input. |
| D07 | Serve the app from GitHub and keep its repository on the local machine. | Implemented as a static Pages build with a local Vite run path. Deployment evidence is maintained in status.md. |
| D08 | Reuse existing PrusaSlicer/SuperSlicer printer and filament profiles where appropriate. | Add a profile compatibility/import workstream and review specific profile licenses; imported values do not establish non-planar limits. |
| D09 | First release is an experimental playground with freely combined Z/radial/speed/extrusion effects. | Build an effect-composition model and experimental validation workflow; tested presets are reference points, not the only editable designs. |
| D10 | First release includes non-circular sections and twist. | Generalize contour parameterization, displacement, sampling, and support/clearance analysis. |
| D11 | Download/upload design recipe files; version selected files normally in the repository. | No in-app GitHub authentication, automatic commits, or synchronization in the first release. |
| D12 | Multi-printer compatibility, accurate filament simulation, integrated lamp brackets/socket interfaces, and free-space loops are required product capabilities, possibly in later milestones. | Remove them from exclusions and give each requirements, tasks, dependencies and acceptance gates. Inclusion is settled; staging/details remain open. |
| D13 | Creative options take priority over guaranteed print stability. | Experimental generators remain usable beyond proven recipes; likely print failure is advisory and not the same as invalid machine instructions. |
| D14 | Support arches, triangles, sagging loops, sinusoidal walls and pause-and-move bridging, with sliders and reasonably accurate motion/material previews. | Use path/anchor/process primitives and time-dependent material prediction; perimeter deformation alone cannot satisfy the product. |
| D15 | Continuity is a strategy, not a universal requirement. | Allow intended pauses, travel, staged anchoring and reconnection for the requested structures while preserving continuous vase regions where useful. |
| D16 | First usable alpha includes sinusoidal walls, triangles, arches and an initial pause-and-move bridge sequence; sagging/free-space loops and deeper physics follow. | Alpha must demonstrate distinct deposition methods. Later loops and accurate physics remain committed scope. |
| D17 | Start building now; favor adaptable code and long implementation sessions with a visible result each session. | PRD approved for implementation. Deliver working slices while keeping physical and software gates distinct. |
| D18 | Default low-impact decisions, log and flag them; pause for major impactful choices. | The engineering defaults below are delegated choices, not claims of explicit product-manager selection. |
| D19 | Update decisions and built status every session, and include the next-session plan in the handoff. | Maintain status.md, session records, milestones and architecture documents alongside code. |
| D20 | Build the next session and expand toward an actual print. | Implement the setup/foundation/complete-output workflow and prepare concrete calibration files. |
| D21 | Firmware is 5.1.2+13478, hotend unmodified, filament is eSUN PLA Basic; nozzle remains 0.4 mm. | Target a reviewed adapter for that firmware, with editable material starting values. |
| D22 | It may be an original MINI rather than MINI+. | Record variant unknown. Shared MINI-family commands are supported; do not infer the probe identity. |
| D23 | Prepare a small calibration coupon first, then a miniature woven vase. | Control → modest wave → miniature sequence; timed spans are a separate experiment. |

## Open decisions

| ID | Question | Recommended starting point | Effect of choosing otherwise |
|---|---|---|---|
| O01 | Wall character | Resolved in D03. | Decorative weave with visible gaps. |
| O02 | How are individual designs saved? | Resolved in D11. | Recipe files plus ordinary Git workflow. |
| O03 | Installed firmware, modifications, exact eSUN product line? | Resolved by D21; variant remains uncertain under D22. | Sheet, actual spool colour and observed calibration are recorded at print time. Measured printhead envelope is still missing. |
| O04 | Exact initial cross-section library? | Propose circle, ellipse, and rounded rectangle, with profile handles and twist. | Arbitrary mesh import and multi-contour forms remain separate scope; additional named shapes need test cases. |
| O05 | Primitive details and diagnostic policy? | Named geometry/process controls, explicit timing and anchor phases, advisory print-failure predictions, no silent clamping; distinguish unresolvable commands and machine limits. | Unrestricted code scripting and uncertain printhead-contact overrides need a specific execution policy. |
| O06 | First-release export set? | Editable recipe, text G-code, validation report; add nominal shape STL if useful. | A manufacturing-grade mesh of every deposited strand is a substantial separate deliverable. |
| O07 | Which lamp fittings and assembly style first? | Integrated bracket/socket interface for one measured fitting in M8; use separate fit coupons during development. | More fittings expand mechanical requirements and physical tests. A separate adapter is not a substitute for the integrated requirement. |
| O08 | Initial audience and browser? | Product manager as an experimental maker, desktop Chromium family for initial validation. | Public novice users, mobile editing, and wider browser support increase usability and support scope. |
| O09 | Numeric acceptance thresholds and reference design? | Agree before the associated gate, using measured printer and computer baselines. | No thresholds will be invented and presented as already approved. |
| O10 | Distribution license and dependency route? | Independently written core and reviewed permissive dependencies while undecided. | Copyleft reuse may require a different distribution plan and license obligations. |
| O11 | First usable alpha primitive set? | Resolved in D16. | Distinct methods early; sagging/free-space loops and deeper physics in following milestones. |
| O12 | Simulation accuracy and compute budget? | Agree target observables/tolerances by method/material, with interactive approximation and optional quality solve. | Tighter accuracy may require more calibration and longer compute; external/local solver infrastructure would need approval. |
| O13 | Second printer for compatibility acceptance? | Choose after the MINI-family baseline; use a meaningfully different profile or firmware when available. | Model/firmware choice changes dialect, motion, clearance and physical-validation work. |

No major open decision is approved by passage of time. O03 now records the supplied facts; measured clearance and physical/numerical acceptance still remain at G1/G2. O04 and O08 have reversible engineering defaults below. O06 now includes complete MINI experiment files as well as wall-only drafts; nominal STL remains optional.

## Logged engineering defaults — session 001

These choices use D18. They can be revisited without changing the approved product direction.

| ID | Default taken | Reason and practical limit |
|---|---|---|
| E01 | TypeScript, React, Vite, Three.js; static client; native accessible controls. | No server/account requirement. Pure domain code and browser workers remain separate from the UI. Exact versions are locked and inventoried. |
| E02 | Circle, ellipse and exponent-4 superellipse (rounded square, stretchable by aspect ratio); taper plus sine belly; true XY twist. | Small useful initial form library. Arbitrary profiles/meshes can be added through the shape interface later. |
| E03 | Recipe schema v1; 1–8 height bands; explicit units; strict unknown/version rejection. | Avoid silent loss of future recipe semantics. Additional persistence changes require migrations or a schema revision. |
| E04 | Weighted height bands with continuous accumulated motif phase; one-motif smoothstep blend at each boundary. | Exact joins with full-amplitude interiors. This is a documented generator convention, not calibrated adhesion behavior. |
| E05 | 100,000-event generation cap; 120 ms edit debounce; terminated obsolete workers; selected-view geometry only; draw on change. | Bound current browser work without clamping experimental parameters. Larger jobs report a resource error. Sampling is heuristic, not a general geometric error guarantee. |
| E06 | First visible build exports walls starting at design Z=0.4 mm; `.gcode.txt` inspection draft uses +90/+90 XY. | A design-coordinate convention, not verified MINI startup. No floor, thermal setup, homing/purge, machine shutdown, or print-ready claim. These remain M1/M2 work. |
| E07 | Nominal strand geometry uses circular area × 3D length; process/local flow applied once; stationary volume rendered separately. | Useful commanded-volume visualization. Gravity, cooling, contact, executed motion and calibrated physical accuracy are absent and remain required. |
| E08 | File-based persistence and 80-step undo history; no automatic browser/cloud save. | Matches the chosen recipe/Git workflow. Save before closing or reloading. |
| E09 | Draft XYZ 3 decimals, E 5, feed 3, dwell 1 ms. Reject positive events erased by quantization; independent modal parse and rounding accounting. | Decimal precision is computational behavior, not a firmware-resolution guarantee. It is not safe to silently erase small extrusion/hold events. |
| E10 | Desktop Chromium primary verification; responsive layout also checked at 390 px; optional WebMCP read/load uses existing validated actions. | No wider browser/device performance guarantee yet. No new external service or data storage. |
| E11 | MIT runtime libraries and OFL font assets, bundled locally; independent generator code; project metadata `private`/`UNLICENSED`. | No upstream slicer algorithms or printer profiles copied. The root distribution license remains the product manager's decision. |

See [architecture](architecture.md), [dependency inventory](dependency-inventory.json), and [third-party notices](../public/THIRD_PARTY_NOTICES.txt).

## Logged engineering defaults — session 002

All choices below use D18 and are revisable. None is a physically validated preset.

| ID | Default taken | Reason and practical limit |
|---|---|---|
| E12 | Preserve schema-1 wall recipes; add version-1 project/setup envelopes. Undo snapshots the whole project. | Setup and recipe apply atomically. Legacy files stay editable; saving a wall-only recipe intentionally excludes setup, while Save project retains it. |
| E13 | Independent MINI Buddy 5.1.2 adapter, stock hotend, 0.4 mm nozzle, 1.75 mm filament; MINI variant may be unknown. | Commands traced to pinned firmware research. Other firmware/hardware blocks full output pending adapter review, without restricting the design editor. |
| E14 | 215 °C first layer, 210 °C body; bed 60 °C; fan 100% after foundation; maximum flow 5 mm³/s, XY 100 mm/s, Z 8 mm/s, acceleration 500 mm/s². | Editable starting values, not measured limits. eSUN publishes 210–230 °C nozzle/45–60 °C bed; flow, cooling schedule and dynamics require coupon evidence. |
| E15 | Three 0.2 mm foundation layers, 0.45 mm lines at 20 mm/s; 4 mm pattern lead-in; one rim turn for tests. | Concentric non-circular-capable foundation. Stadium area for foundation/rim, midpoint-gap area for rising transition; full 3D length and recipe flow applied once. |
| E16 | Foundation off by default for original wall studies; explicit enabling places the wall above its base and ramps Z/radial effects. | Legacy wall generation remains engine 0.1.0; prepared builds record engine 0.2.0. No silent editing of recipe amplitudes; lead-in validation prevents below-foundation excursions. |
| E17 | Startup waits for a heated-bed target and 170 °C nozzle before homing/mesh; zero bed target explicitly disables heat without a cooling wait, then heats for printing; fixed front purge; controlled retract/lift/park/shutdown. | MINI-family adapter owns machine state. Set relative linear E, reset speed/flow and pressure advance; retain firmware input shaping. No saved firmware configuration writes. |
| E18 | Import only a bounded, flat configuration subset; review proposals before applying. Store digest, mapped/ignored keys and imported baseline values. | Do not execute macros, copy source credentials, resolve arbitrary inheritance or infer MINI+ from MINIIS. Normal/quiet machine limits use the smaller configured ceiling; multi-extruder ambiguity fails. |
| E19 | Bed/deposited-width/purge-strip, Z/headroom, XY/Z component speed and flow checks block invalid full output. | Editing freedom is preserved; no geometry or process value is silently clamped. Physical sag/bonding/clearance remain explicit unknowns. Reserve 0.001 mm at XY boundaries for formatting. |
| E20 | Preview uses volume-equivalent flattened rectangles for foundation/transition/rim; body remains circular and deposits spherical. | Planar first layer reaches the bed. Sloped build beads remain a geometric approximation, without contact or filament physics. |
| E21 | Control, wave, miniature and separate held-span studies; the latter has a 4 mm conventional collar. | Tiny bridge movements that vanished during G-code rounding were rejected; the specimen was changed without weakening precision checks. |
| E22 | Final text is independently interpreted and SHA-256 linked to its report. Version small projects; generate larger machine files locally. | Reproducible recipe/setup/audit evidence without committing generated megabyte files. Algorithm provenance is recorded; future engine versions are not promised byte-identical replay. |

Next decisions require actual print observations, agreed predictive-error targets, selected lamp fitting dimensions and a second printer when its milestone starts. No new service, license or guaranteed-success claim was introduced.

## Logged engineering defaults — session 003

The product manager requested attachment fixes, LCD preview/progress, elephant-foot compensation and a purge after printing original files unchanged. These defaults use D18; the later roadmap remains intact.

| ID | Default taken | Reason and practical limit |
|---|---|---|
| E23 | Preserve original studies; add explicit A/B retries at 0.30/0.40 mm pitch, 0.08/0.12 mm amplitude and 6 mm/s. Retain 100% wall fan and existing temperatures. | Original wave's startup had a whole turn without nominal support. Reduce baseline separation before adding larger unsupported windows. A/B remain physically untested. No arbitrary deep plunge or centreline crossing was added. |
| E24 | Project/setup schema 2 adds 0–0.5 mm first-layer inset; new setups 0.15 mm, v1 migration 0 mm. | Preserve old experiment intent. Inset all first-layer rings; higher layers remain nominal. Circle offset is exact; other supported convex outlines use sampled perpendicular offset. Prusa's [compensation guidance](https://help.prusa3d.com/article/elephant-foot-compensation_114487) motivates an editable inset; 0.15 mm is a proposed calibration default. |
| E25 | Restricted circular-wave nominal contact estimator, capped at 512 turns / approximately 250k intervals. | Exposes the startup failure in the UI/report. Same-angle gap versus nominal diameter is an estimate of geometry, not a physical solver. General shapes/material contact remain unfinished. |
| E26 | MINI LCD QOI pair 220×124 and 200×240, deterministic worker rasterizer, bounded prefix. Final-text M73 P/R every ~30 commanded seconds and after waits; positive minutes round up. | Pinned firmware requires QOI for these screens. ETA excludes thermal/probing/firmware dynamics. Initial duration also appears in header/footer metadata. Network/Connect PNG previews are separate from this LCD fix. |
| E27 | Two moving purge segments X5→65→135 at Y6/Z0.2, E8+E10; feeds capped to 90% selected flow and selected XY ceiling. | Official MINI intro-line behavior uses these lengths/amounts; adapt numeric behavior inside our bed reservation without copying its profile or macro. Independently require the full purge sequence and post-purge clearance. No stationary blob prime. G29 remains mandatory. |
| E28 | Keep original observation hashes/manifests and generate retries into session-003 paths. Bound unit-test workers to two, allow 30 s CPU fixtures, reuse immutable baseline audit fixtures. | Separate historical evidence from new outputs. Initial 5 s fixture timeouts were test-runner failures under load, not passing performance evidence. No geometry/export assertions were relaxed; performance is measured separately. |

Control 01 is one reported success; wave 02 is one reported failure. Neither constitutes repeatability, measured clearance or calibrated prediction. The unknown MINI/MINI+ variant and existing physical-accuracy/hardware decisions remain open.

E24 refinement: squircle contours now use adaptive phase tables shared by emission and preflight, including shifted rim seams after partial wall turns. The prior uniform-angle estimate produced multi-millimetre segments near squircle axes. Non-circular prepared geometry therefore changes with engine 0.3; historical exact machine files remain the replay record. Circle retry G-code bytes were verified unchanged by this refinement.
