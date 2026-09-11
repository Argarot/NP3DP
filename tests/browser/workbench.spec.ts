import { expect, test } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { parseRecipeText } from '../../src/domain/recipe';
import { DEFAULT_RECIPE } from '../../src/domain/presets';

test('all studies generate and timed spans survive draft serialization', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Motion draft', exact: true })).toBeEnabled();
  for (const title of ['Folded lattice', 'Arc vessel', 'Held spans', 'Method sampler']) {
    await page.getByLabel('Example recipe').selectOption({ label: title });
    await expect(page.getByLabel('Recipe name')).toHaveValue(title);
    await expect(page.getByRole('button', { name: 'Motion draft', exact: true })).toBeEnabled();
    await expect(page.getByRole('alert')).toHaveCount(0);
  }
  await page.getByRole('button', { name: 'Motion draft', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download .gcode.txt', exact: true }).click();
  const downloaded = await downloadPromise;
  const text = await readFile((await downloaded.path())!, 'utf8');
  expect(text).toContain('NOT A COMPLETE PRINT JOB');
  expect(text).toContain('G4 P');
  expect(text).toContain('\nM83\n');
  expect(text).not.toContain('NaN');
  await page.getByRole('button', { name: 'Close export' }).click();
  await page.getByRole('button', { name: 'Play toolpath', exact: true }).click();
  await expect(page.getByLabel('Toolpath progress')).not.toHaveValue('1');
  await page.getByRole('button', { name: 'Pause playback' }).click();
  expect(errors).toEqual([]);
});

test('recipe edits round-trip through a file and invalid imports preserve the design', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Form', exact: true }).click();
  const field = page.getByRole('spinbutton', { name: 'Top diameter value' });
  await field.fill('106'); await field.press('Enter');
  await page.getByLabel('Cross-section', { exact: true }).selectOption('ellipse');
  await page.getByRole('spinbutton', { name: 'Twist value' }).fill('70');
  await page.getByRole('spinbutton', { name: 'Twist value' }).press('Enter');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Save recipe', exact: true }).click();
  const download = await downloadPromise;
  const file = (await download.path())!;
  const recipe = parseRecipeText(await readFile(file, 'utf8'));
  expect(recipe.shape).toMatchObject({ topDiameterMm: 106, section: 'ellipse', twistDeg: 70 });
  await page.getByLabel('Example recipe').selectOption('held-spans');
  await page.getByLabel('Open recipe file').setInputFiles(file);
  await expect(field).toHaveValue('106');
  await page.getByLabel('Open recipe file').setInputFiles({ name: 'future.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...DEFAULT_RECIPE, schemaVersion: 9 })) });
  await expect(page.getByRole('status')).toContainText('unsupported schemaVersion');
  await expect(field).toHaveValue('106');
});

test('rapid edits use the latest recipe and large jobs can recover', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Form', exact: true }).click();
  const height = page.getByRole('spinbutton', { name: 'Height value' });
  for (const value of ['200', '90', '66']) { await height.fill(value); await height.press('Enter'); }
  await expect(page.getByRole('button', { name: 'Motion draft', exact: true })).toBeEnabled();
  await page.getByRole('button', { name: 'Motion draft', exact: true }).click();
  await expect(page.getByLabel('G-code draft preview')).toContainText('"heightMm":66');
  await page.getByRole('button', { name: 'Close export' }).click();
  await height.fill('200'); await height.press('Enter');
  await page.getByRole('tab', { name: 'Process', exact: true }).click();
  const pitch = page.getByRole('spinbutton', { name: 'Pitch value' });
  await pitch.fill('0.3'); await pitch.press('Enter');
  await expect(page.getByRole('alert')).toContainText('event limit');
  await page.getByLabel('Example recipe').selectOption('ripple-study');
  await expect(page.getByRole('button', { name: 'Motion draft', exact: true })).toBeEnabled();
  await expect(page.getByRole('alert')).toHaveCount(0);
});

test('desktop and mobile controls remain in bounds', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Motion draft', exact: true })).toBeEnabled();
  for (const size of [{ width: 1440, height: 1000 }, { width: 1280, height: 800 }, { width: 390, height: 844 }]) {
    await page.setViewportSize(size);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    if (size.width > 1000) {
      const timeline = await page.getByRole('region', { name: 'Commanded motion playback' }).boundingBox();
      expect(timeline!.y + timeline!.height).toBeLessThan(size.height);
    }
  }
});
