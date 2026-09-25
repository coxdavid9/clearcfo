import { escapeHtml, sendEmail } from "../email";
import type { Subscription } from "./entitlements";
function config(){const url=process.env.SUPABASE_URL?.replace(/\/$/,""),key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("Supabase server configuration is missing.");return{url,key}}
async function sb(path:string,init:RequestInit={}){const{url,key}=config();return fetch(url+"/rest/v1/"+path,{...init,headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",...(init.headers||{})},cache:"no-store"})}
async function ownerEmail(userId:string){const{url,key}=config();const r=await fetch(url+"/auth/v1/admin/users/"+encodeURIComponent(userId),{headers:{apikey:key,Authorization:"Bearer "+key},cache:"no-store"});if(!r.ok)throw new Error("Could not resolve trial email recipient.");const u=await r.json();if(!u.email)throw new Error("Trial recipient email is missing.");return u.email as string}
function amount(s:Subscription){return s.interval==="year"?(s.plan==="pro"?"$790/year":"$390/year"):(s.plan==="pro"?"$79/month":"$39/month")}
function chargeDate(s:Subscription){return s.trial_ends_at?new Date(s.trial_ends_at).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}):"the trial end date"}
function appUrl(){return(process.env.NEXT_PUBLIC_APP_URL||process.env.APP_URL||"https://theclearcfo.com").trim().replace(/\/$/,"")}
async function mark(userId:string,column:string){const r=await sb("subscriptions?user_id=eq."+encodeURIComponent(userId),{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({[column]:new Date().toISOString(),updated_at:new Date().toISOString()})});if(!r.ok)throw new Error("Could not mark trial email.");}
async function hasBriefing(userId:string){const r=await sb("company_memberships?user_id=eq."+encodeURIComponent(userId)+"&select=company_id");if(!r.ok)return true;const rows=await r.json() as Array<{company_id:string}>;if(!rows.length)return false;const ids=rows.map(x=>encodeURIComponent(x.company_id)).join(",");const b=await sb("synced_briefings?company_id=in.("+ids+")&select=company_id&limit=1");return b.ok&&(await b.json()).length>0}
export async function sendTrialEmail(s:Subscription,day:0|2|5|7){
  const to=await ownerEmail(s.user_id),date=chargeDate(s),amt=amount(s),plan=s.plan==="pro"?"Pro":"Core",interval=s.interval==="year"?"annual":"monthly",url=appUrl();
  const subject=day===0?"Welcome to ClearCFO — let's set up your briefing":day===2?"Your CFO Briefing is one step away":day===5?"Your ClearCFO trial ends in 2 days":"Your ClearCFO trial ends today";
  const text=day===0?\`Your 7-day ${plan} trial has started. You won't be charged until ${date} — cancel anytime before then and you'll pay nothing.

Get your first CFO Briefing in a few minutes:
1. Connect QuickBooks for live sync, or
2. Upload a P&L in Excel — no QuickBooks needed.

Open your briefing: ${url}\`:day===2?\`There's no briefing waiting for you yet because your financial data isn't connected. It takes a few minutes — connect QuickBooks or upload a P&L in Excel:

Open your briefing: ${url}\`:day===5?\`Your ${plan} trial ends on ${date}. After that, your plan continues at ${amt}. Cancel anytime from your Account page — cancel before ${date} and you won't be charged.\`:\`Your card will be charged ${amt} tomorrow for your ${plan} ${interval} plan. Cancel anytime from your Account page.\`;
  const e={url:escapeHtml(url),plan:escapeHtml(plan),date:escapeHtml(date),amount:escapeHtml(amt),interval:escapeHtml(interval)};
  const c='display:inline-block;padding:12px 18px;background:#111827;color:#ffffff;text-decoration:none;border-radius:6px;';
  const button=\`<p><a href="${e.url}" style="${c}">Open your briefing</a></p>\`;
  const html=day===0?\`<p>Your 7-day ${e.plan} trial has started. You won't be charged until ${e.date} — cancel anytime before then and you'll pay nothing.</p><p>Get your first CFO Briefing in a few minutes:</p><p>1. Connect QuickBooks for live sync, or<br>2. Upload a P&amp;L in Excel — no QuickBooks needed.</p>${button}\`:day===2?\`<p>There's no briefing waiting for you yet because your financial data isn't connected. It takes a few minutes — connect QuickBooks or upload a P&amp;L in Excel:</p>${button}\`:day===5?\`<p>Your ${e.plan} trial ends on ${e.date}. After that, your plan continues at ${e.amount}. Cancel anytime from your Account page — cancel before ${e.date} and you won't be charged.</p>${button}\`:\`<p>Your card will be charged ${e.amount} tomorrow for your ${e.plan} ${e.interval} plan. Cancel anytime from your Account page.</p>${button}\`;
  await sendEmail({to,subject,text,html});
  const column=day===0?"trial_email_day0_sent_at":day===2?"trial_email_day2_sent_at":day===5?"trial_email_day5_sent_at":"trial_email_day7_sent_at";
  await mark(s.user_id,column);
}
export async function dispatchTrialEmails(){
  const r=await sb("subscriptions?status=eq.trialing&select=*");if(!r.ok)throw new Error("Could not read trial subscriptions.");
  const rows=await r.json() as Subscription[];const now=Date.now();
  for(const s of rows){if(!s.trial_ends_at)continue;const end=new Date(s.trial_ends_at).getTime(),start=end-7*86400000,elapsed=(now-start)/86400000;
    try{
      if(elapsed>=0&&!s.trial_email_day0_sent_at)await sendTrialEmail(s,0);
      else if(elapsed>=2&&!s.trial_email_day2_sent_at&&!(await hasBriefing(s.user_id)))await sendTrialEmail(s,2);
      else if(elapsed>=5&&!s.trial_email_day5_sent_at)await sendTrialEmail(s,5);
      else if(elapsed>=6&&!s.trial_email_day7_sent_at)await sendTrialEmail(s,7);
    }catch(error){console.error("[ClearCFO Trial Email]",s.user_id,error instanceof Error?error.message:"Unknown error")}
  }
}
