import { prepareBuild } from '../print/prepare';
import type { FoundationSettings } from '../print/types';
import { parseRecipe } from '../domain/recipe';
import type { Recipe } from '../domain/types';

self.onmessage = (event: MessageEvent<{ id: number; recipe: Recipe; foundation: FoundationSettings }>) => {
  const { id, recipe } = event.data;
  try {
    const started = performance.now();
    const result = prepareBuild(parseRecipe(recipe), event.data.foundation);
    self.postMessage({ id, result, generationMs: performance.now() - started });
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : 'Generation failed.' });
  }
};
