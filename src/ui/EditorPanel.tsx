import { useState } from 'react';
import type { Band, PatternKind, Process, Recipe, Shape } from '../domain/types';
import { BAND_PARAMETERS, PROCESS_PARAMETERS, SHAPE_PARAMETERS } from '../domain/recipe';
import { createBand } from '../domain/presets';
import { ParameterField } from './ParameterField';
import { Icon } from './Icons';
import { METHOD_COLORS } from '../preview/types';

export const METHODS: Record<PatternKind, { title: string; short: string; description: string; diagram: string }> = {
  wave: { title: 'Sinusoidal wall', short: 'Wave', description: 'A continuous contour with Z and radial oscillation.', diagram: 'M2 22C10 22 10 6 18 6s8 16 16 16 8-16 16-16 8 16 16 16' },
  triangle: { title: 'Triangular spans', short: 'Triangle', description: 'Straight segments meet at raised midpoints between anchors.', diagram: 'M2 22 18 6 34 22 50 6 66 22' },
  arch: { title: 'Curved arches', short: 'Arch', description: 'Curved spans rise between contour anchors.', diagram: 'M2 22Q18-10 34 22Q50-10 66 22' },
  bridge: { title: 'Pause + move bridges', short: 'Bridge', description: 'Deposit at the anchor, hold, rise, span, and return.', diagram: 'M2 22h5V8h22v14h10V8h22v14h5' },
};
type NumericBandKey = keyof typeof BAND_PARAMETERS;
export function EditorPanel({ recipe, selectedBandId, selectBand, onChange }: {
  recipe: Recipe; selectedBandId: string; selectBand: (id: string) => void; onChange: (recipe: Recipe) => boolean;
}) {
  const [tab, setTab] = useState<'form' | 'pattern' | 'process'>('pattern');
  const selected = recipe.bands.find((band) => band.id === selectedBandId) ?? recipe.bands[0]!;
  const editShape = (key: keyof Shape, value: number | string) => onChange({ ...recipe, shape: { ...recipe.shape, [key]: value } });
  const editProcess = (key: keyof Process, value: number) => onChange({ ...recipe, process: { ...recipe.process, [key]: value } });
  const editBand = (patch: Partial<Band>) => onChange({ ...recipe, bands: recipe.bands.map((band) => band.id === selected.id ? { ...band, ...patch } : band) });
  const bandField = (key: NumericBandKey) => <ParameterField key={key} value={selected[key as keyof Band] as number} spec={BAND_PARAMETERS[key]} onChange={(value) => editBand({ [key]: value })} />;
  return <aside className="editor-panel" aria-label="Design controls">
    <div className="panel-tabs" role="tablist" aria-label="Design controls">
      {(['form', 'pattern', 'process'] as const).map((value) => <button key={value} role="tab" aria-selected={tab === value} aria-controls={`panel-${value}`} id={`tab-${value}`} onClick={() => setTab(value)}>{value === 'form' ? 'Form' : value === 'pattern' ? 'Deposition' : 'Process'}</button>)}
    </div>
    <div className="panel-scroll" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
      {tab === 'form' && <>
        <div className="panel-intro"><span className="micro-label">01 / DESIGN ENVELOPE</span><h2>Shape the vessel</h2><p>Control the form beneath the deposition pattern.</p></div>
        <div className="control-group"><label className="control-label" htmlFor="cross-section">Cross-section</label>
          <select id="cross-section" value={recipe.shape.section} onChange={(event) => editShape('section', event.target.value)}><option value="circle">Circle</option><option value="ellipse">Ellipse</option><option value="squircle">Rounded square</option></select>
        </div>
        {(Object.keys(SHAPE_PARAMETERS) as (keyof typeof SHAPE_PARAMETERS)[]).filter((key) => key !== 'aspectRatio' || recipe.shape.section !== 'circle').map((key) => <ParameterField key={key} value={recipe.shape[key as keyof Shape] as number} spec={SHAPE_PARAMETERS[key]} onChange={(value) => editShape(key as keyof Shape, value)} />)}
        <div className="quiet-note"><Icon name="info" /><p>Dimensions describe the nominal envelope. Pattern excursions can extend beyond it.</p></div>
      </>}
      {tab === 'pattern' && <>
        <div className="panel-intro"><span className="micro-label">02 / DEPOSITION PROGRAM</span><h2>Make the material move</h2><p>Stack methods from bottom to top. Each band can combine motion and flow effects.</p></div>
        <div className="band-list" aria-label="Deposition bands">
          {recipe.bands.map((band, index) => <button key={band.id} className={`band-row ${band.id === selected.id ? 'selected' : ''}`} onClick={() => selectBand(band.id)}>
            <span className="band-index" style={{ color: METHOD_COLORS[band.kind] }}>{String(index + 1).padStart(2, '0')}</span><span>{METHODS[band.kind].short}</span><small>{Math.round(band.weight / recipe.bands.reduce((sum, entry) => sum + entry.weight, 0) * 100)}%</small><Icon name="chevron" size={14} />
          </button>)}
          <button className="add-band" disabled={recipe.bands.length >= 8} onClick={() => { const band = createBand('arch', `band-${crypto.randomUUID().slice(0, 8)}`); onChange({ ...recipe, bands: [...recipe.bands, band] }); selectBand(band.id); }}><Icon name="plus" size={15} />Add height band</button>
        </div>
        <div className="control-group"><div className="control-label-row"><label className="control-label" htmlFor="method-kind">Method</label>{recipe.bands.length > 1 && <button className="text-button" onClick={() => onChange({ ...recipe, bands: recipe.bands.filter((band) => band.id !== selected.id) })}>Remove band</button>}</div>
          <select id="method-kind" value={selected.kind} onChange={(event) => editBand({ kind: event.target.value as PatternKind })}>{Object.entries(METHODS).map(([kind, method]) => <option key={kind} value={kind}>{method.title}</option>)}</select>
        </div>
        <div className="method-explanation"><svg viewBox="0 0 68 30" width="86" height="38" aria-hidden="true"><path d="M2 25H66" stroke="#454e57" strokeDasharray="2 3" /><path d={METHODS[selected.kind].diagram} fill="none" stroke={METHOD_COLORS[selected.kind]} strokeWidth="1.8" strokeLinejoin="round" /></svg><p>{METHODS[selected.kind].description}</p></div>
        {recipe.bands.length > 1 && bandField('weight')}
        {bandField('amplitudeMm')}{bandField('repeatsPerTurn')}{bandField('radialAmplitudeMm')}{bandField('phaseAdvanceDeg')}
        {selected.kind === 'bridge' && <><div className="group-divider"><span>Anchor sequence</span></div>{bandField('anchorVolumeMm3')}{bandField('dwellSeconds')}</>}
        <div className="group-divider"><span>Process modulation</span></div>{bandField('speedVariation')}{bandField('flowVariation')}
        <div className="quiet-note"><Icon name="info" /><p>Creative settings stay available even when a print may sag or fail. Band boundaries blend back to the envelope.</p></div>
      </>}
      {tab === 'process' && <>
        <div className="panel-intro"><span className="micro-label">03 / PROCESS SETTINGS</span><h2>Set the deposition rhythm</h2><p>Working values for exploration. These are not a calibrated printer profile.</p></div>
        {(Object.keys(PROCESS_PARAMETERS) as (keyof Process)[]).map((key) => <ParameterField key={key} value={recipe.process[key]} spec={PROCESS_PARAMETERS[key]} onChange={(value) => editProcess(key, value)} />)}
        <div className="machine-card"><span className="micro-label">FIRST TEST MACHINE</span><h3>Prusa MINI+</h3><p>0.4 mm nozzle · eSUN PLA</p><span className="pill">Setup confirmation pending</span><p className="secondary">Firmware, hotend changes, and exact PLA grade are needed before a complete print job.</p></div>
      </>}
    </div>
    <div className="panel-foot"><span>Local recipe</span><span>Save before closing</span></div>
  </aside>;
}
