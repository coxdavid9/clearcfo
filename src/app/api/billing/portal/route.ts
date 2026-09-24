import { NextResponse } from "next/server";
import { getSubscription, requireBillingUser } from "../../../../lib/billing/entitlements";
export const runtime="nodejs";
export async function POST(){
  try{
    const userId=await requireBillingUser(); const sub=await getSubscription(userId);
    if(!sub?.stripe_customer_id) return NextResponse.json({error:"No Stripe billing account is connected."},{status:400});
    const key=process.env.STRIPE_SECRET_KEY; if(!key) throw new Error("Stripe is not configured.");
    const site=(process.env.NEXT_PUBLIC_SITE_URL||"https://theclearcfo.com").replace(/\/$/,"");
    const body=new URLSearchParams({customer:sub.stripe_customer_id,return_url:site+"/profile"});
    const r=await fetch("https://api.stripe.com/v1/billing_portal/sessions",{method:"POST",headers:{Authorization:"Bearer "+key,"Content-Type":"application/x-www-form-urlencoded"},body});
    if(!r.ok) return NextResponse.json({error:"Unable to open billing portal."},{status:502});
    return NextResponse.json({url:(await r.json()).url});
  }catch(e){const m=e instanceof Error?e.message:"Unable to open billing portal.";return NextResponse.json({error:m},{status:m==="Unauthorized"?401:500});}
}
