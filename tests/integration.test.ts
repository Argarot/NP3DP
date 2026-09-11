import { describe, expect, it } from 'vitest';
import { generateToolpath } from '../src/domain/generate.ts';
import { PRESETS } from '../src/domain/presets.ts';
import { parseRecipe, parseRecipeText, serializeRecipe } from '../src/domain/recipe.ts';
import type { Band, GeneratedToolpath, Recipe, ToolpathEvent, Vec3 } from '../src/domain/types.ts';
import { auditDraftGcode } from '../src/export/audit.ts';
import { exportDraft } from '../src/export/draft.ts';

function smallRecipe(kind: Band['kind']): Recipe {
  return {
    schemaVersion: 1,
    name: `${kind} integration fixture`,
    shape: {
      heightMm: 12,
      baseDiameterMm: 32,
      topDiameterMm: 38,
      bellyMm: 2,
      section: 'circle',
      aspectRatio: 1,
      twistDeg: 0,
    },
    process: {
      pitchMm: 4,
      strandDiameterMm: 0.5,
      filamentDiameterMm: 1.75,
      speedMmS: 20,
      travelMmS: 80,
      flowMultiplier: 1,
    },
    bands: [{
      id: `${kind}-band`,
      kind,
      weight: 1,
      amplitudeMm: 3,
      repeatsPerTurn: 4,
      phaseAdvanceDeg: 0,
      radialAmplitudeMm: 1,
      speedVariation: 0,
      flowVariation: 0,
      dwellSeconds: 0.2,
      anchorVolumeMm3: 0.1,
    }],
  };
}

function allNumbers(path: GeneratedToolpath): number[] {
  const result = [
    path.stats.pathLengthMm,
    path.stats.extrusionVolumeMm3,
    path.stats.filamentLengthMm,
    path.stats.commandedDurationS,
    ...Object.values(path.stats.bounds.min),
    ...Object.values(path.stats.bounds.max),
  ];
  for (const event of path.events) {
    if (event.kind === 'extrude') {
      result.push(...Object.values(event.from), ...Object.values(event.to), event.volumeMm3, event.speedMmS);
    } else if (event.kind === 'travel') {
      result.push(...Object.values(event.from), ...Object.values(event.to), event.speedMmS);
    } else if (event.kind === 'deposit') {
      result.push(...Object.values(event.at), event.volumeMm3, event.volumeRateMm3S);
    } else if (event.kind === 'dwell') {
      result.push(...Object.values(event.at), event.seconds);
    } else {
      result.push(...Object.values(event.at));
    }
  }
  return result;
}

function eventSignature(path: GeneratedToolpath): string {
  return JSON.stringify(path.events);
}

