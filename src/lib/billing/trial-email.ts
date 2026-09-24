import { sendEmail } from "../email";
import type { Subscription } from "./entitlements";
function config(){const url=process.env.SUPABASE_URL?.replace(/\/$/,""),key=process.env.SUPABASE_SERVICE_ROLE_KEY;if(!url||!key)throw new Error("Supabase server configuration is missing.");return{url,key}}
async function sb(path:string,init:RequestInit={}){const{url,key}=config();return fetch(url+"/rest/v1/"+path,{...init,headers:{apikey:key,Authorization:"Bearer "+key,"Content-Type":"application/json",...(init.headers||{})},cache:"no-store"})}
async function ownerEmail(userId:string){const{url,key}=config();const r=await fetch(url+"/auth/v1/admin/users/"+encodeURIComponent(userId),{headers:{apikey:key,Authorization:"Bearer "+key},cache:"no-store"});if(!r.ok)throw new Error("Could not resolve trial email recipient.");const u=await r.json();if(!u.email)throw new Error("Trial recipient email is missing.");return u.email as string}
function amount(s:Subscription){return s.interval==="year"?(s.plan==="pro"?"$790/year":"$390/year"):(s.plan==="pro"?"$79/month":"$39/month")}
function chargeDate(s:Subscription){return s.trial_ends_at?new Date(s.trial_ends_at).toLocaleDateString("en-US",{month:"long",day:"numeric",year:"numeric"}):"the trial end date"}
async function mark(userId:string,column:string){const r=await sb("subscriptions?user_id=eq."+encodeURIComponent(userId),{method:"PATCH",headers:{Prefer:"return=minimal"},body:JSON.stringify({[column]:new Date().toISOString(),updated_at:new Date().toISOString()})});if(!r.ok)throw new Error("Could not mark trial email.");}
async function hasBriefing(userId:string){const r=await sb("company_memberships?user_id=eq."+encodeURIComponent(userId)+"&select=company_id");if(!r.ok)return true;const rows=await r.json() as Array<{company_id:string}>;if(!rows.length)return false;const ids=rows.map(x=>encodeURIComponent(x.company_id)).join(",");const b=await sb("synced_briefings?company_id=in.("+ids+")&select=company_id&limit=1");return b.ok && (await b.json()).length>0}
export async function sendTrialEmail(s:Subscription,day:0|2|5|7){
  const to=await ownerEmail(s.user_id),date=chargeDate(s),amt=amount(s);
  const subject=day===0?"Welcome to ClearCFO":day===2?"Your ClearCFO briefing is waiting":day===5?"Your ClearCFO trial ends in 2 days":"Your ClearCFO trial ends today";
  const text=day===0?"Welcome — you won't be charged until "+date+". Your 7-day "+(s.plan==="pro"?"Pro":"Core")+" trial is ready.":day===2?"Connect your financial data to activate your ClearCFO briefing.":day===5?"Your trial ends in 2 days. After that, your selected "+(s.plan==="pro"?"Pro":"Core")+" plan will begin at "+amt+".":"Your card will be charged tomorrow: "+amt+".";
  await sendEmail({to,subject,text,html:"<p>"+text+"</p><p>ClearCFO</p>"});
  const column=day===0?"trial_email_day0_sent_at":day===2?"trial_email_day2_sent_at":day===5?"trial_email_day5_sent_at":"trial_email_day7_sent_at";
  await mark(s.user_id,column);
}
export async function dispatchTrialEmails(){
  const r=await sb("subscriptions?status=eq.trialing&select=*");if(!r.ok)throw new Error("Could not read trial subscriptions.");
  const rows=await r.json() as Subscription[];const now=Date.now();
  for(const s of rows){
    if(!s.trial_ends_at)continue;
    const end=new Date(s.trial_ends_at).getTime(),start=end-7*86400000,elapsed=(now-start)/86400000;
    try{
      if(elapsed>=0&&!s.trial_email_day0_sent_at)await sendTrialEmail(s,0);
      else if(elapsed>=2&&!s.trial_email_day2_sent_at&&!(await hasBriefing(s.user_id)))await sendTrialEmail(s,2);
      else if(elapsed>=5&&!s.trial_email_day5_sent_at)await sendTrialEmail(s,5);
      else if(elapsed>=6&&!s.trial_email_day7_sent_at)await sendTrialEmail(s,7);
    }catch(error){console.error("[ClearCFO Trial Email]",s.user_id,error instanceof Error?error.message:"Unknown error")}
  }
}
