import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';

// Use the same compiler as the app. Generated machine files stay local; small
// editable projects and an evidence manifest are versioned in the repository.
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
try {
  const { RETRY_STUDIES } = await server.ssrLoadModule('/src/print/calibration.ts');
  const { DEFAULT_PRINT_SETUP, parsePrintSetup } = await server.ssrLoadModule('/src/print/setup.ts');
  const { serializeProject } = await server.ssrLoadModule('/src/print/project.ts');
  const { compilePrintJob } = await server.ssrLoadModule('/src/print/complete.ts');
  const setup = parsePrintSetup({ ...DEFAULT_PRINT_SETUP, foundation: { ...DEFAULT_PRINT_SETUP.foundation, enabled: true } });
  const outputs = [];
  for (const study of RETRY_STUDIES) {
    const start = performance.now();
    const result = compilePrintJob(study.recipe, setup);
    if (!result.text || !result.audit || result.audit.errors.length) throw new Error(`${study.id}: ${JSON.stringify(result.diagnostics)}`);
    const compileMs = +(performance.now() - start).toFixed(2);
    const report = { ...JSON.parse(result.report), gcodeSha256: createHash('sha256').update(result.text, 'utf8').digest('hex') };
    const project = { format: 'np3dp-project', schemaVersion: 2, recipe: study.recipe, setup };
    outputs.push({ study, result, report, project, compileMs });
  }
  // Validate every study before writing any delivery files.
  await mkdir('examples/retries', { recursive: true });
  await mkdir('artifacts/session-003', { recursive: true });
  await mkdir('docs/evidence', { recursive: true });
  const studies = [];
  for (const { study, result, report, project, compileMs } of outputs) {
    const filename = study.recipe.name.toLowerCase().replaceAll(' ', '-');
    await writeFile(`examples/retries/${filename}.np3dp-project.json`, serializeProject(project));
    await writeFile(`artifacts/session-003/${filename}.gcode`, result.text);
    await writeFile(`artifacts/session-003/${filename}.print-report.json`, `${JSON.stringify(report, null, 2)}\n`);
    studies.push({ id: study.id, filename, gcodeSha256: report.gcodeSha256, bytes: Buffer.byteLength(result.text),
      events: report.stages.at(-1).endEvent, compileMs, commandMetrics: result.metrics,
      toolpathStats: report.toolpathStats, audit: result.audit, physicalStatus: 'unprinted' });
  }
  const manifest = { generatedAt: new Date().toISOString(), node: process.version, platform: process.platform,
    measurementScope: 'One local compilation per study. Commanded times exclude thermal waits, probing, homing and firmware dynamics. No physical validation.', studies };
  await writeFile('docs/evidence/session-003-calibration.json', `${JSON.stringify(manifest, null, 2)}\n`);
  console.table(studies.map(({ id, bytes, compileMs, audit }) => ({ id, bytes, compileMs, commandedSeconds: +audit.commandedSeconds.toFixed(1), auditErrors: audit.errors.length })));
} finally { await server.close(); }
