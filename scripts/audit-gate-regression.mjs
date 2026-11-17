import assert from "node:assert/strict";
import { evaluateAudit } from "./audit-gate.mjs";

const url = "https://github.com/advisories/GHSA-fc5q-39xc-vjpf";
const node = "node_modules/tinyglobby/node_modules/picomatch";
const lock = { packages: { [node]: { dev: true } } };
const finding = (name, severity, advisoryUrl) => ({
  name, severity, via: [{ name, dependency: name, severity, url: advisoryUrl }],
  nodes: [name === "picomatch" ? node : `node_modules/${name}`], fixAvailable: false,
});
const report = (vulnerabilities) => ({ auditReportVersion: 2, vulnerabilities });
const allowed = () => finding("picomatch", "high", url);
const passes = (v) => evaluateAudit(report(v), lock).ok;
assert.equal(passes({ picomatch: allowed() }), true, "single exception passes");
assert.equal(passes({ other: finding("other", "high", "https://github.com/advisories/GHSA-other") }), false, "another high fails");
assert.equal(passes({}), true, "clean audit passes");
assert.equal(passes({ other: finding("other", "critical", "https://github.com/advisories/GHSA-other") }), false, "critical fails");
assert.equal(passes({ picomatch: finding("picomatch", "high", "https://github.com/advisories/GHSA-new") }), false, "another picomatch advisory fails");
assert.equal(passes({ picomatch: allowed(), other: finding("other", "high", "https://github.com/advisories/GHSA-other") }), false, "exception cannot hide other findings");
const mixed = allowed(); mixed.via.push(finding("picomatch", "high", "https://github.com/advisories/GHSA-new").via[0]);
assert.equal(passes({ picomatch: mixed }), false, "multiple advisories on same package are checked");
const parent = { name: "tinyglobby", severity: "high", via: ["picomatch"], nodes: ["node_modules/tinyglobby"] };
assert.equal(passes({ tinyglobby: parent, picomatch: allowed() }), true, "parent inherits only the known advisory");
assert.equal(passes({ tinyglobby: { ...parent, via: ["picomatch", "other"] }, picomatch: allowed(), other: finding("other", "critical", "https://github.com/advisories/GHSA-new") }), false, "parent cannot conceal another advisory");
assert.equal(passes({ moderate: finding("moderate", "moderate", "https://github.com/advisories/GHSA-moderate") }), true, "moderate threshold unchanged");
assert.equal(evaluateAudit(report({ picomatch: allowed() }), { packages: { [node]: { dev: false } } }).ok, false, "production copy cannot be excepted");
assert.equal(evaluateAudit(report({ picomatch: allowed() }), {}).ok, false, "missing lock evidence fails");
assert.equal(passes({ picomatch: { ...allowed(), fixAvailable: true } }), false, "exception expires when a fix is available");
assert.equal(passes({ picomatch: { ...allowed(), nodes: [] } }), false, "empty nodes cannot establish dev-only use");
assert.equal(passes({ picomatch: finding("picomatch", "critical", url) }), false, "escalated severity requires fresh review");
assert.equal(passes({ other: finding("other", "high", url) }), false, "advisory URL alone cannot exempt another package");
for (const invalid of [null, {}, { error: { code: "ENETUNREACH" } }, { auditReportVersion: 1, vulnerabilities: {} }, report({ broken: {} }), report({ tinyglobby: parent }), report({ loop: { name: "loop", severity: "high", via: ["loop"] } })]) {
  assert.throws(() => evaluateAudit(invalid, lock), "invalid/incomplete report must fail closed");
}
console.log("PASS: audit gate exception, new high/critical findings, inherited advisories, production copies, available fixes, and invalid reports");
