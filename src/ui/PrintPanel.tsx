import { useRef, useState } from 'react';
import type { ParameterSpec } from '../domain/recipe';
import { CALIBRATION_STUDIES } from '../print/calibration';
import { importPrusaConfig } from '../print/importProfile';
import type { ProfileImportResult } from '../print/importProfile';
import { serializeProject } from '../print/project';
import type { FoundationSettings, JobDiagnostic, MaterialSettings, PrintProject, PrinterSettings } from '../print/types';
import type { CommandMetrics } from '../print/diagnostics';
import { downloadText, safeFilename } from './files';
import { ParameterField } from './ParameterField';
import { Icon } from './Icons';

const FOUNDATION_FIELDS = {
  layers: { label: 'Foundation layers', min: 1, max: 8, step: 1, unit: 'layers' },
  layerHeightMm: { label: 'Foundation layer height', min: 0.1, max: 0.35, step: 0.01, unit: 'mm' },
  lineWidthMm: { label: 'Foundation line width', min: 0.35, max: 0.8, step: 0.01, unit: 'mm' },
  speedMmS: { label: 'Foundation speed', min: 5, max: 60, step: 1, unit: 'mm/s' },
  blendHeightMm: { label: 'Pattern lead-in height', min: 0, max: 30, step: 0.1, unit: 'mm' },
  rimTurns: { label: 'Finish rim turns', min: 0, max: 3, step: 1, unit: 'turns' },
} as const satisfies Record<Exclude<keyof FoundationSettings, 'enabled'>, ParameterSpec>;
const MATERIAL_FIELDS = {
  firstLayerNozzleC: { label: 'First-layer nozzle', min: 180, max: 240, step: 1, unit: '°C' },
  nozzleC: { label: 'Body nozzle', min: 180, max: 240, step: 1, unit: '°C' },
  firstLayerBedC: { label: 'First-layer bed', min: 0, max: 80, step: 1, unit: '°C' },
  bedC: { label: 'Body bed', min: 0, max: 80, step: 1, unit: '°C' },
  fanPercent: { label: 'Fan after foundation', min: 0, max: 100, step: 1, unit: '%' },
  maxFlowMm3S: { label: 'Flow ceiling', min: 0.5, max: 15, step: 0.1, unit: 'mm³/s' },
} as const satisfies Record<Exclude<keyof MaterialSettings, 'name' | 'color'>, ParameterSpec>;
const PRINTER_FIELDS = {
  maxXySpeedMmS: { label: 'XY speed ceiling', min: 5, max: 200, step: 1, unit: 'mm/s' },
  maxZSpeedMmS: { label: 'Z speed ceiling', min: 1, max: 15, step: 0.1, unit: 'mm/s' },
  accelerationMmS2: { label: 'Commanded acceleration', min: 100, max: 2000, step: 10, unit: 'mm/s²' },
} as const satisfies Partial<Record<keyof PrinterSettings, ParameterSpec>>;

interface Props {
  project: PrintProject;
  onChange: (project: PrintProject) => boolean;
  diagnostics: JobDiagnostic[];
  metrics: CommandMetrics | null;
  pending: boolean;
  generationError: string | null;
}

