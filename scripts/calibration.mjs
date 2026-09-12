import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'vite';

const BATCHES = {
  next: {
    studiesExport: 'NEXT_STUDIES',
    examplesDirectory: 'examples/next-prints',
    artifactsDirectory: 'artifacts/session-005',
    evidenceFile: 'docs/evidence/session-005-calibration.json',
    publishDirectory: 'public/print-tests/session-005',
  },
  retries: {
    studiesExport: 'RETRY_STUDIES',
    examplesDirectory: 'examples/retries',
    artifactsDirectory: 'artifacts/session-003',
    evidenceFile: 'docs/evidence/session-003-calibration.json',
    publishDirectory: 'public/print-tests/session-003',
  },
};

function usage() {
  return [
    'Usage: node scripts/calibration.mjs [--batch next|retries] [--publish]',
    '',
    'Compiles and audits every selected study before writing its local project, G-code, report and evidence manifest.',
    'The default batch is next (Session 005). --publish additionally writes the validated delivery pack under public/print-tests/ for Pages.',
  ].join('\n');
}

function parseArguments(args) {
  let batchName = 'next';
  let batchSpecified = false;
  let publish = false;
  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === '--help') return { help: true };
    if (argument === '--publish') {
      if (publish) throw new Error('--publish may be provided once.');
      publish = true;
      continue;
    }
    if (argument === '--batch' || argument.startsWith('--batch=')) {
      if (batchSpecified) throw new Error('--batch may be provided once.');
      const value = argument === '--batch' ? args[++index] : argument.slice('--batch='.length);
      if (!value || value.startsWith('--')) throw new Error('--batch requires next or retries.');
      batchName = value;
      batchSpecified = true;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}\n\n${usage()}`);
  }
  const batch = BATCHES[batchName];
  if (!batch) throw new Error(`Unknown batch: ${batchName}. Expected next or retries.`);
  return { batchName, batch, publish };
}

function sha256(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

const options = parseArguments(process.argv.slice(2));
if (options.help) {
  console.log(usage());
  process.exit(0);
}

const server = await createServer({ server: { middlewareMode: true, watch: null }, appType: 'custom', logLevel: 'error' });
try {
  const calibration = await server.ssrLoadModule('/src/print/calibration.ts');
  const studies = calibration[options.batch.studiesExport];
  if (!Array.isArray(studies) || studies.length === 0) throw new Error(`${options.batch.studiesExport} must export one or more studies.`);

  const { DEFAULT_PRINT_SETUP, parsePrintSetup } = await server.ssrLoadModule('/src/print/setup.ts');
  const { serializeProject } = await server.ssrLoadModule('/src/print/project.ts');
  const { compilePrintJob } = await server.ssrLoadModule('/src/print/complete.ts');
  const outputs = [];
  const filenames = new Set();

  for (const study of studies) {
    const setup = parsePrintSetup({ ...DEFAULT_PRINT_SETUP, foundation: calibration.studyFoundation(study, DEFAULT_PRINT_SETUP.foundation) });
    const filename = calibration.studyFilename(study);
    if (filenames.has(filename)) throw new Error(`Delivery filename collision: ${filename}. Study recipe names must be distinct.`);
    filenames.add(filename);

    const start = performance.now();
    const result = compilePrintJob(study.recipe, setup);
    if (!result.text || !result.audit || result.audit.errors.length) throw new Error(`${study.id}: ${JSON.stringify(result.diagnostics)}`);
    const compileMs = +(performance.now() - start).toFixed(2);
    const report = { ...JSON.parse(result.report), gcodeSha256: sha256(result.text) };
    const project = { format: 'np3dp-project', schemaVersion: 2, recipe: study.recipe, setup };
    outputs.push({ study, filename, result, report, project, compileMs });
  }

  // All jobs have compiled and passed their independent audits before delivery files are changed.
  const manifestStudies = outputs.map(({ study, filename, result, report, compileMs }) => ({
    id: study.id,
    filename,
    gcodeSha256: report.gcodeSha256,
    bytes: Buffer.byteLength(result.text),
    events: report.stages.at(-1).endEvent,
    compileMs,
    commandMetrics: result.metrics,
    toolpathStats: report.toolpathStats,
    pathContact: report.pathContact,
    audit: result.audit,
    physicalStatus: 'unprinted',
  }));
  const manifest = {
    generatedAt: new Date().toISOString(),
    batch: options.batchName,
    node: process.version,
    platform: process.platform,
    measurementScope: 'One local compilation per study. Commanded times exclude thermal waits, probing, homing and firmware dynamics. No physical validation.',
    studies: manifestStudies,
  };
  const manifestText = `${JSON.stringify(manifest, null, 2)}\n`;

  await Promise.all([
    mkdir(options.batch.examplesDirectory, { recursive: true }),
    mkdir(options.batch.artifactsDirectory, { recursive: true }),
    mkdir('docs/evidence', { recursive: true }),
  ]);
  for (const { filename, result, report, project } of outputs) {
    await Promise.all([
      writeFile(`${options.batch.examplesDirectory}/${filename}.np3dp-project.json`, serializeProject(project)),
      writeFile(`${options.batch.artifactsDirectory}/${filename}.gcode`, result.text),
      writeFile(`${options.batch.artifactsDirectory}/${filename}.print-report.json`, `${JSON.stringify(report, null, 2)}\n`),
    ]);
  }
  await writeFile(options.batch.evidenceFile, manifestText);

  if (options.publish) {
    await mkdir(options.batch.publishDirectory, { recursive: true });
    for (const { filename, result, report, project } of outputs) {
      await Promise.all([
        writeFile(`${options.batch.publishDirectory}/${filename}.np3dp-project.json`, serializeProject(project)),
        writeFile(`${options.batch.publishDirectory}/${filename}.gcode`, result.text),
        writeFile(`${options.batch.publishDirectory}/${filename}.print-report.json`, `${JSON.stringify(report, null, 2)}\n`),
      ]);
    }
    await writeFile(`${options.batch.publishDirectory}/manifest.json`, manifestText);
  }

  console.table(manifestStudies.map(({ id, bytes, compileMs, audit }) => ({
    id, bytes, compileMs, commandedSeconds: +audit.commandedSeconds.toFixed(1), auditErrors: audit.errors.length,
  })));
} finally {
  await server.close();
}
