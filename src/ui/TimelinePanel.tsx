import { useMemo } from 'react';
import type { GeneratedToolpath, Recipe } from '../domain/types';
import { buildTimeline, eventIndexAtTime, formatDuration } from '../preview/timeline';
import { METHOD_COLORS } from '../preview/types';
import { Icon } from './Icons';
import { METHODS } from './EditorPanel';

export function TimelinePanel({ path, recipe, progress, setProgress, playing, setPlaying, playbackRate, setPlaybackRate }: {
  path: GeneratedToolpath | null; recipe: Recipe; progress: number; setProgress: (value: number) => void;
  playing: boolean; setPlaying: (value: boolean) => void; playbackRate: number; setPlaybackRate: (value: number) => void;
}) {
  const timeline = useMemo(() => path ? buildTimeline(path) : null, [path]);
  const elapsed = progress * (timeline?.durationS ?? 0);
  const current = path && timeline ? path.events[eventIndexAtTime(timeline, elapsed)] : undefined;
  const eventName = !current ? 'No path yet' : current.kind === 'extrude' ? `Extruding · ${current.role}` : current.kind === 'deposit' ? 'Stationary extrusion' : current.kind === 'dwell' ? 'Holding · no extrusion' : current.kind === 'travel' ? 'Travel' : 'Anchor';
  const bandTimes = useMemo(() => {
    if (!path || !timeline) return [];
    const times = new Map<string, number>();
    path.events.forEach((event, index) => times.set(event.bandId, (times.get(event.bandId) ?? 0) + timeline.ends[index]! - (index ? timeline.ends[index - 1]! : 0)));
    return recipe.bands.map((band) => ({ ...band, share: (times.get(band.id) ?? 0) / timeline.durationS }));
  }, [path, recipe.bands, timeline]);
  return <section className="timeline-panel" aria-label="Commanded motion playback">
    <div className="timeline-top"><div className="playback-buttons"><button className="play-button" aria-label={playing ? 'Pause playback' : 'Play toolpath'} disabled={!path} onClick={() => { if (progress >= 1) setProgress(0); setPlaying(!playing); }}><Icon name={playing ? 'pause' : 'play'} size={17} /></button><button className="icon-button" aria-label="Restart toolpath" disabled={!path} onClick={() => { setProgress(0); setPlaying(false); }}><Icon name="reset" size={16} /></button><select aria-label="Playback speed" value={playbackRate} onChange={(event) => setPlaybackRate(Number(event.target.value))}><option value={1}>1×</option><option value={10}>10×</option><option value={50}>50×</option><option value={200}>200×</option></select></div>
      <span className="playback-event">{eventName}</span><span className="time-readout">{formatDuration(elapsed)}<span> / {formatDuration(timeline?.durationS ?? 0)}</span></span></div>
    <div className="timeline-track"><div className="timeline-bands">{bandTimes.map((band) => <span key={band.id} style={{ width: `${band.share * 100}%`, background: METHOD_COLORS[band.kind] }} title={`${METHODS[band.kind].short}: ${formatDuration(band.share * timeline!.durationS)}`} />)}</div><input aria-label="Toolpath progress" type="range" min="0" max="1" step="0.0001" value={progress} disabled={!path} onChange={(event) => { setPlaying(false); setProgress(Number(event.target.value)); }} /></div>
    <div className="timeline-bottom"><span>COMMANDED TIME</span><span>Feed-based estimate · firmware dynamics excluded</span></div>
  </section>;
}
