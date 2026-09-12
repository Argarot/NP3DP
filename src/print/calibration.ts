import type { Recipe } from '../domain/types';
import { parseRecipe } from '../domain/recipe';
import type { FoundationSettings } from './types';

export interface CalibrationStudy {
  id: string;
  title: string;
  description: string;
  observe: string[];
  recipe: Recipe;
  loadLabel?: string;
  foundationOverrides?: Partial<FoundationSettings>;
}

/** Same specimen foundation in the editor and reproducible batch writer. */
export function studyFoundation(study: CalibrationStudy, baseline: FoundationSettings): FoundationSettings {
  return { ...baseline, enabled: true, layers: 3, layerHeightMm: 0.2, lineWidthMm: 0.45,
    speedMmS: 20, blendHeightMm: 4, rimTurns: 1, ...study.foundationOverrides };
}

/** Shared by the catalog links and batch writer; never accept path separators. */
export function studyFilename(study: CalibrationStudy): string {
  const name = study.recipe.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  if (!name || name.length > 100) throw new RangeError('Study name must produce a filename of 1–100 characters.');
  return name;
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

const retryA = specimen('05 Retry A attachment', 34, 12);
retryA.process = { ...retryA.process, pitchMm: 0.3, strandDiameterMm: 0.45, speedMmS: 6 };
retryA.bands[0] = { ...retryA.bands[0]!, amplitudeMm: 0.08, phaseAdvanceDeg: 180 };
const retryB = structuredClone(retryA);
retryB.name = '06 Retry B openings';
retryB.process.pitchMm = 0.4;
retryB.bands[0]!.amplitudeMm = 0.12;

/** New specimens are explicit choices. Preserve the original studies and files
 * as the physical record instead of silently replacing their parameters. */
export const RETRY_STUDIES: readonly CalibrationStudy[] = [
  { id: 'retry-a', title: '05 / Retry A — attachment', loadLabel: 'retry A', description: 'Reported successful. 34 × 12 mm, 0.30 mm rise/turn, 0.08 mm wave, 6 mm/s. The attachment reference for this MINI setup.', observe: ['MINI preview and remaining time visible', 'Purge deposited across the front before the foundation', 'Fan spins after the foundation', 'First wave turns stay attached; record any dragged strands', 'Measure first-layer flare and photograph against a ruler'], recipe: parseRecipe(retryA) },
  { id: 'retry-b', title: '06 / Retry B — openings', loadLabel: 'retry B', description: 'Reported successful. Same size and speed; 0.40 mm rise/turn and 0.12 mm wave create longer unsupported windows. Baseline for the new miniature.', observe: ['Record opening size, sag and detached strands', 'Compare duration and side photographs with A'], recipe: parseRecipe(retryB) },
];

const miniB = structuredClone(retryB);
miniB.name = '07 Mini vase B';
miniB.shape = { ...miniB.shape, heightMm: 24, topDiameterMm: 38, bellyMm: 1 };

const archCoupon = specimen('08 Arch coupon', 32, 10.2);
archCoupon.process = { ...archCoupon.process, pitchMm: 0.3, strandDiameterMm: 0.45, speedMmS: 6 };
const collar = { ...archCoupon.bands[0]!, id: 'method-collar', repeatsPerTurn: 24, weight: 7 };
archCoupon.bands = [collar, { ...collar, id: 'short-arches', kind: 'arch', weight: 10, amplitudeMm: 0.2, phaseAdvanceDeg: 180 }];
const heldSpanV2 = structuredClone(archCoupon);
heldSpanV2.name = '09 Held span V2';
heldSpanV2.bands[1] = { ...collar, id: 'timed-chords', kind: 'bridge', weight: 10, amplitudeMm: 0, phaseAdvanceDeg: 0, dwellSeconds: 0.1, anchorVolumeMm3: 0.02 };

/** New specimen identities preserve the exact historical experiments. */
export const NEXT_STUDIES: readonly CalibrationStudy[] = [
  { id: 'mini-b', title: '07 / Mini vase B', loadLabel: 'miniature B', description: '34 mm base, 38 mm top, 24 mm wall. Keeps B’s wave and speed, adds a gentle taper and belly. Print this first.', observe: ['Do the first turns stay attached as they did in B?', 'Check the widening wall for loose strands or nozzle drag', 'Measure the base/top diameters and photograph openings against a ruler', 'Record actual elapsed time'], recipe: parseRecipe(miniB) },
  { id: 'arch-coupon', title: '08 / Arch coupon', loadLabel: 'arch coupon', description: '32 × 10.2 mm. A 4.2 mm collar leads into short 0.20 mm arches with staggered endpoints. No finish rim: leave the final arches exposed.', observe: ['Watch where the smooth collar changes to arches', 'Record whether endpoints attach or drag the preceding arches', 'Compare small openings and arch shapes with the preview', 'Record actual elapsed time'], recipe: parseRecipe(archCoupon), foundationOverrides: { rimTurns: 0 } },
  { id: 'held-span-v2', title: '09 / Held span V2', loadLabel: 'held spans V2', description: '32 × 10.2 mm. Same collar, then 4.18 mm chords with a small stationary deposit and 0.10 s hold at each endpoint. Zero lift isolates the timing experiment.', observe: ['Do held endpoints form small consistent welds or oversized blobs?', 'Watch whether the straight spans attach without pulling away', 'Compare span sag and endpoint shape with 08', 'Record actual elapsed time; these holds should make the method distinct'], recipe: parseRecipe(heldSpanV2) },
];
