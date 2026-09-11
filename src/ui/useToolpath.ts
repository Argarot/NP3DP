import { useEffect, useRef, useState } from 'react';
import type { GeneratedToolpath, Recipe } from '../domain/types';

interface State {
  path: GeneratedToolpath | null;
  pathRecipe: Recipe | null;
  error: string | null;
  errorKey: string | null;
  generationMs: number | null;
}
/** Termination cancels CPU work; a generation ID also rejects queued stale replies. */
export function useToolpath(recipe: Recipe) {
  const requestId = useRef(0);
  const [state, setState] = useState<State>({ path: null, pathRecipe: null, error: null, errorKey: null, generationMs: null });
  const key = JSON.stringify(recipe);
  useEffect(() => {
    const id = ++requestId.current;
    let worker: Worker | null = null;
    const timeout = window.setTimeout(() => {
      worker = new Worker(new URL('../workers/generate.worker.ts', import.meta.url), { type: 'module' });
      worker.onmessage = (event: MessageEvent<{ id: number; result?: GeneratedToolpath; error?: string; generationMs?: number }>) => {
        if (id !== requestId.current || event.data.id !== id) return;
        if (event.data.result) setState({ path: event.data.result, pathRecipe: recipe, error: null, errorKey: null, generationMs: event.data.generationMs ?? null });
        else setState((previous) => ({ ...previous, error: event.data.error ?? 'Generation failed.', errorKey: JSON.stringify(recipe) }));
        worker?.terminate();
      };
      worker.onerror = () => {
        if (id === requestId.current) setState((previous) => ({ ...previous, error: 'The path worker stopped. Change a setting to retry.', errorKey: JSON.stringify(recipe) }));
        worker?.terminate();
      };
      worker.postMessage({ id, recipe });
    }, 120);
    return () => { window.clearTimeout(timeout); worker?.terminate(); ++requestId.current; };
  }, [recipe]);
  const error = state.errorKey === key ? state.error : null;
  return { ...state, error, pending: state.path?.recipeKey !== key && !error };
}
