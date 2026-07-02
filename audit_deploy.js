#!/usr/bin/env node
/**
 * audit_deploy.js — sound/relief
 *
 * Static checks against index.html before shipping a new version.
 * Every check here exists because of a real bug hit during development —
 * this isn't precautionary boilerplate, it's a list of specific mistakes
 * this project has already made once.
 *
 * Usage: node audit_deploy.js [path/to/index.html]
 * Exit code 0 = all checks passed, 1 = at least one failed.
 */
const fs = require("fs");
const path = process.argv[2] || "index.html";

if (!fs.existsSync(path)) {
  console.error(`Cannot find ${path}`);
  process.exit(1);
}
const html = fs.readFileSync(path, "utf8");

let failures = 0;
let warnings = 0;
const results = [];

function check(name, fn) {
  try {
    const res = fn();
    if (res === true) {
      results.push({ name, status: "pass" });
    } else if (res === "warn") {
      results.push({ name, status: "warn" });
      warnings++;
    } else {
      results.push({ name, status: "fail", detail: typeof res === "string" ? res : "" });
      failures++;
    }
  } catch (err) {
    results.push({ name, status: "fail", detail: "threw: " + err.message });
    failures++;
  }
}

// ---- extract the app's own inline script (last <script> block; three.js is the first) ----
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
const appScript = scripts[scripts.length - 1] || "";

