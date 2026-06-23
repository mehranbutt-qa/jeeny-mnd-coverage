# Matching & Dispatching — Test Coverage Presentation

Management-ready static presentation built directly from TestRail.

## Quick Start

Open `presentation.html` in your browser — no server needed to **view** it.

---

## 🔄 Refresh from TestRail (Live Data)

Because browsers block direct API calls (CORS), a tiny local proxy is required.

### Step 1 — Start the proxy (once)

```cmd
cd C:\path\to\matching-dispatching-coverage
node proxy.js
```

You'll see:
```
  ✅ TestRail CORS Proxy running
  👉 http://localhost:3131
```

Keep this terminal open.

### Step 2 — Open the presentation

Open `presentation.html` in your browser.

### Step 3 — Click Refresh

Click **🔄 Refresh from TestRail** in the sidebar.
- If the proxy is running, the banner shows ✅ green
- Enter your email + API key, tick Save if you want
- Click **Fetch & Refresh**

The presentation updates live with the latest TestRail data.

---

## Files

| File | Description |
|------|-------------|
| `presentation.html` | Standalone offline presentation |
| `index.html` | Same as presentation.html |
| `proxy.js` | Local CORS proxy (run with `node proxy.js`) |
| `extract.js` | Alternative: CLI script to fetch data |
| `build.js` | Rebuild presentation from JSON files |
| `all-cases-data.json` | All M&D cases |
| `smoke-cases.json` | Smoke cases |
| `regression-cases.json` | Regression cases |
| `tier-*.json` | Cases by tier |

## Coverage Summary (last extract)

- **Total M&D Cases:** 480
- **Smoke:** 0 ⚠️
- **Regression:** 45
- **Tier 0:** 0 | **Tier 1:** 13 | **Tier 2:** 9 | **Tier 3:** 458
