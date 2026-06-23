/**
 * extract.js
 * Fetches M&D test cases from TestRail and writes JSON files.
 * Usage: node extract.js
 *
 * Filters by MND_DOMAIN_ID (custom_case_domain) — same rule as presentation.html.
 * Paginates through all project cases/sections (TestRail returns size per page, not total).
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// ── Config ──────────────────────────────────────────────────────────────────
const TESTRAIL_URL = process.env.TESTRAIL_URL || "https://jeeny1.testrail.io";
const TESTRAIL_USER = process.env.TESTRAIL_USER || "";
const TESTRAIL_API_KEY = process.env.TESTRAIL_API_KEY || "";
const PROJECT_ID = 1;
const MND_DOMAIN_ID = 3; // Matching & Dispatching — mapped in presentation.html

const TIER_MAP = {
  1: "Tier 0",
  2: "Tier 1",
  3: "Tier 2",
  4: "Tier 3",
};

const PRIORITY_MAP = {
  1: "Critical",
  2: "High",
  3: "Medium",
  4: "Low",
};

const LAYER_MAP = {
  1: "UI / Mobile",
  2: "API / Backend",
  3: "Integration",
  4: "System / E2E",
  5: "Performance",
};

// Section + feature maps — keep in sync with presentation.html
const SECTION_MAP = {
  519: { name: "Driver App", parent: null },
  525: { name: "Home Screen", parent: 519 },
  564: { name: "Ride Flows", parent: 519 },
  589: { name: "Backend Services", parent: null },
  694: { name: "Forward Dispatch Rides", parent: 564 },
  977: { name: "Matching & Dispatching", parent: 589 },
  978: { name: "Secondary Sorting Formula", parent: 977 },
  1032: { name: "Time Based Dispatch Rule", parent: 977 },
  1061: { name: "Offer Presentation Duration", parent: 977 },
  1141: { name: "Destination Filter", parent: 525 },
  1221: { name: "Price Check Screen ETA", parent: 977 },
  1222: { name: "ELM Status in Sorting Formula", parent: 977 },
  1358: { name: "RCRC DARB Integration", parent: 977 },
  1359: { name: "Authentication Token API", parent: 1358 },
  1360: { name: "Get Vouchers by Partner ID", parent: 1358 },
  1361: { name: "Get Promotion by Voucher ID", parent: 1358 },
  1362: { name: "Voucher Templates API", parent: 1358 },
  1363: { name: "Fare Estimate API", parent: 1358 },
  1364: { name: "Darb Token Integration", parent: 1358 },
  1365: { name: "Webhook Consumer", parent: 1358 },
  1366: { name: "Deep Link Functionality", parent: 1358 },
  1367: { name: "Voucher Validation", parent: 1358 },
  1368: { name: "Service Area & Fare Estimate Filtering", parent: 1358 },
  1369: { name: "Jeeny Pricing - Fare Estimate Filtering", parent: 1358 },
  1370: { name: "Jeeny Pricing - Voucher Radius Validation", parent: 1358 },
  1509: { name: "Driver CQI Score in Injector Formula", parent: 977 },
  1564: { name: "Edge Cases", parent: 1358 },
  1569: { name: "Driver Receive Cash Rides With Negative Balance", parent: 977 },
  1581: { name: "Driver Ranking Verified Boost", parent: 977 },
  1583: { name: "Active Ride", parent: 1358 },
  1629: { name: "Secondary Sorting Improvements", parent: 978 },
  1823: { name: "Forms Config", parent: 1629 },
  1824: { name: "Jeeny Config", parent: 1629 },
  1825: { name: "Cockpit", parent: 1629 },
  1826: { name: "Partner", parent: 1629 },
  2842: { name: "New CRs of DARB", parent: 1358 },
  3015: { name: "Scheduled Driver Service Filter", parent: 977 },
  3026: { name: "Driver's Matching", parent: 977 },
  3027: { name: "Ride Dispatch", parent: 977 },
  6573: { name: "Out-of-Operating Area (OOA/NOA)", parent: 977 },
};

const FEATURE_MAP = {
  1358: "RCRC DARB Integration", 1359: "RCRC DARB Integration", 1360: "RCRC DARB Integration",
  1361: "RCRC DARB Integration", 1362: "RCRC DARB Integration", 1363: "RCRC DARB Integration",
  1364: "RCRC DARB Integration", 1365: "RCRC DARB Integration", 1366: "RCRC DARB Integration",
  1367: "RCRC DARB Integration", 1368: "RCRC DARB Integration", 1369: "RCRC DARB Integration",
  1370: "RCRC DARB Integration", 1564: "RCRC DARB Integration", 1583: "RCRC DARB Integration",
  2842: "RCRC DARB Integration",
  978: "Secondary Sorting Formula", 1629: "Secondary Sorting Formula",
  1823: "Secondary Sorting Formula", 1824: "Secondary Sorting Formula",
  1825: "Secondary Sorting Formula", 1826: "Secondary Sorting Formula",
  1032: "Time Based Dispatch Rule", 1061: "Offer Presentation Duration",
  1221: "Price Check Screen ETA", 1222: "ELM Status in Sorting Formula",
  1509: "Driver CQI Score in Injector Formula",
  1569: "Driver Receive Cash Rides With Negative Balance",
  1581: "Driver Ranking Verified Boost", 3015: "Scheduled Driver Service Filter",
  3026: "Driver's Matching", 3027: "Ride Dispatch", 6573: "Out-of-Operating Area (OOA/NOA)",
  694: "Forward Dispatch Rides", 1141: "Destination Filter", 519: "Driver App - Ride Offer",
};

const RUNTIME_SECTIONS = {};

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
// TestRail's `size` field is the current page count, not project total — stop only when batch < limit.
async function fetchPaginated(pathBase, arrayKey, label) {
  const limit = 250;
  let offset = 0;
  const all = [];

  while (true) {
    console.log(`  Fetching ${label} offset=${offset}...`);
    const data = await apiGet(`${pathBase}&limit=${limit}&offset=${offset}`);
    const items = data[arrayKey] || (Array.isArray(data) ? data : []);
    if (!items.length) break;
    all.push(...items);
    if (items.length < limit) break;
    offset += limit;
    await new Promise((r) => setTimeout(r, 200));
  }

  return all;
}

async function fetchAllCases(projectId) {
  return fetchPaginated(`get_cases/${projectId}`, "cases", "cases");
}

async function fetchAllSections(projectId) {
  return fetchPaginated(`get_sections/${projectId}`, "sections", "sections");
}

function loadRuntimeSections(sections) {
  for (const s of sections) {
    if (!SECTION_MAP[s.id]) {
      RUNTIME_SECTIONS[s.id] = { name: s.name, parent: s.parent_id || null };
    }
  }
}

function stripHtml(s) {
  if (!s) return "";
  return s.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function getSectionPathRuntime(sid) {
  const parts = [];
  let cur = sid;
  const visited = new Set();
  while (cur && !visited.has(cur)) {
    visited.add(cur);
    const s = SECTION_MAP[cur] || RUNTIME_SECTIONS[cur];
    if (!s) break;
    parts.unshift(s.name);
    cur = s.parent;
  }
  return parts.length ? parts : [`Section ${sid}`];
}

function transformCase(c) {
  const sectionPath = getSectionPathRuntime(c.section_id);

  let feature = FEATURE_MAP[c.section_id];
  if (!feature) {
    let cur = c.section_id;
    const visited = new Set();
    while (cur && SECTION_MAP[cur] && !visited.has(cur)) {
      visited.add(cur);
      if (FEATURE_MAP[cur]) {
        feature = FEATURE_MAP[cur];
        break;
      }
      cur = SECTION_MAP[cur].parent;
    }
    if (!feature) {
      feature = sectionPath[sectionPath.length - 1] || `Section ${c.section_id}`;
    }
  }

  return {
    id: c.id,
    title: c.title,
    domain: "Matching & Dispatching",
    tier: TIER_MAP[c.custom_case_tier] || "Unassigned",
    smoke: c.custom_case_smoke === true,
    regression: c.custom_case_regression === true,
    priority: PRIORITY_MAP[c.priority_id] || "Medium",
    module: sectionPath[0] || "Unknown",
    section: sectionPath[sectionPath.length - 1] || "Unknown",
    folder: sectionPath.join(" > "),
    section_id: c.section_id,
    testing_layer: LAYER_MAP[c.custom_case_testing_layer] || "Unclassified",
    feature,
    preconditions: stripHtml(c.custom_preconds),
    steps: stripHtml(c.custom_steps),
    expected: stripHtml(c.custom_expected),
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
  console.log(`M&D domain filter: custom_case_domain === ${MND_DOMAIN_ID}`);

  console.log("\n[1/3] Fetching all project cases (paginated)...");
  const allCases = await fetchAllCases(PROJECT_ID);
  console.log(`  Total cases fetched: ${allCases.length}`);

  console.log("\n[2/3] Fetching all sections (paginated)...");
  const sections = await fetchAllSections(PROJECT_ID);
  loadRuntimeSections(sections);
  console.log(`  Sections loaded: ${sections.length}`);

  console.log("\n[3/3] Filtering & transforming M&D cases...");
  const mndCases = allCases
    .filter((c) => Number(c.custom_case_domain) === MND_DOMAIN_ID && !c.is_deleted)
    .map((c) => transformCase(c));

  const seen = new Set();
  const dedupedCases = mndCases.filter((c) => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });

  console.log(`  M&D cases found: ${dedupedCases.length}`);

  const smokeCases = dedupedCases.filter((c) => c.smoke);
  const regressionCases = dedupedCases.filter((c) => c.regression);
  const tier0 = dedupedCases.filter((c) => c.tier === "Tier 0");
  const tier1 = dedupedCases.filter((c) => c.tier === "Tier 1");
  const tier2 = dedupedCases.filter((c) => c.tier === "Tier 2");
  const tier3 = dedupedCases.filter((c) => c.tier === "Tier 3");

  console.log(`  Smoke: ${smokeCases.length} | Regression: ${regressionCases.length}`);
  console.log(`  Tier 0: ${tier0.length} | Tier 1: ${tier1.length} | Tier 2: ${tier2.length} | Tier 3: ${tier3.length}`);

  const outDir = __dirname;
  const write = (filename, data) => {
    fs.writeFileSync(path.join(outDir, filename), JSON.stringify(data, null, 2));
    console.log(`  Written: ${filename} (${data.length} items)`);
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
