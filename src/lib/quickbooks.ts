import crypto from "node:crypto";
import { cookies } from "next/headers";
import { getAuthCookieNames, getSupabaseUser } from "./supabase-auth";

const QB_AUTH_URL = "https://appcenter.intuit.com/connect/oauth2";
const QB_TOKEN_URL = "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer";
const QB_REVOKE_URL = "https://developer.api.intuit.com/v2/oauth2/tokens/revoke";
const QB_API_BASE = process.env.QUICKBOOKS_ENVIRONMENT === "sandbox"
  ? "https://sandbox-quickbooks.api.intuit.com"
  : "https://quickbooks.api.intuit.com";
const STATE_COOKIE = "clearcfo_qb_oauth_state";
const STATE_MAX_AGE = 10 * 60;
const APP_URL = process.env.NODE_ENV === "production"
  ? "https://theclearcfo.com"
  : (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000");

 type StoredConnection = {
  id: string;
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
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name);

  if (missing.length) {
    throw new Error(`QuickBooks is not configured. Missing environment variables: ${missing.join(", ")}`);
  }

  const key = Buffer.from(encryptionKey!, "base64");
  if (key.length !== 32) {
    throw new Error("QUICKBOOKS_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.");
  }

  return {
    clientId: clientId!,
    clientSecret: clientSecret!,
    redirectUri: redirectUri!,
    key,
    supabaseUrl: supabaseUrl!.replace(/\/$/, ""),
    serviceRoleKey: serviceRoleKey!,
  };
}

function authHeader(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

function encrypt(value: string) {
  const { key } = config();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

function decrypt(value: string) {
  const { key } = config();
  const [ivText, tagText, ciphertextText] = value.split(".");
  if (!ivText || !tagText || !ciphertextText) throw new Error("Invalid encrypted QuickBooks credential.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64url")), decipher.final()]).toString("utf8");
}

function signState(value: string) {
  const { key } = config();
  return crypto.createHmac("sha256", key).update(value).digest("base64url");
}

