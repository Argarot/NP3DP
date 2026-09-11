import type { Shape, Vec3 } from './types';

export const WALL_START_Z_MM = 0.4;

function signedPower(value: number, power: number): number {
  return Math.sign(value) * Math.pow(Math.abs(value), power);
}

function assertShapePointInputs(shape: Shape, theta: number, heightFraction: number): void {
  if (!Number.isFinite(theta) || !Number.isFinite(heightFraction)) {
    throw new RangeError('Shape coordinates must be finite.');
  }
  if (heightFraction < 0 || heightFraction > 1) {
    throw new RangeError('Shape height fraction must be between zero and one.');
  }
  const values = [
    shape.heightMm,
    shape.baseDiameterMm,
    shape.topDiameterMm,
    shape.bellyMm,
    shape.aspectRatio,
    shape.twistDeg,
  ];
  if (!values.every(Number.isFinite)) throw new RangeError('Shape values must be finite.');
  if (shape.heightMm <= 0 || shape.baseDiameterMm <= 0 || shape.topDiameterMm <= 0) {
    throw new RangeError('Shape height and diameters must be greater than zero.');
  }
  if (shape.aspectRatio <= 0) throw new RangeError('Shape aspect ratio must be greater than zero.');
  if (!['circle', 'ellipse', 'squircle'].includes(shape.section)) {
    throw new RangeError(`Unknown section kind: ${String(shape.section)}.`);
  }
  if (minimumNominalRadius(shape) <= 0) {
    throw new RangeError('Shape taper and belly must leave a positive radius at every height.');
  }
}

function radiusAt(shape: Shape, heightFraction: number): number {
  const baseRadius = shape.baseDiameterMm / 2;
  const topRadius = shape.topDiameterMm / 2;
  return baseRadius + (topRadius - baseRadius) * heightFraction
    + shape.bellyMm * Math.sin(Math.PI * heightFraction);
}

export function minimumNominalRadius(shape: Shape): number {
  const baseRadius = shape.baseDiameterMm / 2;
  const topRadius = shape.topDiameterMm / 2;
  const delta = topRadius - baseRadius;
  const candidates = [baseRadius, topRadius];
  if (shape.bellyMm !== 0) {
    const cosine = -delta / (Math.PI * shape.bellyMm);
    if (cosine >= -1 && cosine <= 1) {
      const fraction = Math.acos(cosine) / Math.PI;
      candidates.push(radiusAt(shape, fraction));
    }
  }
  return Math.min(...candidates);
}

/**
 * Returns the nominal nozzle-centre surface. Ellipse and squircle aspect ratio
 * preserve the requested X radius and scale Y by 1/aspectRatio.
 */
export function shapePoint(shape: Shape, theta: number, heightFraction: number): Vec3 {
  return shapePointWithRadialOffset(shape, theta, heightFraction, 0);
}

/** Engine-facing variant; radialOffsetMm changes the contour's scalar radius. */
export function shapePointWithRadialOffset(
  shape: Shape,
  theta: number,
  heightFraction: number,
  radialOffsetMm: number,
): Vec3 {
  assertShapePointInputs(shape, theta, heightFraction);
  if (!Number.isFinite(radialOffsetMm)) throw new RangeError('Radial offset must be finite.');

  const radius = radiusAt(shape, heightFraction) + radialOffsetMm;
  const angle = ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  const yScale = shape.section === 'circle' ? 1 : 1 / shape.aspectRatio;
  const xUnit = shape.section === 'squircle' ? signedPower(cosine, 0.5) : cosine;
  const yUnit = shape.section === 'squircle' ? signedPower(sine, 0.5) : sine;
  const localX = radius * xUnit;
  const localY = radius * yUnit * yScale;
  const twist = shape.twistDeg * Math.PI / 180 * heightFraction;
  const twistCosine = Math.cos(twist);
  const twistSine = Math.sin(twist);

  return {
    x: localX * twistCosine - localY * twistSine,
    y: localX * twistSine + localY * twistCosine,
    z: WALL_START_Z_MM + shape.heightMm * heightFraction,
  };
}

export function maximumNominalRadius(shape: Shape): number {
  return Math.max(shape.baseDiameterMm, shape.topDiameterMm) / 2 + Math.abs(shape.bellyMm);
}
