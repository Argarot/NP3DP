import type { CalibrationStudy } from '../print/calibration';
import { CALIBRATION_STUDIES, NEXT_STUDIES, RETRY_STUDIES, studyFilename } from '../print/calibration';
import { Icon } from './Icons';

export const TEST_BENCH_STUDIES = [...NEXT_STUDIES, ...RETRY_STUDIES, ...CALIBRATION_STUDIES];

export function TestBench({ recipeName, loadStudy }: { recipeName: string; loadStudy: (id: string) => void }) {
  const card = (study: CalibrationStudy, prepared = false) => {
    const filename = studyFilename(study);
    const directory = `${import.meta.env.BASE_URL}print-tests/session-005/`;
    return <article className={`study-card ${recipeName === study.recipe.name ? 'selected' : ''}`} key={study.id}>
      <h3>{study.title}</h3><p>{study.description}</p>
      {study.id === 'wave' && <p className="field-error">Original specimen failed attachment. Retained as a record of that experiment.</p>}
      {['miniature', 'held-spans'].includes(study.id) && <p className="setup-hint">Original geometry, superseded by the new test batch above.</p>}
      <button className="button secondary-button" onClick={() => loadStudy(study.id)}>Load {study.loadLabel ?? (study.id === 'control' ? 'control cup' : study.id === 'miniature' ? 'mini vase' : study.id === 'wave' ? 'wave coupon' : 'span coupon')}<Icon name="chevron" size={14} /></button>
      {prepared && <div className="prepared-downloads">
        <a className="button primary-button" href={`${directory}${filename}.gcode`} download>Download {study.title.slice(0, 2)} G-code<Icon name="save" size={14} /></a>
        <p>Prepared MINI / 0.4 mm / PLA Basic file. Uses the fixed batch settings, independent of editor changes.</p>
        <div><a href={`${directory}${filename}.np3dp-project.json`} download>Project</a><a href={`${directory}${filename}.print-report.json`} download>Print report</a></div>
      </div>}
      {recipeName === study.recipe.name && <details><summary>What to record</summary><ul>{study.observe.map((item) => <li key={item}>{item}</li>)}</ul></details>}
    </article>;
  };
  return <>
    <div className="panel-intro"><span className="micro-label">A + B WORKED → NEXT PRINTS</span><h2>From coupon to vase.</h2><p>A and B, the printer preview and time display are reported working. Try the shaped miniature, then compare arches and held spans as separate experiments.</p><a href="https://github.com/Argarot/NP3DP/blob/main/docs/guides/next-prints.md" target="_blank" rel="noreferrer">Print order, settings and observation guide ↗</a></div>
    <div className="test-batch-summary"><strong>Next batch · unprinted</strong><p>G29 mesh leveling, two-part purge, LCD preview, progress/time and 0.15 mm first-layer compensation in every prepared file.</p><p>215 → 210 °C nozzle · 60 °C bed · full fan after the base. Print one file at a time.</p></div>
    {NEXT_STUDIES.map((study) => card(study, true))}
    <details className="study-history"><summary>Successful A/B references</summary>{RETRY_STUDIES.map((study) => card(study))}</details>
    <details className="study-history"><summary>Original 01–04 experiments</summary>{CALIBRATION_STUDIES.map((study) => card(study))}</details>
    <div className="quiet-note"><Icon name="info" /><p>Load a test to customize it. Loading sets shape, deposition and foundation while retaining printer, material, filament diameter, flow multiplier and compensation. Export print then uses your edited settings.</p></div>
  </>;
}
