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
