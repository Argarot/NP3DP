# Session 004 — successful retries and next test plan

Date: 12 September 2026. Feedback/status session; app/prepared engine remains 0.3.0. No new machine files or application changes.

## Visible result and physical evidence

The product manager reports: “both A and B work well. Preview and time estimate work as well.” The [new observation record](../evidence/session-004-observations.json) preserves this separately from the original control/wave failure and from the unprinted-at-delivery export reports. Exact A/B printed-file identity/settings, run counts and measurements were not separately supplied. Time-display functionality is reported; elapsed-time accuracy remains unmeasured.

The [current status](../status.md), README and print guides now reflect the successful retries. Inspection of `src/print/calibration.ts` and the saved projects confirms that **03 miniature and 04 held-span have not been reworked**. Session 003 added explicit 05/06 retries and common export fixes. New exports of old projects inherit current export behavior, but retain their recipe geometry; saved historical G-code is unchanged.

## Decision and gates

E29 in [decisions](../decisions.md) records the revised test order: derive a small shaped vase from B, then test anchored arches/held spans separately. This is a reversible staging choice within the approved scope. Preserve existing specimens and give the next designs new identifiers.

T22 now has reported physical preview/time-display evidence; T24 has reported A/B successes. G0 stays passed and G1–G5 stay open. No measurements or repeated-run evidence were supplied to close the remaining gates. Required physics, loops, lamp interfaces and multi-printer milestones remain unchanged.

## Verification

Read the current study definitions and historical projects before reporting their revision status. Documentation-only checks passed: new observation JSON parses, both reference hashes match the existing calibration manifest, all 113 local Markdown links resolve, and `git diff --check` reports no whitespace errors. The prior 168-test/eight-browser-workflow implementation evidence remains historical; no new application test run or physical measurement is claimed.

## Next build session

1. Derive a new miniature from B's 0.40 mm pitch, 0.12 mm wave amplitude and 6 mm/s baseline. Introduce modest shape variation, review the changing-radius geometry, and avoid silently reusing the circular-only contact estimator outside its scope.
2. Prepare a separate short anchored-arch/held-span comparison with explicit attachment and motion/extrusion/dwell checks. Wave success does not validate this method.
3. Generate and independently audit the new numbered projects/G-code, verify previews and estimates, run relevant software checks, and deliver an ordered print guide with updated task evidence.
4. Collect file-linked shape/opening and elapsed-time observations from the next prints; use measured evidence for later compensation, timing and physics calibration.
