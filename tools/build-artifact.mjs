// Builds dist/ in the shape the Claude artifact host wants: a page fragment,
// the game script, and the walker model embedded as base64 (the host does not serve .glb files).
import fs from 'fs';
fs.mkdirSync('dist', { recursive: true });
const html = fs.readFileSync('index.html', 'utf8');
const m = html.match(/<!-- page:start -->\n([\s\S]*?)<!-- page:end -->/);
if (!m) throw new Error('page markers not found in index.html');
fs.writeFileSync('dist/index.html', m[1]);
fs.copyFileSync('game.js', 'dist/game.js');
fs.writeFileSync('dist/walker-data.js', '// Humanoid model (glTF binary) embedded as base64 data.\nexport default "' + fs.readFileSync('assets/walker.glb').toString('base64') + '";\n');
console.log('dist/ ready');
