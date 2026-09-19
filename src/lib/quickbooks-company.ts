import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getAuthCookieNames, getSupabaseUser } from "./supabase-auth";
import { getActiveCompany } from "./company";

const QB_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QB_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QB_REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";
// Default to sandbox unless production is explicitly requested: an unset
// QUICKBOOKS_ENVIRONMENT must never silently target the production API.
const QB_API_BASE = process.env.QUICKBOOKS_ENVIRONMENT === "production"
  ? "https://quickbooks.api.intuit.com"
  : "https://sandbox-quickbooks.api.intuit.com";
const STATE_COOKIE = "clearcfo_qb_oauth_state";
const STATE_MAX_AGE = 10 * 60;
const APP_URL = process.env.NODE_ENV === "production"
  ? "https://theclearcfo.com"
  : (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");

type Tokens = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  x_refresh_token_expires_in?: number;
};

type StoredConnection = {
  id: string;
  company_id: string;
  user_id: string;
  realm_id: string;
  company_name: string | null;
  access_token_encrypted: string;
  refresh_token_encrypted: string;
  access_token_expires_at: string;
  refresh_token_expires_at: string | null;
  created_at: string;
};

function config() {
  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const clientSecret = process.env.QUICKBOOKS_CLIENT_SECRET;
  const configuredRedirectUri = process.env.QUICKBOOKS_REDIRECT_URI;
  const redirectUri = process.env.NODE_ENV === "production"
    ? `${APP_URL}/api/quickbooks/callback`
    : configuredRedirectUri;
  const encryptionKey = process.env.QUICKBOOKS_TOKEN_ENCRYPTION_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const missing = [
    ["QUICKBOOKS_CLIENT_ID", clientId],
    ["QUICKBOOKS_CLIENT_SECRET", clientSecret],
    ["QUICKBOOKS_REDIRECT_URI", redirectUri],
    ["QUICKBOOKS_TOKEN_ENCRYPTION_KEY", encryptionKey],
    ["SUPABASE_URL", supabaseUrl],
    ["SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey],
  ].filter(([, value]) => !value).map(([name]) => name);
  if (missing.length) throw new Error(`QuickBooks is not configured. Missing environment variables: ${missing.join(", ")}`);
  const key = Buffer.from(encryptionKey!, "base64");
  if (key.length !== 32) throw new Error("QUICKBOOKS_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  return { clientId: clientId!, clientSecret: clientSecret!, redirectUri: redirectUri!, key, supabaseUrl: supabaseUrl!.replace(/\/$/, ""), serviceRoleKey: serviceRoleKey! };
}

async function supabaseRequest(path: string, init: RequestInit = {}) {
  const { supabaseUrl, serviceRoleKey } = config();
  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json", ...(init.headers || {}) },
    cache: "no-store",
  });
}

function encrypt(value: string) {
  const { key } = config();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ciphertext.toString("base64url")].join(".");
}

function decrypt(value: string) {
  const { key } = config();
  const [ivText, tagText, ciphertextText] = value.split(".");
  if (!ivText || !tagText || !ciphertextText) throw new Error("Invalid encrypted QuickBooks credential.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64url")), decipher.final()]).toString("utf8");
}

function authHeader(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

// --- Sync reliability: bounded retries, timeouts, serialized refresh ------
const QB_REQUEST_TIMEOUT_MS = 25_000;
const QB_REPORT_MAX_ATTEMPTS = 3;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(attempt: number, response: Response | null): number {
  const retryAfter = response?.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) return Math.min(seconds * 1000, 30_000);
  }
  return Math.min(1000 * 2 ** attempt, 8000);
}

function isRetryableStatus(status: number) {
  return status === 429 || status >= 500;
}

async function intuitFetch(url: string, init: RequestInit, attempts = QB_REPORT_MAX_ATTEMPTS): Promise<Response> {
  let lastError: unknown = null;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      const response = await fetch(url, { ...init, signal: AbortSignal.timeout(QB_REQUEST_TIMEOUT_MS), cache: "no-store" });
      if (!isRetryableStatus(response.status) || attempt === attempts - 1) return response;
      lastError = new Error(`QuickBooks request failed (${response.status}).`);
      await response.arrayBuffer().catch(() => null);
      await sleep(retryDelayMs(attempt, response));
    } catch (error) {
      lastError = error;
      if (attempt === attempts - 1) throw error;
      await sleep(retryDelayMs(attempt, null));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("QuickBooks request failed.");
}

const inflightRefreshes = new Map<string, Promise<Tokens>>();

