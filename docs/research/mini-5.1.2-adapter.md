# Prusa MINI/MINI+ 5.1.2 full-text G-code compatibility research

Research date: 11 September 2026. Target facts supplied by the product manager: firmware `5.1.2+13478`, stock hotend, 0.4 mm nozzle, eSUN PLA-Basic; the machine may be an Original Prusa MINI rather than MINI+. This is source and adapter-policy research. It is not printer validation.

## Decision-ready findings

1. **One startup can cover MINI and MINI+.** Prusa's profile current when firmware 5.1.2 shipped names one printer profile `Original Prusa MINI & MINI+`, identifies it to firmware as model `MINI`, and uses the same `G28` then bare `G29` sequence. Firmware 5.1.2 configures one fixed inductive Z-probe interface and one offset; it does not expose separate G-code paths for M.I.N.D.A. and SuperPINDA. Probe identity is therefore not required to serialize a compatible job. It remains required maintenance metadata, and the selected steel sheet must already have a visually verified first-layer calibration. Prusa says either sensor supplies Z endstop and mesh leveling; it also says the Live-Z number is unique to sensor position and sheet. [MINI/MINI+ profile, pinned lines 20729-20775](https://github.com/prusa3d/PrusaSlicer-settings/blob/088c87fba40081a1b7f4a1b0db1a3ea60ad51561/live/PrusaResearch/1.11.9.ini#L20729-L20775), [firmware probe config, pinned lines 763-870](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/include/marlin/Configuration_MINI.h#L763-L870), [Prusa sensor article](https://help.prusa3d.com/article/m-i-n-d-a-superpinda-sensor-testing-mini-mini_134021), [Prusa first-layer calibration](https://help.prusa3d.com/article/first-layer-calibration-mini-mini_229122).

