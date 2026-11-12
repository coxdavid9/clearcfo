import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import ts from "typescript";
async function load(path, transform=x=>x){
 const source=transform(await readFile(path,"utf8"));
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 return import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
}
const pricing=await load("src/lib/pricing.ts");
for(const [date,days] of [["2026-11-25T05:59:59.999Z",7],["2026-11-25T06:00:00Z",30],["2026-12-01T05:59:59.999Z",30],["2026-12-01T06:00:00Z",7]]) assert.equal(pricing.currentTrialDays(new Date(date)),days);
const emails=[];
const trial=await load("src/lib/billing/trial-email.ts",s=>s.replace(/import \{ escapeHtml, sendEmail \} from "..\/email";/,'const escapeHtml = x=>x; const sendEmail = async x=>globalThis.__emails.push(x);'));
globalThis.__emails=emails;
process.env.SUPABASE_URL="https://example.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY="test";
const now=Date.now(), day=86400000;
let row;
globalThis.fetch=async (url,init={})=>{
 if(url.includes("/admin/users/"))return Response.json({email:"test@example.invalid"});
 if(init.method==="PATCH")return new Response(null,{status:204});
 if(url.includes("subscriptions?"))return Response.json([row]);
 return Response.json([]);
};
for(const length of [7,30]){
 for(const elapsed of [0,2,length-2,length-1]){
  row={user_id:"test",plan:"pro",interval:"month",created_at:new Date(now-elapsed*day).toISOString(),trial_ends_at:new Date(now+(length-elapsed)*day).toISOString(),trial_email_day0_sent_at:elapsed? "sent":null,trial_email_day2_sent_at:elapsed>2?"sent":null};
  emails.length=0;
  await trial.dispatchTrialEmails();
  assert.equal(emails.length,1);
  assert.match(emails[0].subject,elapsed===0?/Welcome/:elapsed===2?/one step away/:elapsed===length-2?/ends in 2 days/:/ends today/);
  if(!elapsed)assert.match(emails[0].text,new RegExp(length+"-day"));
 }
}
row={...row,created_at:null};
emails.length=0;await trial.sendTrialEmail(row,0);assert.match(emails[0].text,/Your Pro trial is ready/);
console.log("Trial promo boundaries and 7/30-day email schedules passed.");
const stripe=await load("src/lib/billing/stripe.ts",s=>s.replace('import { currentTrialDays } from "../pricing";','const currentTrialDays = ()=>globalThis.__trialDays;').replace('import { STRIPE_API_VERSION } from "./stripe-payload";','const STRIPE_API_VERSION="test";'));
process.env.STRIPE_SECRET_KEY="sk_test_fake";
process.env.STRIPE_PRO_MONTHLY_PRICE_ID="price_test";
for(const days of [7,30]){
 globalThis.__trialDays=days;
 globalThis.fetch=async (_url,init)=>{
  assert.equal(new URLSearchParams(init.body).get("subscription_data[trial_period_days]"),String(days));
  return Response.json({id:"cs_test_mock",url:"https://example.invalid/checkout"});
 };
 await stripe.createCheckout("cus_test","user_test","pro","month");
}
console.log("Checkout request uses runtime trial length (mock Stripe).");
