import { describe, expect, it } from 'vitest';
import type {
  GeneratedToolpath,
  Recipe,
  ToolpathEvent,
  Vec3,
} from '../src/domain/types.ts';
import { auditDraftGcode } from '../src/export/audit.ts';
import { exportDraft } from '../src/export/draft.ts';
import { exportExperimentReport } from '../src/export/report.ts';
import { recipeKeyForDraft, validateDraftInput } from '../src/export/validation.ts';

const recipe: Recipe = {
  schemaVersion: 1,
  name: 'Audit fixture',
  shape: {
    heightMm: 40,
    baseDiameterMm: 30,
    topDiameterMm: 35,
    bellyMm: 2,
    section: 'circle',
    aspectRatio: 1,
    twistDeg: 0,
  },
  process: {
    pitchMm: 0.8,
    strandDiameterMm: 0.45,
    filamentDiameterMm: 1.75,
    speedMmS: 10,
    travelMmS: 30,
    // Export must not apply this again; event volume already records the result.
    flowMultiplier: 2,
  },
  bands: [{
    id: 'wall',
    kind: 'wave',
    weight: 1,
    amplitudeMm: 1,
    repeatsPerTurn: 6,
    phaseAdvanceDeg: 0,
    radialAmplitudeMm: 1,
    speedVariation: 0,
    flowVariation: 0,
    dwellSeconds: 0.25,
    anchorVolumeMm3: 1,
  }],
};