// 1. No CDN dependency for three.js — regression guard for the "THREE is not
//    defined because cdnjs was unreachable" bug that killed the whole script.
check("three.js is embedded, not loaded from a CDN", () => {
  if (/<script\s+src=["']https?:\/\//i.test(html)) {
    return "found an external <script src=...> — three.js should be inlined so the app has zero network dependencies";
  }
  if (!/THREE\.REVISION|Three\.js/.test(html.slice(0, 50000))) {
    return "warn"; // can't positively confirm three.js is embedded, but no CDN ref either
  }
  return true;
});

// 2. No top-level THREE.* usage before any function is declared — this is
//    exactly the bug that silently killed every event listener on the page.
check("no THREE.* usage outside a function (top-level parse-time crash risk)", () => {
  const firstFnIdx = appScript.indexOf("function ");
  if (firstFnIdx === -1) return "warn — couldn't find any function declarations to compare against";
  const beforeFirstFn = appScript.slice(0, firstFnIdx);
  const m = beforeFirstFn.match(/THREE\./);
  if (m) {
    return `found "THREE." at top level before the first function declaration (offset ${m.index}) — this will throw before any event listeners attach if THREE fails to load`;
  }
  return true;
});

// 3. File input must be opened via a native <label for=...>, not a click()
//    proxy — the div+click() pattern caused infinite recursion via bubbled
//    synthetic click events.
check("file picker uses <label for> instead of a click() proxy", () => {
  if (!/<label[^>]+for=["']fileInput["']/.test(html)) {
    return "no <label for=\"fileInput\"> found — if this reverts to a div with a click() handler that targets a descendant input, expect infinite recursion";
  }
  if (/drop\.addEventListener\(["']click["']/.test(appScript)) {
    return "found a click listener on the drop zone that may proxy to fileInput.click() — check it isn't recursing";
  }
  return true;
});

// 4. Window-level drag/drop capture must exist — without it, drops outside
//    the drop zone get hijacked by the browser's native file handling.
check("window-level dragover/drop preventDefault is present", () => {
  const hasDragover = /window\.addEventListener\(["']dragover["']/.test(appScript)
    || /\[[^\]]*["']dragover["'][^\]]*\][^;]*window\.addEventListener/.test(appScript);
  const hasDrop = /window\.addEventListener\(["']drop["']/.test(appScript)
    || /\[[^\]]*["']drop["'][^\]]*\][^;]*window\.addEventListener/.test(appScript);
  if (!hasDragover || !hasDrop) {
    return "missing window-level drag/drop handling — files dropped outside the drop zone will be opened natively by the browser instead of reaching the app";
  }
  return true;
});

// 5. Critical wiring (file inputs, drag/drop) should run before any
//    THREE-dependent code in source order, so a later failure can't
//    prevent file handling from working at all.
check("file input wiring appears before three.js scene code", () => {
  const wireIdx = appScript.search(/fileInput\.addEventListener\(["']change["']/);
  const sceneIdx = appScript.search(/function initScene/);
  if (wireIdx === -1) return "couldn't find fileInput change listener at all";
  if (sceneIdx !== -1 && wireIdx > sceneIdx) {
    return "file input wiring appears after initScene() in source order — move it earlier so a 3D-related failure can't block file upload";
  }
  return true;
});

// 6. Every $("...") id reference must exist in the HTML.
check("every $(\"id\") reference resolves to a real element", () => {
  const idsInHtml = new Set([...html.matchAll(/id=["']([^"']+)["']/g)].map(m => m[1]));
  const referenced = new Set([...appScript.matchAll(/\$\(["']([^"']+)["']\)/g)].map(m => m[1]));
  const missing = [...referenced].filter(id => !idsInHtml.has(id));
  if (missing.length) return `missing element(s): ${missing.join(", ")}`;
  return true;
});

// 7. 3D render failures must not block G-code export — they're unrelated
//    data paths and a Three.js problem shouldn't disable the download button.
check("buildMesh() failure can't block G-code export", () => {
  const m = appScript.match(/buildMesh\(\);/);
  if (!m) return "warn — couldn't find a bare buildMesh() call to check";
  const idx = appScript.indexOf(m[0]);
  const surrounding = appScript.slice(Math.max(0, idx - 200), idx);
  if (!/try\s*{[^}]*$/.test(surrounding.replace(/\n/g, " "))) {
    return "warn — buildMesh() call doesn't appear to be wrapped in try/catch; verify a render failure can't halt the pipeline before the download button is enabled";
  }
  return true;
});

// 8b. STL export must not depend on the three.js mesh/scene — same
//     reasoning as check 7: a preview failure shouldn't block the file
//     you actually use to sanity-check before cutting.
check("generateSTL() doesn't reference mesh/scene (must work even if 3D preview failed)", () => {
  const m = appScript.match(/function generateSTL\(\)\s*{/);
  if (!m) return "no generateSTL() function found";
  // grab the function body via brace matching
  let i = appScript.indexOf("{", m.index), depth = 0, end = -1;
  for (; i < appScript.length; i++) {
    if (appScript[i] === "{") depth++;
    else if (appScript[i] === "}") { depth--; if (depth === 0) { end = i; break; } }
  }
  const body = end === -1 ? appScript.slice(m.index) : appScript.slice(m.index, end);
  if (/\bmesh\.|\bscene\.|\bmesh\b\s*[,)]|\bscene\b\s*[,)]/.test(body)) {
    return "generateSTL() appears to reference mesh/scene — it should build from the heightmap grid directly, independent of the three.js preview";
  }
  return true;
});

// 9. G-code must always be emitted in mm (G21), regardless of the mm/in
//    display toggle — the unit switch should only affect the UI layer.
check("G-code always declares G21 (mm), independent of display unit", () => {
  if (!/G21/.test(appScript)) return "no G21 unit declaration found in the G-code generator";
  if (/unitSystem[^;]*G2[01]/.test(appScript)) {
    return "G-code unit declaration appears to reference unitSystem — G-code should always be mm regardless of display unit";
  }
  return true;
});

// 9. Node syntax check of the app's own script (catches typos/syntax errors
//    before they ship — three.js itself is assumed pre-validated).
check("app script has valid JS syntax", () => {
  const tmp = "/tmp/_audit_check.js";
  fs.writeFileSync(tmp, appScript);
  try {
    require("child_process").execSync(`node --check ${tmp}`, { stdio: "pipe" });
    return true;
  } catch (err) {
    return "syntax error: " + err.stderr.toString().split("\n").slice(0, 3).join(" ");
  } finally {
    fs.unlinkSync(tmp);
  }
});

// 10. Displayed version (header) must match the APP_VERSION constant used
//     in exported filenames/G-code comments, so they can't drift apart.
check("header version matches APP_VERSION constant", () => {
  const constMatch = appScript.match(/APP_VERSION\s*=\s*["']([^"']+)["']/);
  const headerMatch = html.match(/id=["']versionTag["'][^>]*>v([\d.]+)/);
  if (!constMatch || !headerMatch) return "warn — couldn't find one or both version strings";
  if (constMatch[1] !== headerMatch[1]) {
    return `APP_VERSION is "${constMatch[1]}" but header shows "v${headerMatch[1]}"`;
  }
  return true;
});

// ---- report ----
const icons = { pass: "\u2713", warn: "\u25cb", fail: "\u2717" };
console.log(`\naudit_deploy.js — ${path}\n`);
for (const r of results) {
  console.log(`  ${icons[r.status]} ${r.name}${r.detail ? "\n      " + r.detail : ""}`);
}
console.log(`\n${results.length - failures - warnings}/${results.length} passed, ${warnings} warning(s), ${failures} failure(s)\n`);
process.exit(failures > 0 ? 1 : 0);
