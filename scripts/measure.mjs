import { mkdir, writeFile } from 'node:fs/promises';
import { createServer } from 'vite';

const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { PRESETS } = await server.ssrLoadModule('/src/domain/presets.ts');
  const { parseRecipe } = await server.ssrLoadModule('/src/domain/recipe.ts');
  const { generateToolpath } = await server.ssrLoadModule('/src/domain/generate.ts');
  const { exportDraft } = await server.ssrLoadModule('/src/export/draft.ts');
  const studies = [];
  for (const preset of PRESETS) {
    const recipe = parseRecipe(preset.recipe);
    const start = performance.now();
    const result = generateToolpath(recipe);
    const generated = performance.now();
    const draft = exportDraft(recipe, result);
    studies.push({ id: preset.id, events: result.events.length, generationMs: +(generated - start).toFixed(2), exportWithAuditMs: +(performance.now() - generated).toFixed(2), draftBytes: Buffer.byteLength(draft), stats: result.stats });
  }
  const report = { measuredAt: new Date().toISOString(), node: process.version, platform: process.platform, sampleCount: 1, scope: 'Single local CPU observation, not an acceptance target or browser/firmware timing measurement.', studies };
  await mkdir('docs/evidence', { recursive: true });
  await writeFile('docs/evidence/session-001-measurements.json', `${JSON.stringify(report, null, 2)}\n`);
  console.table(studies.map(({ id, events, generationMs, exportWithAuditMs, draftBytes }) => ({ id, events, generationMs, exportWithAuditMs, draftBytes })));
} finally { await server.close(); }
