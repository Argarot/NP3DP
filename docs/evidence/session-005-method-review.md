# Session 005 method and geometry review

Date: 12 September 2026. Independent numerical review of the new 07–09 study definitions and their generated event streams. Domain engine `0.2.0`; prepared-build engine `0.4.0`; MINI adapter `prusa-mini-buddy-5.1.2`. This is commanded-path evidence, not a printer result or a filament-physics validation.

## Method

The review used the exact recipes in [`examples/next-prints`](../../examples/next-prints/) with the common three-layer foundation, one-turn transition and 4 mm start blend. Studies 07 and 09 have one finish rim; 08 deliberately has none. It checked generated event order and continuity, regenerated each complete job from its saved project, compared the bytes and report to the published files, and independently parsed the final G-code. Matched-revolution separation was measured on the emitted three-dimensional polylines at common polar rays. A centreline separation at or below the nominal 0.45 mm strand diameter is called nominal contact only; this does not model bead shape, welding, cooling, sag or nozzle clearance.

For the shaped wave, a separate dense evaluation compared each wall point with the preceding revolution using the exact taper/belly radius and wave/start-blend equations. For the arch, the quadratic curves were evaluated against the preceding revolution with their 180° phase stagger. For the timed chord, the circular chord sagitta and helical rise were also checked analytically.

## Reviewed studies

| ID | Geometry and process | Pattern purpose |
|---|---|---|
| 07 Mini vase B | 34 mm base, 38 mm top, 24 mm wall, 1 mm radial belly; B baseline: 0.40 mm pitch, 0.45 mm strand, 6 mm/s, 0.12 mm wave, 14 repeats plus 180°/turn | Transfers reported-successful B to a modest changing radius without increasing the wave amplitude. |
| 08 Arch coupon | 32 mm diameter, 10.2 mm wall; 4.2 mm/14-turn collar then 6.0 mm/20-turn arch region; 0.30 mm pitch, 0.45 mm strand, 6 mm/s; 0.20 mm quadratic arches, 24 repeats plus 180°/turn; no finish rim | Tests short curved arches and staggered end contact. The method region contains 490 complete motifs and leaves its scalloped top exposed. |
| 09 Held span V2 | Same body, collar and process as 08; 24 direct chords/turn, zero lift, zero radial offset, phase advance 0°; 0.02 mm³ stationary deposit and 0.10 s dwell at each departing endpoint | Isolates stationary endpoint deposition and dwell from lifted-post geometry. The method region contains 480 complete motifs. |

The 4.2 mm collar ends after exactly 14 turns. The 6.0 mm method region ends after exactly 20 more turns. Its accumulated phase therefore closes on whole motifs for both 08 (`20 × 24.5 = 490`) and 09 (`20 × 24 = 480`), and both method endpoints return to the nominal contour. Only 09 adds a rim after that endpoint.

## Geometry and event findings

The scaled side profiles of the first two method motifs are shown in [`session-005-methods.svg`](session-005-methods.svg). The panels use different labelled vertical scales because the arch amplitude and helical chord rise differ by an order of magnitude.

07 retains B's wave parameters exactly. The changing radius contributes at most 0.0857 mm radial centreline change over a sampled revolution. Across wall-to-prior-turn comparisons, sampled separation is 0.160–0.645 mm and 58.7% is at or below 0.45 mm. The second and third wall turns are wholly within the nominal threshold; the fourth is about 83%. The generated path-contact report also includes the transition and rim and records 0.104–0.645 mm overall. This makes 07 a bounded shape-transfer test, not evidence that taper and belly preserve B's physical attachment.

08's half-motif stagger makes a new arch endpoint coincide in angle with the preceding arch apex. In the full-amplitude method interior, the matched-revolution separation spans 0.100–0.500 mm; 87.5% of sampled phase is within the nominal 0.45 mm threshold. The first and last motif envelopes reduce amplitude at the band edges. The complete emitted-path report finds 0.100–0.5000 mm, with a wall-weighted nominal-contact estimate of about 92%. A provisional one-rim export produced a separate 0.0065 mm near-coincidence between the arch body and rising rim, so the final 08 setup explicitly uses zero rim turns and leaves the arches exposed. The 0.20 mm amplitude was selected because 0.30 mm would widen the ideal staggered range to approximately 0–0.60 mm on the first method test.

