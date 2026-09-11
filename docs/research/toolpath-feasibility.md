# Toolpath feasibility

## Scope and evidence

The confirmed test target is a Prusa MINI+, 0.4 mm nozzle, and white or black eSUN PLA. The first object is a decorative vase with small visible gaps, for dry use or a liner. Installed firmware, modifications, exact filament product line, and measured process limits remain to be recorded.

The agreed alpha includes sinusoidal walls, triangles, arches and initial pause-and-move bridging, with combined process controls, non-circular sections and twist. Sagging/free-space loops, accurate filament physics, integrated lamp hardware and multi-printer compatibility are required later capabilities. The path/process instructions are expressible in principle on suitable three-axis extrusion printers, while successful physical formation is a separate question. This report proposes models and experimental evidence; it supplies no tested profile or executable print file.

## Effect families

| Effect | Engineering interpretation | Proposed sequence |
|---|---|---|
| Radial waves | Inward/outward displacement around a rising contour; changing phase alters support and openings between turns. | First modulation experiment. |
| Z waves | Local vertical oscillation about the rising contour, potentially including downward travel. | Add after clearance and motion checks. |
| Combined weave | Coordinate offsets and phase so strands contact at intended locations and span controlled openings. | Candidate first accepted effect after coupons. |
| Triangles / arches | Explicit vertices, curved spans, anchors and repetition rather than a perimeter offset alone. | Agreed alpha methods; preserve intended corners and process changes. |
| Pause-and-move bridge | Anchor deposition, waiting/cooling, movement and extrusion are distinct phases. | Initial version in the agreed alpha; inspect execution timing and evolving strand shape. |
| Sagging/free-space loops | Coordinate path, emitted length, anchors and timing to form unsupported material. | Required M6 method; stretching, sagging, curling and fusion can be intended behavior rather than automatically rejected failure. |
| Speed/extrusion texture | Coordinate process changes with path location and motion. | Included in first release; separate calibration track because commands do not determine exact executed speed or nozzle pressure. |
| Stationary deposition | Deposit while XYZ is stationary. | Separate experiment; a dwell by itself does not command extrusion. |

