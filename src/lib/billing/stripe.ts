import { createHmac, timingSafeEqual } from "node:crypto";
import type { BillingInterval, Plan, SubscriptionStatus } from "./entitlements";

function key(){ const v=process.env.STRIPE_SECRET_KEY?.trim(); if(!v) throw new Error("STRIPE_SECRET_KEY is not configured."); return v; }
function prices(){
  return {
    core_month: process.env.STRIPE_CORE_MONTHLY_PRICE_ID || "",
    core_year: process.env.STRIPE_CORE_ANNUAL_PRICE_ID || "",
    pro_month: process.env.STRIPE_PRO_MONTHLY_PRICE_ID || "",
    pro_year: process.env.STRIPE_PRO_ANNUAL_PRICE_ID || "",
  } as Record<string,string>;
}
export function priceId(plan:Plan, interval:BillingInterval){ const id=prices()[plan+"_"+interval]; if(!id) throw new Error("Stripe price ID is not configured for "+plan+" "+interval+"."); return id; }
async function stripe(path:string, init:RequestInit={}) {
  return fetch("https://api.stripe.com/v1/"+path,{...init,headers:{Authorization:"Bearer "+key(),...(init.headers||{})},cache:"no-store"});
}
function form(values:Record<string,string|number|undefined>){ const p=new URLSearchParams(); for(const [k,v] of Object.entries(values)) if(v!==undefined) p.set(k,String(v)); return p; }
export async function stripeCustomer(email:string,userId:string){
  const search=await stripe("customers/search?query="+encodeURIComponent("metadata['supabase_user_id']:'"+userId+"'"));
  if(search.ok){ const data=await search.json(); if(data.data?.[0]?.id) return data.data[0].id as string; }
  const r=await stripe("customers",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:form({"email":email,"metadata[supabase_user_id]":userId}).toString()});
  if(!r.ok) throw new Error("Could not create Stripe customer.");
  return (await r.json()).id as string;
}
export async function createCheckout(customer:string,userId:string,plan:Plan,interval:BillingInterval){
  const site=(process.env.NEXT_PUBLIC_SITE_URL||"https://theclearcfo.com").replace(/\/$/,"");
  const r=await stripe("checkout/sessions",{method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded"},body:form({
    mode:"subscription",customer,line_items:"",success_url:site+"/api/billing/return?session_id={CHECKOUT_SESSION_ID}",cancel_url:site+"/customer/briefing?billing=cancelled",
    "line_items[0][price]":priceId(plan,interval),"line_items[0][quantity]":1,
    trial_period_days:7,"subscription_data[metadata][supabase_user_id]":userId,
    "subscription_data[metadata][plan]":plan,"subscription_data[metadata][interval]":interval,
  }).toString()});
  if(!r.ok){ const t=await r.text(); throw new Error(t.slice(0,500)); }
  return await r.json() as {url:string,id:string,subscription?:string};
}
export async function stripeGet(path:string){ const r=await stripe(path); if(!r.ok) throw new Error("Stripe request failed."); return r.json(); }
export async function upsertSubscription(row:Record<string,unknown>){
  const r=await sb("subscriptions",{method:"POST",headers:{Prefer:"resolution=merge-duplicates,return=minimal"},body:JSON.stringify(row)});
  if(!r.ok) throw new Error("Could not save subscription.");
}
export async function verifyStripeSignature(raw:string, header:string|null){
  const secret=process.env.STRIPE_WEBHOOK_SECRET?.trim(); if(!secret || !header) return false;
  const parts=Object.fromEntries(header.split(",").map(x=>x.split("=")).filter(x=>x.length===2));
  const timestamp=Number(parts.t); const sig=parts.v1; if(!timestamp || !sig || Math.abs(Date.now()/1000-timestamp)>300) return false;
  const expected=createHmac("sha256",secret).update(timestamp+"."+raw).digest("hex");
  try{return timingSafeEqual(Buffer.from(expected,"hex"),Buffer.from(sig,"hex"));}catch{return false;}
}
export function mapStatus(status:string):SubscriptionStatus {
  if(status==="trialing") return "trialing"; if(status==="active") return "active"; if(status==="past_due") return "past_due"; return "canceled";
}
