import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import ts from "typescript";
import { QUIZ_QUESTIONS, scoreQuiz, isQuizAnswers } from "../src/lib/quiz.ts";

// Exhaust all 3^8 answer combinations, including every band boundary and tie.
for (let n = 0; n < 3 ** 8; n++) {
  let remaining = n;
  const answers = Array.from({ length: 8 }, () => { const a = remaining % 3; remaining = Math.floor(remaining / 3); return a; });
  const result = scoreQuiz(answers);
  const expected = answers.reduce((sum, a) => sum + a, 0);
  assert.equal(result.score, expected);
  assert.equal(result.band.headline, expected <= 7 ? "Flying blind" : expected <= 12 ? "Partial view" : "Clear view");
  const indices = answers.map((score, index) => ({ score, index })).sort((a, b) => a.score - b.score || a.index - b.index).slice(0, 2).map(x => `q${x.index + 1}`);
  assert.deepEqual(result.blindSpots.map(x => x.key), indices);
}
for (const invalid of [null, {}, [], Array(8).fill("2"), Array(8).fill(-1), Array(8).fill(3), [0, 1], Array(8).fill(0.5)]) {
  assert.equal(isQuizAnswers(invalid), false);
  assert.throws(() => scoreQuiz(invalid));
}
assert.equal(QUIZ_QUESTIONS.length, 8);
console.log("PASS: all 6,561 quiz combinations, score boundaries, tie order, invalid answers");

// Compile just the route's dependency graph to exercise its real handler with mocked Resend.
const dir = fs.mkdtempSync(path.join(process.cwd(), ".quiz-test-"));
const originalFetch = globalThis.fetch;
try {
  for (const file of ["src/lib/quiz.ts", "src/lib/email-helpers.ts", "src/lib/email.ts", "src/lib/quiz-email.ts", "src/lib/rate-limit.ts", "src/app/api/quiz/email/route.ts"]) {
    const dest = path.join(dir, file.replace(/\.ts$/, ".js"));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, ts.transpileModule(fs.readFileSync(file, "utf8"), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText);
  }
  const require = createRequire(import.meta.url);
  const { POST } = require(path.join(dir, "src/app/api/quiz/email/route.js"));
  process.env.RESEND_API_KEY = "quiz-test-only";
  let sent = [];
  globalThis.fetch = async (url, init) => { sent.push(JSON.parse(init.body)); return new Response("{}", { status: 200 }); };
  let ip = 0;
  function request(body, headers = {}, url = "https://theclearcfo.com/api/quiz/email") {
    return new Request(url, { method: "POST", headers: { "content-type": "application/json", "x-real-ip": `test-${ip++}`, ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
  }
  const answers = [2, 2, 0, 2, 2, 1, 2, 2];
  for (const body of [{}, null, { email: "a@example.com", answers: [0] }, { email: "bad", answers }, { email: "a@example.com\r\nBcc:evil@example.com", answers }, "{"]) {
    assert.equal((await POST(request(body))).status, 400);
  }
  assert.equal((await POST(request("x", { "content-length": "20000" }))).status, 413);
  assert.equal((await POST(request("x".repeat(17000)))).status, 413);
  assert.equal((await POST(request({}, { "origin": "https://evil.example" }))).status, 403);
  assert.equal((await POST(request({}, { "content-type": "text/plain" }))).status, 415);
  assert.equal(sent.length, 0);
  for (const [i, a] of [answers, Array(8).fill(0), Array(8).fill(1), Array(8).fill(2)].entries()) {
    const expected = scoreQuiz(a);
    assert.equal((await POST(request({ email: `test${i}@example.com`, answers: a, score: 999, html: "evil" }))).status, 200);
    const mail = sent.at(-1);
    assert.match(mail.from, /ClearCFO </);
    assert.equal(mail.to[0], `test${i}@example.com`);
    assert.ok(mail.text.includes(`${expected.score} out of 16 — ${expected.band.headline}`));
    for (const spot of expected.blindSpots) assert.ok(mail.text.includes(spot.blurb));
    assert.ok(mail.html.includes("https://theclearcfo.com/demo"));
    assert.ok(mail.html.includes("https://theclearcfo.com/signup"));
    assert.ok(!mail.html.includes("evil"));
  }
  // Render terminates TLS: the app sees an internal HTTP URL and the public host in headers.
  const internalUrl = "http://localhost:3000/api/quiz/email";
  for (const host of ["theclearcfo.com", "www.theclearcfo.com", "clearcfo.onrender.com"]) {
    const before = sent.length;
    const response = await POST(request({ email: `proxy-${before}@example.com`, answers }, {
      origin: `https://${host}`, "x-forwarded-host": host, host: "localhost:3000",
    }, internalUrl));
    assert.equal(response.status, 200, `public ${host} must work through the internal HTTP URL`);
    assert.equal(sent.length, before + 1, "same-host proxy request reaches Resend");
  }
  assert.equal((await POST(request({ email: "host-fallback@example.com", answers }, {
    origin: "https://theclearcfo.com", host: "theclearcfo.com",
  }, internalUrl))).status, 200, "Host is used when X-Forwarded-Host is absent");
  for (const headers of [
    { origin: "https://evil.example", "x-forwarded-host": "theclearcfo.com", host: "localhost:3000" },
    { origin: "https://theclearcfo.com", "x-forwarded-host": "evil.example", host: "theclearcfo.com" },
    { origin: "https://evil.example", host: "theclearcfo.com" },
    { origin: "not a URL", "x-forwarded-host": "theclearcfo.com" },
    { origin: "null", "x-forwarded-host": "theclearcfo.com" },
    { origin: "", "x-forwarded-host": "theclearcfo.com" },
    { origin: "https://theclearcfo.com" },
  ]) {
    const before = sent.length;
    const response = await POST(request({ email: "rejected@example.com", answers }, headers, internalUrl));
    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "Please send your breakdown from the quiz page." });
    assert.equal(sent.length, before, "invalid/mismatched origin must not send email");
  }
  console.log("PASS: internal HTTP proxy URL, all public hosts, Host fallback, forwarded-host precedence, invalid/cross-site origins");
  globalThis.fetch = async () => new Response("unavailable", { status: 503 });
  assert.equal((await POST(request({ email: "failure@example.com", answers }))).status, 503);
  assert.equal((await POST(request({ email: "proxy-failure@example.com", answers }, {
    origin: "https://theclearcfo.com", "x-forwarded-host": "theclearcfo.com", host: "localhost:3000",
  }, internalUrl))).status, 503, "valid proxied request reaches provider-failure handling");
  for (let i = 0; i < 2; i++) await POST(request({ email: "limited@example.com", answers }));
  assert.equal((await POST(request({ email: "LIMITED@example.com", answers }))).status, 429);
  for (let i = 0; i < 5; i++) await POST(request({}, { "x-forwarded-for": `spoof-${i},trusted-proxy-ip` }));
  assert.equal((await POST(request({}, { "x-forwarded-for": "different-spoof,trusted-proxy-ip" }))).status, 429);
  console.log("PASS: real email handler validation, payload bounds, origin, server scoring, all bands, provider failures, recipient/IP limits");
} finally {
  globalThis.fetch = originalFetch;
  fs.rmSync(dir, { recursive: true, force: true });
}
