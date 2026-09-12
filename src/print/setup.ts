import type { JobDiagnostic, PrintSetup } from './types';

export const PRINT_SETUP_SCHEMA_VERSION = 2;

/** Explicit proposals for the first MINI-family adapter. They are not printer-test evidence. */
export const DEFAULT_PRINT_SETUP: PrintSetup = {
  schemaVersion: 2,
  printer: {
    adapter: 'prusa-mini-buddy-5.1.2',
    variant: 'unknown',
    firmware: '5.1.2+13478',
    hotend: 'stock',
    nozzleDiameterMm: 0.4,
    maxXySpeedMmS: 100,
    maxZSpeedMmS: 8,
    accelerationMmS2: 500,
  },
  material: {
    name: 'eSUN PLA Basic',
    color: 'unspecified',
    nozzleC: 210,
    firstLayerNozzleC: 215,
    bedC: 60,
    firstLayerBedC: 60,
    maxFlowMm3S: 5,
    fanPercent: 100,
  },
  foundation: {
    enabled: false,
    layers: 3,
    layerHeightMm: 0.2,
    lineWidthMm: 0.45,
    speedMmS: 20,
    blendHeightMm: 4,
    rimTurns: 1,
    elephantFootMm: 0.15,
  },
  provenance: {
    source: 'manual',
    filename: '',
    digest: '',
    slicerVersion: '',
    printerProfile: '',
    filamentProfile: '',
    importedValues: {},
    mappedFields: [],
    ignoredFields: [],
    warnings: [],
  },
};

const SETUP_KEYS = ['schemaVersion', 'printer', 'material', 'foundation', 'provenance'] as const;
const PRINTER_KEYS = ['adapter', 'variant', 'firmware', 'hotend', 'nozzleDiameterMm', 'maxXySpeedMmS', 'maxZSpeedMmS', 'accelerationMmS2'] as const;
const MATERIAL_KEYS = ['name', 'color', 'nozzleC', 'bedC', 'firstLayerNozzleC', 'firstLayerBedC', 'maxFlowMm3S', 'fanPercent'] as const;
const FOUNDATION_V1_KEYS = ['enabled', 'layers', 'layerHeightMm', 'lineWidthMm', 'speedMmS', 'blendHeightMm', 'rimTurns'] as const;
const FOUNDATION_KEYS = [...FOUNDATION_V1_KEYS, 'elephantFootMm'] as const;
const PROVENANCE_KEYS = ['source', 'filename', 'digest', 'slicerVersion', 'printerProfile', 'filamentProfile', 'importedValues', 'mappedFields', 'ignoredFields', 'warnings'] as const;
const CONTROL = /[\u0000-\u001f\u007f]/;
const NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;
/** Full flattened slicer exports can contain many named settings. Preserve them, bounded. */
const MAX_PROVENANCE_ITEMS = 1_000;

/**
 * Validates persisted setup data before it reaches an adapter. This never
 * clamps values: out-of-envelope input remains a visible error for the caller.
 */
