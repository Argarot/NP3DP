import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DEFAULT_RECIPE, PRESETS } from '../domain/presets';
import { parseRecipeText, serializeRecipe } from '../domain/recipe';
import type { GeneratedToolpath, Recipe } from '../domain/types';
import type { ColorMode, ViewMode } from '../preview/types';
import { buildTimeline, formatDuration } from '../preview/timeline';
import { EditorPanel } from './EditorPanel';
import { TimelinePanel } from './TimelinePanel';
import { useToolpath } from './useToolpath';
import { useProjectHistory } from './useProjectHistory';
import { DEFAULT_PRINT_SETUP } from '../print/setup';
import { parseProjectText, serializeProject } from '../print/project';
import type { PrintProject } from '../print/types';
import { inspectPrintJob } from '../print/diagnostics';
import { PrintPanel } from './PrintPanel';
import { PrintExportDialog } from './PrintExportDialog';
import { downloadText, safeFilename } from './files';
import { Icon } from './Icons';
import { ExportDialog } from './ExportDialog';
import { useWebMcp } from './useWebMcp';

const Viewport = lazy(() => import('./Viewport').then((module) => ({ default: module.Viewport })));

export function App() {
  const { project, setProject, undo, redo, canUndo, canRedo } = useProjectHistory({ format: 'np3dp-project', schemaVersion: 2, recipe: DEFAULT_RECIPE, setup: DEFAULT_PRINT_SETUP });
  const { recipe, setup } = project;
  const latestProject = useRef(project);
  latestProject.current = project;
  const generated = useToolpath(recipe, setup.foundation);
  const [workspace, setWorkspace] = useState<'design' | 'print'>('design');
  const [selectedBandId, selectBand] = useState(recipe.bands[0]!.id);
  const [mode, setMode] = useState<ViewMode>('strand');
  const [colorMode, setColorMode] = useState<ColorMode>('method');
  const [progress, setProgress] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(50);
  const [notice, setNotice] = useState<string | null>(null);
  const [exportSession, setExportSession] = useState<{ recipe: Recipe; path: GeneratedToolpath } | null>(null);
  const [printSession, setPrintSession] = useState<PrintProject | null>(null);
  const [showNotes, setShowNotes] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const fileRequest = useRef(0);
  const path = generated.path;
  // Keep the last complete result paired with the exact recipe that produced it.
  const displayedRecipe = generated.pathRecipe ?? recipe;
  const duration = useMemo(() => path ? buildTimeline(path).durationS : 0, [path]);
  const changeProject = useCallback((value: PrintProject) => {
    try { setProject(value); setNotice(null); setPlaying(false); setProgress(1); return true; }
    catch (error) { setNotice(error instanceof Error ? error.message : 'This recipe is invalid.'); return false; }
  }, [setProject]);
  const changeRecipe = useCallback((value: Recipe) => changeProject({ ...project, recipe: value }), [project, changeProject]);
  useWebMcp(recipe, changeRecipe);
  useEffect(() => {
    if (!playing || duration <= 0) return;
    let frame = 0, last = performance.now();
    const tick = (now: number) => {
      const increment = Math.min((now - last) / 1000, 0.2) * playbackRate / duration;
      last = now;
      setProgress((previous) => Math.min(1, previous + increment));
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [playing, duration, playbackRate]);
  useEffect(() => { if (progress >= 1) setPlaying(false); }, [progress]);
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (exportSession || printSession || !(event.ctrlKey || event.metaKey) || event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;
      if (event.key.toLowerCase() === 'z') { event.preventDefault(); if (event.shiftKey) redo(); else undo(); setPlaying(false); }
    };
    window.addEventListener('keydown', handler); return () => window.removeEventListener('keydown', handler);
  }, [undo, redo, exportSession, printSession]);
  const loadFile = async (file?: File) => {
    if (!file) return;
    const request = ++fileRequest.current;
    try {
      if (file.size > 1_000_000) throw new Error('Recipe files must be smaller than 1 MB.');
      const text = await file.text();
      if (request !== fileRequest.current) return;
      const value: unknown = JSON.parse(text);
      const imported = value && typeof value === 'object' && 'format' in value ? parseProjectText(text) : { ...latestProject.current, recipe: parseRecipeText(text) };
      if (changeProject(imported)) { selectBand(imported.recipe.bands[0]!.id); setNotice(`Loaded ${imported.recipe.name}.`); }
    } catch (error) { if (request === fileRequest.current) setNotice(error instanceof Error ? error.message : 'Could not read the recipe.'); }
  };
  const stats = path?.stats;
  const ready = !!path && !generated.pending && !generated.error;
  const inspected = useMemo(() => ready && generated.build ? inspectPrintJob(recipe, setup, generated.build) : null, [ready, recipe, setup, generated.build]);
  return <div className="app-shell">
    <header className="app-header">
      <div className="brand" aria-label="NP3DP workbench"><img src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" /><span>NP3DP</span></div>
      <span className="header-divider" /><div className="project-name"><input key={recipe.name} aria-label="Recipe name" defaultValue={recipe.name} maxLength={80} onBlur={(event) => { if (event.target.value !== recipe.name && !changeRecipe({ ...recipe, name: event.target.value })) event.target.value = recipe.name; }} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); }} /><span>DEPOSITION WORKBENCH <b>0.4</b></span></div>
      <div className="header-actions"><button className="button quiet-button" title="Open a recipe or complete project" onClick={() => fileInput.current?.click()}><Icon name="open" /><span>Open recipe</span></button><button className="button secondary-button" onClick={() => {
        downloadText(setup.foundation.enabled ? serializeProject(project) : serializeRecipe(recipe), `${safeFilename(recipe.name)}.${setup.foundation.enabled ? 'np3dp-project' : 'np3dp'}.json`, 'application/json');
        setNotice(setup.foundation.enabled ? 'Project downloaded with recipe and print setup.' : 'Recipe downloaded. Keep it locally or commit it to your Git repository.');
      }}><Icon name="save" /><span>{setup.foundation.enabled ? 'Save project' : 'Save recipe'}</span></button><button className="button primary-button" disabled={!ready} onClick={() => { if (path) { setPlaying(false); if (setup.foundation.enabled) setPrintSession(project); else setExportSession({ recipe, path }); } }}>{setup.foundation.enabled ? 'Export print' : 'Motion draft'}<Icon name="chevron" size={15} /></button></div>
      <input type="file" ref={fileInput} className="visually-hidden" accept=".json,.np3dp.json" aria-label="Open recipe file" onChange={(event) => { void loadFile(event.target.files?.[0]); event.target.value = ''; }} />
    </header>
    <main className="workspace">
      <div className="control-workspace"><div className="workspace-switch" role="group" aria-label="Workbench mode"><button aria-pressed={workspace === 'design'} onClick={() => setWorkspace('design')}>Design</button><button aria-pressed={workspace === 'print'} onClick={() => setWorkspace('print')}>Prepare print<span className="new-feature-dot" /></button></div>
        {workspace === 'design' ? <EditorPanel recipe={recipe} selectedBandId={selectedBandId} selectBand={selectBand} onChange={changeRecipe} /> : <PrintPanel project={project} onChange={changeProject} diagnostics={inspected?.diagnostics ?? []} metrics={inspected?.metrics ?? null} pending={generated.pending} generationError={generated.error} attachment={generated.build?.attachment} pathContact={generated.build?.pathContact} />}
      </div>
      <section className="design-space" aria-label="Design preview">
        <div className="workbench-toolbar"><div className="view-switch" role="group" aria-label="Preview representation">{([['strand', 'Strand model'], ['path', 'Nozzle path'], ['form', 'Form']] as const).map(([value, label]) => <button key={value} aria-pressed={mode === value} onClick={() => setMode(value)}>{label}</button>)}</div>
          <div className="toolbar-right"><button className="icon-button" title="Undo (Ctrl+Z)" aria-label="Undo recipe change" disabled={!canUndo} onClick={() => { undo(); setPlaying(false); }}><Icon name="undo" size={16} /></button><button className="icon-button" title="Redo (Ctrl+Shift+Z)" aria-label="Redo recipe change" disabled={!canRedo} onClick={() => { redo(); setPlaying(false); }}><Icon name="redo" size={16} /></button><span className="toolbar-divider" /><select aria-label="Example recipe" value="" onChange={(event) => { const preset = PRESETS.find((entry) => entry.id === event.target.value); if (preset) { changeRecipe(preset.recipe); selectBand(preset.recipe.bands[0]!.id); } }}><option value="" disabled>Load a study…</option>{PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.title}</option>)}</select></div>
        </div>
        <Suspense fallback={<div className="viewport-shell export-progress" role="status">Loading the 3D viewport…</div>}><Viewport recipe={displayedRecipe} path={path} mode={mode} colorMode={colorMode} progress={progress} pending={generated.pending} playing={playing} generationFailed={!!generated.error} wallOffsetZMm={generated.build?.wallOffsetZMm ?? 0} foundation={generated.pathFoundation ?? undefined} /></Suspense>
        <div className="viewport-subbar"><div className="legend"><span>Color by</span><select aria-label="Path color" value={colorMode} disabled={mode === 'form'} onChange={(event) => setColorMode(event.target.value as ColorMode)}><option value="method">Method</option><option value="speed">Commanded speed</option></select></div><button className={`notes-toggle ${showNotes ? 'active' : ''}`} aria-expanded={showNotes} onClick={() => setShowNotes(!showNotes)}><Icon name="info" size={15} />{path?.diagnostics.length ?? 0} experiment notes<Icon name="chevron" size={13} style={{ transform: showNotes ? 'rotate(90deg)' : undefined }} /></button></div>
        {showNotes && <div className="experiment-notes"><h2>What this preview can tell you</h2><p>Wall strands use circular sections from volume per path length. Foundation, transition and rim use volume-equivalent flattened sections; sloped sections remain an approximation. This view does not predict sag, cooling, attachment, or nozzle clearance.</p>{path?.diagnostics.map((diagnostic, index) => <div className={`diagnostic ${diagnostic.severity}`} key={`${diagnostic.code}-${index}`}><span>{diagnostic.severity}</span><p>{diagnostic.message}</p></div>)}</div>}
        <TimelinePanel path={path} recipe={generated.pathRecipe ?? recipe} progress={progress} setProgress={setProgress} playing={playing} setPlaying={setPlaying} playbackRate={playbackRate} setPlaybackRate={setPlaybackRate} />
        <div className="metrics" aria-label="Path statistics"><div><span>PATH LENGTH</span><strong>{stats ? (stats.pathLengthMm / 1000).toFixed(2) : '—'} <small>m</small></strong></div><div><span>FILAMENT ESTIMATE</span><strong>{stats ? (stats.filamentLengthMm / 1000).toFixed(2) : '—'} <small>m</small></strong></div><div><span>COMMANDED TIME</span><strong>{stats ? formatDuration(stats.commandedDurationS) : '—'}</strong></div><div><span>HOLD EVENTS</span><strong>{stats?.dwellCount ?? '—'} <small>holds</small></strong></div></div>
      </section>
    </main>
    <footer className="app-footer"><span><span className="status-square" />ENGINEERING PREVIEW <span className="footer-separator">/</span> {setup.foundation.enabled ? 'Foundation + wall · physical print untested' : 'Walls only · no physical simulation yet'}</span><span>{generated.generationMs === null ? 'Preparing engine' : `${path?.events.length.toLocaleString()} events · ${Math.round(generated.generationMs)} ms generation`}<a href="https://github.com/Argarot/NP3DP" target="_blank" rel="noreferrer">Project & docs ↗</a></span></footer>
    {(notice || generated.error) && <div className={`toast ${generated.error ? 'error' : ''}`} role={generated.error ? 'alert' : 'status'}><Icon name="info" /><span>{generated.error ?? notice}</span>{!generated.error && <button aria-label="Dismiss message" onClick={() => setNotice(null)}><Icon name="close" size={16} /></button>}</div>}
    {exportSession && <ExportDialog recipe={exportSession.recipe} path={exportSession.path} close={() => setExportSession(null)} />}
    {printSession && <PrintExportDialog project={printSession} close={() => setPrintSession(null)} />}
  </div>;
}
