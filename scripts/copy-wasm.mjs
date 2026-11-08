// Copies the MediaPipe WebAssembly files next to the app so nothing loads from a third-party server.
import { cpSync, mkdirSync, existsSync } from 'node:fs';
const from = 'node_modules/@mediapipe/tasks-vision/wasm';
const to = 'public/models/wasm';
if (!existsSync(from)) { console.error('Run npm install first.'); process.exit(1); }
mkdirSync(to, { recursive: true });
for (const f of ['vision_wasm_internal.js', 'vision_wasm_internal.wasm']) cpSync(`${from}/${f}`, `${to}/${f}`);
console.log('MediaPipe wasm copied to', to);
