const AUTH_COOKIE = "clearcfo_access_token";
const REFRESH_COOKIE = "clearcfo_refresh_token";

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("Supabase authentication is not configured.");
  }

  return { url: url.replace(/\/$/, ""), publishableKey };
}

export function getAuthCookieNames() {
  return { AUTH_COOKIE, REFRESH_COOKIE };
}

export async function getSupabaseUser(accessToken: string) {
  const { url, publishableKey } = getSupabaseConfig();

  const response = await fetch(`${url}/auth/v1/user`, {
    method: "GET",
    headers: {
      apikey: publishableKey,
      Authorization: `Bearer ${accessToken}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    return null;
  }

  return response.json();
}

export async function signInWithPassword(email: string, password: string) {
  const { url, publishableKey } = getSupabaseConfig();

  const response = await fetch(
    `${url}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    }
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { ok: false as const, error: payload?.msg || payload?.message || payload?.error_description || "Unable to sign in." };
  }

  return {
    ok: true as const,
    accessToken: payload.access_token as string,
    refreshToken: payload.refresh_token as string,
    expiresIn: Number(payload.expires_in || 3600),
    user: payload.user,
  };
}

export async function signUpWithPassword(email: string, password: string) {
  const { url, publishableKey } = getSupabaseConfig();

  const response = await fetch(`${url}/auth/v1/signup`, {
    method: "POST",
    headers: {
      apikey: publishableKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { ok: false as const, error: payload?.msg || payload?.message || payload?.error_description || "Unable to create the account." };
  }

  return {
    ok: true as const,
    accessToken: payload.access_token as string | undefined,
    refreshToken: payload.refresh_token as string | undefined,
    expiresIn: Number(payload.expires_in || 3600),
    user: payload.user,
  };
}

export async function refreshSession(refreshToken: string) {
  const { url, publishableKey } = getSupabaseConfig();

  const response = await fetch(
    `${url}/auth/v1/token?grant_type=refresh_token`,
    {
      method: "POST",
      headers: {
        apikey: publishableKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    }
  );

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { ok: false as const, error: payload?.msg || payload?.message || "Unable to refresh the session." };
  }

  return {
    ok: true as const,
    accessToken: payload.access_token as string,
    refreshToken: (payload.refresh_token || refreshToken) as string,
    expiresIn: Number(payload.expires_in || 3600),
    user: payload.user,
  };
}
