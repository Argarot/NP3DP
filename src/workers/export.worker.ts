import { exportDraft } from '../export/draft';
import { exportExperimentReport } from '../export/report';
import type { GeneratedToolpath, Recipe } from '../domain/types';
import { compilePrintJob } from '../print/complete';
import type { PrintSetup } from '../print/types';

self.onmessage = async (event: MessageEvent<{ kind?: 'draft'; recipe: Recipe; path: GeneratedToolpath } | { kind: 'full'; recipe: Recipe; setup: PrintSetup }>) => {
  let report: string | undefined;
  try {
    if (event.data.kind === 'full') {
      const result = compilePrintJob(event.data.recipe, event.data.setup);
      let report = result.report;
      if (result.text) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(result.text));
        report = JSON.stringify({ ...JSON.parse(report), gcodeSha256: [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('') }, null, 2);
      }
      self.postMessage({ ...result, report, preview: result.text?.split('\n', 100).join('\n') });
      return;
    }
    const { recipe, path } = event.data;
    report = exportExperimentReport(recipe, path);
    const text = exportDraft(recipe, path);
    const preview = text.split('\n', 100).join('\n');
    self.postMessage({ text, preview, report });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Draft export failed.', report });
  }
};
