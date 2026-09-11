import { useEffect, useRef } from 'react';
import { flushSync } from 'react-dom';
import { parseRecipe } from '../domain/recipe';
import type { Recipe } from '../domain/types';

interface PageTool {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
}
interface ModelContext {
  registerTool: (tool: PageTool, options: { signal: AbortSignal }) => void | Promise<void>;
}

/** Optional browser capability. Uses the same validated editor actions; no service or account. */
export function useWebMcp(recipe: Recipe, changeRecipe: (recipe: Recipe) => void) {
  const current = useRef(recipe);
  useEffect(() => { current.current = recipe; }, [recipe]);
  useEffect(() => {
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: PageTool) => {
      try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => {}); }
      catch { /* Experimental API absence or rejection must not affect the editor. */ }
    };
    register({
      name: 'np3dp_read_recipe',
      description: 'Read the current versioned NP3DP design recipe. This does not generate or export a print job.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute: () => ({ recipe: current.current }),
    });
    register({
      name: 'np3dp_load_recipe',
      description: 'Replace the visible design with a complete NP3DP schemaVersion 1 recipe. Undo is available. Validates every field before changing the editor; does not download or run G-code.',
      inputSchema: { type: 'object', properties: { recipe: { type: 'object', description: 'Complete recipe with schemaVersion, name, shape, process and 1–8 bands; obtain a template using np3dp_read_recipe.' } }, required: ['recipe'], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: true },
      execute: (input) => {
        if (typeof input !== 'object' || input === null || Object.keys(input).join(',') !== 'recipe') throw new Error('Expected exactly one recipe field.');
        const parsed = parseRecipe((input as { recipe: unknown }).recipe);
        flushSync(() => changeRecipe(parsed));
        current.current = parsed;
        return { loaded: true, name: parsed.name, schemaVersion: parsed.schemaVersion, bands: parsed.bands.length };
      },
    });
    return () => lifecycle.abort();
  }, [changeRecipe]);
}
