// Writes a made-up export file (generated body points, not a real person) to try the analyser on:
//   npx tsx scripts/make-demo-export.ts demo.json && npx tsx scripts/analyze-samples.ts demo.json
import { writeFileSync } from 'node:fs';
import { packFrame } from '../src/vision/samples';
import { evenKicks, synthClip } from '../tests/helpers/synth';

const take = (exerciseId: string, leg: 'left' | 'right', opts = {}, seed = 1) => ({
  id: `${exerciseId}-${leg}`, exerciseId, leg, expected: 5, fps: 15, createdAt: Date.now(),
  frames: synthClip({ seconds: 20, kicks: evenKicks(5, leg, 1, 3, opts), seed }).map((f) => packFrame(f.t, f.lm)),
});
const out = { app: 'tkd-practice', version: 1, samples: [take('roundhouse', 'left'), take('roundhouse', 'right', {}, 2), take('front-kick', 'left', { peak: 80, reach: 165 }, 3), take('side-kick', 'right', { peak: 80, reach: 165 }, 4)] };
writeFileSync(process.argv[2] ?? 'demo.json', JSON.stringify(out));
console.log('wrote', process.argv[2] ?? 'demo.json');
