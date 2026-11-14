// Renders the first-person arm pose from the player's eye and from outside, for tuning arms.js.
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'http'; import fs from 'fs'; import path from 'path';
const types = { '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.html': 'text/html' };
const srv = http.createServer((q, s) => { const f = path.join(path.resolve('.'), decodeURIComponent(q.url.split('?')[0])); if (!fs.existsSync(f)) { s.statusCode = 404; return s.end(); } s.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream'); s.end(fs.readFileSync(f)); }).listen(8766);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const pg = await b.newPage({ viewport: { width: +(process.env.W || 640), height: +(process.env.H || 360) } });
await pg.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', r => r.fulfill({ body: fs.readFileSync(path.join('node_modules/three', r.request().url().split('three@0.160.0/')[1])), contentType: 'text/javascript' }));
pg.on('pageerror', e => console.log('[pageerror]', e.message)); pg.on('console', m => { if (m.type() === 'error') console.log('[error]', m.text()); });
await pg.goto('http://localhost:8766/tools/arms-test.html#' + encodeURIComponent(process.argv[2] || '{}'));
await pg.waitForFunction(() => window.snap, null, { timeout: 60000 });
fs.mkdirSync('shots', { recursive: true });
const views = { eye: [[0, 0, 0], [0, 0, -1]], side: [[0.9, 0.0, -0.3], [0, -0.2, -0.25]], top: [[0.0, 0.9, -0.2], [0, -0.2, -0.25]], front: [[0.05, -0.1, -1.1], [0.05, -0.2, 0]] };
for (const [k, [p, l]] of Object.entries(views)) { const u = await pg.evaluate(([p, l]) => window.snap(p, l), [p, l]); fs.writeFileSync(`shots/arms_${k}.jpg`, Buffer.from(u.split(',')[1], 'base64')); }
console.log('done'); await b.close(); srv.close();