export function parsePrintSetup(input: unknown): PrintSetup {
  const setup = expectRecord(input, 'print setup');
  expectExactKeys(setup, SETUP_KEYS, 'print setup');
  if (setup.schemaVersion !== 1 && setup.schemaVersion !== PRINT_SETUP_SCHEMA_VERSION) {
    throw new Error(`Invalid print setup: unsupported schemaVersion ${describe(setup.schemaVersion)}; versions 1 and 2 are supported.`);
  }

  const printer = expectRecord(setup.printer, 'print setup.printer');
  expectExactKeys(printer, PRINTER_KEYS, 'print setup.printer');
  const material = expectRecord(setup.material, 'print setup.material');
  expectExactKeys(material, MATERIAL_KEYS, 'print setup.material');
  const foundation = expectRecord(setup.foundation, 'print setup.foundation');
  expectExactKeys(foundation, setup.schemaVersion === 1 ? FOUNDATION_V1_KEYS : FOUNDATION_KEYS, 'print setup.foundation');
  const provenance = expectRecord(setup.provenance, 'print setup.provenance');
  expectExactKeys(provenance, PROVENANCE_KEYS, 'print setup.provenance');

  const parsed: PrintSetup = {
    schemaVersion: 2,
    printer: {
      adapter: expectEnum(printer.adapter, ['prusa-mini-buddy-5.1.2'], 'print setup.printer.adapter') as PrintSetup['printer']['adapter'],
      variant: expectEnum(printer.variant, ['mini', 'mini-plus', 'unknown'], 'print setup.printer.variant') as PrintSetup['printer']['variant'],
      firmware: expectText(printer.firmware, 'print setup.printer.firmware', 1, 80),
      hotend: expectEnum(printer.hotend, ['stock', 'modified', 'unknown'], 'print setup.printer.hotend') as PrintSetup['printer']['hotend'],
      nozzleDiameterMm: expectNumber(printer.nozzleDiameterMm, 'print setup.printer.nozzleDiameterMm', 0.2, 1),
      maxXySpeedMmS: expectNumber(printer.maxXySpeedMmS, 'print setup.printer.maxXySpeedMmS', 5, 200),
      maxZSpeedMmS: expectNumber(printer.maxZSpeedMmS, 'print setup.printer.maxZSpeedMmS', 1, 15),
      accelerationMmS2: expectNumber(printer.accelerationMmS2, 'print setup.printer.accelerationMmS2', 100, 2_000),
    },
    material: {
      name: expectText(material.name, 'print setup.material.name', 1, 100),
      color: expectEnum(material.color, ['white', 'black', 'unspecified'], 'print setup.material.color') as PrintSetup['material']['color'],
      nozzleC: expectNumber(material.nozzleC, 'print setup.material.nozzleC', 180, 240),
      bedC: expectNumber(material.bedC, 'print setup.material.bedC', 0, 80),
      firstLayerNozzleC: expectNumber(material.firstLayerNozzleC, 'print setup.material.firstLayerNozzleC', 180, 240),
      firstLayerBedC: expectNumber(material.firstLayerBedC, 'print setup.material.firstLayerBedC', 0, 80),
      maxFlowMm3S: expectNumber(material.maxFlowMm3S, 'print setup.material.maxFlowMm3S', 0.5, 15),
      fanPercent: expectNumber(material.fanPercent, 'print setup.material.fanPercent', 0, 100),
    },
    foundation: {
      enabled: expectBoolean(foundation.enabled, 'print setup.foundation.enabled'),
      layers: expectNumber(foundation.layers, 'print setup.foundation.layers', 1, 8, true),
      layerHeightMm: expectNumber(foundation.layerHeightMm, 'print setup.foundation.layerHeightMm', 0.1, 0.35),
      lineWidthMm: expectNumber(foundation.lineWidthMm, 'print setup.foundation.lineWidthMm', 0.35, 0.8),
      speedMmS: expectNumber(foundation.speedMmS, 'print setup.foundation.speedMmS', 5, 60),
      blendHeightMm: expectNumber(foundation.blendHeightMm, 'print setup.foundation.blendHeightMm', 0, 30),
      rimTurns: expectNumber(foundation.rimTurns, 'print setup.foundation.rimTurns', 0, 3, true),
      // Loading an older file must not silently shrink its successful base.
      elephantFootMm: setup.schemaVersion === 1 ? 0 : expectNumber(foundation.elephantFootMm, 'print setup.foundation.elephantFootMm', 0, 0.5),
    },
    provenance: {
      source: expectEnum(provenance.source, ['manual', 'prusaslicer-config'], 'print setup.provenance.source') as PrintSetup['provenance']['source'],
      filename: expectText(provenance.filename, 'print setup.provenance.filename', 0, 255),
      digest: expectText(provenance.digest, 'print setup.provenance.digest', 0, 128),
      slicerVersion: expectText(provenance.slicerVersion, 'print setup.provenance.slicerVersion', 0, 100),
      printerProfile: expectText(provenance.printerProfile, 'print setup.provenance.printerProfile', 0, 160),
      filamentProfile: expectText(provenance.filamentProfile, 'print setup.provenance.filamentProfile', 0, 160),
      importedValues: expectImportedValues(provenance.importedValues),
      mappedFields: expectTextArray(provenance.mappedFields, 'print setup.provenance.mappedFields'),
      ignoredFields: expectTextArray(provenance.ignoredFields, 'print setup.provenance.ignoredFields'),
      warnings: expectTextArray(provenance.warnings, 'print setup.provenance.warnings'),
    },
  };
  if (parsed.foundation.layerHeightMm > parsed.foundation.lineWidthMm) {
    throw new Error('Invalid print setup.foundation: layerHeightMm must not exceed lineWidthMm.');
  }
  return parsed;
}

