# Architecture options

Pre-implementation research snapshot, 11 September 2026. The browser-engine route was subsequently implemented under the product manager's build authorization. [Implementation architecture](../architecture.md) and [current status](../status.md) supersede proposals and implementation-state statements below; the alternatives remain useful design context.

## Original recommendation

Use a typed procedural path engine that can run in a browser worker, evaluating reviewed permissive code for reuse. Keep the UI, printer dialect, export validation, and geometry algorithms separate. React/TypeScript and Three.js are candidates for the editor and viewport, subject to version and license review. The confirmed delivery uses GitHub hosting plus a local checkout and recipe files: propose a static GitHub Pages build and local development server, without automatic in-app GitHub commits.

The source model is a deposition recipe: form geometry, anchors, path primitives, ordered process events and printer/material context. A contour-plus-offset representation alone cannot implement the agreed arches, triangles and pause-and-move bridges or the committed free-space loops and integrated hardware. General mesh slicing remains a separate input capability.

## Approaches

| Approach | Benefit | Cost or constraint | Assessment |
|---|---|---|---|
| Browser path engine | Responsive local workflow; one engine supplies preview and export; no server required for computation. | We own sampling, deposition estimates, validation, and dialect correctness. Browser resource limits need measurement. | Recommended candidate. |
| Browser UI with Python/FullControl service | Existing direct-path concepts and Python tooling accelerate experiments. | Hosting or local companion process; deployment and serialization; GPL reuse needs an explicit distribution decision. | Viable alternative, especially for a research-oriented open-source product. |
| Reuse/adapt gcoordinator components | MIT-licensed Python path-generation library offers a permissive source for selected algorithms. | A browser port needs fidelity tests and retained notices; a Python service would change the GitHub-only execution plan. | Review selected components before deciding to reimplement everything. |
| Postprocess another slicer's output | Reuses conventional base generation and machine setup. | Must interpret machine state and distinguish regions; a perimeter transform does not represent independent anchors and timed deposition programs. | Possible import/integration component, not the core generative model. |
| Fork a general slicer | Broad model input and existing slicing machinery. | Much larger codebase, build and browser-integration effort, and copyleft obligations. | Poor fit for the first parametric vase. |

