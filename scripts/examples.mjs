import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { PRESETS } = await server.ssrLoadModule('/src/domain/presets.ts');
  const { serializeRecipe } = await server.ssrLoadModule('/src/domain/recipe.ts');
  await mkdir('examples', { recursive: true });
  for (const preset of PRESETS) await writeFile(`examples/${preset.id}.np3dp.json`, `${serializeRecipe(preset.recipe)}\n`);
  console.log(`Wrote ${PRESETS.length} versioned example recipes.`);
} finally { await server.close(); }
