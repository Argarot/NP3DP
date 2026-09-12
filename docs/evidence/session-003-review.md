# Session-003 independent review

Root integrated contributions; reviewers worked outside the checkout. No physical print was performed by the agents.

## Attachment and foundation

Independent comparison found the continuous circular-wave analysis matches phase, start/end envelopes, transition, partial final turn and rim indexing. For sampled original-path extrema, differences from interpolated emitted geometry were below 0.0003 mm; the original third-turn contact fraction differed by approximately 0.42 percentage points. This remains an estimate, not an exact emitted-path contact audit. Retry A/B's first three nominal classifications agreed with generated geometry.

First-layer containment, subsequent nominal layers, one-layer transition and even/odd foundation joins were reviewed. Review also found that old squircle parameter sampling could produce 4.2795 mm chords despite a nominal 0.6 mm sampling target; the session includes a sampling correction and regression checks. Circle retries are independent of that squircle issue.

## MINI display and complete files

Review found and closed two metadata-audit omissions: a syntactically valid wrong duration/tail could previously pass, and deletion of the initial M73 could pass because later zero-time updates remained. The audit now requires matching independently timed head/tail estimates and an initial M73 as the first executable command. Mutation fixtures exercise both cases.

An independent decoder read both actual QOI payloads from each generated retry file, exercising full QOI operations and checking image ends, dimensions, pixel counts and nonempty content. Both thumbnail pairs fit comfortably within the first 2,048 lines: A's blocks begin at lines 4/190 and finish at 186/504; B at 4/191 through 187/505. Rows are at most 78 base64 characters. The metadata is for MINI LCD screens; PrusaLink/Connect PNG thumbnails are not included.

The review verified first-command M73, every post-wait refresh, all P/R values against an independent final-text timeline, and completion only after M400. A has 41 updates, 1,057.292183 commanded seconds and maximum update gap 30.039921 seconds; B has 35 updates, 879.716936 commanded seconds and maximum gap 30.075109 seconds. The longest individual command in either file is six seconds. Heating, homing, probing, acceleration and planner time are excluded.

Both jobs retain G28/G29 before extrusion and exact ordered X5→65→135 purge segments at Y6/Z0.2, E8+E10, E reset, clearance lift and checked finish. Final audit records 18 mm startup filament and peak purge flow about 4.48986 mm³/s under the selected 5 mm³/s ceiling.

The [calibration manifest](session-003-calibration.json) is authoritative for final generated checksums. The [observation record](session-003-observations.json) identifies the separate original printed files. No software review proves LCD behavior, purge continuity, attachment, mesh-corrected motion or repeatability on the printer.
