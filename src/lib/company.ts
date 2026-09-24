import { cookies } from "next/headers";
import { getAuthCookieNames, getSupabaseUser } from "./supabase-auth";
import { BUSINESS_LIMIT, getSubscription, hasAccess } from "./billing/entitlements";

const ACTIVE_COMPANY_COOKIE = "clearcfo_active_company_id";

type Company = {
  id: string;
  name: string;
  industry: string | null;
  company_size: string | null;
  contact_phone: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

type Membership = {
  id: string;
  company_id: string;
  user_id: string;
  role: "owner" | "admin" | "member" | "accountant";
  created_at: string;
  company: Company;
};

function config() {
  const url = process.env.SUPABASE_URL?.replace(/\/$/, "");
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) throw new Error("Supabase server configuration is missing.");
  return { url, serviceRoleKey };
}

async function supabaseRequest(path: string, init: RequestInit = {}) {
  const { url, serviceRoleKey } = config();
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}`, "Content-Type": "application/json", ...(init.headers || {}) },
    cache: "no-store",
  });
}

async function currentUser() {
  const cookieStore = await cookies();
  const { AUTH_COOKIE } = getAuthCookieNames();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  return getSupabaseUser(token);
}

async function currentUserId() {
  const user = await currentUser();
  return user?.id || null;
}

export async function requireCurrentCompanyUser() {
  const userId = await currentUserId();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

export async function listUserCompanies(userId: string): Promise<Membership[]> {
  const response = await supabaseRequest(
    `company_memberships?user_id=eq.${encodeURIComponent(userId)}&select=id,company_id,user_id,role,created_at,company:companies(*)&order=created_at.asc`
  );
  if (!response.ok) throw new Error(`Could not read companies (${response.status}).`);
  return await response.json() as Membership[];
}

async function createInitialCompany(userId: string) {
  const user = await currentUser();
  const metadata = user?.user_metadata || {};
  const response = await supabaseRequest("companies", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      name: typeof metadata.companyName === "string" && metadata.companyName.trim() ? metadata.companyName.trim().slice(0, 200) : "My Business",
      industry: typeof metadata.industry === "string" && metadata.industry.trim() ? metadata.industry.trim().slice(0, 200) : null,
      company_size: typeof metadata.companySize === "string" && metadata.companySize.trim() ? metadata.companySize.trim().slice(0, 200) : null,
      contact_phone: typeof metadata.contactPhone === "string" && metadata.contactPhone.trim() ? metadata.contactPhone.trim().slice(0, 200) : null,
      created_by: userId,
    }),
  });
  if (!response.ok) throw new Error(`Could not create initial business (${response.status}).`);
  const companies = await response.json() as Company[];
  const company = companies[0];
  if (!company) throw new Error("Initial business was not created.");

  const membershipResponse = await supabaseRequest("company_memberships", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ company_id: company.id, user_id: userId, role: "owner" }),
  });
  if (!membershipResponse.ok) throw new Error(`Could not create initial business membership (${membershipResponse.status}).`);
  return company;
}

export async function getActiveCompany(userId: string): Promise<Company | null> {
  let memberships = await listUserCompanies(userId);
  if (!memberships.length) {
    const company = await createInitialCompany(userId);
    memberships = await listUserCompanies(userId);
    if (!memberships.length) return company;
  }

  const cookieStore = await cookies();
  const requestedId = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value;
  const active = memberships.find((membership) => membership.company_id === requestedId) || memberships[0];

  if (requestedId !== active.company_id) {
    cookieStore.set(ACTIVE_COMPANY_COOKIE, active.company_id, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }

  return active.company;
}

export async function setActiveCompany(userId: string, companyId: string) {
  const response = await supabaseRequest(
    `company_memberships?user_id=eq.${encodeURIComponent(userId)}&company_id=eq.${encodeURIComponent(companyId)}&select=company_id&limit=1`
  );
  if (!response.ok) throw new Error(`Could not verify company membership (${response.status}).`);
  const rows = await response.json() as Array<{ company_id: string }>;
  if (!rows.length) throw new Error("You do not have access to that business.");

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
}

export async function createCompany(userId: string, input: { name: string; industry?: string; companySize?: string; contactPhone?: string }) {
  const subscription = await getSubscription(userId);
  if (!hasAccess(subscription)) throw new Error("upgrade_required: Your trial or subscription is not active. Subscribe to continue.");
  const memberships = await listUserCompanies(userId);
  const limit = BUSINESS_LIMIT[subscription!.plan];
  if (memberships.length >= limit) throw new Error(subscription!.plan === "core" ? "upgrade_required: Core includes 1 business — upgrade to Pro for up to 5." : "upgrade_required: Pro includes up to 5 businesses.");
  const name = input.name.trim().slice(0, 200);
  if (!name) throw new Error("Business name is required.");

  const createResponse = await supabaseRequest("companies", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ name, industry: input.industry?.trim().slice(0, 200) || null, company_size: input.companySize?.trim().slice(0, 200) || null, contact_phone: input.contactPhone?.trim().slice(0, 200) || null, created_by: userId }),
  });
  if (!createResponse.ok) throw new Error(`Could not create business (${createResponse.status}).`);
  const companies = await createResponse.json() as Company[];
  const company = companies[0];
  if (!company) throw new Error("Business was not created.");

  const membershipResponse = await supabaseRequest("company_memberships", {
    method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ company_id: company.id, user_id: userId, role: "owner" }),
  });
  if (!membershipResponse.ok) throw new Error(`Could not create business membership (${membershipResponse.status}).`);
  await setActiveCompany(userId, company.id);
  return company;
}

export async function updateCompany(userId: string, companyId: string, input: { name?: string }) {
  const memberships = await listUserCompanies(userId);
  const membership = memberships.find((item) => item.company_id === companyId);
  if (!membership) throw new Error("Business not found.");
  if (membership.role !== "owner" && membership.role !== "admin") throw new Error("Only owners and admins can rename a business.");

  const name = input.name?.trim().slice(0, 200);
  if (name !== undefined && !name) throw new Error("Business name is required.");
  if (name === undefined) throw new Error("Nothing to update.");

  const response = await supabaseRequest(`companies?id=eq.${encodeURIComponent(companyId)}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({ name }),
  });
  if (!response.ok) throw new Error(`Could not rename business (${response.status}).`);
  const companies = await response.json() as Company[];
  const company = companies[0];
  if (!company) throw new Error("Business was not updated.");
  return company;
}

