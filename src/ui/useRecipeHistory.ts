import { useCallback, useReducer } from 'react';
import { parseRecipe } from '../domain/recipe';
import type { Recipe } from '../domain/types';

interface History { past: Recipe[]; present: Recipe; future: Recipe[] }
type Action = { kind: 'edit'; recipe: Recipe } | { kind: 'undo' | 'redo' };
const LIMIT = 80;
function reducer(state: History, action: Action): History {
  if (action.kind === 'edit') {
    if (JSON.stringify(state.present) === JSON.stringify(action.recipe)) return state;
    return { past: [...state.past, state.present].slice(-LIMIT), present: action.recipe, future: [] };
  }
  if (action.kind === 'undo' && state.past.length) return {
    past: state.past.slice(0, -1), present: state.past.at(-1)!, future: [state.present, ...state.future],
  };
  if (action.kind === 'redo' && state.future.length) return {
    past: [...state.past, state.present], present: state.future[0]!, future: state.future.slice(1),
  };
  return state;
}
export function useRecipeHistory(initial: Recipe) {
  const [state, dispatch] = useReducer(reducer, { past: [], present: parseRecipe(initial), future: [] });
  const setRecipe = useCallback((recipe: Recipe) => dispatch({ kind: 'edit', recipe: parseRecipe(recipe) }), []);
  const undo = useCallback(() => dispatch({ kind: 'undo' }), []);
  const redo = useCallback(() => dispatch({ kind: 'redo' }), []);
  return { recipe: state.present, setRecipe, undo, redo, canUndo: !!state.past.length, canRedo: !!state.future.length };
}
