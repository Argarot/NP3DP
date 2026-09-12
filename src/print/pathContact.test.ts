import assert from 'node:assert/strict';
import { test } from 'vitest';
import type { ExtrudeEvent, Recipe, ToolpathEvent, Vec3 } from '../domain/types';
import { CALIBRATION_STUDIES, NEXT_STUDIES } from './calibration';
import { prepareBuild } from './prepare';
import {
  inspectMatchedRevolutionPathContact,
  type PathContactBuildLike,
} from './pathContact';
import type { FoundationSettings, PrintStage } from './types';

const TWO_PI = 2 * Math.PI;

function point(radiusMm: number, phaseRad: number, zMm: number): Vec3 {
  return { x: radiusMm * Math.cos(phaseRad), y: radiusMm * Math.sin(phaseRad), z: zMm };
}

function revolution(
  role: 'transition' | 'wall' | 'rim',
  radiusAt: (fraction: number) => number,
  zAt: (fraction: number) => number,
  turns: number,
  segmentsPerTurn = 64,
  direction: 1 | -1 = 1,
): ExtrudeEvent[] {
  const count = Math.ceil(turns * segmentsPerTurn);
  const events: ExtrudeEvent[] = [];
  for (let index = 0; index < count; index += 1) {
    const start = index / segmentsPerTurn;
    const end = Math.min(turns, (index + 1) / segmentsPerTurn);
    const from = point(radiusAt(start / turns), direction * TWO_PI * start, zAt(start / turns));
    const to = point(radiusAt(end / turns), direction * TWO_PI * end, zAt(end / turns));
    events.push({
      kind: 'extrude',
      from,
      to,
      volumeMm3: 1,
      speedMmS: 5,
      role,
      bandId: 'wave',
    });
  }
  return events;
}

function syntheticBuild(
  transition: ExtrudeEvent[],
  wall: ExtrudeEvent[],
  rim: ExtrudeEvent[] = [],
): PathContactBuildLike {
  const events: ToolpathEvent[] = [...transition, ...wall, ...rim];
  const stages: PrintStage[] = [
    { kind: 'transition', startEvent: 0, endEvent: transition.length },
    { kind: 'wall', startEvent: transition.length, endEvent: transition.length + wall.length },
  ];
  if (rim.length > 0) {
    stages.push({ kind: 'rim', startEvent: transition.length + wall.length, endEvent: events.length });
  }
  return {
    path: {
      engineVersion: 'test', recipeKey: 'test', events,
      stats: {
        pathLengthMm: 0, extrusionVolumeMm3: 0, filamentLengthMm: 0,
        commandedDurationS: 0, extrudeMoves: events.length, travelMoves: 0, dwellCount: 0,
        bounds: { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } },
      },
      diagnostics: [],
    },
    stages,
  };
}

test('matches emitted helical chords one revolution apart', () => {
  const transition = revolution('transition', () => 10, (u) => 0.4 * u, 1);
  const wall = revolution('wall', () => 10, (u) => 0.4 + 0.8 * u, 2);
  const report = inspectMatchedRevolutionPathContact(syntheticBuild(transition, wall), 0.45);
  assert.equal(report.applicable, true);
  if (!report.applicable) return;
  assert.equal(report.comparisons.length, 2);
  for (const comparison of report.comparisons) {
    assert.ok(Math.abs(comparison.minSeparationMm - 0.4) < 1e-10);
    assert.ok(Math.abs(comparison.maxSeparationMm - 0.4) < 1e-10);
    assert.equal(comparison.contactFractionEstimate, 1);
  }
  assert.deepEqual(report.comparisons[0]!.referenceStages, ['transition']);
});

test('includes radial XY drift in the three-dimensional separation', () => {
  const transition = revolution('transition', (u) => 9.7 + 0.3 * u, (u) => 0.4 * u, 1);
  const wall = revolution('wall', (u) => 10 + 0.6 * u, (u) => 0.4 + 0.8 * u, 2);
  const report = inspectMatchedRevolutionPathContact(syntheticBuild(transition, wall), 0.49);
  assert.equal(report.applicable, true);
  if (!report.applicable) return;
  assert.equal(report.comparisons.length, 2);
  for (const comparison of report.comparisons) {
    const chordMidpointSeparation = Math.hypot(0.3 * Math.cos(Math.PI / 64), 0.4);
    assert.ok(Math.abs(comparison.minSeparationMm - chordMidpointSeparation) < 1e-6,
      JSON.stringify(comparison));
    assert.ok(Math.abs(comparison.maxSeparationMm - 0.5) < 1e-10, JSON.stringify(comparison));
    assert.equal(comparison.contactFractionEstimate, 0);
    assert.equal(comparison.hasNominalContact, false);
  }
});

