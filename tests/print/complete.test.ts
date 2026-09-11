import { describe, expect, it } from 'vitest';
import { CALIBRATION_STUDIES } from '../../src/print/calibration';
import { compilePrintJob } from '../../src/print/complete';
import { DEFAULT_PRINT_SETUP, parsePrintSetup } from '../../src/print/setup';
import { prepareBuild } from '../../src/print/prepare';
import { inspectPrintJob } from '../../src/print/diagnostics';
import { auditMiniGcode } from '../../src/print/auditMini';

const setup = () => parsePrintSetup({ ...DEFAULT_PRINT_SETUP, foundation: { ...DEFAULT_PRINT_SETUP.foundation, enabled: true } });

describe('complete MINI experiments', () => {
  for (const study of CALIBRATION_STUDIES) it(`compiles and audits ${study.title}`, () => {
    const result = compilePrintJob(study.recipe, setup());
    expect(result.diagnostics.filter((entry) => entry.severity === 'error')).toEqual([]);
    expect(result.text).toContain('M200 D0');
    expect(result.text).toContain('M109 R170');
    expect(result.text).toContain('M862.3 P"MINI"');
    expect(result.text).toContain('M106 S255');
    expect(result.text).toContain('; STAGE foundation');
    expect(result.text).toContain('; STAGE rim');
    expect(result.audit?.shutdownComplete).toBe(true);
    expect(result.audit?.bodyExtrusionMm).toBeGreaterThan(0);
    expect(result.audit?.errors).toEqual([]);
    const report = JSON.parse(result.report);
    expect(report.observations.printed).toBe(false);
    expect(report.project.recipe).toEqual(study.recipe);
    if (study.id === 'held-spans') expect(result.text).toContain('G4 P150');
  });

  it('keeps unresolved adapter state and wall-only recipes out of full output', () => {
    const recipe = CALIBRATION_STUDIES[0]!.recipe;
    const differentFirmware = setup(); differentFirmware.printer.firmware = '6.0.0';
    expect(compilePrintJob(recipe, differentFirmware).text).toBeNull();
    expect(compilePrintJob(recipe, DEFAULT_PRINT_SETUP).diagnostics.some((entry) => entry.code === 'job.foundation-required')).toBe(true);
  });
  it('supports an explicitly unheated bed without an unattainable cooling wait', () => {
    const config = setup();
    config.material.firstLayerBedC = 0; config.material.bedC = 0;
    const result = compilePrintJob(CALIBRATION_STUDIES[0]!.recipe, config);
    expect(result.audit?.errors).toEqual([]);
    expect(result.text).toContain('M140 S0.000');
    expect(result.text).not.toContain('M190');
    const regressed = result.text!.replace('M140 S0.000', 'M140 S0.000\nM190 R0.000');
    expect(auditMiniGcode(regressed, config).errors.join(' ')).toContain('without a cooling wait to zero');
    config.material.bedC = 60;
    const heatedBody = compilePrintJob(CALIBRATION_STUDIES[0]!.recipe, config);
    expect(heatedBody.audit?.errors).toEqual([]);
    expect(heatedBody.text).toContain('M190 R60.000');
  });
  it('diagnoses command Z/flow limits without modifying the recipe', () => {
    const recipe = structuredClone(CALIBRATION_STUDIES[1]!.recipe);
    recipe.process.speedMmS = 95;
    const config = setup(), before = JSON.stringify(recipe);
    const result = compilePrintJob(recipe, config);
    expect(result.text).toBeNull();
    expect(result.diagnostics.some((entry) => entry.code === 'motion.z-limit')).toBe(true);
    expect(result.diagnostics.some((entry) => entry.code === 'flow.limit')).toBe(true);
    expect(JSON.stringify(recipe)).toBe(before);
  });
  it('rejects stale prepared inputs and protects the purge strip', () => {
    const config = setup(), recipe = structuredClone(CALIBRATION_STUDIES[0]!.recipe);
    const build = prepareBuild(recipe, config.foundation);
    const changed = { ...recipe, name: 'changed' };
    expect(inspectPrintJob(changed, config, build).diagnostics.some((entry) => entry.code === 'job.stale')).toBe(true);
    const escaped = { ...build, path: { ...build.path, events: [{ kind: 'travel' as const, bandId: recipe.bands[0]!.id, from: { x: 0, y: -82, z: 1 }, to: { x: 1, y: -82, z: 1 }, speedMmS: 10 }] } };
    expect(inspectPrintJob(recipe, config, escaped).diagnostics.some((entry) => entry.code === 'bounds.purge-strip')).toBe(true);
  });
  it('includes rim width and increased flow in the deposited bed envelope', () => {
    const config = setup(), recipe = structuredClone(CALIBRATION_STUDIES[0]!.recipe);
    recipe.process.flowMultiplier = 2;
    const build = prepareBuild(recipe, config.foundation);
    const rim = build.path.events.find((event) => event.kind === 'extrude' && event.role === 'rim')!;
    if (rim.kind !== 'extrude') throw new Error('Missing rim fixture');
    const originalLength = Math.hypot(rim.to.x - rim.from.x, rim.to.y - rim.from.y, rim.to.z - rim.from.z);
    const edge = { ...rim, from: { x: 89.6, y: 0, z: 1 }, to: { x: 89.6, y: 1, z: 1 }, volumeMm3: rim.volumeMm3 / originalLength };
    const result = inspectPrintJob(recipe, config, { ...build, path: { ...build.path, events: [edge] } });
    expect(result.diagnostics.some((entry) => entry.code === 'bounds.bed')).toBe(true);
  });
});
