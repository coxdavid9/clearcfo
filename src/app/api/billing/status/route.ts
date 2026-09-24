import { NextResponse } from "next/server";
import { getSubscription, requireBillingUser } from "../../../../lib/billing/entitlements";
export const runtime="nodejs";
export async function GET(){
  try{ const userId=await requireBillingUser(); const sub=await getSubscription(userId);
    return NextResponse.json({plan:sub?.plan??null,interval:sub?.interval??null,status:sub?.status??null,trialEndsAt:sub?.trial_ends_at??null,currentPeriodEnd:sub?.current_period_end??null,hasAccess:!!sub && ["trialing","active","past_due"].includes(sub.status)});
  }catch(e){const m=e instanceof Error?e.message:"Unable to read billing status."; return NextResponse.json({error:m},{status:m==="Unauthorized"?401:500});}
}