/** Adapter-specific blockers. A valid saved setup can still be unsupported by this narrow adapter. */
export function getPrintSetupDiagnostics(setupInput: unknown): JobDiagnostic[] {
  const setup = parsePrintSetup(setupInput);
  const diagnostics: JobDiagnostic[] = [];
  if (setup.printer.nozzleDiameterMm !== 0.4) {
    diagnostics.push({ severity: 'error', code: 'unsupported-nozzle', message: 'The current Prusa MINI adapter only supports a 0.4 mm nozzle.' });
  }
  if (setup.printer.variant === 'unknown') {
    diagnostics.push({ severity: 'warning', code: 'unknown-printer-variant', message: 'Confirm whether the printer is a MINI or MINI+ before creating a printer job.' });
  }
  return diagnostics;
}

function expectRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error(`Invalid ${path}: expected a plain object.`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new Error(`Invalid ${path}: expected a plain object.`);
  return value as Record<string, unknown>;
}

function expectExactKeys(value: Record<string, unknown>, expected: readonly string[], path: string): void {
  const allowed = new Set(expected);
  const extra = Object.keys(value).filter((key) => !allowed.has(key));
  if (extra.length) throw new Error(`Invalid ${path}: unexpected field${extra.length === 1 ? '' : 's'} ${extra.map((key) => `"${key}"`).join(', ')}.`);
  const missing = expected.filter((key) => !Object.prototype.hasOwnProperty.call(value, key));
  if (missing.length) throw new Error(`Invalid ${path}: missing required field${missing.length === 1 ? '' : 's'} ${missing.map((key) => `"${key}"`).join(', ')}.`);
}

function expectNumber(value: unknown, path: string, min: number, max: number, integer = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Invalid ${path}: expected a finite number.`);
  if (value < min || value > max) throw new Error(`Invalid ${path}: expected a value from ${min} to ${max}.`);
  if (integer && !Number.isInteger(value)) throw new Error(`Invalid ${path}: expected an integer.`);
  return value;
}

function expectBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') throw new Error(`Invalid ${path}: expected a boolean.`);
  return value;
}

function expectEnum(value: unknown, values: readonly string[], path: string): string {
  if (typeof value !== 'string' || !values.includes(value)) throw new Error(`Invalid ${path}: expected one of ${values.join(', ')}.`);
  return value;
}

function expectText(value: unknown, path: string, min: number, max: number): string {
  if (typeof value !== 'string' || value.length < min || value.length > max || CONTROL.test(value)) {
    throw new Error(`Invalid ${path}: expected ${min} to ${max} control-character-free characters.`);
  }
  if (min > 0 && value.trim().length === 0) throw new Error(`Invalid ${path}: expected non-blank text.`);
  return value;
}

function expectTextArray(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.length > MAX_PROVENANCE_ITEMS) throw new Error(`Invalid ${path}: expected at most ${MAX_PROVENANCE_ITEMS} text items.`);
  return value.map((item, index) => expectText(item, `${path}[${index}]`, 1, 240));
}

const IMPORTED_VALUE_KEYS = new Set([
  'printer.nozzleDiameterMm', 'printer.maxXySpeedMmS', 'printer.maxZSpeedMmS', 'printer.accelerationMmS2',
  'material.nozzleC', 'material.firstLayerNozzleC', 'material.bedC', 'material.firstLayerBedC', 'material.maxFlowMm3S', 'material.fanPercent',
  'foundation.layerHeightMm', 'foundation.lineWidthMm', 'foundation.elephantFootMm', 'process.filamentDiameterMm', 'process.flowMultiplier',
]);

function expectImportedValues(value: unknown): Record<string, string> {
  const imported = expectRecord(value, 'print setup.provenance.importedValues');
  const entries = Object.entries(imported);
  if (entries.length > 40) throw new Error('Invalid print setup.provenance.importedValues: at most 40 values are supported.');
  const result: Record<string, string> = {};
  for (const [key, item] of entries) {
    if (!IMPORTED_VALUE_KEYS.has(key)) throw new Error(`Invalid print setup.provenance.importedValues: unsupported target "${key}".`);
    const text = expectText(item, `print setup.provenance.importedValues.${key}`, 1, 100);
    if (!NUMBER_PATTERN.test(text) || !Number.isFinite(Number(text))) {
      throw new Error(`Invalid print setup.provenance.importedValues.${key}: expected a finite numeric string.`);
    }
    result[key] = text;
  }
  return result;
}

function describe(value: unknown): string {
  return typeof value === 'string' ? `"${value}"` : String(value);
}
