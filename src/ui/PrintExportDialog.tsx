import { useEffect, useRef, useState } from 'react';
import type { PrintProject } from '../print/types';
import type { PrintJobResult } from '../print/complete';
import { serializeProject } from '../print/project';
import { formatDuration } from '../preview/timeline';
import { downloadText, safeFilename } from './files';
import { Icon } from './Icons';

interface Result extends PrintJobResult { preview?: string; error?: string }

export function PrintExportDialog({ project, close }: { project: PrintProject; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [result, setResult] = useState<Result | null>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    let active = true;
    const worker = new Worker(new URL('../workers/export.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<Result>) => { if (active) setResult(event.data); worker.terminate(); };
    worker.onerror = () => { if (active) setResult({ text: null, report: '', diagnostics: [], metrics: { maximumXySpeedMmS: 0, maximumZSpeedMmS: 0, maximumFlowMm3S: 0, minimumZMm: 0, maximumZMm: 0 }, audit: null, error: 'The export worker stopped. Close and reopen to retry.' }); worker.terminate(); };
    worker.postMessage({ kind: 'full', recipe: project.recipe, setup: project.setup });
    return () => { active = false; worker.terminate(); };
  }, [project]);
  const filename = safeFilename(project.recipe.name);
  return <dialog className="export-dialog print-export-dialog" ref={dialog} onCancel={close} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div className="dialog-heading"><div><span className="micro-label">MINI / FIRMWARE 5.1.2</span><h2>Review the experimental print</h2></div><button className="icon-button" onClick={close} aria-label="Close print export"><Icon name="close" /></button></div>
    <p><strong>{project.recipe.name}</strong> includes startup, probing, a front purge, foundation, transition, wall and finish. It is a complete experiment file; physical printability is untested.</p>
    <div className="print-summary"><span>{project.setup.material.name}</span><span>{project.setup.material.firstLayerNozzleC} → {project.setup.material.nozzleC} °C nozzle</span><span>{project.setup.material.firstLayerBedC} → {project.setup.material.bedC} °C bed</span><span>{project.setup.printer.nozzleDiameterMm} mm nozzle · {project.setup.printer.hotend} hotend</span></div>
    {!result ? <div className="export-progress" role="status">Preparing and auditing the complete job…</div> : result.error ? <p className="field-error" role="alert">{result.error}</p> : <>
      <div className={`export-verdict ${result.text ? 'pass' : 'fail'}`} role="status"><strong>{result.text ? 'Command audit passed' : 'Export needs attention'}</strong>{result.audit && <span>{result.audit.moveCount.toLocaleString()} motion commands · {formatDuration(result.audit.commandedSeconds)} commanded time, excluding heating and probing</span>}</div>
      <div className="export-diagnostics">{result.diagnostics.filter((entry) => entry.severity !== 'info').map((entry) => <p className={entry.severity === 'error' ? 'field-error' : ''} key={entry.code}>{entry.message}</p>)}</div>
      {result.text && <details className="job-preview"><summary>Inspect startup and initial commands</summary><pre tabIndex={0} aria-label="Complete G-code preview">{result.preview}</pre><p>The downloaded file contains the full path and shutdown sequence.</p></details>}
    </>}
    <div className="first-print-note"><strong>First control print</strong><p>Use your normally calibrated sheet and first-layer Z setting. Clear the bed and front purge strip, load the recorded PLA, then start the file from USB and observe the foundation. Record dimensions and any adhesion, extrusion or nozzle-contact problems before advancing to the wave coupon.</p></div>
    <div className="dialog-actions wrap-actions">
      <button className="button secondary-button" onClick={() => downloadText(serializeProject(project), `${filename}.np3dp-project.json`, 'application/json')}>Save project</button>
      <button className="button secondary-button" disabled={!result?.report} onClick={() => result?.report && downloadText(result.report, `${filename}.print-report.json`, 'application/json')}>Download print report</button>
      <button className="button primary-button" disabled={!result?.text} onClick={() => result?.text && downloadText(result.text, `${filename}.gcode`)}><Icon name="save" />Download .gcode</button>
    </div>
  </dialog>;
}