describe('draft wall export', () => {
  it('converts event volume to relative filament E exactly once', () => {
    const area = Math.PI * (recipe.process.filamentDiameterMm / 2) ** 2;
    const events: ToolpathEvent[] = [
      extrude({ x: 0, y: 0, z: 1 }, { x: 10, y: 0, z: 1 }, area * 2),
    ];

    const text = exportDraft(recipe, toolpath(events));
    const audit = auditDraftGcode(text);

    expect(text).toContain('M83');
    expect(text).not.toContain('M221');
    expect(text).toMatch(/G1 X100\.000 Y90\.000 Z1\.000 E2\.00000 F600\.000/);
    expect(audit.errors).toEqual([]);
    expect(audit.extrusionMm).toBeCloseTo(2, 8);
  });

  it('keeps stationary extrusion and dwell as distinct commands', () => {
    const area = Math.PI * (recipe.process.filamentDiameterMm / 2) ** 2;
    const at = { x: 2, y: -3, z: 1 };
    const events: ToolpathEvent[] = [
      { kind: 'deposit', bandId: 'wall', at, volumeMm3: area, volumeRateMm3S: area / 2 },
      { kind: 'dwell', bandId: 'wall', at, seconds: 0.25 },
      { kind: 'anchor', bandId: 'wall', at },
    ];

    const text = exportDraft(recipe, toolpath(events));
    const audit = auditDraftGcode(text);

    expect(text).toMatch(/G1 E1\.00000 F30\.000\nG4 P250\n; ANCHOR/);
    expect(audit.extrusionMm).toBe(1);
    expect(audit.dwellSeconds).toBe(0.25);
    expect(audit.moveCount).toBe(2); // initial approach + E-only deposition
    expect(audit.commandedTimeSeconds).toBeCloseTo(2.25, 8);
  });

  it('records an exact zero-volume deposit as a comment without motion or division', () => {
    const at = { x: 2, y: -3, z: 1 };
    const events: ToolpathEvent[] = [
      { kind: 'deposit', bandId: 'wall', at, volumeMm3: 0, volumeRateMm3S: 0 },
      { kind: 'anchor', bandId: 'wall', at },
    ];

    const text = exportDraft(recipe, toolpath(events));
    const audit = auditDraftGcode(text);

    expect(text).toContain('; DEPOSIT event=0 band=wall at X92.000 Y87.000 Z1.000 volume=0 (no extrusion command)');
    expect(text).not.toMatch(/^G1 /m);
    expect(audit.errors).toEqual([]);
    expect(audit.extrusionMm).toBe(0);
    expect(audit.commandedTimeSeconds).toBe(0);
    expect(audit.moveCount).toBe(1); // initial approach only
  });

  it('rejects positive extrusion that would disappear at E precision', () => {
    const area = Math.PI * (recipe.process.filamentDiameterMm / 2) ** 2;
    const at = { x: 0, y: 0, z: 1 };
    const events: ToolpathEvent[] = [{
      kind: 'deposit',
      bandId: 'wall',
      at,
      volumeMm3: area * 0.000004,
      volumeRateMm3S: area,
    }];

    expect(() => exportDraft(recipe, toolpath(events))).toThrow(/events\[0\].*resolves to E0 at 5-decimal E precision/);
  });

  it('rejects positive XYZ motion that collapses at coordinate precision', () => {
    const events: ToolpathEvent[] = [
      extrude({ x: 0, y: 0, z: 1 }, { x: 0.0004, y: 0, z: 1 }, 1),
    ];

    expect(() => exportDraft(recipe, toolpath(events))).toThrow(/events\[0\].*positive path length.*collapses to zero at 3-decimal XYZ precision/);
  });

  it('emits a full initial XYZ approach and removes negative zero', () => {
    const events: ToolpathEvent[] = [
      extrude({ x: -90, y: -90, z: -0.0001 }, { x: -89, y: -90, z: 0.0001 }, 1),
    ];
    const text = exportDraft(recipe, toolpath(events));

    expect(text).toContain('G0 X0.000 Y0.000 Z0.000 F1800.000');
    expect(text).not.toContain('-0.000');
  });

  it('accepts finite domain fixtures outside editor ranges', () => {
    const fixture: Recipe = {
      ...recipe,
      name: 'Small domain fixture',
      shape: { ...recipe.shape, heightMm: 8, baseDiameterMm: 5, topDiameterMm: 5, aspectRatio: 0.2 },
      process: { ...recipe.process, pitchMm: 0.1, strandDiameterMm: 0.1, filamentDiameterMm: 0.5, speedMmS: 0.5, travelMmS: 0.5, flowMultiplier: 0 },
      bands: [{ ...recipe.bands[0]!, repeatsPerTurn: 1 }],
    };
    const events: ToolpathEvent[] = [
      { kind: 'extrude', bandId: 'wall', from: { x: 0, y: 0, z: 0.1 }, to: { x: 1, y: 0, z: 0.2 }, volumeMm3: 0, speedMmS: 0.5, role: 'wall' },
    ];

    expect(() => exportDraft(fixture, toolpath(events, fixture))).not.toThrow();
  });

  it('sanitizes comment fields so recipe text cannot inject commands', () => {
    const injected: Recipe = { ...recipe, name: 'fixture\nG28\r\nM104 S250' };
    const events: ToolpathEvent[] = [
      extrude({ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }, 1),
    ];
    const text = exportDraft(injected, toolpath(events, injected));

    expect(text).toContain('; Recipe: fixture G28 M104 S250');
    expect(text.split('\n').filter((line) => /^(G28|M104)/.test(line))).toEqual([]);
    expect(auditDraftGcode(text).errors).toEqual([]);
  });

  it('refuses stale keys, non-finite values and discontinuous events', () => {
    const valid = [extrude({ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }, 1)];
    expect(() => exportDraft(recipe, { ...toolpath(valid), recipeKey: '{}' })).toThrow(/recipeKey/);

    const nonFinite = [extrude({ x: 0, y: 0, z: 1 }, { x: Number.NaN, y: 0, z: 1 }, 1)];
    expect(() => exportDraft(recipe, toolpath(nonFinite))).toThrow(/finite/);

    const discontinuous = [
      extrude({ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }, 1),
      extrude({ x: 2, y: 0, z: 1 }, { x: 3, y: 0, z: 1 }, 1),
    ];
    expect(() => exportDraft(recipe, toolpath(discontinuous))).toThrow(/discontinuous/);

    const blocked = toolpath(valid);
    blocked.diagnostics = [{ severity: 'error', code: 'INVALID_JOB', message: 'Generation did not resolve.' }];
    expect(() => exportDraft(recipe, blocked)).toThrow(/blocked by INVALID_JOB/);
  });

  it('audits modal state and rejects unknown or malformed commands', () => {
    const missingM83 = 'G21\nG90\nG92 E0\nG0 X90 Y90 Z1 F1000\nG1 X91 Y90 Z1 E1 F600\n';
    const unknown = 'G21\nG90\nM83\nG92 E0\nG28\n';
    const malformed = 'G21\nG90\nM83\nG92 E0\nG0 X90 Y90 Z1 F1000 S2\n';

    expect(auditDraftGcode(missingM83).errors.join(' ')).toMatch(/M83/);
    expect(auditDraftGcode(unknown).errors.join(' ')).toMatch(/unsupported opcode G28/);
    expect(auditDraftGcode(malformed).errors.join(' ')).toMatch(/expected parameters/);
  });

  it('makes quantization differences bounded and visible to independent parsing', () => {
    const events: ToolpathEvent[] = [
      extrude({ x: 0, y: 0, z: 1 }, { x: 1 / 3, y: 0, z: 1 }, 1 / 7),
    ];
    const path = toolpath(events);
    const text = exportDraft(recipe, path);
    const audit = auditDraftGcode(text);

    expect(Math.abs(audit.extrusionMm - path.stats.filamentLengthMm)).toBeLessThanOrEqual(0.0000051);
    expect(audit.bounds?.max.x).toBe(90.333);

    const altered = text.replace(/E(\d+\.\d+)/, (_match, value: string) => `E${Number(value) + 1}`);
    expect(auditDraftGcode(altered).extrusionMm).not.toBeCloseTo(path.stats.filamentLengthMm, 4);
  });

  it('checks parsed command time against explicit per-event rounding bounds', () => {
    const area = Math.PI * (recipe.process.filamentDiameterMm / 2) ** 2;
    const start = { x: 0.0004, y: 0.0004, z: 1.0004 };
    const end = { x: 1.23456, y: 0.22222, z: 1.11111 };
    const events: ToolpathEvent[] = [
      { kind: 'extrude', bandId: 'wall', from: start, to: end, volumeMm3: area * 0.123456789, speedMmS: 7.123456, role: 'wall' },
      { kind: 'deposit', bandId: 'wall', at: end, volumeMm3: area * 0.234567891, volumeRateMm3S: area * 0.03456789 },
      { kind: 'dwell', bandId: 'wall', at: end, seconds: 0.1234 },
    ];
    const path = toolpath(events);
    const expectations = validateDraftInput(recipe, path).expectations;
    const audit = auditDraftGcode(exportDraft(recipe, path));

    expect(audit.commandedTimeSeconds).toBeCloseTo(expectations.quantizedCommandedTimeSeconds, 10);
    expect(Math.abs(audit.commandedTimeSeconds - expectations.commandedTimeSeconds))
      .toBeLessThanOrEqual(expectations.commandedTimeRoundingBoundSeconds + 1e-10);
    expect(expectations.commandedTimeRoundingBoundSeconds).toBeGreaterThan(0);
    expect(expectations.commandedTimeRoundingBoundSeconds).toBeLessThan(0.01);
    expect(expectations.extrusionRoundingBoundMm).toBeGreaterThan(0);
    expect(expectations.dwellRoundingBoundSeconds).toBeCloseTo(0.0004, 10);
  });

  it('exports a deterministic report with actual limitations and diagnostics', () => {
    const events: ToolpathEvent[] = [
      extrude({ x: 0, y: 0, z: 1 }, { x: 1, y: 0, z: 1 }, 1),
    ];
    const path = toolpath(events);
    const first = exportExperimentReport(recipe, path);
    const second = exportExperimentReport(recipe, path);
    const report = JSON.parse(first) as Record<string, unknown>;

    expect(first).toBe(second);
    expect(report).toMatchObject({
      reportVersion: 1,
      recipe,
      toolpath: { engineVersion: path.engineVersion, diagnostics: path.diagnostics, stats: path.stats },
    });
    expect(first).toMatch(/No printer, clearance, adhesion or physical filament-behaviour test/);
    expect(first).toMatch(/Each positive extrusion and positive-length move must remain nonzero after quantization/);
    expect(first).toMatch(/per-event XYZ, feed, E and dwell rounding differences/);
  });
});

