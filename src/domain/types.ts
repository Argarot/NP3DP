/** Domain coordinates are millimetres, centred on the part; Z points up.
 * Machine offsets, E-axis conversion and firmware commands belong to adapters. */
export type Vec3 = Readonly<{ x: number; y: number; z: number }>;
export type PatternKind = 'wave' | 'triangle' | 'arch' | 'bridge';
export type SectionKind = 'circle' | 'ellipse' | 'squircle';

export interface Shape {
  heightMm: number;
  baseDiameterMm: number;
  topDiameterMm: number;
  bellyMm: number;
  section: SectionKind;
  aspectRatio: number;
  twistDeg: number;
}
export interface Process {
  pitchMm: number;
  strandDiameterMm: number;
  filamentDiameterMm: number;
  speedMmS: number;
  travelMmS: number;
  flowMultiplier: number;
}
export interface Band {
  id: string;
  kind: PatternKind;
  /** Relative share of the wall height. Normalised only during generation. */
  weight: number;
  amplitudeMm: number;
  repeatsPerTurn: number;
  /** Continuous phase advance per revolution, never reset at the seam. */
  phaseAdvanceDeg: number;
  radialAmplitudeMm: number;
  speedVariation: number;
  flowVariation: number;
  dwellSeconds: number;
  anchorVolumeMm3: number;
}
export interface Recipe {
  schemaVersion: 1;
  name: string;
  shape: Shape;
  process: Process;
  bands: Band[];
}

interface EventBase { bandId: string }
export interface ExtrudeEvent extends EventBase {
  kind: 'extrude'; from: Vec3; to: Vec3;
  volumeMm3: number; speedMmS: number;
  role: 'wall' | 'span' | 'rise' | 'fall' | 'transition';
}
export interface TravelEvent extends EventBase {
  kind: 'travel'; from: Vec3; to: Vec3; speedMmS: number;
}
export interface DwellEvent extends EventBase {
  kind: 'dwell'; at: Vec3; seconds: number;
}
export interface DepositEvent extends EventBase {
  kind: 'deposit'; at: Vec3; volumeMm3: number; volumeRateMm3S: number;
}
export interface AnchorEvent extends EventBase {
  kind: 'anchor'; at: Vec3;
}
export type ToolpathEvent = ExtrudeEvent | TravelEvent | DwellEvent | DepositEvent | AnchorEvent;
export interface Diagnostic {
  severity: 'error' | 'warning' | 'info'; code: string; message: string; bandId?: string;
}
export interface Bounds { min: Vec3; max: Vec3 }
export interface ToolpathStats {
  pathLengthMm: number;
  extrusionVolumeMm3: number;
  filamentLengthMm: number;
  commandedDurationS: number;
  extrudeMoves: number;
  travelMoves: number;
  dwellCount: number;
  bounds: Bounds;
}
export interface GeneratedToolpath {
  engineVersion: string;
  recipeKey: string;
  events: ToolpathEvent[];
  stats: ToolpathStats;
  diagnostics: Diagnostic[];
}
