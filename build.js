/**
 * build.js
 * Reads JSON files and regenerates presentation.html + index.html
 * Usage: node build.js
 *
 * Full refresh workflow:
 *   node extract.js   ← fetch from TestRail
 *   node build.js     ← rebuild HTML
 *   git push          ← publish to GitHub Pages
 *
 * Or just run:  update.cmd  (Windows) — does all 3 steps in one go
 */

const fs   = require('fs');
const path = require('path');
const dir  = __dirname;

function readJSON(file){
  const p = path.join(dir, file);
  if(!fs.existsSync(p)){ console.warn(`  Missing: ${file}`); return []; }
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

console.log('\n=== M&D Presentation Builder ===');

const allCases = readJSON('all-cases-data.json');
console.log(`  Loaded ${allCases.length} M&D cases`);

// Read current presentation and replace data
let html = fs.readFileSync(path.join(dir, 'presentation.html'), 'utf8');

// Replace the CASES array
const casesJson = JSON.stringify(allCases);
html = html.replace(/const CASES = \[.*?\];/s, `const CASES = ${casesJson};`);

fs.writeFileSync(path.join(dir, 'presentation.html'), html);
fs.writeFileSync(path.join(dir, 'index.html'), html);

const smoke      = allCases.filter(c => c.smoke).length;
const regression = allCases.filter(c => c.regression).length;
const t1         = allCases.filter(c => c.tier === 'Tier 1').length;
const t2         = allCases.filter(c => c.tier === 'Tier 2').length;
const t3         = allCases.filter(c => c.tier === 'Tier 3').length;

console.log(`  Total: ${allCases.length} | Smoke: ${smoke} | Regression: ${regression}`);
console.log(`  Tier 1: ${t1} | Tier 2: ${t2} | Tier 3: ${t3}`);
console.log('\n  Written: presentation.html');
console.log('  Written: index.html');
console.log('\n✅ Build complete.\n');
