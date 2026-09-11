# Project working agreement

- Read `docs/status.md` and the latest session record before continuing. The PRD is the product contract; status records distinguish implementation from physical validation.
- End every working session with a visible result, current task/gate status, decision updates, verification evidence, and a concrete next-session plan.
- Log reversible, low-impact defaults in `docs/decisions.md`. Ask the product manager before major scope, licensing, hosting, hardware or physics-accuracy commitments.
- Keep domain mathematics independent of React, Three.js, storage and firmware. Use explicit millimetres, seconds and cubic millimetres; convert to G-code only at the adapter boundary.
- Recipes are versioned, validated untrusted input. Changes to persisted semantics require a migration or version change. No eval, silent clamping, or silently changing a user's experiment.
- Generators produce explicit motion, stationary extrusion, dwell and anchor events. Preview and export consume those same events. A rendered filament tube is not a validated physical simulation.
- Preserve intentional corners and continuous phase. Bound resource use, cancel obsolete jobs, and never let stale output replace current settings.
- Test mathematical/event invariants and export semantics. Run type checking, unit tests, production build and relevant browser checks. Record actual evidence; do not claim unperformed printer tests.
- Prefer small cohesive modules and bounded subagent ownership. Do not add backend services or large frameworks for speculative future needs.
- Do not vendor upstream code or printer profiles without a recorded source, version, license and integration review. Product licensing is undecided; `UNLICENSED` in package metadata prevents accidental publication and is not a chosen open-source license.