09 emits exactly 480 `span`, 480 `deposit`, 480 `dwell` and 481 `anchor` events in the timed-chord band, with no `rise` or `fall` event. Each chord is 4.1769 mm. Its 0.1369 mm midpoint sagitta and 0.300 mm helical rise combine to a 0.3298 mm first-turn centreline distance from the preceding circular collar; later phase-aligned chords repeat 0.300 mm above the prior chord. The emitted-path report finds 0.200–0.3298 mm overall and no over-threshold window. Therefore 09 is a timed endpoint and straight-chord test. It is not a free-space sag coupon.

The original 04 lifted bridge remains mechanically high risk. In every full-amplitude interior motif the generator extrudes a fall into an anchor, deposits and dwells, then extrudes the same post in reverse as the next rise. With its aligned anchors, 0.80 mm lift and 0.30 mm pitch, the next revolution also places an anchor centreline inside the earlier post. New diagnostics expose both facts without modifying the historical recipe. A possible later 0.12 mm-lift specimen would avoid the cross-revolution centreline intersection, but it would still double-extrude every interior post and would add about 115.2 mm of moving extrusion over 480 motifs. It should follow observation of the zero-lift control rather than join this batch.

During generation, floating-point phase accumulation initially produced a terminal zero-motion bridge interval: 480 spans but 481 deposits/dwells and 482 anchor markers. The corrected shared phase-boundary calculation removes boundaries within a scale-aware few-ulp tolerance from both preflight and emission. The exact 09 counts are now 480/480/481, and a regression moves the band boundary by a material amount and confirms that a genuine partial span remains.

## Generated-job audit

The session manifest is [`session-005-calibration.json`](session-005-calibration.json). All three generated files regenerated byte-for-byte from their saved projects, contain both MINI QOI thumbnails, perform the two-part 18 mm purge after mandatory mesh levelling, finish with the ordered shutdown, and have zero independent-audit errors.

| ID | G-code bytes / SHA-256 | Prepared events | Prepared commanded time | Parsed final-command time | Body dwell | Parsed maximum flow |
|---|---|---:|---:|---:|---:|---:|
| 07 | 1,187,895 / `1f2536be57434ce92282252cd9f67caf0435015e760e3bdcd4d2860b86c48a49` | 25,158 | 1,498.75 s | 1,518.41 s | 0 s | 4.490 mm³/s |
| 08 | 1,108,259 / `2698112ece0a2e20a0872b5bea426ad0c0b25247176d4f896690dfc913c88411` | 23,764 | 857.49 s | 877.20 s | 0 s | 4.490 mm³/s |
| 09 | 798,288 / `e2e51026b4a6c0211fab952da643b55a97a6d3d50fd83c355e7e2a90bdb5977d` | 17,371 | 917.53 s | 937.15 s | 48.00 s | 4.490 mm³/s |

The parsed time includes adapter moves omitted from the prepared-path statistic. Both exclude thermal waits, probing, homing duration, acceleration and firmware dynamics. The 4.490 mm³/s maximum occurs in the flow-capped purge; the prepared deposition path maximum is 1.628 mm³/s.

## Print order and stop conditions

Print 07, then 08, then 09. Stop the sequence and retain the failed output if a specimen detaches, strands collect on the nozzle, the nozzle or fan duct touches prior material, or an endpoint deposit grows enough to catch the nozzle. Record the exact filename, spool colour, run count, elapsed time, opening/endpoint observations and dimension measurements. For 08, inspect the collar-to-arch join, alternating endpoint contact and the small maximum-gap regions. For 09, inspect deposit consistency, corner pull-away and straightness; do not interpret success as validation of unsupported-span sag.

The geometry checks support this ordered experiment and the new diagnostics. They do not close clearance, repeatability, dimensional-accuracy, thermal-bonding or predictive-physics gates. The limits and relevant primary-source context remain recorded in [`wave-attachment.md`](../research/wave-attachment.md).