async function refreshTokens(connection: StoredConnection): Promise<Tokens> {
  const existing = inflightRefreshes.get(connection.id);
  if (existing) return existing;
  const pending = (async () => {
    const { clientId, clientSecret } = config();
    const response = await intuitFetch(QB_TOKEN_URL, {
      method: "POST",
      headers: { Authorization: authHeader(clientId, clientSecret), "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: decrypt(connection.refresh_token_encrypted) }).toString(),
    }, 1);
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error_description || "QuickBooks session expired. Please reconnect QuickBooks.");
    const tokens = payload as Tokens;
    await updateTokens(connection.id, tokens);
    return tokens;
  })();
  inflightRefreshes.set(connection.id, pending);
  try {
    return await pending;
  } finally {
    inflightRefreshes.delete(connection.id);
  }
}

function signState(value: string) {
  return crypto.createHmac("sha256", config().key).update(value).digest("base64url");
}

function verifyState(value: string) {
  const separator = value.lastIndexOf(".");
  if (separator <= 0) return null;
  const payload = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  const expected = signState(payload);
  const provided = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (provided.length !== expectedBuffer.length || !crypto.timingSafeEqual(provided, expectedBuffer)) return null;
  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!decoded.userId || !decoded.companyId || !decoded.exp || decoded.exp < Date.now()) return null;
    return decoded as { userId: string; companyId: string; exp: number; nonce?: string };
  } catch {
    return null;
  }
}

async function getCurrentUser() {
  const cookieStore = await cookies();
  const { AUTH_COOKIE } = getAuthCookieNames();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  return token ? getSupabaseUser(token) : null;
}

async function exchangeCode(code: string): Promise<Tokens> {
  const { clientId, clientSecret, redirectUri } = config();
  const response = await intuitFetch(QB_TOKEN_URL, {
    method: "POST",
    headers: { Authorization: authHeader(clientId, clientSecret), "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }).toString(),
  }, 1);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error_description || payload?.error || "QuickBooks authorization failed.");
  return payload as Tokens;
}

async function getCompanyInfo(realmId: string, accessToken: string) {
  try {
    const response = await intuitFetch(`${QB_API_BASE}/v3/company/${encodeURIComponent(realmId)}/companyinfo/${encodeURIComponent(realmId)}`, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    }, 1);
    if (!response.ok) return null;
    const payload = await response.json().catch(() => null);
    return payload?.CompanyInfo?.CompanyName || null;
  } catch {
    return null;
  }
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  return user;
}

export async function createQuickBooksConnectUrl(userId: string) {
  config();
  const company = await getActiveCompany(userId);
  if (!company) throw new Error("Create a business before connecting QuickBooks.");
  const payload = Buffer.from(JSON.stringify({ userId, companyId: company.id, exp: Date.now() + STATE_MAX_AGE * 1000, nonce: crypto.randomBytes(16).toString("base64url") })).toString("base64url");
  const state = `${payload}.${signState(payload)}`;
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: STATE_MAX_AGE });
  return `${QB_AUTH_URL}?${new URLSearchParams({ client_id: config().clientId, response_type: "code", scope: "com.intuit.quickbooks.accounting", redirect_uri: config().redirectUri, state }).toString()}`;
}

export async function completeQuickBooksCallback(code: string, realmId: string, state: string) {
  const verified = verifyState(state);
  if (!verified) throw new Error("QuickBooks authorization state is invalid or expired.");
  const user = await getCurrentUser();
  if (!user || user.id !== verified.userId) throw new Error("Your ClearCFO session is no longer valid.");
  const activeCompany = await getActiveCompany(user.id);
  if (!activeCompany || activeCompany.id !== verified.companyId) throw new Error("The selected ClearCFO business is no longer available.");

  const cookieStore = await cookies();
  cookieStore.delete(STATE_COOKIE);
  const tokens = await exchangeCode(code);
  const companyName = await getCompanyInfo(realmId, tokens.access_token);
  const now = Date.now();
  const row = {
    company_id: activeCompany.id,
    user_id: user.id,
    realm_id: realmId,
    company_name: companyName || activeCompany.name,
    access_token_encrypted: encrypt(tokens.access_token),
    refresh_token_encrypted: encrypt(tokens.refresh_token),
    access_token_expires_at: new Date(now + Number(tokens.expires_in || 3600) * 1000).toISOString(),
    refresh_token_expires_at: tokens.x_refresh_token_expires_in ? new Date(now + Number(tokens.x_refresh_token_expires_in) * 1000).toISOString() : null,
  };
  const response = await supabaseRequest("quickbooks_connections?on_conflict=company_id", {
    method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(row),
  });
  if (!response.ok) throw new Error(`Could not save QuickBooks connection (${response.status}).`);
  return { companyName: companyName || activeCompany.name, companyId: activeCompany.id };
}

