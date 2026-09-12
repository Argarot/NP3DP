import { describe, expect, it } from 'vitest';
import type { Band, Recipe, ToolpathEvent, Vec3 } from './types';
import { generateToolpath } from './generate';
import { distance, eventDurationSeconds } from './math';
import { MAX_TOOLPATH_EVENTS } from './patterns';
import { PRESETS } from './presets';
import { shapePoint, WALL_START_Z_MM } from './shapes';
import { exportDraft } from '../export/draft';

function band(kind: Band['kind'], id: string = kind): Band {
  return {
    id,
    kind,
    weight: 1,
    amplitudeMm: 3,
    repeatsPerTurn: 2,
    phaseAdvanceDeg: 0,
    radialAmplitudeMm: 1,
    speedVariation: 0,
    flowVariation: 0,
    dwellSeconds: 0.4,
    anchorVolumeMm3: 0.2,
  };
}

function recipe(bands: Band[] = [band('wave')]): Recipe {
  return {
    schemaVersion: 1,
    name: 'test',
    shape: {
      heightMm: 8,
      baseDiameterMm: 20,
      topDiameterMm: 20,
      bellyMm: 0,
      section: 'circle',
      aspectRatio: 1,
      twistDeg: 0,
    },
    process: {
      pitchMm: 2,
      strandDiameterMm: 0.45,
      filamentDiameterMm: 1.75,
      speedMmS: 12,
      travelMmS: 30,
      flowMultiplier: 1,
    },
    bands,
  };
}

function expectSamePoint(actual: Vec3, expected: Vec3, digits = 10): void {
  expect(actual.x).toBeCloseTo(expected.x, digits);
  expect(actual.y).toBeCloseTo(expected.y, digits);
  expect(actual.z).toBeCloseTo(expected.z, digits);
}

function eventLocation(event: ToolpathEvent): Vec3 {
  return event.kind === 'extrude' || event.kind === 'travel' ? event.to : event.at;
}

describe('shapePoint', () => {
  it('closes a twisted non-circular contour and uses wall Z coordinates', () => {
    const shape = {
      ...recipe().shape,
      section: 'squircle' as const,
      aspectRatio: 1.7,
      twistDeg: 73,
      bellyMm: 2,
    };
    const first = shapePoint(shape, 0, 0.37);
    const closed = shapePoint(shape, 2 * Math.PI, 0.37);
    expectSamePoint(closed, first);
    expect(first.z).toBeCloseTo(WALL_START_Z_MM + shape.heightMm * 0.37, 12);
    const seamShape = { ...shape, twistDeg: 0 };
    expectSamePoint(shapePoint(seamShape, 2 * Math.PI, 0.37), shapePoint(seamShape, 0, 0.37));
  });

  it('rotates ellipse geometry instead of reparameterizing a fixed ellipse', () => {
    const shape = {
      ...recipe().shape,
      section: 'ellipse' as const,
      aspectRatio: 2,
      twistDeg: 90,
    };
    const radius = shape.baseDiameterMm / 2;
    const rotatedAxisPoint = shapePoint(shape, 0, 1);
    expect(rotatedAxisPoint.x).toBeCloseTo(0, 12);
    expect(rotatedAxisPoint.y).toBeCloseTo(radius, 12);

    const halfHeightPoints = Array.from({ length: 2_048 }, (_, index) =>
      shapePoint(shape, index / 2_048 * 2 * Math.PI, 0.5));
    const expectedRotatedBound = radius * Math.sqrt(0.5 + 0.5 / shape.aspectRatio ** 2);
    const xBound = Math.max(...halfHeightPoints.map((point) => Math.abs(point.x)));
    const yBound = Math.max(...halfHeightPoints.map((point) => Math.abs(point.y)));
    expect(xBound).toBeCloseTo(expectedRotatedBound, 5);
    expect(yBound).toBeCloseTo(expectedRotatedBound, 5);
  });
});