export async function deleteCompany(userId: string, companyId: string) {
  const memberships = await listUserCompanies(userId);
  const membership = memberships.find((item) => item.company_id === companyId);
  if (!membership) throw new Error("Business not found.");
  if (membership.role !== "owner") throw new Error("Only the business owner can delete a business.");
  if (memberships.length <= 1) throw new Error("You can't delete your only business.");

  const scopedTables = [
    "alert_history",
    "alert_rules",
    "notification_preferences",
    "quickbooks_connections",
    "synced_briefings",
  ];
  for (const table of scopedTables) {
    const response = await supabaseRequest(`${table}?company_id=eq.${encodeURIComponent(companyId)}`, {
      method: "DELETE",
    });
    if (!response.ok) throw new Error(`Could not delete business data (${response.status}).`);
  }
  const membershipResponse = await supabaseRequest(`company_memberships?company_id=eq.${encodeURIComponent(companyId)}`, {
    method: "DELETE",
  });
  if (!membershipResponse.ok) throw new Error(`Could not delete business memberships (${membershipResponse.status}).`);
  const companyResponse = await supabaseRequest(`companies?id=eq.${encodeURIComponent(companyId)}`, {
    method: "DELETE",
  });
  if (!companyResponse.ok) throw new Error(`Could not delete business (${companyResponse.status}).`);

  const cookieStore = await cookies();
  const requestedId = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value;
  const next = memberships.find((item) => item.company_id !== companyId);
  if (requestedId === companyId && next) {
    cookieStore.set(ACTIVE_COMPANY_COOKIE, next.company_id, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 365 });
  }
  return { deletedCompanyId: companyId };
}

export async function getCompanyContext() {
  const userId = await requireCurrentCompanyUser();
  const company = await getActiveCompany(userId);
  if (!company) throw new Error("No business is configured for this account.");
  return { userId, company };
}