function verifyState(value: string) {
  const separator = value.lastIndexOf(".");
  if (separator <= 0) return null;

  const payload = value.slice(0, separator);
  const signature = value.slice(separator + 1);
  if (!signature) return null;

  const expected = signState(payload);
  const providedBuffer = Buffer.from(signature, "utf8");
  const expectedBuffer = Buffer.from(expected, "utf8");
  if (providedBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(providedBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (!decoded.userId || !decoded.exp || decoded.exp < Date.now()) return null;
    return decoded as { userId: string; exp: number; nonce?: string };
  } catch {
    return null;
  }
}

async function getCurrentUser() {
  const cookieStore = await cookies();
  const { AUTH_COOKIE } = getAuthCookieNames();
  const accessToken = cookieStore.get(AUTH_COOKIE)?.value;
  if (!accessToken) return null;
  return getSupabaseUser(accessToken);
}

async function supabaseRequest(path: string, init: RequestInit = {}) {
  const { supabaseUrl, serviceRoleKey } = config();
  return fetch(`${supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
}

export async function requireCurrentUser() {
  const user = await getCurrentUser();
  return user;
}

export async function createQuickBooksConnectUrl(userId: string) {
  config();
  const payload = Buffer.from(JSON.stringify({
    userId,
    exp: Date.now() + STATE_MAX_AGE * 1000,
    nonce: crypto.randomBytes(16).toString("base64url"),
  })).toString("base64url");
  const state = `${payload}.${signState(payload)}`;
  const cookieStore = await cookies();
  cookieStore.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: STATE_MAX_AGE,
  });

  const params = new URLSearchParams({
    client_id: config().clientId,
    response_type: "code",
    scope: "com.intuit.quickbooks.accounting",
    redirect_uri: config().redirectUri,
    state,
  });

  return `${QB_AUTH_URL}?${params.toString()}`;
}

async function exchangeCode(code: string) {
  const { clientId, clientSecret, redirectUri } = config();
  const response = await fetch(QB_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: authHeader(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri }).toString(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error_description || payload?.error || "QuickBooks authorization failed.");
  return payload as { access_token: string; refresh_token: string; expires_in: number; x_refresh_token_expires_in?: number };
}

async function getCompanyInfo(realmId: string, accessToken: string) {
  const response = await fetch(`${QB_API_BASE}/v3/company/${encodeURIComponent(realmId)}/companyinfo/${encodeURIComponent(realmId)}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  return payload?.CompanyInfo?.CompanyName || null;
}

export async function getQuickBooksCompanyStartDate(userId: string): Promise<string | null> {
  const connection = await getConnection(userId);
  if (!connection) return null;
  const { accessToken } = await accessTokenForConnection(connection);
  const response = await fetch(
    `${QB_API_BASE}/v3/company/${encodeURIComponent(connection.realm_id)}/companyinfo/${encodeURIComponent(connection.realm_id)}`,
    {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
      cache: "no-store",
    }
  );
  if (!response.ok) return null;
  const payload = await response.json().catch(() => null);
  // CompanyStartDate looks like "2020-01-01".
  return payload?.CompanyInfo?.CompanyStartDate || null;
}

export async function saveQuickBooksConnection(userId: string, realmId: string, tokens: Awaited<ReturnType<typeof exchangeCode>>) {
  const companyName = await getCompanyInfo(realmId, tokens.access_token);
  const now = Date.now();
  const row = {
    user_id: userId,
    realm_id: realmId,
    company_name: companyName,
    access_token_encrypted: encrypt(tokens.access_token),
    refresh_token_encrypted: encrypt(tokens.refresh_token),
    access_token_expires_at: new Date(now + Number(tokens.expires_in || 3600) * 1000).toISOString(),
    refresh_token_expires_at: tokens.x_refresh_token_expires_in
      ? new Date(now + Number(tokens.x_refresh_token_expires_in) * 1000).toISOString()
      : null,
  };

  const response = await supabaseRequest("quickbooks_connections?on_conflict=user_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(row),
  });
  if (!response.ok) throw new Error(`Could not save QuickBooks connection (${response.status}).`);
  return { companyName };
}

export async function completeQuickBooksCallback(code: string, realmId: string, state: string) {
  // The signed state contains the authenticated user's ID and expiration, so it
  // can safely bind the OAuth response to the initiating user without depending
  // on the browser preserving the OAuth cookie across the Intuit redirect.
  const verified = verifyState(state);
  if (!verified) throw new Error("QuickBooks authorization state is invalid or expired.");

  const user = await getCurrentUser();
  if (!user || user.id !== verified.userId) throw new Error("Your ClearCFO session is no longer valid.");

  const cookieStore = await cookies();
  cookieStore.delete(STATE_COOKIE);

  const tokens = await exchangeCode(code);
  return saveQuickBooksConnection(user.id, realmId, tokens);
}

async function getConnection(userId: string): Promise<StoredConnection | null> {
  const response = await supabaseRequest(`quickbooks_connections?user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`);
  if (!response.ok) throw new Error(`Could not read QuickBooks connection (${response.status}).`);
  const rows = await response.json() as StoredConnection[];
  return rows[0] || null;
}

async function updateTokens(id: string, tokens: Awaited<ReturnType<typeof exchangeCode>>) {
  const now = Date.now();
  const response = await supabaseRequest(`quickbooks_connections?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({
      access_token_encrypted: encrypt(tokens.access_token),
      refresh_token_encrypted: encrypt(tokens.refresh_token),
      access_token_expires_at: new Date(now + Number(tokens.expires_in || 3600) * 1000).toISOString(),
      refresh_token_expires_at: tokens.x_refresh_token_expires_in
        ? new Date(now + Number(tokens.x_refresh_token_expires_in) * 1000).toISOString()
        : null,
    }),
  });
  if (!response.ok) throw new Error(`Could not update QuickBooks token (${response.status}).`);
}

async function accessTokenForConnection(connection: StoredConnection) {
  if (new Date(connection.access_token_expires_at).getTime() > Date.now() + 60_000) {
    return { connection, accessToken: decrypt(connection.access_token_encrypted) };
  }

  const { clientId, clientSecret } = config();
  const response = await fetch(QB_TOKEN_URL, {
    method: "POST",
    headers: {
      Authorization: authHeader(clientId, clientSecret),
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: decrypt(connection.refresh_token_encrypted) }).toString(),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.error_description || "QuickBooks session expired. Please reconnect QuickBooks.");
  const tokens = payload as Awaited<ReturnType<typeof exchangeCode>>;
  await updateTokens(connection.id, tokens);
  return { connection, accessToken: tokens.access_token };
}

export async function getQuickBooksConnection(userId: string) {
  const connection = await getConnection(userId);
  if (!connection) return null;
  return {
    connected: true,
    companyName: connection.company_name,
    realmId: connection.realm_id,
    connectedAt: connection.created_at,
  };
}

export async function disconnectQuickBooks(userId: string) {
  try {
    const connection = await getConnection(userId);
    if (connection) {
      await revokeIntuitTokens(decrypt(connection.refresh_token_encrypted));
    }
  } catch (error) {
    console.error(
      "[ClearCFO QuickBooks] Pre-disconnect revocation skipped:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }

  const response = await supabaseRequest(`quickbooks_connections?user_id=eq.${encodeURIComponent(userId)}`, { method: "DELETE" });
  if (!response.ok) throw new Error(`Could not disconnect QuickBooks (${response.status}).`);
}

async function revokeIntuitTokens(refreshToken: string): Promise<void> {
  try {
    const { clientId, clientSecret } = config();
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const response = await fetch(QB_REVOKE_URL, {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams({ token: refreshToken }).toString(),
    });
    if (!response.ok) {
      console.error(`[ClearCFO QuickBooks] Token revocation failed (${response.status}).`);
    }
  } catch (error) {
    console.error(
      "[ClearCFO QuickBooks] Token revocation error:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

export async function quickBooksReport(userId: string, reportName: string, params: Record<string, string>) {
  if (!/^[A-Za-z]+$/.test(reportName)) throw new Error("Invalid QuickBooks report.");
  const connection = await getConnection(userId);
  if (!connection) throw new Error("QuickBooks is not connected.");
  const { accessToken } = await accessTokenForConnection(connection);
  const search = new URLSearchParams(params);
  const response = await fetch(`${QB_API_BASE}/v3/company/${encodeURIComponent(connection.realm_id)}/reports/${reportName}?${search.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json" },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload?.Fault?.Error?.[0]?.Message || `QuickBooks ${reportName} report failed.`);
  return payload;
}
