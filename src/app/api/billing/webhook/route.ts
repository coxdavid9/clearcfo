import { NextResponse } from "next/server";
import { stripeGet, upsertSubscription, verifyStripeSignature, mapStatus } from "../../../../lib/billing/stripe";
export const runtime="nodejs";
export async function POST(request:Request){
  const raw=await request.text(); if(!await verifyStripeSignature(raw,request.headers.get("stripe-signature"))) return NextResponse.json({error:"Invalid signature."},{status:400});
  try{
    const event=JSON.parse(raw); const obj=event.data?.object;
    if(event.type==="checkout.session.completed"){
      const userId=obj?.metadata?.supabase_user_id; const subId=obj?.subscription;
      if(userId && subId){ const s=await stripeGet("subscriptions/"+encodeURIComponent(subId)); await upsertSubscription({user_id:userId,stripe_customer_id:obj.customer,stripe_subscription_id:s.id,plan:s.metadata?.plan||obj.metadata?.plan,interval:s.metadata?.interval||obj.metadata?.interval,status:mapStatus(s.status),trial_ends_at:s.trial_end?new Date(s.trial_end*1000).toISOString():null,current_period_end:s.current_period_end?new Date(s.current_period_end*1000).toISOString():null,cancel_at_period_end:!!s.cancel_at_period_end,is_comp:false}); }
    } else if(["customer.subscription.created","customer.subscription.updated"].includes(event.type)){
      if(!obj?.id) return NextResponse.json({received:true});
      const existing=await stripeGet("subscriptions/"+encodeURIComponent(obj.id)); const userId=existing.metadata?.supabase_user_id;
      if(userId){ const sub=await (async()=>{const e=await import("../../../../lib/billing/entitlements");return e.getSubscription(userId)})(); if(!sub?.is_comp) await upsertSubscription({user_id:userId,stripe_customer_id:existing.customer, stripe_subscription_id:existing.id,plan:existing.metadata?.plan,interval:existing.metadata?.interval,status:mapStatus(existing.status),trial_ends_at:existing.trial_end?new Date(existing.trial_end*1000).toISOString():null,current_period_end:existing.current_period_end?new Date(existing.current_period_end*1000).toISOString():null,cancel_at_period_end:!!existing.cancel_at_period_end,is_comp:false}); }
    } else if(event.type==="customer.subscription.deleted"){
      const subId=obj?.id; const userId=obj?.metadata?.supabase_user_id;
      if(subId && userId){ const e=await import("../../../../lib/billing/entitlements"); const current=await e.getSubscription(userId); if(!current?.is_comp) await upsertSubscription({user_id:userId,stripe_subscription_id:subId,status:"canceled"}); }
    }
    return NextResponse.json({received:true});
  }catch(e){console.error("[Billing] webhook",e); return NextResponse.json({error:"Webhook processing failed."},{status:500});}
}