The direct-path concept is documented in [FullControl's original paper](https://doi.org/10.1016/j.addma.2021.102109). [gcoordinator](https://github.com/tomohiron907/gcoordinator) offers a permissive candidate in the same broad category. The tradeoffs above are our analysis, not benchmark results.

## Design recipe and intermediate representation

The saved project should contain schema/engine versions, explicit units, form and structural regions, anchor relationships, primitive parameters and repeats, effect order, process-phase settings, seed where relevant, printer/material/environment profiles, simulation model version, and provenance. Reopening should reproduce the same recipe and command plan or report a migration. Simulation reproducibility additionally depends on solver version, resolution, parameters and declared numerical tolerances.

Use a recipe/sequence graph above a typed execution representation. Primitives produce anchored curves or polylines and events: extrude-and-move, travel, retract/prime, dwell, controlled stationary extrusion where selected, process-setting change, and machine setup/finish. Dependencies express deposition order and anchoring intent; nominal durations or conditions must resolve into instructions supported by the target firmware. Preserve region, method and diagnostic metadata. Distinguish planned cooling time from measured filament temperature; the offline generator has no implicit sensor feedback.

Path, feed, extrusion and dwell outputs should be deterministic for a fixed resolved recipe/profile. Printer planning then estimates executed time and motion; that estimate drives material prediction. A material solver must not alter the exported recipe silently. Any optimization that changes a path or process setting is an explicit new recipe revision.

Four representations serve different purposes:

1. **Nominal shape:** intended silhouette and dimensions.
2. **Ordered path:** the nozzle-center trajectory and process state.
3. **Estimated executed motion:** expected timed nozzle/flow behavior under the selected firmware and machine model.
4. **Predicted deposited material:** time-dependent strand shape, cross-section, sag and contact with calibrated accuracy where available.

Exact exported G-code is a fourth verification surface: parse the produced file with an independently structured modal-state interpreter and compare coordinates, extrusion, bounds, and state to the validated operations. Check after rounding and any simplification; otherwise a valid internal path can become an invalid output file.

## Geometry and path generation

Use a continuous profile function for overall scale against normalized height and a periodic closed contour for each section. Non-circular sections and twist are confirmed scope. Propose circles, ellipses, and rounded rectangles as the first primitive library, pending approval. Twist rotates the section over height and contributes to geometry, contact, and motion calculations.

Contour construction is one generator. Add independent triangle/arch/span primitives with endpoints, orientation, attachment locations and local frames. Place/repeat them over regions or between anchors. The planned loop family may intentionally use gravity, cooling or excess deposited length to create a strand that does not follow the nozzle centerline. Integrated lamp geometry later introduces structural regions that share the same ordered execution representation.

Define effect composition and coordinate frames explicitly. A proposed deterministic sequence is base profile/section, twist, radial displacement in a documented local frame, vertical displacement, then speed/extrusion modifiers along the resulting path. A radial displacement and an offset along the contour normal differ on a non-circular section; offer clearly named behavior rather than silently changing meaning. Treat geometry modifiers as distances, speed/flow modifiers as appropriately bounded factors or values, and preserve the exact order in the recipe. Parameter envelopes over height or path progress are candidates for the playground; unrestricted script execution is separate scope.

For continuous-wave methods, define phase across revolutions without unintended jumps. For piecewise and timed methods, preserve intentional corners, stops and phase boundaries rather than smoothing them away. Resample continuous sections according to geometric error and curvature; treat event boundaries as immutable unless an explicit transformation is requested. Base/finish transitions belong to each method's semantics.

Adaptive sampling must have both a geometric-error budget and resource limits. A visually smooth line is not proof of sufficient sampling. Conversely, excessive tiny segments can increase file size and exceed a controller's useful processing capacity. Establish bounds with fixtures and the actual target printer.

Physical bead width, effective layer spacing, and line contact are related but distinct parameters. Base thickness and body pitch must be coordinated. Choose and document the volume model: 3D arc length times a perpendicular cross-section is an ideal-strand approximation, while supported deposition may need gap-dependent accounting. See [feasibility research](toolpath-feasibility.md).

## Browser execution

Keep interactive controls on the main thread and geometry/path work in a dedicated worker. Use generation IDs and cancellation so obsolete results cannot overwrite a newer design. Transfer typed buffers where useful, but account for the fact that transferred buffers lose their ownership in the sender. This is a supported browser mechanism, not a performance guarantee for our workloads. [MDN, *Using Web Workers*](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)

Use a lightweight line preview while editing; render more detailed strand geometry only for an inspected region or appropriate level of detail. Three.js buffer geometry supports lines and meshes with attributes held in buffers. Its GPU resources need explicit disposal when replaced. [Three.js, *BufferGeometry*](https://threejs.org/docs/pages/BufferGeometry.html)

Run material prediction as a separately cancellable job tied to recipe and solver versions. Provide immediate geometry/motion updates and progressive material refinement, clearly indicating pending/stale predictions. Benchmark the initial calibrated strand/span model and deeper dynamic models before choosing their runtime. Evaluate workers/WASM for the GitHub-hosted app; request a product decision before introducing a required local/backend solver. A cheap geometric preview is a baseline or fallback, not completion of the physical-simulation requirement. See [simulation strategy](filament-simulation.md).

Separate the numerical model from GPU precision: calculate manufacturing coordinates at suitable precision and use relative/centered display coordinates as needed. Benchmark representative large jobs before claiming full-resolution interactivity. Set job-size and memory ceilings with a clear recoverable error.

## Validation boundaries

Validation should cover units, finite values, deposition bounds including modulation and bead width, continuous joins, intended extrusion, permitted commands, modal state, clearance, support/contact assumptions, and configured motion/flow limits. Separately validate setup, purge, travel, and park against the machine travel envelope or reviewed template; their valid region need not equal the part's printable area.

Clearance requires the nozzle and nearby printhead envelope, not only the path centerline. A useful initial model can be conservative and bounded to known hardware. State its assumptions visibly. Unknown hardware geometry means unknown clearance; do not label it proven clear. Check time-ordered deposited material and intentionally allowed deposition contact separately.

Software validity, physical-prediction accuracy and tested-recipe evidence are separate statuses. Intentional gaps, likely sag/collapse, uncertain adhesion and untested combinations should remain usable as experiments. Do not silently clamp to proven settings. Essential unresolved state or malformed commands are a different error category; distinguish known machine-envelope violations from uncertain contact with predicted material. The final diagnostic/override policy remains a product decision. The path view shows commanded coordinates, with estimated execution and material behavior in separate views.

## Printer integration

The product manager confirmed MINI+, a 0.4 mm nozzle, and white or black eSUN PLA. Installed firmware, modifications, and exact filament product line remain open. The original MINI's published specification includes a 180 mm cubic build volume and a Bowden extruder. Those family specifications do not establish this machine's current motion or extrusion performance. [Prusa, original MINI announcement](https://blog.prusa3d.com/original-prusa-mini-is-here-smart-and-compact-3d-printer_30887/)

Pin a firmware/profile combination. Audit initialization, units, homing, leveling, heating, extrusion mode/reset, pressure-control settings, purge, and shutdown against that combination. Do not borrow MK3 start code simply because both machines are Prusas. Prefer text G-code for an inspectable initial export; binary packaging and printer-network integrations are separate decisions.

Reuse existing slicer printer/material settings as requested. Add a versioned adapter for the selected configuration format, rather than treating every upstream field as directly applicable. Keep baseline values and non-planar clearance/contact/motion extensions separate. See [profile reuse](profile-reuse.md) for import boundaries and licensing evidence.

Multi-printer compatibility is required. Keep generative methods independent of machine names and commands. Printer adapters own supported operations, setup/finish, dialect, flow scaling, firmware mode and envelope/timing models. Re-targeting recomputes checks and physical-prediction scope; it is not a text replacement pass. Test a second selected printer under M9 while preserving separate software-compatible, simulated and physically tested status.

## Base and mount strategy

For a constrained vase, a dedicated planar base planner is a reasonable candidate. It must connect to the spiral deliberately, with no unplanned travel through the part. Supporting general imported bases would change this assessment.

Integrated lamp brackets and socket interfaces are required under M8. Model measured fitting geometry, tolerances, retention, access, clearances and attachment to decorative regions. Plan conventional structural deposition and experimental spans together, including travel and state transitions. Separate fit coupons may support development, but a separate adapter alone does not fulfill the integrated feature. The fitting/assembly choice and acceptance targets remain product decisions.

## Sources and evidence scope

Sources linked inline were accessed 11 September 2026. At the time of this research, library versions had not been selected and no dependency had been installed or benchmarked. Statements about proposed component boundaries, validation, and testing are engineering recommendations. Subsequent exact versions and measurements are recorded in the implementation documents linked above.
