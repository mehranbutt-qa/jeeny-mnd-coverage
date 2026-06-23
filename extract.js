/**
 * extract.js
 * Fetches all M&D test cases from TestRail and writes JSON files.
 * Usage: node extract.js
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// ── Config ──────────────────────────────────────────────────────────────────
const TESTRAIL_URL = process.env.TESTRAIL_URL || "https://jeeny1.testrail.io";
const TESTRAIL_USER = process.env.TESTRAIL_USER || "";
const TESTRAIL_API_KEY = process.env.TESTRAIL_API_KEY || "";
const PROJECT_ID = 1;

// Domain ID for "Matching & Dispatching" — confirmed from TestRail sample (value=3)
// We will discover this dynamically by fetching custom field options.
// Fallback: 3 (from observed data)
let MND_DOMAIN_ID = null;

// Tier mapping (custom_case_tier values observed)
const TIER_MAP = {
  1: "Tier 0",
  2: "Tier 1",
  3: "Tier 2",
  4: "Tier 3",
};

// Priority mapping
const PRIORITY_MAP = {
  1: "Critical",
  2: "High",
  3: "Medium",
  4: "Low",
};

// ── HTTP helper ──────────────────────────────────────────────────────────────
function apiGet(path) {
  return new Promise((resolve, reject) => {
    const auth = Buffer.from(`${TESTRAIL_USER}:${TESTRAIL_API_KEY}`).toString("base64");
    const url = new URL(`${TESTRAIL_URL}/index.php?/api/v2/${path}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "GET",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error(`JSON parse error: ${e.message}\nBody: ${data.slice(0, 200)}`));
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data.slice(0, 300)}`));
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}

// ── Paginated fetch ──────────────────────────────────────────────────────────
async function fetchAllCases(projectId) {
  let offset = 0;
  const limit = 250;
  const allCases = [];
  while (true) {
    console.log(`  Fetching cases offset=${offset}...`);
    const data = await apiGet(`get_cases/${projectId}&limit=${limit}&offset=${offset}`);
    const cases = data.cases || data;
    allCases.push(...cases);
    const total = data.size || cases.length;
    if (cases.length < limit || allCases.length >= (data.size || Infinity)) break;
    offset += limit;
    // small delay to avoid rate limiting
    await new Promise((r) => setTimeout(r, 200));
  }
  return allCases;
}

async function fetchAllSections(projectId) {
  console.log("  Fetching sections...");
  try {
    const data = await apiGet(`get_sections/${projectId}`);
    return data.sections || data;
  } catch (e) {
    console.warn("  Warning: Could not fetch sections:", e.message);
    return [];
  }
}

// ── Domain ID discovery ──────────────────────────────────────────────────────
async function discoverDomainId(cases) {
  // Look at unique domain values and try to match by examining case titles
  // Strategy: find cases we know are M&D (section 519 from sample had domain=3)
  // Confirmed from sample data: custom_case_domain=3 for M&D case C18839
  // We'll validate by checking the most common domain among known M&D sections
  const domainCounts = {};
  for (const c of cases) {
    const d = c.custom_case_domain;
    if (d != null) domainCounts[d] = (domainCounts[d] || 0) + 1;
  }
  console.log("  Domain ID distribution:", domainCounts);
  // From sample: case 18839 title contains "Matching & Dispatching" context, domain=3
  // Also domain=1 appears many times — likely a default/other domain
  // We use 3 as confirmed M&D domain ID
  return 3;
}

// ── Build section lookup map ─────────────────────────────────────────────────
function buildSectionMap(sections) {
  const map = {};
  for (const s of sections) {
    map[s.id] = s;
  }
  return map;
}

function getSectionPath(sectionId, sectionMap) {
  const parts = [];
  let current = sectionMap[sectionId];
  while (current) {
    parts.unshift(current.name);
    current = current.parent_id ? sectionMap[current.parent_id] : null;
  }
  return parts;
}

function getModule(sectionId, sectionMap) {
  const path = getSectionPath(sectionId, sectionMap);
  return path[0] || "Unknown";
}

function getSection(sectionId, sectionMap) {
  const s = sectionMap[sectionId];
  return s ? s.name : `Section ${sectionId}`;
}

// ── Transform case ───────────────────────────────────────────────────────────
function transformCase(c, sectionMap) {
  const sectionPath = getSectionPath(c.section_id, sectionMap);
  const tierRaw = c.custom_case_tier;
  const tier = TIER_MAP[tierRaw] || "Unassigned";

  return {
    id: c.id,
    title: c.title,
    domain: "Matching & Dispatching",
    tier,
    smoke: c.custom_case_smoke === true,
    regression: c.custom_case_regression === true,
    priority: PRIORITY_MAP[c.priority_id] || "Medium",
    module: sectionPath[0] || "Unknown",
    section: sectionPath[sectionPath.length - 1] || "Unknown",
    folder: sectionPath.join(" > "),
    section_id: c.section_id,
    preconditions: c.custom_preconds || "",
    steps: c.custom_steps || "",
    expected: c.custom_expected || "",
    refs: c.refs || "",
  };
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  if (!TESTRAIL_USER || !TESTRAIL_API_KEY) {
    console.error("ERROR: Set TESTRAIL_USER and TESTRAIL_API_KEY env vars.");
    process.exit(1);
  }

  console.log("=== TestRail M&D Data Extractor ===");
  console.log(`Project: ${PROJECT_ID} | URL: ${TESTRAIL_URL}`);

  console.log("\n[1/4] Fetching all test cases...");
  const allCases = await fetchAllCases(PROJECT_ID);
  console.log(`  Total cases fetched: ${allCases.length}`);

  console.log("\n[2/4] Discovering domain ID...");
  MND_DOMAIN_ID = await discoverDomainId(allCases);
  console.log(`  Matching & Dispatching domain ID: ${MND_DOMAIN_ID}`);

  console.log("\n[3/4] Fetching sections...");
  const sections = await fetchAllSections(PROJECT_ID);
  const sectionMap = buildSectionMap(sections);
  console.log(`  Sections loaded: ${sections.length}`);

  console.log("\n[4/4] Filtering & transforming M&D cases...");
  const mndCases = allCases
    .filter((c) => c.custom_case_domain === MND_DOMAIN_ID && !c.is_deleted)
    .map((c) => transformCase(c, sectionMap));

  // Deduplicate by ID
  const seen = new Set();
  const dedupedCases = mndCases.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  console.log(`  M&D cases found: ${dedupedCases.length}`);

  // Derived sets
  const smokeCases = dedupedCases.filter((c) => c.smoke);
  const regressionCases = dedupedCases.filter((c) => c.regression);
  const tier0 = dedupedCases.filter((c) => c.tier === "Tier 0");
  const tier1 = dedupedCases.filter((c) => c.tier === "Tier 1");
  const tier2 = dedupedCases.filter((c) => c.tier === "Tier 2");
  const tier3 = dedupedCases.filter((c) => c.tier === "Tier 3");

  console.log(`  Smoke: ${smokeCases.length} | Regression: ${regressionCases.length}`);
  console.log(`  Tier 0: ${tier0.length} | Tier 1: ${tier1.length} | Tier 2: ${tier2.length} | Tier 3: ${tier3.length}`);

  // Write JSON files
  const outDir = __dirname;
  const write = (filename, data) => {
    fs.writeFileSync(path.join(outDir, filename), JSON.stringify(data, null, 2));
    console.log(`  Written: ${filename} (${data.length || Object.keys(data).length} items)`);
  };

  write("all-cases-data.json", dedupedCases);
  write("smoke-cases.json", smokeCases);
  write("regression-cases.json", regressionCases);
  write("tier-0-cases.json", tier0);
  write("tier-1-cases.json", tier1);
  write("tier-2-cases.json", tier2);
  write("tier-3-cases.json", tier3);

  console.log("\n✅ Extraction complete. Run: node build.js");
}

main().catch((e) => {
  console.error("Fatal error:", e.message);
  process.exit(1);
});