function extrude(from: Vec3, to: Vec3, volumeMm3: number): ToolpathEvent {
  return { kind: 'extrude', bandId: 'wall', from, to, volumeMm3, speedMmS: 10, role: 'wall' };
}

function toolpath(events: ToolpathEvent[], sourceRecipe: Recipe = recipe): GeneratedToolpath {
  let pathLengthMm = 0;
  let extrusionVolumeMm3 = 0;
  let commandedDurationS = 0;
  let extrudeMoves = 0;
  let travelMoves = 0;
  let dwellCount = 0;
  const points: Vec3[] = [];
  for (const event of events) {
    if (event.kind === 'extrude' || event.kind === 'travel') {
      const length = distance(event.from, event.to);
      pathLengthMm += length;
      commandedDurationS += length / event.speedMmS;
      points.push(event.from, event.to);
      if (event.kind === 'extrude') {
        extrusionVolumeMm3 += event.volumeMm3;
        extrudeMoves += 1;
      } else {
        travelMoves += 1;
      }
    } else {
      points.push(event.at);
      if (event.kind === 'deposit') {
        extrusionVolumeMm3 += event.volumeMm3;
        commandedDurationS += event.volumeMm3 === 0 ? 0 : event.volumeMm3 / event.volumeRateMm3S;
      } else if (event.kind === 'dwell') {
        commandedDurationS += event.seconds;
        dwellCount += 1;
      }
    }
  }
  const area = Math.PI * (sourceRecipe.process.filamentDiameterMm / 2) ** 2;
  return {
    engineVersion: 'fixture-engine-1',
    recipeKey: recipeKeyForDraft(sourceRecipe),
    events,
    stats: {
      pathLengthMm,
      extrusionVolumeMm3,
      filamentLengthMm: extrusionVolumeMm3 / area,
      commandedDurationS,
      extrudeMoves,
      travelMoves,
      dwellCount,
      bounds: eventBounds(points),
    },
    diagnostics: [{ severity: 'warning', code: 'UNTESTED', message: 'No physical test.' }],
  };
}

function distance(a: Vec3, b: Vec3): number {
  return Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z);
}

function eventBounds(points: Vec3[]): GeneratedToolpath['stats']['bounds'] {
  const first = points[0];
  if (!first) throw new Error('Fixture requires a point.');
  return points.slice(1).reduce((result, point) => ({
    min: {
      x: Math.min(result.min.x, point.x),
      y: Math.min(result.min.y, point.y),
      z: Math.min(result.min.z, point.z),
    },
    max: {
      x: Math.max(result.max.x, point.x),
      y: Math.max(result.max.y, point.y),
      z: Math.max(result.max.z, point.z),
    },
  }), { min: { ...first }, max: { ...first } });
}
