import { describe, expect, it } from 'vitest';
import { DEFAULT_RECIPE, PRESETS } from './presets';
import { parseRecipe, parseRecipeText, serializeRecipe } from './recipe';

function clonedDefault(): unknown {
  return JSON.parse(serializeRecipe(DEFAULT_RECIPE));
}

describe('recipe contract', () => {
  it('round-trips every shipped preset deterministically', () => {
    for (const preset of PRESETS) {
      const first = serializeRecipe(preset.recipe);
      expect(parseRecipeText(first)).toEqual(preset.recipe);
      expect(serializeRecipe(parseRecipeText(first))).toBe(first);
    }
  });

  it('preserves a recipe name as untrusted data while constructing only schema fields', () => {
    const recipe = clonedDefault() as Record<string, unknown>;
    const untrustedName = '<img src=x onerror=alert(1)>';
    recipe.name = untrustedName;
    const parsed = parseRecipe(recipe);

    expect(parsed.name).toBe(untrustedName);
    expect(Object.keys(parsed)).toEqual(['schemaVersion', 'name', 'shape', 'process', 'bands']);
    expect(Object.keys(parsed.shape)).toEqual(['heightMm', 'baseDiameterMm', 'topDiameterMm', 'bellyMm', 'section', 'aspectRatio', 'twistDeg']);
  });

  it.each([
    {
      label: 'an unsupported version explicitly',
      mutate(recipe: Record<string, unknown>) { recipe.schemaVersion = 2; },
      message: /unsupported schemaVersion 2/,
    },
    {
      label: 'an unknown top-level field without retaining it',
      mutate(recipe: Record<string, unknown>) { recipe.unreviewedFutureField = true; },
      message: /unexpected field/,
    },
    {
      label: 'a prototype-polluting field without retaining it',
      mutate(recipe: Record<string, unknown>) {
        Object.defineProperty(recipe, '__proto__', { value: { altered: true }, enumerable: true });
      },
      message: /unexpected field/,
    },
    {
      label: 'a non-finite nested value',
      mutate(recipe: Record<string, unknown>) {
        (recipe.shape as Record<string, unknown>).heightMm = Number.NaN;
      },
      message: /finite number/,
    },
    {
      label: 'a missing nested field',
      mutate(recipe: Record<string, unknown>) { delete (recipe.process as Record<string, unknown>).pitchMm; },
      message: /missing required field "pitchMm"/,
    },
    {
      label: 'an unexpected nested field',
      mutate(recipe: Record<string, unknown>) { (recipe.bands as Array<Record<string, unknown>>)[0]!.futureBandMode = 'new'; },
      message: /unexpected field "futureBandMode"/,
    },
    {
      label: 'an out-of-range value without clamping it',
      mutate(recipe: Record<string, unknown>) { (recipe.process as Record<string, unknown>).pitchMm = 0; },
      message: /0.3 to 5/,
    },
    {
      label: 'a negative weight',
      mutate(recipe: Record<string, unknown>) { (recipe.bands as Array<Record<string, unknown>>)[0]!.weight = -1; },
      message: /0.1 to 10/,
    },
    {
      label: 'a fractional repeat count',
      mutate(recipe: Record<string, unknown>) { (recipe.bands as Array<Record<string, unknown>>)[0]!.repeatsPerTurn = 28.5; },
      message: /integer/,
    },
  ])('rejects $label', ({ mutate, message }) => {
    const recipe = clonedDefault() as Record<string, unknown>;
    mutate(recipe);
    expect(() => parseRecipe(recipe)).toThrow(message);
  });

  it('rejects invalid band counts and identifiers', () => {
    const empty = clonedDefault() as { bands: unknown[] };
    empty.bands = [];
    expect(() => parseRecipe(empty)).toThrow(/at least one band/);

    const tooMany = clonedDefault() as { bands: unknown[] };
    tooMany.bands = Array.from({ length: 9 }, () => clonedDefault() as { bands: unknown[] }).map((recipe) => recipe.bands[0]);
    expect(() => parseRecipe(tooMany)).toThrow(/at most 8/);

    const duplicate = clonedDefault() as { bands: Array<{ id: string }> };
    duplicate.bands.push({ ...duplicate.bands[0]! });
    expect(() => parseRecipe(duplicate)).toThrow(/duplicate band id/);
  });
});
