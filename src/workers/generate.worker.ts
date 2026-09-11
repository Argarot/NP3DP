import { generateToolpath } from '../domain/generate';
import { parseRecipe } from '../domain/recipe';
import type { Recipe } from '../domain/types';

self.onmessage = (event: MessageEvent<{ id: number; recipe: Recipe }>) => {
  const { id, recipe } = event.data;
  try {
    const started = performance.now();
    const result = generateToolpath(parseRecipe(recipe));
    self.postMessage({ id, result, generationMs: performance.now() - started });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : 'Generation failed.' });
  }
};
