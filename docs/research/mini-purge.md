# MINI retry purge review

## Finding

The current adapter waits at X5, Y6, Z2 for first-layer nozzle temperature,
resets relative E, lowers to Z0.2, and makes one 60 mm purge move with 6 mm of
1.75 mm filament. At the default 5 mm3/s cap the command is F600, so it deposits
14.432 mm3 at 2.405 mm3/s. The final-text auditor only requires some positive
startup extrusion; it does not prove the purge coordinates, amount, ordered
segments, or return to clearance.

The pinned official Prusa profile uses a much larger two-part intro line:

- Original MINI/MINI+ 0.4: 60 mm with E8 F900, followed by 70 mm with E10 F700.
- MINI/MINI+ Input Shaper 0.4: the same 60/E8/F900 and 70/E10/F700 pattern.

The official coordinates use Y=-2. NP3DP has already chosen a more conservative
0..180 XY policy and reserves Y<10 for purge, so adapting the distances and
amounts to X5..135, Y6 is preferable to copying the machine-edge coordinates.

Primary source: Prusa Research, PrusaSlicer settings 1.11.9, commit
`088c87fba40081a1b7f4a1b0db1a3ea60ad51561`, MINI profile `start_gcode`:
https://raw.githubusercontent.com/prusa3d/PrusaSlicer-settings/088c87fba40081a1b7f4a1b0db1a3ea60ad51561/live/PrusaResearch/1.11.9.ini
(raw lines 20611 and 20677). The repository declares AGPL-3.0; retain the
source/version/license/integration note required by the project agreement and
do not import the profile wholesale.

Prusa's hardware glossary confirms that the MINI's side-mounted extruder pushes
filament through a Bowden PTFE tube:
https://help.prusa3d.com/glossary/extruder-extruder-motor-mini_142004 . This
supports allowing a moving intro segment to establish flow after the thermal
wait. It does not establish a calibrated pressure volume for this material.

## Proposed visible, flow-capped sequence

Starting from the adapter's existing X5, Y6, Z2 position after mesh probing:

```gcode
M109 R215.000                 ; resolved first-layer temperature
G92 E0
G0 Z0.200 F120.000
; moving prime / first intro segment
G1 X65.000 Y6.000 E8.00000 F840.000
; visible verification segment
G1 X135.000 Y6.000 E10.00000 F700.000
G92 E0
G0 Z2.000 F120.000
```

For 1.75 mm filament, `Af=pi*(1.75/2)^2=2.405281875 mm2`. At F840 the
first segment commands 4.48986 mm3/s. At F700 the second commands 4.00880
mm3/s. Total purge is 18 mm filament or 43.2951 mm3 over 130 mm, matching the
official distances and E amounts. The first segment remains below 90% of the
selected 5 mm3/s cap; the second remains below it as well.

For a different selected cap, calculate each feed independently:

`F = min(officialF, 0.9*maxFlow*60*L/(E*Af), maxXySpeed*60)`

Serialize down or with enough margin that decimal rounding cannot exceed the
cap. If the result becomes impractically slow under a very low cap, block or
warn instead of silently changing E or exceeding the selected limit.

Do not add a stationary extrusion-only prime for this retry. It would create a
blob or hanging strand without providing a visible line-quality check, and the
official MINI sequence establishes flow while moving. Treat segment one as the
sacrificial pressure-building section and segment two as the observation gate:
if segment two is not continuous, stop before the foundation.

## Auditor changes needed with the serializer change

Replace the `startupExtrusion` boolean as the sole completion gate with an
ordered startup-purge state:

1. Post-mesh Z-only clearance reaches Z2.
2. XY reaches exactly X5, Y6 at clearance.
3. The first-layer nozzle target has completed its wait.
4. Z-only descent reaches Z0.2.
5. Exact moving purge reaches X65, Y6, Z0.2 with E8 and the derived feed.
6. Exact visible segment reaches X135, Y6, Z0.2 with E10 and its derived feed.
7. E is reset and Z-only clearance returns to Z2 before part approach.

Expose `startupExtrusionMm=18` and `purgeComplete=true` in the audit/report.
Keep the independent parsed-flow calculation already present. Mutation tests
should remove or alter each segment, E amount, coordinate, feed, wait, reset,
and post-purge lift and require rejection.

This sequence can verify that material appears before the object. It cannot
calibrate Bowden pressure, extrusion width, sheet adhesion, or blob behavior.