2. **The probing sequence is compatible and temperature-conscious.** The contemporaneous official profile sets the nozzle to 170 C and the bed to the selected first-layer temperature, waits for both, lowers travel acceleration to 1250 mm/s², homes, probes, then restores travel acceleration and heats the nozzle to print temperature. In firmware 5.1.2, `M104`/`M140` set targets without waiting. `M109 S` and `M190 S` wait only while heating; their `R` forms wait while heating or cooling. An independent adapter should issue both non-blocking targets first, then `M190 R<bed>` and `M109 R170` before `G28`/`G29` when it promises probing at the declared temperature. The `R` forms prevent an already-hot machine from probing above the target. [official profile line 20774](https://github.com/prusa3d/PrusaSlicer-settings/blob/088c87fba40081a1b7f4a1b0db1a3ea60ad51561/live/PrusaResearch/1.11.9.ini#L20774), [M104/M109 source, pinned lines 47-155](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/lib/Marlin/Marlin/src/gcode/temperature/M104_M109.cpp#L47-L155), [M140/M190 source, pinned lines 42-69](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/lib/Marlin/Marlin/src/gcode/temperature/M140_M190.cpp#L42-L69).

3. **Bare `G29` is a complete Prusa MINI mesh operation on 5.1.2.** `G28` disables existing leveling before homing. Prusa's UBL compatibility behavior expands a parameterless `G29` to probe (`P1`), interpolate, extrapolate, and activate the new mesh. This makes the profile's bare `G29` meaningful; it must not be replaced with a guessed generic-Marlin macro. [G28 leveling behavior, pinned lines 439-448](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/lib/Marlin/Marlin/src/gcode/calibrate/G28.cpp#L439-L448), [bare G29 expansion, pinned lines 702-710](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/lib/Marlin/Marlin/src/feature/bedlevel/ubl/ubl_G29.cpp#L702-L710).

4. **The requested modal commands are supported, but every relevant mode should be explicit.** `G90` plus `M83` gives absolute XYZ and relative E; firmware implements `M83` directly. Add `M200 D0` because volumetric extrusion is compiled into 5.1.2 and `D0` restores linear filament-millimetre E units. Reset `M220 S100` and use an explicit `M221` value. Firmware's `M221` accepts an integer percentage and directly changes the planner's extrusion factor. For NP3DP, defaulting to `M221 S100` preserves the audited E-volume relation. Prusa's old macro used 95%, but importing that silently would change the experiment; a non-100 value must be a visible material/profile setting and included in the audit. [M83 source](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/lib/Marlin/Marlin/src/gcode/units/M82_M83.cpp#L28-L33), [volumetric config, pinned lines 2146-2158](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/include/marlin/Configuration_MINI_adv.h#L2146-L2158), [M200 behavior, pinned lines 29-47](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/lib/Marlin/Marlin/src/gcode/config/M200-M205.cpp#L29-L47), [M221 behavior](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/lib/Marlin/Marlin/src/gcode/config/M221.cpp#L28-L50).

5. **Input Shaper exists on this firmware, but do not invent tuning.** Prusa states that MINI/+ gained Input Shaper in firmware 5.1.0; the supplied 5.1.2 therefore supports it. The 5.1.2 source has firmware defaults of MZV 118.2 Hz X and 32.8 Hz Y, with Z shaping disabled, and resets IS from EEPROM after a print. The contemporaneous IS slicer profile allows 4000 mm/s² X/Y, while the non-IS profile uses 2500 mm/s² and firmware compile defaults are 1250 mm/s². Those are upstream configurations, not physical validation for NP3DP's novel path. For the first coupon, leave `M593` untouched and explicitly cap `M201`/`M204` at the conservative job policy. `M204 P500 R500 T500` is valid syntax on 5.1.2. [Prusa Input Shaper article](https://help.prusa3d.com/article/input-shaper-core-one-mk4-s-mk3-9-s-mk3-5-s-xl-mini_451816), [firmware IS defaults, pinned lines 63-102](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/lib/Marlin/Marlin/src/feature/input_shaper/input_shaper_config.hpp#L63-L102), [official IS profile limits, pinned lines 20818-20843](https://github.com/prusa3d/PrusaSlicer-settings/blob/088c87fba40081a1b7f4a1b0db1a3ea60ad51561/live/PrusaResearch/1.11.9.ini#L20818-L20843), [firmware MINI limits, pinned lines 688-703](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/include/marlin/Configuration_MINI.h#L688-L703), [M204 P/R/T implementation, pinned lines 87-107](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/lib/Marlin/Marlin/src/gcode/config/M200-M205.cpp#L87-L107).

6. **Pressure Advance must not be left stale.** Firmware's initial PA value is zero with 0.04 s smoothing; `M572 S0` disables it, while `M900` is a legacy compatibility path that calls the same PA implementation. Prusa's December 2023 generic PLA/MINIIS profile used `M572 S0.3` and a 0.06 s smoothing override, but it did not identify eSUN PLA-Basic specifically. A later current profile gives different eSUN values. This is strong evidence that copying a number would be false precision. For the first coupon, explicitly use `M572 S0 W0.04` and record PA as disabled/unvalidated, then calibrate it as its own process parameter. Reset with `M572 S0` in the finish block. [PA defaults](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/lib/Marlin/Marlin/src/feature/pressure_advance/pressure_advance_config.hpp#L5-L13), [M572 semantics](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/lib/Marlin/Marlin/src/gcode/feature/pressure_advance/M572.cpp#L28-L79), [2023 generic PLA values, pinned lines 5954-5976](https://github.com/prusa3d/PrusaSlicer-settings/blob/088c87fba40081a1b7f4a1b0db1a3ea60ad51561/live/PrusaResearch/1.11.9.ini#L5954-L5976).

7. **`G4 P` is supported for explicit dwell events.** Firmware 5.1.2 accepts `P` in milliseconds or `S` in seconds and synchronizes the planner before dwelling. Serialize NP3DP dwell seconds to a checked, nonnegative integer millisecond value and emit `G4 P<n>`. Use `M400` for an end-of-motion barrier because it states the intent more clearly than the official profile's parameterless `G4`. [G4 implementation, pinned lines 27-43](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/lib/Marlin/Marlin/src/gcode/motion/G4.cpp#L27-L43).

8. **Use the nominal bed for generated motion.** Firmware travel limits are X -2..180, Y -3..180 and Z 0..185 mm, while Prusa's printer profile declares a 0..180 mm square bed and 180 mm printable height. The official purge uses Y=-2, which is legal machine travel but outside the declared bed. An independent conservative policy should keep its purge, print, and park XY at 0..180 and its print Z at 0..180; reserve and collision-check a purge strip such as X 5..65, Y 4..8 before export. Lift Z first, then move XY. At finish, retract in relative E, lift to a serializer-computed absolute Z no greater than 180, park at a checked point such as X170 Y170, `M400`, turn heaters and fan off, reset flow and PA, then disable motors. Reject a job when the purge strip, lifted park path, or printhead clearance intersects the job; do not rely on firmware clipping. [firmware travel limits, pinned lines 1010-1027](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/include/marlin/Configuration_MINI.h#L1010-L1027), [official profile bed and motions, pinned lines 20737-20775](https://github.com/prusa3d/PrusaSlicer-settings/blob/088c87fba40081a1b7f4a1b0db1a3ea60ad51561/live/PrusaResearch/1.11.9.ini#L20737-L20775), [software endstops, pinned lines 1059-1077](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/include/marlin/Configuration_MINI.h#L1059-L1077).

## Minimal independently written policy

The adapter should generate values from normalized machine/material/job records and keep all substitutions visible in the audit. A safe first-coupon ordering is:

```gcode
M862.3 P "MINI"
M862.1 P0.4
G21
G90
M83
M200 D0
M220 S100
M221 S100
M572 S0 W0.04
M140 S<bed>
M104 S170
M190 R<bed>
M109 R170
M201 X1250 Y1250 Z400 E4000
M204 P500 R500 T500
G28
G29
G0 Z2 F720
G0 X5 Y6 F2400
M104 S<first-layer-nozzle>
M109 R<first-layer-nozzle>
G0 Z0.2 F720
G1 X65 E<purge-mm> F600
G0 Z2 F720
; move to checked job start, lower, and consume the shared event stream
```

The exact purge amount is a visible calibration value, not a copied macro constant. `M862.3` and `M862.1` are useful 5.1.2 preflight checks; MINI and MINI+ both use model `MINI`. The firmware source scans these checks near the file start and compares nozzle diameter to the configured machine. [5.1.2 preflight fields](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/src/common/gcode/gcode_info.hpp#L52-L60), [model/nozzle comparison](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/src/common/gcode/gcode_info.cpp#L347-L441).

The finish block should use the known emitted maximum Z and checked park path rather than a runtime expression copied from PrusaSlicer:

```gcode
G1 E-0.8 F2100
G0 Z<min(job-max-z+5,180)> F720
G0 X170 Y170 F4200
M400
M104 S0
M140 S0
M107
M221 S100
M572 S0
M84
```

The PLA-Basic material record should start as **unvalidated**. eSUN's current official product data recommends 210-230 C nozzle, 45-60 C bed, 100% fan and lists 220/55 C in its test condition. A reversible first-coupon default of 220 C nozzle and 55 C bed lies inside those ranges, but it is not MINI-specific validation. The job must include an explicit cooling transition after the foundation/first layer; leaving `M107` active for the whole print contradicts the supplier's recommendation. eSUN's test condition lists 4 mm³/s, so 4 mm³/s is a defensible initial cap for this exact grade, not the 13 mm³/s value in Prusa's older generic `Esun PLA` entry. [eSUN PLA-Basic product page](https://www.esun3d.com/pla-basic-product), [eSUN PLA-Basic TDS](https://www.esun3d.com/uploads/PLA-Basic_TDS-V1-2024.08.07.pdf), [Prusa's older generic Esun PLA entry, pinned lines 13938-13948](https://github.com/prusa3d/PrusaSlicer-settings/blob/088c87fba40081a1b7f4a1b0db1a3ea60ad51561/live/PrusaResearch/1.11.9.ini#L13938-L13948).

## Firmware and profile provenance

- Installed target: `5.1.2+13478`. Official release `v5.1.2`, commit [`6f686bff4e0bb6660815e0bb944b971f1b7577c5`](https://github.com/prusa3d/Prusa-Firmware-Buddy/tree/6f686bff4e0bb6660815e0bb944b971f1b7577c5), released 15 December 2023, explicitly covers MINI/MINI+. [Release](https://github.com/prusa3d/Prusa-Firmware-Buddy/releases/tag/v5.1.2).
- Contemporaneous profile reference: legacy Prusa settings commit [`088c87fba40081a1b7f4a1b0db1a3ea60ad51561`](https://github.com/prusa3d/PrusaSlicer-settings/tree/088c87fba40081a1b7f4a1b0db1a3ea60ad51561), bundle `live/PrusaResearch/1.11.9.ini`, committed 18 December 2023. Its index targets PrusaSlicer 2.7.0-beta1 or later and records the final 5.1.0 MINI IS profile lineage. [Pinned index](https://github.com/prusa3d/PrusaSlicer-settings/blob/088c87fba40081a1b7f4a1b0db1a3ea60ad51561/live/PrusaResearch/index.idx#L1-L12).
- Current profile comparison only: commit [`46064d500118cfe605986beafd1b72bbdb1f6fb8`](https://github.com/prusa3d/PrusaSlicer-settings-prusa-fff/tree/46064d500118cfe605986beafd1b72bbdb1f6fb8), `PrusaResearch/2.5.9.ini`. It shows current MINI coverage but targets a much later profile/firmware ecosystem and must not be treated as the 5.1.2 contract. [Pinned current MINI profile](https://github.com/prusa3d/PrusaSlicer-settings-prusa-fff/blob/46064d500118cfe605986beafd1b72bbdb1f6fb8/PrusaResearch/2.5.9.ini#L52686-L52805).

## License and reuse boundary

The legacy `PrusaSlicer-settings` repository containing the contemporaneous 1.11.9 bundle has an explicit AGPL-3.0 license. Copying its INI data or start/end macros into NP3DP would therefore be a distribution/licensing commitment and is inappropriate while NP3DP's product license remains undecided. [Pinned license](https://github.com/prusa3d/PrusaSlicer-settings/blob/088c87fba40081a1b7f4a1b0db1a3ea60ad51561/License).

The separate current `PrusaSlicer-settings-prusa-fff` tree at the inspected commit contains no root `LICENSE`, `COPYING`, `NOTICE`, or `README`; the bundle header also states no license. That does not make the data license-free. Do not bundle it until Prusa supplies clear terms or a product licensing review accepts the risk. [Pinned current repository tree](https://github.com/prusa3d/PrusaSlicer-settings-prusa-fff/tree/46064d500118cfe605986beafd1b72bbdb1f6fb8).

A narrow parser for a flat configuration exported by the user from their own installed PrusaSlicer does not require NP3DP to redistribute Prusa's profile dataset. Treat that file as validated, untrusted user input: record its slicer/version, selected profile names, content digest and overrides; accept only a fixed field allow-list; reject unresolved inheritance, placeholders, expressions, custom G-code and post-processing rather than executing them. NP3DP should generate its own start/finish blocks from normalized facts and cite provenance. Importing user data and bundling upstream data are separate decisions. [Prusa import/export instructions](https://help.prusa3d.com/article/how-to-import-and-export-custom-profiles-in-prusaslicer_382766), [Prusa vendor bundle specification](https://github.com/prusa3d/PrusaSlicer/wiki/Vendor-bundles-and-updating-process).

## Physical gate

This research supports software compatibility only. Before calling a file print-ready, confirm the active 0.4 mm nozzle setting, installed sheet profile and first-layer calibration; inspect that the purge strip and parked head clear the coupon; supervise the first low-speed coupon; record actual extrusion, adhesion, cooling, ringing and PA observations. The miniature woven vase should follow only after that coupon, with its own bounded height, head-clearance, cooling and volumetric-flow checks.

## Unheated-bed case found during integration

`M190 R0` is not immediate in this firmware: it enters the cooling loop and only escapes via the cooling-slope safeguard (60-second checks, 1.5 °C threshold). The source explicitly identifies R0 as misuse. NP3DP therefore emits `M140 S0` without a bed wait when the selected first-layer bed target is zero. Its audit treats explicit heater-off as the resolved zero-bed state, rejects wait-to-zero and still requires waits for positive targets/increases. [M190 implementation](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/lib/Marlin/Marlin/src/gcode/temperature/M140_M190.cpp#L42-L69), [bed cooling loop](https://github.com/prusa3d/Prusa-Firmware-Buddy/blob/6f686bff4e0bb6660815e0bb944b971f1b7577c5/lib/Marlin/Marlin/src/module/temperature.cpp#L3999-L4109).
