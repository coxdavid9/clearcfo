import Image from "next/image";
import { ArrowRight, CircleDollarSign, Package } from "lucide-react";

export default function Hero() {
  return (
    <section id="top" className="relative overflow-hidden bg-slate-50">
      <div className="mx-auto max-w-7xl px-5 pb-20 pt-16 sm:px-8 sm:pb-24 sm:pt-20 lg:pt-24">
        <div className="grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
          <div>
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm">
              <span className="h-2 w-2 rounded-full bg-blue-600" />
              AI-powered financial intelligence
            </div>
            <h1 className="max-w-3xl text-5xl font-bold tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
              Your Business Has the Data.
              <br />
              <span className="text-blue-600">ClearCFO</span> Has the Answers.
            </h1>
            <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600 sm:text-xl">
              ClearCFO turns financial data into clear insights, prioritized actions, and better decisions — without spending hours digging through reports.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#pricing" className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3.5 text-sm font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:bg-blue-700 hover:shadow-md">
                See Pricing <ArrowRight className="h-4 w-4" />
              </a>
              <a href="#how-it-works" className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition-colors hover:border-blue-200 hover:text-blue-600">
                See How It Works
              </a>
            </div>
          </div>

          <div className="relative">
            <div className="absolute -inset-6 rounded-[2rem] bg-blue-100/40 blur-2xl" />
            <div className="relative rounded-[1.75rem] border border-blue-100 bg-white p-3 shadow-xl shadow-slate-200/70">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 sm:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-blue-600">ClearCFO Intelligence</p>
                    <h2 className="mt-1 text-lg font-bold text-slate-950">What ClearCFO finds.</h2>
                    <p className="mt-1 text-xs text-slate-500">A quick read on the financial signals that deserve attention.</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-semibold text-red-600">2 signals need attention · 1 to monitor</span>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-3">
                  <SignalCard icon={<CircleDollarSign className="h-4 w-4" />} label="Revenue" value="$933,000" change="↓ 6.7%" tone="attention" />
                  <SignalCard icon={<Package className="h-4 w-4" />} label="Inventory" value="$344,000" change="↑ 14.7%" tone="monitor" />
                  <SignalCard icon={<CircleDollarSign className="h-4 w-4" />} label="Cash" value="$440,000" change="↓ 12.0%" tone="attention" />
                </div>

                <div className="mt-4 rounded-2xl border border-blue-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-blue-600">ClearCFO Recommendation</p>
                      <p className="mt-1 text-sm font-bold text-slate-950">Review inventory aging, purchasing cadence, and demand support.</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-1 text-[10px] font-semibold text-red-600">Priority</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-slate-600">Inventory is growing faster than revenue while cash is declining. ClearCFO surfaces the relationship, explains why it matters, and focuses management on what to investigate next.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {['Evidence-based', 'Prioritized', 'Management-ready'].map((label) => (
                      <span key={label} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-medium text-slate-600">{label}</span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

type SignalCardProps = {
  icon: React.ReactNode;
  label: string;
  value: string;
  change: string;
  tone: "attention" | "monitor";
};

function SignalCard({ icon, label, value, change, tone }: SignalCardProps) {
  const attention = tone === "attention";
  return (
    <div className={`rounded-xl border p-3 ${attention ? "border-red-200 bg-red-50/30" : "border-amber-200 bg-amber-50/30"}`}>
      <div className="flex items-center justify-between gap-2 text-[10px] font-medium text-slate-600">
        <span className="flex items-center gap-1.5">{icon}{label}</span>
        <span className={attention ? "font-semibold text-red-600" : "font-semibold text-amber-600"}>{change}</span>
      </div>
      <p className="mt-1 text-lg font-bold text-slate-950">{value}</p>
      <p className="text-[9px] text-slate-500">vs. prior period</p>
    </div>
  );
}