export async function getConnectionForCompany(companyId: string): Promise<StoredConnection | null> {
  const response = await supabaseRequest(`quickbooks_connections?company_id=eq.${encodeURIComponent(companyId)}&select=*&limit=1`);
  if (!response.ok) throw new Error(`Could not read QuickBooks connection (${response.status}).`);
  const rows = await response.json() as StoredConnection[];
  return rows[0] || null;
}

async function getConnection(userId: string): Promise<StoredConnection | null> {
  const company = await getActiveCompany(userId);
  if (!company) return null;
  return getConnectionForCompany(company.id);
}

async function updateTokens(id: string, tokens: Tokens) {
  const now = Date.now();
  const response = await supabaseRequest(`quickbooks_connections?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({
      access_token_encrypted: encrypt(tokens.access_token), refresh_token_encrypted: encrypt(tokens.refresh_token),
      access_token_expires_at: new Date(now + Number(tokens.expires_in || 3600) * 1000).toISOString(),
      refresh_token_expires_at: tokens.x_refresh_token_expires_in ? new Date(now + Number(tokens.x_refresh_token_expires_in) * 1000).toISOString() : null,
    }),
  });
  if (!response.ok) throw new Error(`Could not update QuickBooks token (${response.status}).`);
}

async function accessTokenForConnection(connection: StoredConnection, forceRefresh = false) {
  if (!forceRefresh && new Date(connection.access_token_expires_at).getTime() > Date.now() + 60_000) {
    return { accessToken: decrypt(connection.access_token_encrypted) };
  }
  const tokens = await refreshTokens(connection);
  return { accessToken: tokens.access_token };
}

export async function getQuickBooksConnection(userId: string) {
  const connection = await getConnection(userId);
  if (!connection) return null;
  return { connected: true, companyName: connection.company_name, realmId: connection.realm_id, connectedAt: connection.created_at, companyId: connection.company_id };
}

export async function disconnectQuickBooks(userId: string) {
  const connection = await getConnection(userId);
  if (!connection) return;
  try { await revokeIntuitTokens(decrypt(connection.refresh_token_encrypted)); } catch (error) { console.error("[ClearCFO QuickBooks] Token revocation skipped:", error instanceof Error ? error.message : "Unknown error"); }
  const response = await supabaseRequest(`quickbooks_connections?company_id=eq.${encodeURIComponent(connection.company_id)}`, { method: "DELETE" });
  if (!response.ok) throw new Error(`Could not disconnect QuickBooks (${response.status}).`);
}

async function revokeIntuitTokens(refreshToken: string) {
  const { clientId, clientSecret } = config();
  const response = await intuitFetch(QB_REVOKE_URL, {
    method: "POST", headers: { Authorization: authHeader(clientId, clientSecret), "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams({ token: refreshToken }).toString(),
  }, 1);
  if (!response.ok) console.error(`[ClearCFO QuickBooks] Token revocation failed (${response.status}).`);
}

export async function quickBooksReportForCompany(companyId: string, reportName: string, params: Record<string, string>) {
  if (!/^[A-Za-z]+$/.test(reportName)) throw new Error("Invalid QuickBooks report.");
  const connection = await getConnectionForCompany(companyId);
  if (!connection) throw new Error("QuickBooks is not connected for the selected business.");
  const search = new URLSearchParams(params);
  const url = `${QB_API_BASE}/v3/company/${encodeURIComponent(connection.realm_id)}/reports/${reportName}?${search.toString()}`;
  const readReport = async (accessToken: string) => {
    const response = await intuitFetch(url, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok && response.status !== 401) throw new Error(payload?.Fault?.Error?.[0]?.Message || `QuickBooks ${reportName} report failed.`);
    return { response, payload };
  };
  const { accessToken } = await accessTokenForConnection(connection);
  let { response, payload } = await readReport(accessToken);
  if (response.status === 401) {
    const refreshed = await accessTokenForConnection(connection, true);
    ({ response, payload } = await readReport(refreshed.accessToken));
  }
  if (!response.ok) throw new Error(payload?.Fault?.Error?.[0]?.Message || `QuickBooks ${reportName} report failed.`);
  return payload;
}

export async function quickBooksReport(userId: string, reportName: string, params: Record<string, string>) {
  const company = await getActiveCompany(userId);
  if (!company) throw new Error("QuickBooks is not connected for the selected business.");
  return quickBooksReportForCompany(company.id, reportName, params);
}
