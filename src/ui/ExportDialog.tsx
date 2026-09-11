import { useEffect, useRef, useState } from 'react';
import type { GeneratedToolpath, Recipe } from '../domain/types';
import { downloadText, safeFilename } from './files';
import { Icon } from './Icons';

export function ExportDialog({ recipe, path, close }: { recipe: Recipe; path: GeneratedToolpath; close: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [result, setResult] = useState<{ text?: string; preview?: string; report?: string; error?: string } | null>(null);
  useEffect(() => { dialog.current?.showModal(); }, []);
  useEffect(() => {
    let active = true;
    const worker = new Worker(new URL('../workers/export.worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (event: MessageEvent<NonNullable<typeof result>>) => { if (active) setResult(event.data); worker.terminate(); };
    worker.onerror = () => { if (active) setResult({ error: 'The export worker stopped. Close and reopen the draft to retry.' }); worker.terminate(); };
    worker.postMessage({ recipe, path });
    return () => { active = false; worker.terminate(); };
  }, [recipe, path]);
  return <dialog className="export-dialog" ref={dialog} onCancel={close} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
    <div className="dialog-heading"><div><span className="micro-label">EXPERIMENT EXPORT</span><h2>Inspect the motion draft</h2></div><button className="icon-button" onClick={close} aria-label="Close export"><Icon name="close" /></button></div>
    <p><strong>{recipe.name}</strong> — a wall toolpath, not a complete print job. It has no base, heating, homing, purge, or end sequence. The draft uses a 90 mm X/Y offset for the MINI reference bed.</p>
    <div className="notice">Printer-specific output comes after the actual setup and foundation strategy are verified. Save this draft for inspection and comparison.</div>
    {!result ? <div className="export-progress" role="status">Preparing and auditing the draft…</div> : result.error ? <p role="alert" className="field-error">{result.error}</p> : <pre tabIndex={0} aria-label="G-code draft preview">{result.preview}<span>{'\n\n… Preview limited to 100 lines. Download contains the full draft.'}</span></pre>}
    <div className="dialog-actions"><button className="button secondary-button" disabled={!result?.report} onClick={() => result?.report && downloadText(result.report, `${safeFilename(recipe.name)}.report.json`, 'application/json')}>Download experiment report</button><button className="button primary-button" disabled={!result?.text} onClick={() => result?.text && downloadText(result.text, `${safeFilename(recipe.name)}.gcode.txt`)}><Icon name="save" />Download .gcode.txt</button></div>
  </dialog>;
}
