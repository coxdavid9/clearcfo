import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";
import ts from "typescript";
async function load(path, transform=x=>x){
 const js=ts.transpileModule(transform(await readFile(path,"utf8")),{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 return import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
}
process.env.SUPABASE_URL="https://example.invalid";
process.env.SUPABASE_SERVICE_ROLE_KEY="test";
const promo=await load("src/lib/billing/promo.ts");
let codeRow={code:"JEFF14",trial_days:14,card_required:false,active:true,max_redemptions:1},redemptions=[];
globalThis.fetch=async url=>Response.json(url.includes("promo_codes?")?[codeRow]:redemptions);
assert.deepEqual(await promo.validatePromo(" jeff14 ","u"),{code:"JEFF14",trialDays:14,cardRequired:false});
for(const patch of [{active:false},{expires_at:"2020-01-01"},{trial_days:91}]){
 const old=codeRow;codeRow={...old,...patch};assert.equal(await promo.validatePromo("JEFF14","u"),null);codeRow=old;
}
redemptions=[{user_id:"someone",status:"completed",created_at:new Date().toISOString()}];assert.equal(await promo.validatePromo("JEFF14","u"),null);
codeRow.max_redemptions=null;redemptions=[{user_id:"u",status:"completed",created_at:new Date().toISOString()}];assert.equal(await promo.validatePromo("JEFF14","u"),null);
assert.equal(await promo.validatePromo("bad!","u"),null);
const stripe=await load("src/lib/billing/stripe.ts",s=>s.replace('import { currentTrialDays } from "../pricing";','const currentTrialDays=()=>30;').replace('import { STRIPE_API_VERSION } from "./stripe-payload";','const STRIPE_API_VERSION="test";'));
process.env.STRIPE_SECRET_KEY="sk_test_fake";process.env.STRIPE_CORE_MONTHLY_PRICE_ID="price_test";
let payload;
globalThis.fetch=async (_url,init)=>{payload=new URLSearchParams(init.body);return Response.json({id:"mock"});};
for(const terms of [undefined,{code:"JEFF14",trialDays:14,cardRequired:false},{code:"CARD14",trialDays:14,cardRequired:true}]){
 await stripe.createCheckout("cus_test","u","core","month",terms);
 assert.equal(payload.get("subscription_data[trial_period_days]"),String(terms?.trialDays??30));
 assert.equal(payload.get("payment_method_collection"),terms?.cardRequired===false?"if_required":null);
 assert.equal(payload.get("subscription_data[trial_settings][end_behavior][missing_payment_method]"),terms?.cardRequired===false?"cancel":null);
 assert.equal(payload.get("metadata[promo_code]"),terms?.code??null);
 assert.equal(payload.get("subscription_data[metadata][promo_code]"),terms?.code??null);
}
assert.deepEqual(promo.promoFields({promo_code:"JEFF14",card_required:"false"}),{promo_code:"JEFF14",trial_card_required:false});
assert.deepEqual(promo.promoFields(),{});
const sent=[];
const email=await load("src/lib/billing/trial-email.ts",s=>s.replace('import { escapeHtml, sendEmail } from "../email";','const escapeHtml=x=>x; const sendEmail=async x=>globalThis.__sent.push(x);'));
globalThis.__sent=sent;
globalThis.fetch=async (url,init)=>url.includes("/admin/users/")?Response.json({email:"test@example.invalid"}):new Response(null,{status:204});
const row={user_id:"u",plan:"core",interval:"month",created_at:new Date().toISOString(),trial_ends_at:new Date(Date.now()+14*86400000).toISOString()};
for(const day of [0,5,7]){
 await email.sendTrialEmail({...row,trial_card_required:false},day);
 const message=sent.at(-1);assert.doesNotMatch(message.text,/card will be charged|won't be charged until/);assert.doesNotMatch(message.html,/card will be charged|won't be charged until/);
 await email.sendTrialEmail(row,day);
 assert.match(sent.at(-1).text,day===0?/won't be charged until/:day===5?/plan continues/:/card will be charged/);
}
console.log("PASS: promo validation, precedence, card flags, persistence fields and email copy");

redemptions=[{user_id:"someone",status:"pending",created_at:new Date(Date.now()-25*86400000/24).toISOString()}];
codeRow.max_redemptions=1;
globalThis.fetch=async url=>Response.json(url.includes("promo_codes?")?[codeRow]:redemptions);
assert(await promo.validatePromo("JEFF14","u"));
redemptions=[{user_id:"u",status:"pending",created_at:new Date().toISOString()}];
assert(await promo.validatePromo("JEFF14","u"));
console.log("PASS: advisory pending claims reuse and expiry");
async function route(path,doubles){
 const source=(await readFile(path,"utf8")).replace(/import[^;]+;/g,"");
 globalThis.__promoDoubles=doubles;
 return loadFromSource("const {"+Object.keys(doubles).join(",")+"}=globalThis.__promoDoubles;\n"+source);
}
async function loadFromSource(source){
 const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
 return import("data:text/javascript;base64,"+Buffer.from(js).toString("base64"));
}
const doubles={
 NextResponse:{json:(body,init)=>Response.json(body,init)},
 requireBillingUser:async()=>"u",
 validatePromo:async()=>null,
 claimPromoCode:async()=>false,
 INVALID_PROMO:promo.INVALID_PROMO,
 getSubscription:async()=>null,
 cookies:async()=>({get:()=>({value:"token"})}),
 getAuthCookieNames:()=>({AUTH_COOKIE:"auth"}),
 getSupabaseUser:async()=>({email:"test@example.invalid"}),
 stripeCustomer:async()=>"customer",
 createCheckout:async()=>({url:"https://example.invalid/checkout"})
};
const validateRoute=await route("src/app/api/billing/promo/validate/route.ts",doubles);
const request=code=>new Request("https://example.invalid",{method:"POST",body:JSON.stringify({code,plan:"core",interval:"month"})});
assert.deepEqual(await (await validateRoute.POST(request("NOPE99"))).json(),{valid:false});
const checkoutRoute=await route("src/app/api/billing/checkout/route.ts",doubles);
const rejected=await checkoutRoute.POST(request("NOPE99"));
assert.equal(rejected.status,400);
assert.deepEqual(await rejected.json(),{error:promo.INVALID_PROMO});
console.log("PASS: invalid code endpoints reject generically and never fall back to standard terms");

const planSelection = await readFile("src/components/PlanSelection.tsx", "utf8");
assert.match(planSelection, /\{status\s*===\s*null\s*&&<div[^>]*><button[\s\S]*?Have a code\?/,
 "Promo entry must render for never-subscribed accounts (status === null).");
assert.doesNotMatch(planSelection, /\{!locked\s*&&<div[^>]*><button[\s\S]*?Have a code\?/,
 "Promo entry must not be gated by !locked.");
console.log("PASS: never-subscribed promo entry is independent of locked");

// Execute actual in-app start route with service doubles.
const entitlements = await load("src/lib/billing/entitlements.ts", s => s.replace(/import[^;]+;/g, ""));
const clock = Date.now();
const inAppRow = { ...row, status: "trialing", promo_code: "TEST14", stripe_subscription_id: null, trial_ends_at: new Date(clock - 1).toISOString() };
assert.equal(entitlements.hasAccess(inAppRow), false);
assert.equal(entitlements.hasAccess({...inAppRow,trial_ends_at:new Date(clock+86400000).toISOString()}), true);
assert.equal(entitlements.hasAccess({...inAppRow,stripe_subscription_id:"sub_test"}), true);
let existingRow=null, writtenRow=null, claims=0, completed=0, welcomes=0, cardRequired=false, claimAllowed=true, emailFails=false;
const startRoute=await route("src/app/api/billing/promo/start/route.ts",{
 NextResponse:doubles.NextResponse,
 requireBillingUser:async()=>"new-user",
 validatePromo:async()=>({code:"TEST14",trialDays:14,cardRequired}),
 INVALID_PROMO:promo.INVALID_PROMO,
 hasAccess:entitlements.hasAccess,
 getSubscription:async()=>writtenRow??existingRow,
 claimPromoCode:async()=>{claims++;return claimAllowed;},
 recordPromoRedemption:async()=>{completed++;},
 upsertSubscription:async value=>{writtenRow=value;},
 sendTrialEmail:async (_row,day)=>{assert.equal(day,0);welcomes++;if(emailFails)throw new Error("Email unavailable");}
});
const startRequest=(extra={})=>new Request("https://example.invalid/api/billing/promo/start",{method:"POST",body:JSON.stringify({code:"TEST14",plan:"core",interval:"month",termsAccepted:true,...extra})});
function resetStart(){existingRow=null;writtenRow=null;claims=0;completed=0;welcomes=0;cardRequired=false;claimAllowed=true;emailFails=false;}
resetStart();
let result=await startRoute.POST(startRequest());
assert.equal(result.status,200);
assert.equal(writtenRow.status,"trialing");
assert.equal(writtenRow.stripe_customer_id,null);
assert.equal(writtenRow.stripe_subscription_id,null);
assert.equal(writtenRow.promo_code,"TEST14");
assert.equal(writtenRow.trial_card_required,false);
assert(Date.parse(writtenRow.terms_accepted_at)>=clock);
assert(Math.abs(Date.parse(writtenRow.trial_ends_at)-Date.now()-14*86400000)<5000);
assert.equal(completed,1);assert.equal(welcomes,1);
resetStart();
result=await startRoute.POST(startRequest({termsAccepted:undefined}));
assert.equal(result.status,400);assert.equal(claims,0);assert.equal(writtenRow,null);
resetStart();cardRequired=true;
result=await startRoute.POST(startRequest());
assert.equal(result.status,400);assert.deepEqual(await result.json(),{error:promo.INVALID_PROMO});assert.equal(claims,0);
resetStart();existingRow={...inAppRow,status:"active"};
assert.equal((await startRoute.POST(startRequest())).status,409);assert.equal(claims,0);
resetStart();existingRow={...inAppRow,stripe_subscription_id:"sub_old",status:"canceled"};
assert.equal((await startRoute.POST(startRequest())).status,400);assert.equal(claims,0);
resetStart();existingRow={...inAppRow,promo_code:"OLD14"};
assert.equal((await startRoute.POST(startRequest())).status,200);assert.equal(writtenRow.promo_code,"TEST14");
assert.equal(writtenRow.trial_email_day2_sent_at,null);
resetStart();claimAllowed=false;
assert.equal((await startRoute.POST(startRequest())).status,400);assert.equal(writtenRow,null);
resetStart();emailFails=true;
const oldError=console.error;console.error=()=>{};
try { assert.equal((await startRoute.POST(startRequest())).status,200); } finally { console.error=oldError; }
resetStart();
assert.equal((await startRoute.POST(startRequest({plan:"bad"}))).status,400);assert.equal(claims,0);

const patches=[];
sent.length=0;
globalThis.fetch=async (url,init={})=>{
 if(init.method==="PATCH"){patches.push({url,body:JSON.parse(init.body)});return new Response(null,{status:204});}
 if(url.includes("subscriptions?"))return Response.json([inAppRow]);
 throw new Error("Expired in-app trials must not resolve email or briefing");
};
await email.dispatchTrialEmails();
assert.equal(sent.length,0);
assert.equal(patches.length,1);
assert.equal(patches[0].body.status,"canceled");
assert(patches[0].url.includes("stripe_subscription_id=is.null"));
assert.match(planSelection,/disabled=\{busy!==null\|\|\(noCard&&!termsAccepted\)\}/);
assert(planSelection.includes('fetch("/api/billing/promo/start"'));
assert(planSelection.includes('href="/terms" target="_blank"'));
assert(planSelection.includes('href="/privacy" target="_blank"'));
console.log("PASS: in-app trial consent, persistence, redemption, best-effort email, access expiry and dispatcher cleanup");

globalThis.__promoDoubles={...doubles,hasAccess:entitlements.hasAccess,getSubscription:async()=>inAppRow};
const conversionSource=(await readFile("src/app/api/billing/checkout/route.ts","utf8")).replace(/import[^;]+;/g,"");
const conversion=await loadFromSource("const {"+Object.keys(globalThis.__promoDoubles).join(",")+"}=globalThis.__promoDoubles;\n"+conversionSource+"\n// Expired in-app conversion regression");
assert.equal((await conversion.POST(new Request("https://example.invalid",{method:"POST",body:JSON.stringify({plan:"core",interval:"month"})}))).status,200);
console.log("PASS: expired in-app trial can enter normal card checkout");