test('reports a final partial wall turn and compares a rim against emitted wall geometry', () => {
  const transition = revolution('transition', () => 10, (u) => 0.4 * u, 1);
  const wall = revolution('wall', () => 10, (u) => 0.4 + 0.5 * u, 1.25);
  const wallEnd = wall.at(-1)!.to;
  const rimRaw = revolution('rim', () => 10, (u) => wallEnd.z + 0.2 * u, 1);
  const rim = rimRaw.map((event) => ({
    ...event,
    from: point(10, TWO_PI * 1.25 + Math.atan2(event.from.y, event.from.x), event.from.z),
    to: point(10, TWO_PI * 1.25 + Math.atan2(event.to.y, event.to.x), event.to.z),
  }));
  rim[0] = { ...rim[0]!, from: wallEnd };
  const report = inspectMatchedRevolutionPathContact(syntheticBuild(transition, wall, rim), 0.45);
  assert.equal(report.applicable, true);
  if (!report.applicable) return;
  assert.equal(report.comparisons.length, 3);
  assert.ok(Math.abs(report.comparisons[1]!.revolutionFraction - 0.25) < 1e-10);
  assert.equal(report.comparisons[2]!.currentStage, 'rim');
  assert.deepEqual(report.comparisons[2]!.referenceStages, ['wall']);
});

test('inspects actual shaped-wave output and detects nonzero radial contribution', () => {
  const recipe: Recipe = {
    schemaVersion: 1,
    name: 'shaped B geometry',
    shape: {
      heightMm: 12,
      baseDiameterMm: 34,
      topDiameterMm: 31,
      bellyMm: 1,
      section: 'circle',
      aspectRatio: 1,
      twistDeg: 0,
    },
    process: {
      pitchMm: 0.4,
      strandDiameterMm: 0.45,
      filamentDiameterMm: 1.75,
      speedMmS: 6,
      travelMmS: 80,
      flowMultiplier: 1,
    },
    bands: [{
      id: 'wave', kind: 'wave', weight: 1, amplitudeMm: 0.12,
      repeatsPerTurn: 14, phaseAdvanceDeg: 180, radialAmplitudeMm: 0,
      speedVariation: 0, flowVariation: 0, dwellSeconds: 0, anchorVolumeMm3: 0,
    }],
  };
  const foundation: FoundationSettings = {
    enabled: true, layers: 3, layerHeightMm: 0.2, lineWidthMm: 0.45,
    speedMmS: 20, blendHeightMm: 4, rimTurns: 1, elephantFootMm: 0.15,
  };
  const report = inspectMatchedRevolutionPathContact(
    prepareBuild(recipe, foundation), recipe.process.strandDiameterMm,
  );
  assert.equal(report.applicable, true);
  if (!report.applicable) return;
  assert.equal(report.comparisons.length, 31);
  assert.equal(report.comparisons.at(-1)!.currentStage, 'rim');
  const bodyComparison = report.comparisons.find((entry) => entry.currentStage === 'wall'
    && entry.revolutionIndex === 10)!;
  const cylindricalRecipe: Recipe = {
    ...recipe,
    shape: { ...recipe.shape, topDiameterMm: 34, bellyMm: 0 },
  };
  const cylindricalReport = inspectMatchedRevolutionPathContact(
    prepareBuild(cylindricalRecipe, foundation), recipe.process.strandDiameterMm,
  );
  assert.equal(cylindricalReport.applicable, true);
  if (!cylindricalReport.applicable) return;
  const cylindricalComparison = cylindricalReport.comparisons.find((entry) =>
    entry.currentStage === 'wall' && entry.revolutionIndex === 10)!;
  assert.ok(bodyComparison.minSeparationMm > cylindricalComparison.minSeparationMm);
  assert.ok(bodyComparison.maxSeparationMm > cylindricalComparison.maxSeparationMm);
});

