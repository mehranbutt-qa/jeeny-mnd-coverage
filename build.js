/**
 * build.js
 * Reads JSON files and regenerates presentation.html
 * Usage: node build.js
 * 
 * To re-fetch from TestRail first: node extract.js && node build.js
 */

const fs = require("fs");
const path = require("path");

const dir = __dirname;

function readJSON(file) {
  const p = path.join(dir, file);
  if (!fs.existsSync(p)) { console.warn(`  Missing: ${file}`); return []; }
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

console.log("=== M&D Presentation Builder ===");

const allCases = readJSON("all-cases-data.json");
console.log(`  Loaded ${allCases.length} M&D cases`);

// Read template (if exists) or use inline
let template = path.join(dir, "presentation.html");
let html = fs.readFileSync(template, "utf8");

// Re-inject data
html = html.replace(/const ALL_CASES = .*?;/, `const ALL_CASES = ${JSON.stringify(allCases)};`);

fs.writeFileSync(path.join(dir, "index.html"), html);
fs.writeFileSync(template, html);

console.log("  Written: presentation.html");
console.log("  Written: index.html");
console.log("\n✅ Build complete. Open presentation.html in your browser.");