Coordinated X/Y/Z/E linear motion is documented in [Marlin's G0/G1 reference](https://marlinfw.org/docs/gcode/G000-G001.html). Target compatibility must be checked against the selected Buddy firmware build; generic Marlin or Klipper documentation cannot certify MINI behavior. [Prusa Buddy firmware](https://github.com/prusa3d/Prusa-Firmware-Buddy)

## Continuous phase and actual descent

Let theta be continuous angle in radians and p the base rise per revolution. A simple explanatory model is:

`z(theta) = z0 + p*theta/(2*pi) + Az*sin(k*theta + phi)`

For constant amplitude, frequency, and phase:

`dz/dtheta = p/(2*pi) + Az*k*cos(k*theta + phi)`

Nondecreasing height requires `p >= 2*pi*abs(Az*k)`. That condition would suppress the downward motion contemplated by the product. Instead, permit bounded local descent, require controlled overall growth across the repeating pattern, and check time-ordered clearance and support. Net upward growth alone is not a collision test.

Define phase over the entire continuous path. A constant integer number of waves per revolution repeats phase at the same azimuth on the next turn; a half-integer produces half-cycle inversion. Flipping a wave at each revolution can introduce a jump unless a designed transition changes local phase/frequency. Changing radius and choosing physical wavelength further complicate alignment.

AmiSlicer is evidence for woven appearance, but its manual describes separate closed layers and alternating their phase. It does not establish the mathematics or printability of a continuous spiral. [AmiSlicer manual](https://github.com/kasanetarium/AmiSlicer/blob/main/docs/manual_en.md)

These equations are our derivation, not a production pattern. Variable amplitude and base/rim transitions add derivative terms; sampling and coordinate rounding also require checks.

For non-circular sections, define the periodic contour, displacement frame, and parameterization explicitly. Polar angle and contour arc length are different coordinates. Twist contributes lateral displacement and changes support and acceleration demand; it cannot be treated as only a display transform. Reject unsupported multi-contour or degenerate shapes until their planning semantics exist.

## Contact, support, and collision

An unbroken path can produce disconnected or collapsed material. A cheap diagnostic compares consecutive turns at matching azimuth: radial difference dr and vertical difference dz give separation `sqrt(dr*dr + dz*dz)`. Compare it with an explicitly modeled bead-contact band.

For contour-based methods, closest contact may occur at a different azimuth. Compare current segments with earlier deposited geometry, and measure unsupported length between contacts. For anchored primitives, follow their explicit attachment graph and time-evolving material instead of assuming adjacent revolutions. Compare with calibrated span/attachment evidence as a diagnostic, not a universal veto: unsupported deposition and excess material are part of the product. Path continuity and self-intersection checks do not establish bonding.

Check the swept nozzle and relevant printhead envelope against earlier material, bed, and fixtures. Include the heater block, fan duct, probe, and other protrusions where relevant. Expected contact at the extrusion zone is distinct from a nozzle-body collision. Bread and CurviSlicer document clearance limitations, but their bounds should not be copied as MINI+ settings. [Bread](https://github.com/nick-parker/Bread), [CurviSlicer](https://github.com/mfx-inria/curvislicer)

Separate the deposition envelope from the machine's permitted travel envelope. Setup, purge, and park moves can legitimately lie outside the printable part area. Validate them against a reviewed machine envelope or approved template; do not apply the part's 180 mm square bounds blindly to every move.

## Extrusion model

Name the volume model explicitly. For an ideal strand with a cross-section perpendicular to its trajectory:

`dV = A_perpendicular * ds_3D`

`dE = multiplier * dV / (pi * filament_diameter^2 / 4)`

This is a useful approximation for specified bead geometry, not a universal physical law for nozzle deposition. If width and gap are defined in a vertical plane transverse to XY travel, a layer-contact approximation can instead use projected XY length and a gap-dependent area. Vertical nozzle motion does not automatically make a 3D-length extrusion estimate correct.

FullControl implements 3D-length/area accounting; its research discusses changing extrusion in non-planar conditions. Treat this as a precedent to evaluate. [Extrusion implementation](https://github.com/FullControlXYZ/fullcontrol/blob/master/fullcontrol/gcode/extrusion_classes.py), [Gleadall, 2021](https://doi.org/10.1016/j.addma.2021.102109)

State the model used for supported segments, transitions, and spans. Verify volume with analytical fixtures, then test the approximation physically. Apply flow scaling exactly once: a retained firmware flow command and already-adjusted E values must not accidentally double the adjustment.

## Motion and sampling

For `A*sin(2*pi*f*t)`, peak oscillatory velocity is `2*pi*f*A` and peak acceleration is `(2*pi*f)^2*A`. Doubling frequency doubles velocity demand and quadruples acceleration demand. Base motion, changing speed, and amplitude modulation add terms. These are mathematical relationships, not suggested printer settings.

For a sampled XYZ segment with length L and unit direction u, requested path speed v implies axis speeds `v*u_i`. Bound v by every axis limit and include E/flow demands. For smooth curves, account for curvature acceleration as well as tangential acceleration. For short segments, acceleration/braking reachability and junction handling can prevent the requested speed from being reached.

Buddy's planner contains axis-speed and acceleration limiting. The MINI configuration and its installed settings determine the actual limits; defaults in source must not be assumed to equal the user's runtime state. [Buddy planner](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/master/lib/Marlin/Marlin/src/module/planner.cpp), [inspected MINI configuration](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/4828f8b6a72324d5e6f135e4d9dd01e3ddb58d38/include/marlin/Configuration_MINI.h)

Adaptive sampling needs a geometric-error bound, preservation of extrema/transitions, and a measured command-volume budget. Excessively dense segments can exceed useful planner throughput; coarse segments change the path. Recheck bounds, continuity, extrusion, and state after simplification and export formatting.

Propose text linear moves for the initial export because they are inspectable. This is a scope simplification, not a claim that MINI cannot use arcs or binary files. [Prusa binary G-code documentation](https://help.prusa3d.com/article/binary-g-code_646763)

## MINI+ profile and preview semantics

Installed firmware and the legacy/Input Shaper profile variant must be explicit. Prusa documents Input Shaper support on MINI/+; the inspected official profiles differ in motion and pressure-control setup. They also include flow scaling and an intentional purge move outside the normal part area. Reusing profiles requires understanding this state. [Prusa Input Shaper](https://help.prusa3d.com/article/input-shaper-core-one-mk4-s-mk3-9-s-mk3-5-s-xl-mini_451816), [inspected MINI profile sections](https://github.com/prusa3d/PrusaSlicer-settings-prusa-fff/blob/46064d500118cfe605986beafd1b72bbdb1f6fb8/PrusaResearch/2.5.9.ini#L52686-L52805)

Call the viewport a **commanded nozzle-center path**. Parsing exported G-code can verify command/modal equivalence; it cannot prove exact physical motion. Bed leveling, shaping, planning, quantization, and machine dynamics affect execution. Any executed-motion or deposited-strand simulation remains a stated approximation.

Record exact eSUN product, diameter, color, and lot where available. Do not silently map unspecified PLA to PLA+ or another formulation. Keep physical evidence for white and black separately until a shared process envelope has been demonstrated.

## Base, finish, and hardware regions

A dedicated planar base planner is a reasonable candidate for the constrained vase. Ramp into and out of the decorative body with controlled joins. Review the entire job, including setup, travel, purge, and finish.

A separately sliced base introduces a stateful merge: transforms, coordinates, extrusion modes, temperatures, flow, and retraction must agree. It needs an explicit integration design. It is not automatically simpler than a dedicated base planner.

Integrated lamp brackets and socket interfaces are required in M8. They introduce structural/decorative print regions and specific fitting/material/assembly requirements. Fit coupons can support development, but the milestone must produce an integrated design and combined toolpath plan. The first fitting still needs selection.

## Proposed test ladder

| Stage | Evidence | What it establishes |
|---|---|---|
| Machine/profile record | Firmware, nozzle, material, modifications, source settings, and geometric bounds. | Target profile scope. |
| Numerical/file checks | Analytical fixtures, invalid cases, modal state, independently parsed export. | Correctness within stated computational models. |
| Optional supervised motion inspection | A deliberately designed non-extruding test where useful. | Reachability/obvious envelope issues; an empty bed does not test contact with deposited material. |
| Baseline control print | Small conventional spiral/base from our engine. | Setup, extrusion, adhesion, and transitions. |
| Modulation coupons | Radial then bounded Z/combined trials, changing one principal factor at a time. | An envelope for support, bonding, appearance, and motion on this setup. |
| Primitive/process coupons | Triangles, arches, timed bridges and then sagging/free-space loops, with varied anchors/flow/timing. | Behavior and prediction error for genuinely different deposition methods, including failures. |
| Repeated reference vase | Agreed repetitions and measurements tied to recipe/profile revisions. | Repeatability of the selected preset and range. |
| Later assembly tests | Scoped fitting, retention, load, and thermal evidence. | That assembly only. |

Numeric tolerances, dimensions, sample count, and process domains remain to be agreed before their gates. Physical tests are performed by the product manager. Incorrect commands and unresolved essential machine state are engineering errors. Likely print instability or uncalibrated material behavior is an advisory experimental outcome. No method inherits tested status from another preset, and unstable prints do not by themselves justify disabling a generator.

Accurate physical prediction is a required research/development track. See [filament simulation](filament-simulation.md) for candidate reduced/dynamic models, calibration, held-out validation and compute questions. The wave equations in this report cover one method family; they are not the architecture of the entire studio.

## Sources and limits

Sources linked above were accessed 11 September 2026. Equations and proposed architecture are engineering analysis. No printer was controlled, no samples were printed, and no runnable G-code was generated during research.
