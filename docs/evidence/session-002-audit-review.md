# MINI 5.1.2 complete-job audit review

Reviewed the in-progress `src/print/{types,diagnostics,auditMini,complete}.ts` and `src/export/draft.ts` snapshot on 2026-09-11. This review separates malformed or insufficiently proven machine instructions from the already disclosed absence of physical print validation.

## Result

The current `serializeMiniJob` output has a coherent command sequence for the confirmed target: MINI-family Buddy firmware 5.1.2, stock hotend, 0.4 mm nozzle and 1.75 mm filament. Its startup uses exact modes, disables volumetric E, resets speed/flow/pressure state, sets conservative acceleration, waits at the bed and 170 °C probing targets, homes, meshes, performs a Z-only clearance lift, resolves XY, waits for the first-layer nozzle target, purges, approaches at clearance, and descends without an XY diagonal. The finish retracts, lifts above the parsed body height, parks inside the nominal 180 mm envelope, synchronizes, turns heaters and fan off, resets pressure/flow state and disables motors.

No unsupported or malformed command was found in that emitted sequence. The main defects were audit gaps which allowed later serializer regressions to pass:

1. The old interpreter accepted a combined first post-home XYZ move. That did not prove Z clearance before XY travel.
2. Heater checks used broad ranges and `readyBed < bed`; they did not prove exact setup targets or that the current probing target was the target most recently waited for.
3. `M204` was validated only if present. Removing it still passed because there was no required-state flag.
4. The fan was range-checked but not tied to the resolved PWM or the foundation/transition boundary.
5. A file with the retract, lift and park deleted still passed when it retained `M400`, heater-off, fan-off and `M84`.
6. Exact comparisons against unquantized setup values could reject the serializer's three-decimal output. Conversely, raw temperature comparisons can choose a wait for two values that serialize identically.

## Contribution

- `src/print/auditMini.ts` is a drop-in hardened interpreter. It requires a successful Z-only `G0` to at least 2 mm before any post-home XY resolution; all later positions are explicit absolute moves.
- It compares temperature and acceleration values to three-decimal setup values, requires exact waited probe and first-layer states, permits deliberate non-waited body cooldown, and requires waits for increased body targets. Either safe wait form is accepted when two raw values quantize to the same target.
- It keeps the fan at zero through the foundation and requires `round(fanPercent * 255 / 100)` when the transition begins.
- It requires the controlled finish: exact 0.8 mm stationary retract, Z-only lift at least 5 mm above maximum parsed body Z with a 0.001 mm rounding allowance, exact X10 Y170 park, `M400`, heater/fan shutdown, pressure/flow resets and `M84`.
- It still leaves source-event totals to `compilePrintJob`, which already compares body move count, E and dwell against independently quantized event expectations.
- `tests/print/mini-audit.test.ts` compiles a real control-cup job, verifies valid cooling and heating transitions, and mutates that output by deleting or changing clearance, acceleration, pressure, probing/first-layer temperature waits, fan commands, every finish component and an unsupported opcode.

## Remaining root-owned observations

- The fixed startup/park feeds are 50 mm/s XY and 2 mm/s Z. `parsePrintSetup` currently permits selected limits below those values (5 mm/s XY and 1 mm/s Z). The audit safely blocks such jobs, but the serializer could instead choose the lesser selected limit if every valid setup is meant to export.
- The audit proves a positive, temperature-waited startup extrusion within the machine envelope and below the flow cap. It does not require the purge to be exactly X5/Y6/Z0.2 to X65/Y6 with E6; the current serializer emits that exact strip. Add an explicit purge sub-state only if the purge geometry becomes part of the versioned adapter contract.
- Source diagnostics check nominal deposited radius before quantization. XYZ rounding can move a centre by at most 0.0005 mm relative to that nominal edge. This is below any claimed physical-model accuracy but can be covered by reserving a 0.001 mm software margin if strict mathematical containment is desired.

The eSUN temperature choices, foundation line dimensions, 6 mm purge quantity, pressure-advance reset, retained firmware input shaping, first-layer adhesion, probe calibration and printhead/strand clearance remain unvalidated physical choices. They are clearly reported as such and are not malformed G-code findings.

## Verification

The contribution was overlaid on an isolated copy of the current checkout with the root `node_modules` dependency directory:

- `npm test`: 10 files, 122 tests passed, including 18 new audit tests, including command mutations.
- `npx tsc -b --pretty false`: passed.
- `npm run build`: passed; Vite transformed 46 modules and produced the production bundle.
- Calibration build sizes with the default enabled foundation: control 16,461 events; wave 16,631; mini woven vase 68,480; held spans 14,987. All remain below the 100,000-event generator limit.

No file in `L:\ChatGPT\NP3DP` was edited by this review task.

## Root integration follow-up

The integrated serializer limits startup/park XY travel to the selected XY ceiling. Its Z lifts and foundation layer changes remain 2 mm/s; a selected lower Z ceiling produces a blocking diagnostic/audit result. Bed/deposited-width checks now include flow-adjusted foundation/rim sections and a 0.001 mm XY formatting margin. The transition volume ramps with midpoint gap, verified separately. The final integrated suite passes 133 tests; the earlier 122-test count above records the independent review snapshot. Physical assumptions remain unvalidated.
