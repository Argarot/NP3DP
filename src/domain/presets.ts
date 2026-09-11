import type { Band, PatternKind, Recipe } from './types';

export interface RecipePreset {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly recipe: Recipe;
}

/** Creates a conservative starting band for a named deposition method. */
export function createBand(kind: PatternKind, id: string): Band {
  const common: Omit<Band, 'id' | 'kind' | 'amplitudeMm' | 'repeatsPerTurn' | 'phaseAdvanceDeg' | 'radialAmplitudeMm' | 'dwellSeconds' | 'anchorVolumeMm3'> = {
    weight: 1,
    speedVariation: 0.15,
    flowVariation: 0.08,
  };
  switch (kind) {
    case 'wave':
      return { id, kind, ...common, amplitudeMm: 1.2, repeatsPerTurn: 28, phaseAdvanceDeg: 180, radialAmplitudeMm: 0.8, dwellSeconds: 0, anchorVolumeMm3: 0 };
    case 'triangle':
      return { id, kind, ...common, amplitudeMm: 1.6, repeatsPerTurn: 22, phaseAdvanceDeg: 120, radialAmplitudeMm: 1, dwellSeconds: 0.12, anchorVolumeMm3: 0.08 };
    case 'arch':
      return { id, kind, ...common, amplitudeMm: 2.4, repeatsPerTurn: 14, phaseAdvanceDeg: 90, radialAmplitudeMm: 1.4, dwellSeconds: 0.2, anchorVolumeMm3: 0.18 };
    case 'bridge':
      return { id, kind, ...common, amplitudeMm: 2, repeatsPerTurn: 8, phaseAdvanceDeg: 0, radialAmplitudeMm: 1.2, dwellSeconds: 0.5, anchorVolumeMm3: 0.3 };
  }
}

export const DEFAULT_RECIPE: Recipe = {
  schemaVersion: 1,
  name: 'Ripple study',
  shape: {
    heightMm: 70,
    baseDiameterMm: 74,
    topDiameterMm: 95,
    bellyMm: 8,
    section: 'circle',
    aspectRatio: 1,
    twistDeg: 0,
  },
  process: {
    pitchMm: 1.2,
    strandDiameterMm: 0.55,
    filamentDiameterMm: 1.75,
    speedMmS: 24,
    travelMmS: 80,
    flowMultiplier: 1,
  },
  bands: [createBand('wave', 'ripple')],
};

export const PRESETS: readonly RecipePreset[] = [
  {
    id: 'ripple-study',
    title: 'Ripple study',
    description: 'A continuous, open wave weave with broad, readable ripples.',
    recipe: DEFAULT_RECIPE,
  },
  {
    id: 'folded-lattice',
    title: 'Folded lattice',
    description: 'Angular triangular repeats make a crisp diamond-like open wall.',
    recipe: {
      schemaVersion: 1, name: 'Folded lattice',
      shape: { heightMm: 86, baseDiameterMm: 72, topDiameterMm: 88, bellyMm: 5, section: 'squircle', aspectRatio: 1.1, twistDeg: 24 },
      process: { pitchMm: 1.35, strandDiameterMm: 0.52, filamentDiameterMm: 1.75, speedMmS: 22, travelMmS: 80, flowMultiplier: 1.02 },
      bands: [{ ...createBand('triangle', 'folds'), weight: 1.2, amplitudeMm: 1.8, repeatsPerTurn: 24 }],
    },
  },
  {
    id: 'arc-vessel',
    title: 'Arc vessel',
    description: 'Slow, taller arches collect into a soft lantern-like vessel.',
    recipe: {
      schemaVersion: 1, name: 'Arc vessel',
      shape: { heightMm: 92, baseDiameterMm: 68, topDiameterMm: 98, bellyMm: 10, section: 'ellipse', aspectRatio: 1.25, twistDeg: -18 },
      process: { pitchMm: 1.5, strandDiameterMm: 0.58, filamentDiameterMm: 1.75, speedMmS: 19, travelMmS: 70, flowMultiplier: 1.04 },
      bands: [{ ...createBand('arch', 'arcs'), weight: 1.4, amplitudeMm: 2.8, repeatsPerTurn: 16 }],
    },
  },
  {
    id: 'held-spans',
    title: 'Held spans',
    description: 'Deliberate anchors and short dwells emphasize bridge-like spans.',
    recipe: {
      schemaVersion: 1, name: 'Held spans',
      shape: { heightMm: 76, baseDiameterMm: 76, topDiameterMm: 82, bellyMm: 3, section: 'circle', aspectRatio: 1, twistDeg: 0 },
      process: { pitchMm: 1.6, strandDiameterMm: 0.6, filamentDiameterMm: 1.75, speedMmS: 16, travelMmS: 65, flowMultiplier: 1.08 },
      bands: [{ ...createBand('bridge', 'spans'), weight: 1, amplitudeMm: 2.2, repeatsPerTurn: 10, dwellSeconds: 0.65, anchorVolumeMm3: 0.36 }],
    },
  },
  {
    id: 'method-sampler',
    title: 'Method sampler',
    description: 'Four bands compare waves, folds, arches, and held spans in one vase.',
    recipe: {
      schemaVersion: 1, name: 'Method sampler',
      shape: { heightMm: 108, baseDiameterMm: 78, topDiameterMm: 96, bellyMm: 7, section: 'ellipse', aspectRatio: 1.15, twistDeg: 30 },
      process: { pitchMm: 1.35, strandDiameterMm: 0.56, filamentDiameterMm: 1.75, speedMmS: 20, travelMmS: 75, flowMultiplier: 1.03 },
      bands: [
        { ...createBand('wave', 'sample-wave'), weight: 0.9 },
        { ...createBand('triangle', 'sample-triangle'), weight: 1 },
        { ...createBand('arch', 'sample-arch'), weight: 1.1 },
        { ...createBand('bridge', 'sample-bridge'), weight: 0.9 },
      ],
    },
  },
];
