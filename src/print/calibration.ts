import type { Recipe } from '../domain/types';
import { parseRecipe } from '../domain/recipe';

export interface CalibrationStudy {
  id: string;
  title: string;
  description: string;
  observe: string[];
  recipe: Recipe;
}

function specimen(name: string, diameter: number, height: number): Recipe {
  return {
    schemaVersion: 1, name,
    shape: { heightMm: height, baseDiameterMm: diameter, topDiameterMm: diameter, bellyMm: 0, section: 'circle', aspectRatio: 1, twistDeg: 0 },
    process: { pitchMm: 0.3, strandDiameterMm: 0.4, filamentDiameterMm: 1.75, speedMmS: 18, travelMmS: 60, flowMultiplier: 1 },
    bands: [{ id: 'test-wall', kind: 'wave', weight: 1, amplitudeMm: 0, repeatsPerTurn: 14, phaseAdvanceDeg: 0, radialAmplitudeMm: 0, speedVariation: 0, flowVariation: 0, dwellSeconds: 0, anchorVolumeMm3: 0 }],
  };
}

const control = specimen('01 Control cup', 30, 10);
const wave = specimen('02 Wave coupon', 34, 14);
wave.process = { ...wave.process, pitchMm: 0.6, strandDiameterMm: 0.45, speedMmS: 12 };
wave.bands[0] = { ...wave.bands[0]!, amplitudeMm: 0.3, phaseAdvanceDeg: 180 };
const miniature = specimen('03 Mini woven vase', 40, 45);
miniature.shape = { ...miniature.shape, topDiameterMm: 52, bellyMm: 4 };
miniature.process = { ...miniature.process, pitchMm: 0.35, strandDiameterMm: 0.48, speedMmS: 12 };
miniature.bands[0] = { ...miniature.bands[0]!, amplitudeMm: 0.6, repeatsPerTurn: 24, phaseAdvanceDeg: 180 };
const spans = specimen('04 Held-span coupon', 32, 12);
spans.process = { ...spans.process, pitchMm: 0.3, strandDiameterMm: 0.45, speedMmS: 6 };
spans.bands = [
  { ...spans.bands[0]!, id: 'span-collar', weight: 1 },
  { ...spans.bands[0]!, id: 'timed-spans', weight: 2, kind: 'bridge', amplitudeMm: 0.8, repeatsPerTurn: 12, dwellSeconds: 0.15, anchorVolumeMm3: 0.03 },
];

export const CALIBRATION_STUDIES: readonly CalibrationStudy[] = [
  { id: 'control', title: '01 / Control cup', description: '30 mm × 10 mm. A conventional spiral establishes adhesion and extrusion before adding unsupported motion.', observe: ['First-layer adhesion and line contact', 'Outside diameter and wall thickness', 'Continuous wall and consistent extrusion'], recipe: parseRecipe(control) },
  { id: 'wave', title: '02 / Wave coupon', description: '34 mm × 14 mm. Adds a small vertical wave while keeping radial, speed and flow effects off.', observe: ['Compare attachment and strand thickness with the control', 'Record any nozzle drag or detached strands', 'Photograph the side against a millimetre scale'], recipe: parseRecipe(wave) },
  { id: 'miniature', title: '03 / Mini woven vase', description: '40 mm base × 45 mm wall. A small decorative experiment after the control and wave coupon.', observe: ['Opening sizes and pattern continuity', 'Loose strands and nozzle contact', 'Compare the actual silhouette with the commanded preview'], recipe: parseRecipe(miniature) },
  { id: 'held-spans', title: '04 / Held-span coupon', description: '32 mm × 12 mm. A 4 mm conventional collar leads into anchoring, timed holds and free spans.', observe: ['Attachment at the ends of each span', 'Sag at the centre and any nozzle drag', 'Keep this separate from the baseline extrusion check'], recipe: parseRecipe(spans) },
];
