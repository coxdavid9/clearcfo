import { cookies } from "next/headers";
import { getAuthCookieNames, getSupabaseUser } from "./supabase-auth";

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
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
}

async function currentUserId() {
  const cookieStore = await cookies();
  const { AUTH_COOKIE } = getAuthCookieNames();
  const token = cookieStore.get(AUTH_COOKIE)?.value;
  if (!token) return null;
  const user = await getSupabaseUser(token);
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

export async function getActiveCompany(userId: string): Promise<Company | null> {
  const memberships = await listUserCompanies(userId);
  if (!memberships.length) return null;

  const cookieStore = await cookies();
  const requestedId = cookieStore.get(ACTIVE_COMPANY_COOKIE)?.value;
  const active = memberships.find((membership) => membership.company_id === requestedId) || memberships[0];

  if (requestedId !== active.company_id) {
    cookieStore.set(ACTIVE_COMPANY_COOKIE, active.company_id, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
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
  cookieStore.set(ACTIVE_COMPANY_COOKIE, companyId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function createCompany(
  userId: string,
  input: { name: string; industry?: string; companySize?: string; contactPhone?: string }
) {
  const name = input.name.trim().slice(0, 200);
  if (!name) throw new Error("Business name is required.");

  const createResponse = await supabaseRequest("companies", {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify({
      name,
      industry: input.industry?.trim().slice(0, 200) || null,
      company_size: input.companySize?.trim().slice(0, 200) || null,
      contact_phone: input.contactPhone?.trim().slice(0, 200) || null,
      created_by: userId,
    }),
  });
  if (!createResponse.ok) throw new Error(`Could not create business (${createResponse.status}).`);
  const companies = await createResponse.json() as Company[];
  const company = companies[0];
  if (!company) throw new Error("Business was not created.");

  const membershipResponse = await supabaseRequest("company_memberships", {
    method: "POST",
    headers: { Prefer: "return=minimal" },
    body: JSON.stringify({ company_id: company.id, user_id: userId, role: "owner" }),
  });
  if (!membershipResponse.ok) throw new Error(`Could not create business membership (${membershipResponse.status}).`);

  await setActiveCompany(userId, company.id);
  return company;
}

export async function getCompanyContext() {
  const userId = await requireCurrentCompanyUser();
  const company = await getActiveCompany(userId);
  if (!company) throw new Error("No business is configured for this account.");
  return { userId, company };
}
