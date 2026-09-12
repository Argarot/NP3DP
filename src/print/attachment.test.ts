import assert from 'node:assert/strict';
import { test } from 'vitest';
import {
  inspectCircularWaveAttachment,
  type CircularWaveRecipeLike,
  type FoundationLike,
} from './attachment';

const foundation: FoundationLike = {
  enabled: true,
  layers: 3,
  layerHeightMm: 0.2,
  blendHeightMm: 4,
  rimTurns: 1,
};

function recipe(pitchMm: number, strandDiameterMm: number, amplitudeMm: number,
  heightMm = 12): CircularWaveRecipeLike {
  return {
    shape: {
      heightMm,
      baseDiameterMm: 34,
      topDiameterMm: 34,
      bellyMm: 0,
      section: 'circle',
      aspectRatio: 1,
      twistDeg: 0,
    },
    process: { pitchMm, strandDiameterMm },
    bands: [{
      kind: 'wave',
      amplitudeMm,
      repeatsPerTurn: 14,
      phaseAdvanceDeg: 180,
      radialAmplitudeMm: 0,
      speedVariation: 0,
      flowVariation: 0,
    }],
  };
}

test('identifies the original coupon startup contact failure and closed-form range', () => {
  const report = inspectCircularWaveAttachment(recipe(0.6, 0.45, 0.3, 14), foundation);
  assert.equal(report.applicable, true);
  if (!report.applicable) return;
  assert.ok(report.sampledGeometry.turns[0]!.contactFractionEstimate > 0);
  assert.ok(report.sampledGeometry.turns[0]!.contactFractionEstimate < 1);
  assert.equal(report.sampledGeometry.turns[1]!.contactFractionEstimate, 0);
  assert.ok(report.sampledGeometry.turns[1]!.minGapMm > 0.51);
  assert.ok(report.sampledGeometry.turns[1]!.minGapMm < 0.52);
  assert.ok(Math.abs(report.fullBlendClosedForm.minGapMm - 0) < 1e-12);
  assert.ok(Math.abs(report.fullBlendClosedForm.maxGapMm - 1.2) < 1e-12);
  assert.ok(Math.abs(report.fullBlendClosedForm.contactFraction - 0.4195693767) < 1e-9);
});

test('retry A starts fully contacting and retains only small full-blend openings', () => {
  const report = inspectCircularWaveAttachment(recipe(0.3, 0.45, 0.08), foundation);
  assert.equal(report.applicable, true);
  if (!report.applicable) return;
  assert.equal(report.sampledGeometry.turns[0]!.contactFractionEstimate, 1);
  assert.equal(report.sampledGeometry.turns[1]!.contactFractionEstimate, 1);
  assert.ok(Math.abs(report.fullBlendClosedForm.minGapMm - 0.14) < 1e-12);
  assert.ok(Math.abs(report.fullBlendClosedForm.maxGapMm - 0.46) < 1e-12);
  assert.ok(Math.abs(report.fullBlendClosedForm.contactFraction - 0.8868659177) < 1e-9);
  assert.equal(report.fullBlendClosedForm.hasCentrelineCrossing, false);
});

test('retry B starts fully contacting and opens wider positive-gap windows', () => {
  const report = inspectCircularWaveAttachment(recipe(0.4, 0.45, 0.12), foundation);
  assert.equal(report.applicable, true);
  if (!report.applicable) return;
  assert.equal(report.sampledGeometry.turns[0]!.contactFractionEstimate, 1);
  assert.equal(report.sampledGeometry.turns[1]!.contactFractionEstimate, 1);
  assert.ok(Math.abs(report.fullBlendClosedForm.minGapMm - 0.16) < 1e-12);
  assert.ok(Math.abs(report.fullBlendClosedForm.maxGapMm - 0.64) < 1e-12);
  assert.ok(Math.abs(report.fullBlendClosedForm.contactFraction - 0.5668038843) < 1e-9);
  assert.equal(report.fullBlendClosedForm.hasCentrelineCrossing, false);
});

test('rejects non-circular and oversized analyses', () => {
  const nonCircular = recipe(0.3, 0.45, 0.08);
  nonCircular.shape.section = 'ellipse';
  assert.equal(inspectCircularWaveAttachment(nonCircular, foundation).applicable, false);

  const huge = recipe(0.001, 0.45, 0.08);
  const report = inspectCircularWaveAttachment(huge, foundation);
  assert.equal(report.applicable, false);
  if (report.applicable) return;
  assert.ok(report.reasons.some((reason) => reason.includes('capped')));
});
