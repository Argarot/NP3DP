import type { GeneratedToolpath, Recipe } from '../domain/types.ts';
import {
  DRAFT_BED_CENTER_OFFSET_MM,
  EXTRUSION_DECIMAL_PLACES,
  FEED_DECIMAL_PLACES,
  validateDraftInput,
  XYZ_DECIMAL_PLACES,
} from './validation.ts';

export function exportExperimentReport(recipe: Recipe, path: GeneratedToolpath): string {
  const { expectations } = validateDraftInput(recipe, path);
  return `${JSON.stringify({
    reportVersion: 1,
    reportKind: 'NP3DP experimental wall-toolpath report',
    recipe,
    toolpath: {
      engineVersion: path.engineVersion,
      recipeKey: path.recipeKey,
      diagnostics: path.diagnostics,
      stats: path.stats,
    },
    draftExport: {
      intendedFilenameExtension: '.gcode.txt',
      coordinateOffsetMm: DRAFT_BED_CENTER_OFFSET_MM,
      preflightEventTotals: expectations,
      auditScope: 'Event and quantization preflight. Serialized text is independently parsed when the motion draft is generated.',
      extrusionModel: 'Event volume divided once by circular filament cross-sectional area.',
      numericalQuantization: {
        xyzDecimalPlaces: XYZ_DECIMAL_PLACES,
        extrusionDecimalPlaces: EXTRUSION_DECIMAL_PLACES,
        feedDecimalPlaces: FEED_DECIMAL_PLACES,
        dwellResolutionMilliseconds: 1,
        policy: 'Each positive extrusion and positive-length move must remain nonzero after quantization. Exact zero-volume deposits are comments, not motion commands.',
        timeComparison: 'Parsed command time excludes the initial approach and is checked against original event time using the sum of per-event XYZ, feed, E and dwell rounding differences.',
      },
    },
    limitations: [
      'This is a motion-only wall experiment, not a complete print job.',
      'Machine start/end setup, temperatures, homing, purge and a base are absent.',
      'Installed firmware, exact material SKU and hotend geometry have not been recorded.',
      'No printer, clearance, adhesion or physical filament-behaviour test has been performed.',
      'The nozzle-centre commands and duration are computational plans, not validated executed motion or deposited geometry.',
      'The X90 Y90 centre offset assumes a nominal 180 mm square MINI bed and is not a validated machine profile.',
    ],
  }, null, 2)}\n`;
}
