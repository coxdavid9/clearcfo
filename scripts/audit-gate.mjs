import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

const EXCEPTION_URL = "https://github.com/advisories/GHSA-fc5q-39xc-vjpf";
// Temporary exception: GHSA-fc5q-39xc-vjpf in picomatch ONLY.
// Dev-only ESLint glob chain; absent from production-only installs. Exploitation
// requires crafted glob patterns reaching local lint tooling. No patched release
// exists as of 2026-11-17. Re-check on every dependency update: remove this
// exception as soon as a patched picomatch or parent update drops the vulnerable
// version. Never exempt production copies or another advisory on this package.
const severities = new Set(["info", "low", "moderate", "high", "critical"]);
const high = (severity) => severity === "high" || severity === "critical";
const object = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

export function evaluateAudit(report, lock) {
  if (!object(report) || report.error || report.auditReportVersion !== 2 || !object(report.vulnerabilities)) {
    throw new Error("Missing or unsupported npm audit report; refusing to pass.");
  }
  const vulnerabilities = report.vulnerabilities;
  const blocked = new Set();
  const excepted = new Set();
  const memo = new Map();
  function inspect(name, visiting = new Set()) {
    if (memo.has(name)) return memo.get(name);
    const entry = vulnerabilities[name];
    if (visiting.has(name) || !object(entry) || entry.name !== name || !severities.has(entry.severity) || !Array.isArray(entry.via) || !entry.via.length) {
      throw new Error(`Invalid or unresolved audit dependency: ${name}`);
    }
    const chain = new Set(visiting).add(name);
    let hasHigh = false;
    for (const via of entry.via) {
      if (typeof via === "string") {
        hasHigh = inspect(via, chain) || hasHigh;
        continue;
      }
      if (!object(via) || !severities.has(via.severity) || typeof via.url !== "string") {
        throw new Error(`Invalid audit advisory for ${name}`);
      }
      if (!high(via.severity)) continue;
      hasHigh = true;
      const devOnly = Array.isArray(entry.nodes) && entry.nodes.length > 0 && entry.nodes.every((node) =>
        typeof node === "string" && node.endsWith("node_modules/picomatch") && lock?.packages?.[node]?.dev === true);
      if (name === "picomatch" && via.name === "picomatch" && via.dependency === "picomatch" &&
          via.url === EXCEPTION_URL && via.severity === "high" && devOnly && entry.fixAvailable === false) {
        excepted.add(`${name}: ${via.url} (dev-only, no fix available)`);
      } else {
        blocked.add(`${name}: ${via.url} (${via.severity})`);
      }
    }
    // npm marks parent packages high through string-valued `via` references.
    // Resolve their actual advisories; do not allowlist parent package names.
    if (high(entry.severity) && !hasHigh) blocked.add(`${name}: unexplained ${entry.severity} severity`);
    memo.set(name, hasHigh);
    return hasHigh;
  }
  for (const name of Object.keys(vulnerabilities)) inspect(name);
  return { ok: blocked.size === 0, blocked: [...blocked], excepted: [...excepted] };
}

export function runAudit() {
  const audit = spawnSync("npm", ["audit", "--json", "--include=dev", "--include=optional"], {
    encoding: "utf8", maxBuffer: 16 * 1024 * 1024,
  });
  // Keep the full raw audit visible, including the exception and moderates.
  if (audit.stdout) process.stdout.write(audit.stdout);
  if (audit.stderr) process.stderr.write(audit.stderr);
  if (audit.error || audit.signal || ![0, 1].includes(audit.status)) throw new Error("npm audit could not complete.");
  const report = JSON.parse(audit.stdout);
  const lock = JSON.parse(readFileSync(new URL("../package-lock.json", import.meta.url), "utf8"));
  const result = evaluateAudit(report, lock);
  for (const exception of result.excepted) console.warn(`Temporary audit exception: ${exception}`);
  for (const failure of result.blocked) console.error(`Audit blocked: ${failure}`);
  if (!result.ok) return 1;
  console.log("Audit gate passed: no unexcepted high or critical advisories.");
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try { process.exitCode = runAudit(); }
  catch (error) { console.error("Audit gate failed:", error.message); process.exitCode = 1; }
}