test('returns applicability reasons for rotational reversal and bounded work', () => {
  const transition = revolution('transition', () => 10, (u) => 0.4 * u, 1, 4);
  const forward = revolution('wall', () => 10, (u) => 0.4 + 0.4 * u, 1, 4);
  const reversed = forward.slice(0, 2);
  reversed.push({
    ...forward[2]!,
    from: reversed.at(-1)!.to,
    to: point(10, TWO_PI * 0.4, forward[2]!.to.z),
  });
  const reversalReport = inspectMatchedRevolutionPathContact(
    syntheticBuild(transition, reversed), 0.45,
  );
  assert.equal(reversalReport.applicable, false);
  if (!reversalReport.applicable) {
    assert.ok(reversalReport.reasons.some((reason) => reason.includes('reverses')));
  }

  const hugeWall = revolution('wall', () => 10, (u) => 0.4 + 0.4 * u, 513, 4);
  const boundedReport = inspectMatchedRevolutionPathContact(
    syntheticBuild(transition, hugeWall), 0.45,
  );
  assert.equal(boundedReport.applicable, false);
  if (!boundedReport.applicable) {
    assert.ok(boundedReport.reasons.some((reason) => reason.includes('capped')));
  }
});

test('recognises clockwise emitted paths', () => {
  const transition = revolution('transition', () => 10, (u) => 0.4 * u, 1, 64, -1);
  const wall = revolution('wall', () => 10, (u) => 0.4 + 0.4 * u, 1, 64, -1);
  const report = inspectMatchedRevolutionPathContact(syntheticBuild(transition, wall), 0.45);
  assert.equal(report.applicable, true);
  if (!report.applicable) return;
  assert.equal(report.rotationDirection, 'clockwise');
  assert.ok(Math.abs(report.comparisons[0]!.maxSeparationMm - 0.4) < 1e-10);
});

test('accepts the emitted arch and zero-lift held-span studies but rejects lifted posts', () => {
  const foundation: FoundationSettings = {
    enabled: true, layers: 3, layerHeightMm: 0.2, lineWidthMm: 0.45,
    speedMmS: 20, blendHeightMm: 4, rimTurns: 1, elephantFootMm: 0.15,
  };
  for (const id of ['arch-coupon', 'held-span-v2']) {
    const recipe = NEXT_STUDIES.find((study) => study.id === id)!.recipe;
    const report = inspectMatchedRevolutionPathContact(
      prepareBuild(recipe, foundation), recipe.process.strandDiameterMm,
    );
    assert.equal(report.applicable, true, id);
    if (report.applicable && id === 'held-span-v2') {
      assert.ok(report.warnings.some((warning) => warning.includes('deposit event')));
    }
  }

  const lifted = CALIBRATION_STUDIES.find((study) => study.id === 'held-spans')!.recipe;
  const liftedReport = inspectMatchedRevolutionPathContact(
    prepareBuild(lifted, foundation), lifted.process.strandDiameterMm,
  );
  assert.equal(liftedReport.applicable, false);
  if (!liftedReport.applicable) {
    assert.ok(liftedReport.reasons.some((reason) => reason.includes('rotational advance')));
  }
});

test('validates excluded marker continuity, extrusion roles, and deposited volume', () => {
  const transition = revolution('transition', () => 10, (u) => 0.4 * u, 1);
  const wall = revolution('wall', () => 10, (u) => 0.4 + 0.4 * u, 1);
  const base = syntheticBuild(transition, wall);
  const displacedMarker: ToolpathEvent = {
    kind: 'anchor', bandId: 'wave', at: { x: 99, y: 99, z: 99 },
  };
  const markerEvents = [...base.path.events];
  markerEvents.splice(transition.length + 1, 0, displacedMarker);
  const markerBuild: PathContactBuildLike = {
    path: { ...base.path, events: markerEvents },
    stages: [
      { kind: 'transition', startEvent: 0, endEvent: transition.length },
      { kind: 'wall', startEvent: transition.length, endEvent: markerEvents.length },
    ],
  };
  const markerReport = inspectMatchedRevolutionPathContact(markerBuild, 0.45);
  assert.equal(markerReport.applicable, false);
  if (!markerReport.applicable) {
    assert.ok(markerReport.reasons.some((reason) => reason.includes('displaced')));
  }

  const invalidRole = wall.map((event, index) => index === 0
    ? { ...event, role: 'foundation' as const }
    : event);
  const roleReport = inspectMatchedRevolutionPathContact(
    syntheticBuild(transition, invalidRole), 0.45,
  );
  assert.equal(roleReport.applicable, false);
  if (!roleReport.applicable) {
    assert.ok(roleReport.reasons.some((reason) => reason.includes('unsupported extrusion role')));
  }

  const zeroVolume = wall.map((event, index) => index === 0
    ? { ...event, volumeMm3: 0 }
    : event);
  const volumeReport = inspectMatchedRevolutionPathContact(
    syntheticBuild(transition, zeroVolume), 0.45,
  );
  assert.equal(volumeReport.applicable, false);
  if (!volumeReport.applicable) {
    assert.ok(volumeReport.reasons.some((reason) => reason.includes('positive finite volume')));
  }
});