function vector(from: Vec3, to: Vec3): Vec3 {
  return { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
}

function cosine(a: Vec3, b: Vec3): number {
  const aLength = Math.hypot(a.x, a.y, a.z);
  const bLength = Math.hypot(b.x, b.y, b.z);
  return (a.x * b.x + a.y * b.y + a.z * b.z) / (aLength * bLength);
}

describe('integrated recipe, generator, and draft export contracts', () => {
  it.each(PRESETS)('parses, generates, exports, and audits $title', (preset) => {
      const recipe = parseRecipeText(serializeRecipe(preset.recipe));
      const path = generateToolpath(recipe);
      const draft = exportDraft(recipe, path);
      const audit = auditDraftGcode(draft);

      expect(path.events.length, preset.title).toBeGreaterThan(0);
      expect(allNumbers(path).every(Number.isFinite), preset.title).toBe(true);
      expect(audit.errors, preset.title).toEqual([]);
      expect(audit.moveCount, preset.title).toBeGreaterThan(0);
  });

  it('round-trips a small recipe and produces reproducible paths and draft text', () => {
    const original = smallRecipe('wave');
    original.shape.section = 'ellipse';
    original.shape.aspectRatio = 1.35;
    original.shape.twistDeg = 73;
    original.bands[0]!.phaseAdvanceDeg = 90;
    const parsed = parseRecipeText(serializeRecipe(original));
    const first = generateToolpath(parsed);
    const second = generateToolpath(parseRecipe(parsed));

    expect(parsed).toEqual(original);
    expect(second).toEqual(first);
    expect(exportDraft(parsed, second)).toBe(exportDraft(parsed, first));
  });

  it.each([
    { section: 'circle' as const, aspectRatio: 1, twistDeg: 0 },
    { section: 'ellipse' as const, aspectRatio: 1.6, twistDeg: 127 },
    { section: 'squircle' as const, aspectRatio: 0.65, twistDeg: -211 },
  ])('keeps $section contours with $twistDeg° twist finite and distinct', (shape) => {
    const recipe = smallRecipe('wave');
    recipe.shape = { ...recipe.shape, ...shape };
    const path = generateToolpath(parseRecipe(recipe));
    const baseline = generateToolpath(smallRecipe('wave'));

    expect(allNumbers(path).every(Number.isFinite)).toBe(true);
    if (shape.twistDeg !== 0) expect(eventSignature(path)).not.toBe(eventSignature(baseline));
  });

  it.each([
    {
      kind: 'wave' as const,
      change: { amplitudeMm: 7, radialAmplitudeMm: 4, phaseAdvanceDeg: 135 },
    },
    {
      kind: 'triangle' as const,
      change: { amplitudeMm: 8, radialAmplitudeMm: 3, phaseAdvanceDeg: 135 },
    },
    {
      kind: 'arch' as const,
      change: { amplitudeMm: 7, radialAmplitudeMm: 4, phaseAdvanceDeg: -90 },
    },
    {
      kind: 'bridge' as const,
      change: { speedVariation: 0.5, flowVariation: 0.4, anchorVolumeMm3: 0.7 },
    },
  ])('makes $kind controls affect the emitted events', ({ kind, change }) => {
    const base = generateToolpath(smallRecipe(kind));
    const changedRecipe = smallRecipe(kind);
    changedRecipe.bands[0] = { ...changedRecipe.bands[0]!, ...change };
    const changed = generateToolpath(parseRecipe(changedRecipe));

    expect(eventSignature(changed)).not.toBe(eventSignature(base));
    expect(allNumbers(changed).every(Number.isFinite)).toBe(true);
  });

  it('preserves a visible corner in triangular spans', () => {
    const recipe = smallRecipe('triangle');
    recipe.shape = { ...recipe.shape, heightMm: 12, baseDiameterMm: 32, topDiameterMm: 32, bellyMm: 0 };
    recipe.process.pitchMm = 5;
    recipe.bands[0] = { ...recipe.bands[0]!, amplitudeMm: 10, radialAmplitudeMm: 0 };
    const segments = generateToolpath(parseRecipe(recipe)).events.filter((event): event is Extract<ToolpathEvent, { kind: 'extrude' }> => event.kind === 'extrude');
    const cornerCosines = segments.slice(0, -1).flatMap((segment, index) => {
      const next = segments[index + 1];
      if (!next || segment.to.x !== next.from.x || segment.to.y !== next.from.y || segment.to.z !== next.from.z) return [];
      return [cosine(vector(segment.from, segment.to), vector(next.from, next.to))];
    });

    expect(cornerCosines.some((value) => value < 0.25)).toBe(true);
  });

  it('applies bridge speed and flow variation to moving and stationary extrusion', () => {
    const baseRecipe = smallRecipe('bridge');
    const controlledRecipe = smallRecipe('bridge');
    controlledRecipe.bands[0] = {
      ...controlledRecipe.bands[0]!, speedVariation: 0.5, flowVariation: 0.4,
    };
    const base = generateToolpath(baseRecipe);
    const controlled = generateToolpath(parseRecipe(controlledRecipe));
    const baseSpeeds = base.events.filter((event): event is Extract<ToolpathEvent, { kind: 'extrude' }> => event.kind === 'extrude').map((event) => event.speedMmS);
    const controlledSpeeds = controlled.events.filter((event): event is Extract<ToolpathEvent, { kind: 'extrude' }> => event.kind === 'extrude').map((event) => event.speedMmS);
    const baseDeposits = base.events.filter((event): event is Extract<ToolpathEvent, { kind: 'deposit' }> => event.kind === 'deposit').map((event) => event.volumeMm3);
    const controlledDeposits = controlled.events.filter((event): event is Extract<ToolpathEvent, { kind: 'deposit' }> => event.kind === 'deposit').map((event) => event.volumeMm3);

    expect(controlledSpeeds).not.toEqual(baseSpeeds);
    expect(controlledDeposits).not.toEqual(baseDeposits);
    expect(controlledSpeeds.some((speed) => speed !== controlledRecipe.process.speedMmS)).toBe(true);
  });

  it('keeps a high-detail valid recipe finite and rejects an over-budget maximum recipe specifically', () => {
    const highDetail = smallRecipe('wave');
    highDetail.name = 'High detail, bounded';
    highDetail.shape = {
      heightMm: 40, baseDiameterMm: 220, topDiameterMm: 220, bellyMm: 80,
      section: 'squircle', aspectRatio: 2, twistDeg: 360,
    };
    highDetail.process = {
      pitchMm: 5, strandDiameterMm: 1.2, filamentDiameterMm: 3,
      speedMmS: 100, travelMmS: 200, flowMultiplier: 3,
    };
    highDetail.bands[0] = {
      ...highDetail.bands[0]!, weight: 10, amplitudeMm: 12, repeatsPerTurn: 4,
      phaseAdvanceDeg: 180, radialAmplitudeMm: 12, speedVariation: 0.9,
      flowVariation: 1, dwellSeconds: 5, anchorVolumeMm3: 2,
    };
    const bounded = generateToolpath(parseRecipe(highDetail));
    expect(allNumbers(bounded).every(Number.isFinite)).toBe(true);

    const overBudget = structuredClone(highDetail);
    overBudget.shape.heightMm = 200;
    overBudget.process.pitchMm = 0.3;
    overBudget.bands[0]!.repeatsPerTurn = 96;
    expect(() => generateToolpath(parseRecipe(overBudget))).toThrow(/100,000 event limit/);
  });
});
