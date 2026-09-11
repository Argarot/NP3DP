import { useEffect, useRef, useState } from 'react';
import type { Recipe } from '../domain/types';
import type { FoundationSettings, PreparedBuild } from '../print/types';

interface State {
  build: PreparedBuild | null;
  pathRecipe: Recipe | null;
  pathFoundation: FoundationSettings | null;
  error: string | null;
  errorKey: string | null;
  generationMs: number | null;
}
/** Termination cancels CPU work; a generation ID also rejects queued stale replies. */
export function useToolpath(recipe: Recipe, foundation: FoundationSettings) {
  const requestId = useRef(0);
  const [state, setState] = useState<State>({ build: null, pathRecipe: null, pathFoundation: null, error: null, errorKey: null, generationMs: null });
  const key = JSON.stringify({ recipe, foundation });
  useEffect(() => {
    const id = ++requestId.current;
    let worker: Worker | null = null;
    const timeout = window.setTimeout(() => {
      worker = new Worker(new URL('../workers/generate.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<{ id: number; result?: PreparedBuild; error?: string; generationMs?: number }>) => {
        if (id !== requestId.current || event.data.id !== id) return;
        if (event.data.result) setState({ build: event.data.result, pathRecipe: recipe, pathFoundation: foundation, error: null, errorKey: null, generationMs: event.data.generationMs ?? null });
        else setState((previous) => ({ ...previous, error: event.data.error ?? 'Generation failed.', errorKey: key }));
        worker?.terminate();
      };
      worker.onerror = () => {
        if (id === requestId.current) setState((previous) => ({ ...previous, error: 'The path worker stopped. Change a setting to retry.', errorKey: key }));
        worker?.terminate();
      };
      worker.postMessage({ id, recipe, foundation });
    }, 120);
    return () => { window.clearTimeout(timeout); worker?.terminate(); ++requestId.current; };
  }, [key]);
  const error = state.errorKey === key ? state.error : null;
  return { ...state, path: state.build?.path ?? null, error, pending: state.build?.buildKey !== key && !error };
}
