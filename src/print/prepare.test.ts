import { describe, expect, it } from 'vitest';
import { generateToolpath } from '../domain/generate';
import { distance } from '../domain/math';
import type { Band, Recipe, ToolpathEvent, Vec3 } from '../domain/types';
import { exportDraft } from '../export/draft';
import { prepareBuild, PREPARED_BUILD_ENGINE_VERSION } from './prepare';
import type { FoundationSettings, PrintStage } from './types';

function testBand(overrides: Partial<Band> = {}): Band {
  return {
    id: 'body',
    kind: 'wave',
    weight: 1,
    amplitudeMm: 0.3,
    repeatsPerTurn: 2,
    phaseAdvanceDeg: 0,
    radialAmplitudeMm: 0.2,
    speedVariation: 0,
    flowVariation: 0,
    dwellSeconds: 0,
    anchorVolumeMm3: 0,
    ...overrides,
  };
}

function testRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    schemaVersion: 1,
    name: 'prepared test',
    shape: {
      heightMm: 4,
      baseDiameterMm: 8,
      topDiameterMm: 9,
      bellyMm: 0.5,
      section: 'circle',
      aspectRatio: 1,
      twistDeg: 15,
    },
    process: {
      pitchMm: 1,
      strandDiameterMm: 0.4,
      filamentDiameterMm: 1.75,
      speedMmS: 12,
      travelMmS: 40,
      flowMultiplier: 1.1,
    },
    bands: [testBand()],
    ...overrides,
  };
}

function foundationSettings(overrides: Partial<FoundationSettings> = {}): FoundationSettings {
  return {
    enabled: true,
    layers: 3,
    layerHeightMm: 0.2,
    lineWidthMm: 0.45,
    speedMmS: 20,
    blendHeightMm: 4,
    rimTurns: 1,
    ...overrides,
  };
}

function eventStart(event: ToolpathEvent): Vec3 {
  return event.kind === 'extrude' || event.kind === 'travel' ? event.from : event.at;
}

function eventEnd(event: ToolpathEvent): Vec3 {
  return event.kind === 'extrude' || event.kind === 'travel' ? event.to : event.at;
}

function expectSamePoint(actual: Vec3, expected: Vec3): void {
  expect(actual.x).toBeCloseTo(expected.x, 10);
  expect(actual.y).toBeCloseTo(expected.y, 10);
  expect(actual.z).toBeCloseTo(expected.z, 10);
}

function eventsForStage(result: ReturnType<typeof prepareBuild>, stage: PrintStage): ToolpathEvent[] {
  return result.path.events.slice(stage.startEvent, stage.endEvent);
}

