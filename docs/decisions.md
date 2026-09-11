# Decision log

## Confirmed by the product manager

| ID | Decision | Consequence |
|---|---|---|
| D01 | Research and scope first; agree a PRD before implementation. | Completed through discovery; implementation was authorized in D17. |
| D02 | First test printer is Prusa MINI+, with 0.4 mm nozzle and white or black eSUN PLA. | Start with this combination; firmware, hardware modifications, and exact filament product line still need recording. |
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

## Open decisions

| ID | Question | Recommended starting point | Effect of choosing otherwise |
|---|---|---|---|
| O01 | Wall character | Resolved in D03. | Decorative weave with visible gaps. |
| O02 | How are individual designs saved? | Resolved in D11. | Recipe files plus ordinary Git workflow. |
| O03 | Installed firmware, modifications, exact eSUN product line? | Record the actual setup before G1. | These details determine compatible base profiles and additional calibration. No physical defaults have been assumed. |
| O04 | Exact initial cross-section library? | Propose circle, ellipse, and rounded rectangle, with profile handles and twist. | Arbitrary mesh import and multi-contour forms remain separate scope; additional named shapes need test cases. |
| O05 | Primitive details and diagnostic policy? | Named geometry/process controls, explicit timing and anchor phases, advisory print-failure predictions, no silent clamping; distinguish unresolvable commands and machine limits. | Unrestricted code scripting and uncertain printhead-contact overrides need a specific execution policy. |
| O06 | First-release export set? | Editable recipe, text G-code, validation report; add nominal shape STL if useful. | A manufacturing-grade mesh of every deposited strand is a substantial separate deliverable. |
| O07 | Which lamp fittings and assembly style first? | Integrated bracket/socket interface for one measured fitting in M8; use separate fit coupons during development. | More fittings expand mechanical requirements and physical tests. A separate adapter is not a substitute for the integrated requirement. |
| O08 | Initial audience and browser? | Product manager as an experimental maker, desktop Chromium family for initial validation. | Public novice users, mobile editing, and wider browser support increase usability and support scope. |
| O09 | Numeric acceptance thresholds and reference design? | Agree before the associated gate, using measured printer and computer baselines. | No thresholds will be invented and presented as already approved. |
| O10 | Distribution license and dependency route? | Independently written core and reviewed permissive dependencies while undecided. | Copyleft reuse may require a different distribution plan and license obligations. |
| O11 | First usable alpha primitive set? | Resolved in D16. | Distinct methods early; sagging/free-space loops and deeper physics in following milestones. |
| O12 | Simulation accuracy and compute budget? | Agree target observables/tolerances by method/material, with interactive approximation and optional quality solve. | Tighter accuracy may require more calibration and longer compute; external/local solver infrastructure would need approval. |
| O13 | Second printer for compatibility acceptance? | Choose after the MINI+ baseline; use a meaningfully different profile or firmware when available. | Model/firmware choice changes dialect, motion, clearance and physical-validation work. |

No major open decision is approved by passage of time. Hardware details in O03 are still needed at G1; they do not block the editor. O04 and O08 have reversible engineering defaults below. O06 starts with recipe/report and inspection-only text; complete printer output remains required in M2, and nominal STL remains optional.

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
