import type { GeneratedToolpath, Recipe } from '../domain/types';

/** Print setup is deliberately separate from schema-1 wall recipe semantics. */
export interface FoundationSettings {
  enabled: boolean;
  layers: number;
  layerHeightMm: number;
  lineWidthMm: number;
  speedMmS: number;
  /** Height over which experimental offsets are introduced above the foundation. */
  blendHeightMm: number;
  rimTurns: number;
}

export interface PrinterSettings {
  adapter: 'prusa-mini-buddy-5.1.2';
  variant: 'mini' | 'mini-plus' | 'unknown';
  firmware: string;
  hotend: 'stock' | 'modified' | 'unknown';
  nozzleDiameterMm: number;
  /** User-selected command limits, not a claim of measured machine capability. */
  maxXySpeedMmS: number;
  maxZSpeedMmS: number;
  accelerationMmS2: number;
}

export interface MaterialSettings {
  name: string;
  color: 'white' | 'black' | 'unspecified';
  nozzleC: number;
  bedC: number;
  firstLayerNozzleC: number;
  firstLayerBedC: number;
  maxFlowMm3S: number;
  fanPercent: number;
}

export interface ProfileProvenance {
  source: 'manual' | 'prusaslicer-config';
  filename: string;
  digest: string;
  slicerVersion: string;
  printerProfile: string;
  filamentProfile: string;
  /** Mapped target values at import, so later edits remain distinguishable. */
  importedValues: Record<string, string>;
  mappedFields: string[];
  ignoredFields: string[];
  warnings: string[];
}

export interface PrintSetup {
  schemaVersion: 1;
  printer: PrinterSettings;
  material: MaterialSettings;
  foundation: FoundationSettings;
  provenance: ProfileProvenance;
}

export interface PrintProject {
  format: 'np3dp-project';
  schemaVersion: 1;
  recipe: Recipe;
  setup: PrintSetup;
}

export type PrintStageKind = 'foundation' | 'transition' | 'wall' | 'rim';
export interface PrintStage { kind: PrintStageKind; startEvent: number; endEvent: number }
export interface PreparedBuild {
  /** Paired identity includes the placement/foundation inputs as well as the recipe. */
  buildKey: string;
  path: GeneratedToolpath;
  wallOffsetZMm: number;
  stages: PrintStage[];
}

export interface JobDiagnostic {
  severity: 'error' | 'warning' | 'info';
  code: string;
  message: string;
  eventIndex?: number;
}
