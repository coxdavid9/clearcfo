import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const packageJson = JSON.parse(read("package.json"));
const proxy = read("proxy.ts");
const refreshRoute = read("src/app/api/auth/refresh/route.ts");
const aiRoute = read("src/app/api/cfo-analysis/route.ts");
const profileRoute = read("src/app/api/customer/profile/route.ts");
const quickBooks = read("src/lib/quickbooks-company.ts");
const envExample = read(".env.example");

assert(packageJson.dependencies.next === "16.3.4", "Next.js security baseline is not pinned to 16.3.4.");
assert(
  packageJson.dependencies.xlsx === "https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz",
  "SheetJS security baseline is not pinned to 0.20.3."
);
assert(packageJson.overrides?.nanoid === "3.3.18", "nanoid security override is missing.");
assert(packageJson.overrides?.["js-yaml"] === "4.3.2", "js-yaml security override is missing.");

assert(proxy.includes("SUPABASE_PUBLISHABLE_KEY"), "Auth proxy must use SUPABASE_PUBLISHABLE_KEY.");
assert(!proxy.includes("SUPABASE_ANON_KEY"), "Auth proxy must not depend on the retired SUPABASE_ANON_KEY name.");
assert(proxy.includes("X-Content-Type-Options"), "Security headers must include X-Content-Type-Options.");
assert(proxy.includes("X-Frame-Options"), "Security headers must include X-Frame-Options.");
assert(proxy.includes("Strict-Transport-Security"), "Production responses must set HSTS.");
assert(proxy.includes("refreshRedirect"), "Expired customer sessions must be refreshable without forcing a login.");

assert(refreshRoute.includes("safeNextPath"), "Auth refresh must validate the redirect target.");
assert(refreshRoute.includes('value.startsWith("//")'), "Auth refresh must reject protocol-relative open redirects.");

assert(aiRoute.includes("MAX_REQUEST_BYTES = 250 * 1024"), "AI route must enforce a request-size limit.");
assert(aiRoute.includes("store: false"), "OpenAI requests must explicitly disable response storage.");
assert(!aiRoute.includes("console.log(rawBody"), "AI route must never log the incoming financial payload.");

assert(profileRoute.includes("MAX_REQUEST_BYTES = 16 * 1024"), "Profile endpoint must enforce a request-size limit.");
assert(profileRoute.includes('"Cache-Control": "no-store"'), "Profile responses must not be cached.");

assert(quickBooks.includes('createCipheriv("aes-256-gcm"'), "QuickBooks tokens must use authenticated encryption at rest.");
assert(quickBooks.includes('cache: "no-store"'), "QuickBooks API data must not be cached by fetch.");
assert(quickBooks.includes("timingSafeEqual"), "QuickBooks OAuth state signatures must use timing-safe comparison.");

assert(envExample.includes("OPENAI_API_KEY="), "Environment documentation must define the server-side OpenAI key.");
assert(!envExample.includes("NEXT_PUBLIC_OPENAI_API_KEY"), "OpenAI secrets must never be documented as public environment variables.");

console.log("PASS  Dependency security baselines");
console.log("PASS  Authentication proxy and security headers");
console.log("PASS  Session refresh and redirect safety");
console.log("PASS  AI request/privacy safeguards");
console.log("PASS  Customer profile request safeguards");
console.log("PASS  QuickBooks credential protections");
console.log("PASS  Environment secret handling");
console.log("\nAll security regression checks passed.");
