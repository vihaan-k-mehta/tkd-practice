// Usage: npx tsx scripts/analyze-samples.ts path/to/tkd-training-data.json
// Reads the file the app exports (body points only, no video) and reports, for every exercise you recorded,
// how many reps the standard tracker counts, how many a tuned tracker counts, and what settings would fix it.
import { readFileSync } from 'node:fs';
import { analyzeExport, type ExportFile } from '../src/vision/analyze';

const path = process.argv[2];
if (!path) { console.error('Give the path to tkd-training-data.json'); process.exit(1); }
const file = JSON.parse(readFileSync(path, 'utf8')) as ExportFile;
const { rows, suggestedDefaults } = analyzeExport(file);

if (!rows.length) { console.log('No usable recordings in that file.'); process.exit(0); }
const pad = (s: string, n: number) => (s + ' '.repeat(n)).slice(0, n);
console.log(pad('Exercise', 32) + pad('Takes', 7) + pad('Standard', 10) + pad('Tuned', 8) + 'Notes');
for (const r of rows) {
  const notes = [r.cfg ? `settings ${JSON.stringify(r.cfg)}` : '', r.motionThreshold !== undefined ? `moving above ${r.motionThreshold}` : '', r.advice].filter(Boolean).join(' | ');
  console.log(pad(r.name, 32) + pad(String(r.samples), 7) + pad(r.before, 10) + pad(r.after, 8) + notes);
}
if (suggestedDefaults) console.log('\nSeveral kick exercises needed the same loosening, so the standard defaults may be too strict for everyone:', JSON.stringify(suggestedDefaults));