describe('prepareBuild', () => {
  it('keeps disabled schema-1 generation byte-for-byte identical', () => {
    const recipe = testRecipe();
    const settings = foundationSettings({ enabled: false });
    const expected = generateToolpath(recipe);
    const prepared = prepareBuild(recipe, settings);
    expect(prepared.path).toEqual(expected);
    expect(prepared.path.engineVersion).toBe('0.1.0');
    expect(prepared.wallOffsetZMm).toBe(0);
    expect(prepared.stages).toEqual([{ kind: 'wall', startEvent: 0, endEvent: expected.events.length }]);
    expect(prepared.buildKey).toBe(JSON.stringify({ recipe, foundation: settings }));
  });

  it('uses the analytic polygon and radial-connector volume for a circular base', () => {
    const recipe = testRecipe({
      shape: {
        heightMm: 1,
        baseDiameterMm: 2,
        topDiameterMm: 2,
        bellyMm: 0,
        section: 'circle',
        aspectRatio: 1,
        twistDeg: 0,
      },
      process: { ...testRecipe().process, flowMultiplier: 1.2 },
      bands: [testBand({ amplitudeMm: 0, radialAmplitudeMm: 0 })],
    });
    const settings = foundationSettings({
      layers: 1,
      layerHeightMm: 0.2,
      lineWidthMm: 1,
      blendHeightMm: 0,
      rimTurns: 0,
    });
    const prepared = prepareBuild(recipe, settings);
    const foundation = prepared.stages.find((stage) => stage.kind === 'foundation');
    if (foundation === undefined) throw new Error('Missing foundation stage.');
    const actualVolume = eventsForStage(prepared, foundation).reduce(
      (sum, event) => sum + (event.kind === 'extrude' ? event.volumeMm3 : 0), 0);
    const polygonCircumference = 2 * 32 * Math.sin(Math.PI / 32);
    const pathLength = 1 + polygonCircumference;
    const beadArea = (1 - 0.2) * 0.2 + Math.PI * 0.2 ** 2 / 4;
    expect(actualVolume).toBeCloseTo(pathLength * beadArea * 1.2, 10);
  });

  it('ramps transition stadium area from midpoint gap and matches its analytic sum', () => {
    const recipe = testRecipe({
      shape: {
        heightMm: 1,
        baseDiameterMm: 2,
        topDiameterMm: 2,
        bellyMm: 0,
        section: 'circle',
        aspectRatio: 1,
        twistDeg: 0,
      },
      process: { ...testRecipe().process, flowMultiplier: 1.2 },
      bands: [testBand({ amplitudeMm: 0, radialAmplitudeMm: 0 })],
    });
    const settings = foundationSettings({
      layers: 1,
      layerHeightMm: 0.2,
      lineWidthMm: 1,
      blendHeightMm: 0,
      rimTurns: 0,
    });
    const prepared = prepareBuild(recipe, settings);
    const transition = prepared.stages.find((stage) => stage.kind === 'transition');
    if (transition === undefined) throw new Error('Missing transition stage.');
    const extrusions = eventsForStage(prepared, transition).filter((event) => event.kind === 'extrude');
    const count = extrusions.length;
    const totalLength = extrusions.reduce((sum, event) => sum + distance(event.from, event.to), 0);
    const height = settings.layerHeightMm;
    const quadratic = Math.PI / 4 - 1;
    const meanMidpointArea = settings.lineWidthMm * height / 2
      + quadratic * height ** 2 * (1 / 3 - 1 / (12 * count ** 2));
    const totalVolume = extrusions.reduce((sum, event) => sum + event.volumeMm3, 0);
    expect(totalVolume).toBeCloseTo(totalLength * meanMidpointArea * recipe.process.flowMultiplier, 10);

    const first = extrusions[0];
    const last = extrusions.at(-1);
    if (first === undefined || last === undefined) throw new Error('Missing transition extrusion.');
    const area = (gap: number) => (settings.lineWidthMm - gap) * gap + Math.PI * gap ** 2 / 4;
    expect(first.volumeMm3).toBeCloseTo(
      distance(first.from, first.to) * area(height / (2 * count)) * recipe.process.flowMultiplier, 12);
    expect(last.volumeMm3).toBeCloseTo(
      distance(last.from, last.to) * area(height * (count - 0.5) / count) * recipe.process.flowMultiplier, 12);
    expect(first.volumeMm3).toBeLessThan(last.volumeMm3);
  });

  it('builds inclusive/exclusive foundation, transition, wall and rim stages', () => {
    const recipe = testRecipe();
    const settings = foundationSettings();
    const prepared = prepareBuild(recipe, settings);
    expect(prepared.path.engineVersion).toBe(PREPARED_BUILD_ENGINE_VERSION);
    expect(prepared.buildKey).toBe(JSON.stringify({ recipe, foundation: settings }));
    expect(prepared.wallOffsetZMm).toBeCloseTo(0.4, 12);
    expect(prepared.stages.map((stage) => stage.kind)).toEqual([
      'foundation', 'transition', 'wall', 'rim',
    ]);
    expect(prepared.stages[0]?.startEvent).toBe(0);
    for (let index = 1; index < prepared.stages.length; index += 1) {
      expect(prepared.stages[index]?.startEvent).toBe(prepared.stages[index - 1]?.endEvent);
    }
    expect(prepared.stages.at(-1)?.endEvent).toBe(prepared.path.events.length);
  });

  it('keeps all event locations continuous across layer and stage joins', () => {
    const prepared = prepareBuild(testRecipe(), foundationSettings());
    let current = eventStart(prepared.path.events[0] as ToolpathEvent);
    for (const event of prepared.path.events) {
      expectSamePoint(eventStart(event), current);
      current = eventEnd(event);
    }
    const layerChanges = prepared.path.events.filter((event) => event.kind === 'travel');
    expect(layerChanges).toHaveLength(2);
    expect(layerChanges.every((event) => event.kind === 'travel'
      && event.from.x === event.to.x && event.from.y === event.to.y
      && event.speedMmS === 2)).toBe(true);
  });

  it('places the wall above the foundation and blends negative wave excursions', () => {
    const recipe = testRecipe({
      bands: [testBand({ amplitudeMm: 2.5, radialAmplitudeMm: 1 })],
      shape: { ...testRecipe().shape, heightMm: 12 },
    });
    const settings = foundationSettings({ blendHeightMm: 3 });
    const prepared = prepareBuild(recipe, settings);
    const foundationTop = settings.layers * settings.layerHeightMm;
    const wall = prepared.stages.find((stage) => stage.kind === 'wall');
    if (wall === undefined) throw new Error('Missing wall stage.');
    for (const event of eventsForStage(prepared, wall)) {
      expect(eventStart(event).z).toBeGreaterThanOrEqual(foundationTop - 1e-10);
      expect(eventEnd(event).z).toBeGreaterThanOrEqual(foundationTop - 1e-10);
    }
    const transition = prepared.stages.find((stage) => stage.kind === 'transition');
    if (transition === undefined) throw new Error('Missing transition stage.');
    const transitionEvents = eventsForStage(prepared, transition);
    expect(eventStart(transitionEvents[0] as ToolpathEvent).z).toBeCloseTo(foundationTop, 12);
    expect(eventEnd(transitionEvents.at(-1) as ToolpathEvent).z)
      .toBeCloseTo(foundationTop + settings.layerHeightMm, 12);
    expectSamePoint(eventEnd(transitionEvents.at(-1) as ToolpathEvent),
      eventStart(eventsForStage(prepared, wall)[0] as ToolpathEvent));
  });

  it.each(['circle', 'ellipse', 'squircle'] as const)(
    'makes a planar similar-contour foundation for %s sections',
    (section) => {
      const recipe = testRecipe({
        shape: { ...testRecipe().shape, section, aspectRatio: section === 'circle' ? 1 : 1.6 },
      });
      const prepared = prepareBuild(recipe, foundationSettings({ layers: 1, rimTurns: 0 }));
      const foundation = prepared.stages.find((stage) => stage.kind === 'foundation');
      if (foundation === undefined) throw new Error('Missing foundation stage.');
      const events = eventsForStage(prepared, foundation);
      expect(events.every((event) => eventStart(event).z === 0.2 && eventEnd(event).z === 0.2)).toBe(true);
      const outerEnd = eventEnd(events.at(-1) as ToolpathEvent);
      expect(outerEnd.x).toBeCloseTo(recipe.shape.baseDiameterMm / 2, 10);
      expect(outerEnd.y).toBeCloseTo(0, 10);
    },
  );

  it('assigns foundation/rim roles and the requested first/last band metadata', () => {
    const recipe = testRecipe({
      bands: [testBand({ id: 'first' }), testBand({ id: 'last', kind: 'triangle', weight: 1 })],
    });
    const prepared = prepareBuild(recipe, foundationSettings());
    const foundationAndTransition = prepared.path.events.filter((event) =>
      event.kind === 'extrude' && (event.role === 'foundation' || event.role === 'transition'));
    const rim = prepared.path.events.filter((event) => event.kind === 'extrude' && event.role === 'rim');
    expect(foundationAndTransition.length).toBeGreaterThan(0);
    expect(foundationAndTransition.every((event) => event.bandId === 'first')).toBe(true);
    expect(rim.length).toBeGreaterThan(0);
    expect(rim.every((event) => event.bandId === 'last')).toBe(true);
  });

  it('emits only positive-volume, positive-speed, non-degenerate extrusion', () => {
    const prepared = prepareBuild(testRecipe(), foundationSettings());
    const extrusions = prepared.path.events.filter((event) => event.kind === 'extrude');
    expect(extrusions.length).toBeGreaterThan(0);
    expect(extrusions.every((event) => event.volumeMm3 > 0
      && event.speedMmS > 0 && distance(event.from, event.to) > 1e-9)).toBe(true);
    expect(() => exportDraft(testRecipe(), prepared.path)).not.toThrow();
  });

  it('omits the rim stage when rim turns are zero', () => {
    const prepared = prepareBuild(testRecipe(), foundationSettings({ rimTurns: 0 }));
    expect(prepared.stages.some((stage) => stage.kind === 'rim')).toBe(false);
    expect(prepared.path.events.some((event) => event.kind === 'extrude' && event.role === 'rim')).toBe(false);
  });

  it('rejects invalid settings and insufficient explicit blend height', () => {
    expect(() => prepareBuild(testRecipe(), foundationSettings({ layers: 1.5 }))).toThrow(/safe integer/i);
    expect(() => prepareBuild(testRecipe(), foundationSettings({ lineWidthMm: 0.1 }))).toThrow(/stadium/i);
    expect(() => prepareBuild(testRecipe(), foundationSettings({ speedMmS: Number.NaN }))).toThrow(/finite/i);
    expect(() => prepareBuild(testRecipe(), foundationSettings({ rimTurns: -1 }))).toThrow(/non-negative/i);
    const largeWave = testRecipe({ bands: [testBand({ amplitudeMm: 4 })] });
    expect(() => prepareBuild(largeWave, foundationSettings({ blendHeightMm: 4 })))
      .toThrow(/at least 4\.500 mm/i);
    expect(() => prepareBuild(testRecipe(), foundationSettings({ blendHeightMm: 0 })))
      .toThrow(/greater than zero/i);
  });

  it('rejects total build size before creating an oversized foundation', () => {
    const tinyBead = foundationSettings({
      layers: 3,
      layerHeightMm: 0.00001,
      lineWidthMm: 0.00001,
      blendHeightMm: 4,
      rimTurns: 0,
    });
    expect(() => prepareBuild(testRecipe(), tinyBead)).toThrow(/100,000 event limit/i);
  });

  it.each([
    { name: 'control cup', diameter: 30, pitch: 0.3, strand: 0.4, speed: 18, amplitude: 0 },
    { name: 'wave coupon', diameter: 34, pitch: 0.6, strand: 0.4, speed: 12, amplitude: 0.3 },
    { name: 'miniature woven vase', diameter: 40, pitch: 0.9, strand: 0.4, speed: 12, amplitude: 0.6 },
  ])('passes independent draft validation for the $name prepared path', (sample) => {
    const recipe = testRecipe({
      name: sample.name,
      shape: {
        heightMm: 3,
        baseDiameterMm: sample.diameter,
        topDiameterMm: sample.diameter,
        bellyMm: 0,
        section: 'circle',
        aspectRatio: 1,
        twistDeg: 0,
      },
      process: {
        ...testRecipe().process,
        pitchMm: sample.pitch,
        strandDiameterMm: sample.strand,
        speedMmS: sample.speed,
      },
      bands: [testBand({ amplitudeMm: sample.amplitude, radialAmplitudeMm: sample.amplitude })],
    });
    const prepared = prepareBuild(recipe, foundationSettings());
    expect(() => exportDraft(recipe, prepared.path)).not.toThrow();
    const transition = prepared.stages.find((stage) => stage.kind === 'transition');
    if (transition === undefined) throw new Error('Missing transition stage.');
    const first = prepared.path.events[transition.startEvent];
    expect(first?.kind).toBe('extrude');
    if (first?.kind === 'extrude') {
      const filamentArea = Math.PI * (recipe.process.filamentDiameterMm / 2) ** 2;
      expect(first.volumeMm3 / filamentArea).toBeGreaterThan(0.000005);
    }
  });
});
