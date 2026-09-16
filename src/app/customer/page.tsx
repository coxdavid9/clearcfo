import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default function CustomerPage() {
  // The financial dashboard is part of the CFO Briefing experience.
  // Keep /customer as a backwards-compatible entry point, but do not maintain
  // a second dashboard page.
  redirect("/customer/briefing");
}
