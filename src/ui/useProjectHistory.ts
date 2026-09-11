import { useCallback, useReducer } from 'react';
import { parseRecipe } from '../domain/recipe';
import { parsePrintSetup } from '../print/setup';
import type { PrintProject } from '../print/types';

interface History { past: PrintProject[]; present: PrintProject; future: PrintProject[] }
type Action = { kind: 'edit'; project: PrintProject } | { kind: 'undo' | 'redo' };
function validate(project: PrintProject): PrintProject { return { format: 'np3dp-project', schemaVersion: 1, recipe: parseRecipe(project.recipe), setup: parsePrintSetup(project.setup) }; }
function reducer(state: History, action: Action): History {
  if (action.kind === 'edit') {
    if (JSON.stringify(state.present) === JSON.stringify(action.project)) return state;
    return { past: [...state.past, state.present].slice(-80), present: action.project, future: [] };
  }
  if (action.kind === 'undo' && state.past.length) return { past: state.past.slice(0, -1), present: state.past.at(-1)!, future: [state.present, ...state.future] };
  if (action.kind === 'redo' && state.future.length) return { past: [...state.past, state.present].slice(-80), present: state.future[0]!, future: state.future.slice(1) };
  return state;
}

/** Recipe + machine changes commit together, including profile imports and undo. */
export function useProjectHistory(initial: PrintProject) {
  const [state, dispatch] = useReducer(reducer, initial, (project): History => ({ past: [], present: validate(project), future: [] }));
  const setProject = useCallback((project: PrintProject) => dispatch({ kind: 'edit', project: validate(project) }), []);
  const undo = useCallback(() => dispatch({ kind: 'undo' }), []);
  const redo = useCallback(() => dispatch({ kind: 'redo' }), []);
  return { project: state.present, setProject, undo, redo, canUndo: !!state.past.length, canRedo: !!state.future.length };
}