describe('generateToolpath', () => {
  it('connects all band families exactly without hidden travel', () => {
    const bands = [
      band('wave', 'w'),
      band('triangle', 't'),
      band('arch', 'a'),
      band('bridge', 'b'),
    ];
    const input = recipe(bands);
    const result = generateToolpath(input);
    let current = shapePoint(input.shape, 0, 0);
    for (const event of result.events) {
      if (event.kind === 'extrude' || event.kind === 'travel') {
        expectSamePoint(event.from, current);
      } else {
        expectSamePoint(event.at, current);
      }
      current = eventLocation(event);
    }
    expect(result.events.some((event) => event.kind === 'travel')).toBe(false);
    const totalTheta = 2 * Math.PI * input.shape.heightMm / input.process.pitchMm;
    expectSamePoint(current, shapePoint(input.shape, totalTheta, 1));
  });

  it('keeps every coordinate, statistic and bound finite', () => {
    const input = recipe([band('wave'), band('triangle'), band('arch'), band('bridge')]);
    input.shape.section = 'ellipse';
    input.shape.aspectRatio = 1.4;
    input.shape.twistDeg = 41;
    input.shape.topDiameterMm = 14;
    input.shape.bellyMm = 2;
    const result = generateToolpath(input);
    const numbers = [
      result.stats.pathLengthMm,
      result.stats.extrusionVolumeMm3,
      result.stats.filamentLengthMm,
      result.stats.commandedDurationS,
      ...Object.values(result.stats.bounds.min),
      ...Object.values(result.stats.bounds.max),
    ];
    expect(numbers.every(Number.isFinite)).toBe(true);
    for (const event of result.events) {
      expect(Object.values(eventLocation(event)).every(Number.isFinite)).toBe(true);
    }
  });

  it('matches the analytic circular helix length and volume baseline', () => {
    const baselineBand = {
      ...band('wave'),
      amplitudeMm: 0,
      radialAmplitudeMm: 0,
      repeatsPerTurn: 1,
    };
    const input = recipe([baselineBand]);
    input.shape.heightMm = 2;
    input.process.pitchMm = 1;
    input.process.flowMultiplier = 1.2;
    const result = generateToolpath(input);
    const turns = input.shape.heightMm / input.process.pitchMm;
    const circumferenceTravel = input.shape.baseDiameterMm / 2 * turns * 2 * Math.PI;
    const analyticLength = Math.hypot(circumferenceTravel, input.shape.heightMm);
    const strandArea = Math.PI * (input.process.strandDiameterMm / 2) ** 2;
    const analyticVolume = analyticLength * strandArea * input.process.flowMultiplier;
    // The polyline sampler targets density rather than exact arc integration.
    expect(Math.abs(result.stats.pathLengthMm / analyticLength - 1)).toBeLessThan(2e-4);
    expect(Math.abs(result.stats.extrusionVolumeMm3 / analyticVolume - 1)).toBeLessThan(2e-4);
  });

  it('represents bridge deposit, dwell, rise, span and fall as separate phases', () => {
    const bridgeBand = { ...band('bridge'), repeatsPerTurn: 1, anchorVolumeMm3: 0 };
    const input = recipe([bridgeBand]);
    input.shape.heightMm = 2;
    input.process.pitchMm = 2;
    const result = generateToolpath(input);
    expect(result.events.slice(0, 7).map((event) =>
      event.kind === 'extrude' ? `${event.kind}:${event.role}` : event.kind)).toEqual([
      'anchor',
      'deposit',
      'dwell',
      'extrude:rise',
      'extrude:span',
      'extrude:fall',
      'anchor',
    ]);
    const movingVolume = result.events.reduce(
      (sum, event) => sum + (event.kind === 'extrude' ? event.volumeMm3 : 0),
      0,
    );
    expect(result.stats.extrusionVolumeMm3).toBeCloseTo(movingVolume, 12);
    const dwell = result.events.find((event) => event.kind === 'dwell');
    expect(dwell?.kind).toBe('dwell');
    if (dwell?.kind === 'dwell') expect(eventDurationSeconds(dwell)).toBe(bridgeBand.dwellSeconds);
  });

  it('omits degenerate bridge motion while retaining its meaningful span', () => {
    const bridgeBand = {
      ...band('bridge'),
      amplitudeMm: 0,
      radialAmplitudeMm: 0,
      repeatsPerTurn: 1,
      anchorVolumeMm3: 0,
      dwellSeconds: 0,
    };
    const input = recipe([bridgeBand]);
    input.shape.heightMm = 2;
    input.process.pitchMm = 2;
    const result = generateToolpath(input);
    const motions = result.events.filter((event) => event.kind === 'extrude' || event.kind === 'travel');
    expect(motions.map((event) => event.kind === 'extrude' ? event.role : 'travel')).toEqual(['span']);
    expect(motions.every((event) => distance(event.from, event.to) > 1e-9)).toBe(true);
    expect(() => exportDraft(input, result)).not.toThrow();
  });

  it('preserves a sharp triangle midpoint', () => {
    const triangleBand = { ...band('triangle'), repeatsPerTurn: 1, radialAmplitudeMm: 0 };
    const input = recipe([triangleBand]);
    input.shape.heightMm = 2;
    input.process.pitchMm = 2;
    const result = generateToolpath(input);
    const segments = result.events.filter((event) => event.kind === 'extrude');
    expect(segments).toHaveLength(2);
    const first = segments[0];
    const second = segments[1];
    if (first?.kind !== 'extrude' || second?.kind !== 'extrude') throw new Error('Missing triangle segments.');
    expectSamePoint(first.to, second.from);
    expect(first.to.z).toBeCloseTo(WALL_START_Z_MM + 1 + triangleBand.amplitudeMm, 10);
    const incoming = { x: first.to.x - first.from.x, y: first.to.y - first.from.y, z: first.to.z - first.from.z };
    const outgoing = { x: second.to.x - second.from.x, y: second.to.y - second.from.y, z: second.to.z - second.from.z };
    const dot = incoming.x * outgoing.x + incoming.y * outgoing.y + incoming.z * outgoing.z;
    expect(dot / (distance(first.from, first.to) * distance(second.from, second.to))).toBeLessThan(-0.9);
  });

  it('samples a quadratic arch and preserves its requested apex', () => {
    const archBand = { ...band('arch'), repeatsPerTurn: 1, radialAmplitudeMm: 0 };
    const input = recipe([archBand]);
    input.shape.heightMm = 2;
    input.process.pitchMm = 2;
    const result = generateToolpath(input);
    const segments = result.events.filter((event) => event.kind === 'extrude');
    expect(segments.length).toBeGreaterThanOrEqual(16);
    const requestedMidpointZ = WALL_START_Z_MM + 1 + archBand.amplitudeMm;
    expect(segments.some((event) => event.kind === 'extrude'
      && Math.abs(event.to.z - requestedMidpointZ) < 1e-10)).toBe(true);
  });

  it('permits intentional local descent in an oscillatory wall', () => {
    const waveBand = { ...band('wave'), amplitudeMm: 3, repeatsPerTurn: 4 };
    const input = recipe([waveBand]);
    input.shape.heightMm = 2;
    input.process.pitchMm = 2;
    const result = generateToolpath(input);
    expect(result.events.some((event) => event.kind === 'extrude' && event.to.z < event.from.z)).toBe(true);
  });

  it('reports the actual commanded minimum when geometry crosses below Z=0', () => {
    const input = recipe([{ ...band('wave'), amplitudeMm: 5, radialAmplitudeMm: 0 }]);
    input.shape.heightMm = 2;
    input.process.pitchMm = 2;
    const result = generateToolpath(input);
    expect(result.stats.bounds.min.z).toBeLessThan(0);
    const diagnostic = result.diagnostics.find((entry) => entry.code === 'bounds.below-reference-plane');
    expect(diagnostic?.message).toContain(`${result.stats.bounds.min.z.toFixed(3)} mm`);
    expect(diagnostic?.message).toContain('Z=0 reference plane');
  });

  it('is deterministic and keys the canonical passed recipe', () => {
    const input = recipe([band('arch')]);
    const first = generateToolpath(input);
    const second = generateToolpath(input);
    expect(first).toEqual(second);
    expect(first.recipeKey).toBe(JSON.stringify(input));
    expect(first.engineVersion).toBe('0.2.0');
  });

  it('uses phase advance, radial, speed and local flow controls', () => {
    const controlled = {
      ...band('wave'),
      amplitudeMm: 1,
      radialAmplitudeMm: 2,
      phaseAdvanceDeg: 180,
      speedVariation: 0.25,
      flowVariation: 0.3,
    };
    const input = recipe([controlled]);
    input.process.flowMultiplier = 1.2;
    const result = generateToolpath(input);
    const extrusions = result.events.filter((event) => event.kind === 'extrude');
    const speeds = new Set(extrusions.map((event) => event.speedMmS.toFixed(6)));
    expect(speeds.size).toBeGreaterThan(2);

    const nominalArea = Math.PI * (input.process.strandDiameterMm / 2) ** 2;
    const localFlows = extrusions.map((event) => event.volumeMm3
      / (nominalArea * distance(event.from, event.to) * input.process.flowMultiplier));
    expect(Math.min(...localFlows)).toBeGreaterThanOrEqual(1 - Math.abs(controlled.flowVariation) - 1e-12);
    expect(Math.max(...localFlows)).toBeLessThanOrEqual(1 + Math.abs(controlled.flowVariation) + 1e-12);
    expect(generateToolpath({ ...input, bands: [{ ...controlled, phaseAdvanceDeg: 0 }] }).events)
      .not.toEqual(result.events);
  });

  it('reaches full wave amplitude after one edge motif', () => {
    const waveBand = {
      ...band('wave'),
      amplitudeMm: 2,
      radialAmplitudeMm: 0,
      repeatsPerTurn: 1,
    };
    const input = recipe([waveBand]);
    input.shape.heightMm = 12;
    input.process.pitchMm = 2;
    const result = generateToolpath(input);
    const extrusions = result.events.filter((event) => event.kind === 'extrude');
    const totalTheta = 12 * Math.PI;
    const targetTheta = 2.5 * Math.PI;
    let nearestIndex = 0;
    let nearestDelta = Infinity;
    for (let index = 0; index < extrusions.length; index += 1) {
      const theta = totalTheta * (index + 1) / extrusions.length;
      const delta = Math.abs(theta - targetTheta);
      if (delta < nearestDelta) {
        nearestDelta = delta;
        nearestIndex = index;
      }
    }
    const nearest = extrusions[nearestIndex];
    if (nearest?.kind !== 'extrude') throw new Error('Missing wave sample.');
    const local = (nearestIndex + 1) / extrusions.length;
    const nominalZ = WALL_START_Z_MM + input.shape.heightMm * local;
    expect(nearest.to.z - nominalZ).toBeGreaterThan(1.95);
  });

  it.each(PRESETS)('generates and draft-exports $title within the engine budget', (preset) => {
      const result = generateToolpath(preset.recipe);
      expect(result.events.length, preset.id).toBeGreaterThan(0);
      expect(result.events.length, preset.id).toBeLessThanOrEqual(MAX_TOOLPATH_EVENTS);
      expect(() => exportDraft(preset.recipe, result), preset.id).not.toThrow();
  });

  it('rejects non-finite input and jobs above the hard event budget', () => {
    const invalid = recipe();
    invalid.shape.heightMm = Number.NaN;
    expect(() => generateToolpath(invalid)).toThrow(/finite/i);

    const oversized = recipe([{ ...band('wave'), repeatsPerTurn: 100_000 }]);
    oversized.shape.heightMm = 2;
    oversized.process.pitchMm = 2;
    expect(() => generateToolpath(oversized)).toThrow(/100,000 event limit/i);
  });
});