export function PrintPanel({ project, onChange, diagnostics, metrics, pending, generationError }: Props) {
  const { setup, recipe } = project;
  const [tab, setTab] = useState<'setup' | 'foundation' | 'tests'>('tests');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState<{ sourceKey: string; result: ProfileImportResult } | null>(null);
  const file = useRef<HTMLInputElement>(null);
  const key = JSON.stringify(project);
  const editFoundation = (field: keyof FoundationSettings, value: number | boolean) => onChange({ ...project, setup: { ...setup, foundation: { ...setup.foundation, [field]: value } } });
  const editMaterial = (field: keyof MaterialSettings, value: number | string) => onChange({ ...project, setup: { ...setup, material: { ...setup.material, [field]: value } } });
  const editPrinter = (field: keyof PrinterSettings, value: number | string) => onChange({ ...project, setup: { ...setup, printer: { ...setup.printer, [field]: value } } });
  const loadProfile = async (selected?: File) => {
    if (!selected) return;
    setError(null); setReview(null); setBusy(true);
    try {
      if (selected.size > 1_000_000) throw new Error('Profile files must be smaller than 1 MB.');
      const result = await importPrusaConfig(await selected.text(), selected.name, setup);
      setReview({ sourceKey: key, result });
    } catch (failure) { setError(failure instanceof Error ? failure.message : 'Profile import failed.'); }
    finally { setBusy(false); }
  };
  const loadStudy = (id: string) => {
    const study = CALIBRATION_STUDIES.find((entry) => entry.id === id)!;
    onChange({ ...project,
      recipe: { ...study.recipe, process: { ...study.recipe.process, filamentDiameterMm: recipe.process.filamentDiameterMm, flowMultiplier: recipe.process.flowMultiplier } },
      setup: { ...setup, foundation: { ...setup.foundation, enabled: true, layers: 3, layerHeightMm: 0.2, lineWidthMm: 0.45, speedMmS: 20, blendHeightMm: 4, rimTurns: 1 } },
    });
  };
  const blocked = diagnostics.filter((entry) => entry.severity === 'error');
  return <section className="editor-panel print-panel" aria-label="Print preparation">
    <div className="panel-tabs" role="tablist" aria-label="Print preparation tabs">
      {([['tests', 'Test bench'], ['setup', 'Printer'], ['foundation', 'Foundation']] as const).map(([value, label]) => <button role="tab" key={value} aria-selected={tab === value} aria-controls={`print-${value}`} onClick={() => setTab(value)}>{label}</button>)}
    </div>
    <div className="panel-scroll" role="tabpanel" id={`print-${tab}`}>
      {tab === 'tests' && <>
        <div className="panel-intro"><span className="micro-label">FIRST PHYSICAL EXPERIMENTS</span><h2>Start small. Learn from it.</h2><p>Check a control cup before adding unsupported motion. These studies are ready to inspect, with no print success claimed.</p></div>
        {CALIBRATION_STUDIES.map((study) => <article className={`study-card ${recipe.name === study.recipe.name ? 'selected' : ''}`} key={study.id}>
          <h3>{study.title}</h3><p>{study.description}</p>
          <button className="button secondary-button" onClick={() => loadStudy(study.id)}>Load {study.id === 'control' ? 'control cup' : study.id === 'miniature' ? 'mini vase' : study.id === 'wave' ? 'wave coupon' : 'span coupon'}<Icon name="chevron" size={14} /></button>
          {recipe.name === study.recipe.name && <details><summary>What to record</summary><ul>{study.observe.map((item) => <li key={item}>{item}</li>)}</ul></details>}
        </article>)}
        <div className="quiet-note"><Icon name="info" /><p>Loading a test sets its shape, deposition and foundation. It retains your printer, material, filament diameter and flow multiplier.</p></div>
      </>}
      {tab === 'setup' && <>
        <div className="panel-intro"><span className="micro-label">MACHINE + MATERIAL</span><h2>Prusa MINI family</h2><p>One reviewed command adapter. Every physical recipe is still an experiment.</p></div>
        <label className="control-label" htmlFor="printer-variant">Printer variant</label><select id="printer-variant" value={setup.printer.variant} onChange={(event) => editPrinter('variant', event.target.value)}><option value="unknown">MINI / MINI+ — uncertain</option><option value="mini">Original MINI</option><option value="mini-plus">MINI+</option></select>
        <TextField label="Installed firmware" value={setup.printer.firmware} onChange={(value) => editPrinter('firmware', value)} />
        <label className="control-label" htmlFor="hotend-type">Hotend</label><select id="hotend-type" value={setup.printer.hotend} onChange={(event) => editPrinter('hotend', event.target.value)}><option value="stock">Stock</option><option value="modified">Modified</option><option value="unknown">Unknown</option></select>
        <div className="profile-facts">{setup.printer.nozzleDiameterMm} mm nozzle · 180 × 180 × 180 mm<br />Adapter: Buddy 5.1.2 / 0.4 mm nozzle</div>
        <button className="button secondary-button profile-import-button" disabled={busy} onClick={() => file.current?.click()}><Icon name="open" />{busy ? 'Reading profile…' : 'Import PrusaSlicer config'}</button>
        <input className="visually-hidden" type="file" ref={file} accept=".ini" aria-label="Import PrusaSlicer configuration file" onChange={(event) => { void loadProfile(event.target.files?.[0]); event.target.value = ''; }} />
        <p className="setup-hint">Use File → Export → Export Config in PrusaSlicer. Review the mapped values before applying. Embedded G-code stays inactive.</p>
        {error && <p role="alert" className="field-error">{error}</p>}
        {review && <div className="import-review" aria-label="Imported profile review">
          <h3>Review imported settings</h3><p>{review.result.setup.provenance.filename}</p>
          <dl>{review.result.changes.map((change, index) => <div key={`${change.field}-${index}`}><dt>{fieldLabel(change.field)}</dt><dd>{change.before === 'current recipe not supplied' ? String(readTarget(project, change.field)) : change.before} → {change.after}</dd></div>)}</dl>
          <details><summary>{review.result.warnings.length} import notes</summary><ul>{review.result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul></details>
          {review.sourceKey !== key && <p className="field-error">Settings changed while this proposal was open. Import again to review against the current project.</p>}
          <button className="button primary-button" disabled={review.sourceKey !== key} onClick={() => { if (onChange({ ...project, setup: review.result.setup, recipe: { ...recipe, process: { ...recipe.process, ...review.result.process } } })) setReview(null); }}>Apply imported settings</button>
          <button className="text-button" onClick={() => setReview(null)}>Discard proposal</button>
        </div>}
        {setup.provenance.source === 'prusaslicer-config' && <div className="import-provenance"><span className="micro-label">IMPORTED BASELINE</span><p>{setup.provenance.printerProfile || setup.provenance.filename}</p><p>{setup.provenance.filamentProfile}</p><p>{setup.provenance.mappedFields.length} mapped · {setup.provenance.ignoredFields.length} ignored</p><p>{Object.entries(setup.provenance.importedValues).filter(([field, value]) => String(readTarget(project, field)) !== value).length} current overrides</p></div>}
        <div className="section-heading">Filament and cooling</div>
        <TextField label="Material name" value={setup.material.name} onChange={(value) => editMaterial('name', value)} />
        <label className="control-label" htmlFor="filament-color">Filament colour</label><select id="filament-color" value={setup.material.color} onChange={(event) => editMaterial('color', event.target.value)}><option value="unspecified">Record at print time</option><option value="white">White</option><option value="black">Black</option></select>
        <p className="setup-hint">Temperatures and flow ceilings are editable starting values. Fan is off during the foundation and set below for the transition and wall.</p>
        {(Object.keys(MATERIAL_FIELDS) as (keyof typeof MATERIAL_FIELDS)[]).map((field) => <ParameterField key={field} value={setup.material[field]} spec={MATERIAL_FIELDS[field]} onChange={(value) => editMaterial(field, value)} />)}
        <details className="machine-limits"><summary>Command limits and acceleration</summary><p className="setup-hint">These ceilings check the commands. They are not measured hardware capabilities.</p>{(Object.keys(PRINTER_FIELDS) as (keyof typeof PRINTER_FIELDS)[]).map((field) => <ParameterField key={field} value={setup.printer[field]} spec={PRINTER_FIELDS[field]} onChange={(value) => editPrinter(field, value)} />)}</details>
      </>}
      {tab === 'foundation' && <>
        <div className="panel-intro"><span className="micro-label">BUILD THE WHOLE OBJECT</span><h2>A base to build on</h2><p>The foundation, rising transition and rim join the same path as your experimental wall.</p></div>
        <label className="toggle-row"><input type="checkbox" checked={setup.foundation.enabled} onChange={(event) => editFoundation('enabled', event.target.checked)} /><span>Include foundation and finish</span></label>
        <div className="build-sequence"><span>Foundation</span><b>→</b><span>Lead-in</span><b>→</b><span>Wall</span><b>→</b><span>Rim</span></div>
        {(Object.keys(FOUNDATION_FIELDS) as (keyof typeof FOUNDATION_FIELDS)[]).map((field) => <ParameterField key={field} value={setup.foundation[field]} spec={FOUNDATION_FIELDS[field]} onChange={(value) => editFoundation(field, value)} />)}
        <div className="quiet-note"><Icon name="info" /><p>Lead-in height gradually introduces Z and radial effects. It must accommodate downward excursions; requested amplitudes are preserved above it.</p></div>
      </>}
      <div className={`print-readiness ${blocked.length ? 'blocked' : ''}`} aria-label="Job readiness">
        <span className="micro-label">COMMAND CHECKS</span><h3>{generationError ? 'Print plan needs adjustment' : pending ? 'Updating the print plan…' : !setup.foundation.enabled ? 'Wall study mode' : blocked.length ? `${blocked.length} issue${blocked.length === 1 ? '' : 's'} to resolve` : 'Ready for export review'}</h3>
        {generationError && <p className="field-error">{generationError}</p>}
        {!pending && blocked.map((entry) => <p className="field-error" key={entry.code}>{entry.message}</p>)}
        {!pending && metrics && <dl><div><dt>Peak Z command</dt><dd>{metrics.maximumZSpeedMmS.toFixed(2)} mm/s</dd></div><div><dt>Peak flow command</dt><dd>{metrics.maximumFlowMm3S.toFixed(2)} mm³/s</dd></div></dl>}
        <p>Physical printability and printhead clearance remain unverified.</p>
      </div>
    </div>
    <div className="panel-footer"><button className="text-button" onClick={() => downloadText(serializeProject(project), `${safeFilename(recipe.name)}.np3dp-project.json`, 'application/json')}>Save project + print setup</button><span>Local files</span></div>
  </section>;
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => boolean }) {
  return <label className="setup-text-field"><span>{label}</span><input key={value} aria-label={label} defaultValue={value} maxLength={100} onBlur={(event) => { if (event.target.value !== value && !onChange(event.target.value)) event.target.value = value; }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /></label>;
}
function readTarget(project: PrintProject, field: string): unknown {
  const [section, name] = field.split('.');
  const record = section === 'process' ? project.recipe.process : project.setup[section as keyof typeof project.setup];
  return record && typeof record === 'object' ? (record as unknown as Record<string, unknown>)[name!] : undefined;
}
function fieldLabel(field: string): string {
  const name = field.split('.')[1]!;
  const spec = ({ ...FOUNDATION_FIELDS, ...MATERIAL_FIELDS, ...PRINTER_FIELDS } as Record<string, ParameterSpec>)[name];
  return spec?.label ?? ({ filamentDiameterMm: 'Filament diameter', flowMultiplier: 'Flow multiplier', nozzleDiameterMm: 'Nozzle diameter', printerProfile: 'Printer profile', filamentProfile: 'Filament profile', slicerVersion: 'Slicer version' } as Record<string, string>)[name] ?? field;
}
