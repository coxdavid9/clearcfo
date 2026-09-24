import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthCookieNames } from "../../../../lib/supabase-auth";
import { stripeGet, upsertSubscription, mapStatus } from "../../../../lib/billing/stripe";
export const runtime="nodejs";
export async function GET(request:Request){
  const url=new URL(request.url), sessionId=url.searchParams.get("session_id");
  const site=(process.env.NEXT_PUBLIC_SITE_URL||"https://theclearcfo.com").replace(/\/$/,"");
  if(!sessionId) return NextResponse.redirect(site+"/customer/briefing");
  try{
    const session=await stripeGet("checkout/sessions/"+encodeURIComponent(sessionId)+"?expand[]=subscription");
    const userId=session.metadata?.supabase_user_id || session.subscription?.metadata?.supabase_user_id;
    if(userId && session.subscription){
      const s=session.subscription;
      await upsertSubscription({user_id:userId,stripe_customer_id:session.customer,stripe_subscription_id:s.id,plan:s.metadata?.plan || session.metadata?.plan,interval:s.metadata?.interval || session.metadata?.interval,status:mapStatus(s.status),trial_ends_at:s.trial_end?new Date(s.trial_end*1000).toISOString():null,current_period_end:s.current_period_end?new Date(s.current_period_end*1000).toISOString():null,cancel_at_period_end:!!s.cancel_at_period_end,is_comp:false});
    }
    return NextResponse.redirect(site+"/customer/briefing");
  }catch(e){console.error("[Billing] return",e); return NextResponse.redirect(site+"/customer/briefing?billing=error");}
}
