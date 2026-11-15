// Headless screenshot harness: node tools/shot.mjs '[{"name":"street","begin":true}]' 960 540
// Renders single frames on demand (software GL is slow) and writes them to shots/.
import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
import http from 'http'; import fs from 'fs'; import path from 'path';
const root = path.resolve('.'), nm = path.resolve('node_modules/three');
const types = { '.js': 'text/javascript', '.glb': 'model/gltf-binary', '.html': 'text/html' };
const srv = http.createServer((q, s) => {
  let u = decodeURIComponent(q.url.split('?')[0]);
  if (u === '/') u = '/index.html';
  const f = path.join(root, u); if (!fs.existsSync(f)) { s.statusCode = 404; return s.end(); }
  s.setHeader('content-type', types[path.extname(f)] || 'application/octet-stream'); s.end(fs.readFileSync(f));
}).listen(+(process.env.PORT || 8765));
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const shots = JSON.parse(process.argv[2] || '[]'); const W = +(process.argv[3] || 1280), H = +(process.argv[4] || 720);
const pg = await b.newPage({ viewport: { width: W, height: H } });
await pg.route('https://cdn.jsdelivr.net/npm/three@0.160.0/**', r => { const p = r.request().url().split('three@0.160.0/')[1]; r.fulfill({ body: fs.readFileSync(path.join(nm, p)), contentType: 'text/javascript' }); });
await pg.route('https://fonts.googleapis.com/**', r => r.abort());
pg.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') console.log('[' + m.type() + ']', m.text().slice(0, 400)); });
pg.on('pageerror', e => console.log('[pageerror]', e.message, (e.stack || '').split('\n').slice(0, 4).join(' | ')));
fs.mkdirSync('shots', { recursive: true });
await pg.addInitScript(() => { window.__manual = true; });
await pg.goto(`http://localhost:${+(process.env.PORT || 8765)}/`);
await pg.waitForFunction(() => window.__game && !document.getElementById('go').disabled, null, { timeout: 120000 }).catch(e => console.log('wait fail', e.message));
for (const s of shots) {
  const t0 = Date.now();
  const url = await pg.evaluate(s => { const g = window.__game; if (s.begin) { document.getElementById('veil').hidden = true; g.begin(); } Object.assign(g.player, s.p || {}); if (s.js) eval(s.js); for (let i = 0; i < (s.frames || 3); i++) g.frame(); return g.renderer.domElement.toDataURL('image/jpeg', 0.9); }, s);
  if (s.page) await pg.screenshot({ path: `shots/${s.name}.png` });
  fs.writeFileSync(`shots/${s.name}.jpg`, Buffer.from(url.split(',')[1], 'base64'));
  console.log('shot', s.name, Date.now() - t0, 'ms');
}
console.log(await pg.evaluate(() => JSON.stringify({ z: window.__game.zombies.length })));
await b.close(); srv.close();
