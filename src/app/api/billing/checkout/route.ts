import { NextResponse } from "next/server";
import { getSubscription, requireBillingUser, type BillingInterval, type Plan } from "../../../../lib/billing/entitlements";
import { createCheckout, stripeCustomer } from "../../../../lib/billing/stripe";
export const runtime="nodejs";
export async function POST(request:Request){
  try{
    const userId=await requireBillingUser(); const body=await request.json().catch(()=>({}));
    const plan=body?.plan as Plan, interval=body?.interval as BillingInterval;
    if(!["core","pro"].includes(plan)||!["month","year"].includes(interval)) return NextResponse.json({error:"Invalid plan selection."},{status:400});
    const existing=await getSubscription(userId); if(existing && ["trialing","active","past_due"].includes(existing.status)) return NextResponse.json({error:"A subscription already exists."},{status:409});
    const cookie=(await import("next/headers")).cookies(); const c=await cookie; const {getAuthCookieNames,getSupabaseUser}=await import("../../../../lib/supabase-auth"); const token=c.get(getAuthCookieNames().AUTH_COOKIE)?.value; const user=token?await getSupabaseUser(token):null;
    if(!user?.email) return NextResponse.json({error:"Your account email is unavailable."},{status:400});
    const customer=await stripeCustomer(user.email,userId); const session=await createCheckout(customer,userId,plan,interval);
    return NextResponse.redirect(session.url,303);
  }catch(e){console.error("[Billing] checkout",e); return NextResponse.json({error:e instanceof Error?e.message:"Unable to start checkout."},{status:500});}
}
