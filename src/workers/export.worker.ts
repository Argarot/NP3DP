import { exportDraft } from '../export/draft';
import { exportExperimentReport } from '../export/report';
import type { GeneratedToolpath, Recipe } from '../domain/types';

self.onmessage = (event: MessageEvent<{ recipe: Recipe; path: GeneratedToolpath }>) => {
  let report: string | undefined;
  try {
    const { recipe, path } = event.data;
    report = exportExperimentReport(recipe, path);
    const text = exportDraft(recipe, path);
    const preview = text.split('\n', 100).join('\n');
    self.postMessage({ text, preview, report });
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Draft export failed.', report });
  }
};
