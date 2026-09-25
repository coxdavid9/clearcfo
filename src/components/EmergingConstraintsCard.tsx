import type { EmergingConstraint } from "../lib/briefing/emerging-constraints";

type EmergingConstraintsCardProps = {
  constraints: EmergingConstraint[];
};

export default function EmergingConstraintsCard({ constraints }: EmergingConstraintsCardProps) {
  if (!constraints.length) return null;

  return (
    <section className="mt-8" aria-labelledby="emerging-constraints-heading">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p id="emerging-constraints-heading" className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">EMERGING CONSTRAINTS</p>
          <p className="mt-1 text-xs text-slate-500">Patterns forming across your financial data before the KPI turns red.</p>
        </div>
        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-amber-700">{constraints.length} detected</span>
      </div>
      <div className="mt-4 space-y-4">
        {constraints.map((constraint) => {
          const statusLabel = constraint.status === "resolved" ? "RESOLVED" : constraint.status.toUpperCase();
          const statusClass = constraint.status === "resolved"
            ? "bg-slate-100 text-slate-600"
            : constraint.status === "worsening"
              ? "bg-red-50 text-red-700"
              : constraint.status === "easing"
                ? "bg-emerald-50 text-emerald-700"
                : "bg-amber-50 text-amber-700";

          return (
            <article key={constraint.id} className="rounded-2xl border border-amber-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-bold text-slate-900">{constraint.title}</p>
                  <p className="mt-1 text-xs font-medium text-slate-500">{constraint.statusDetail}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${statusClass}`}>{statusLabel}</span>
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600">{constraint.confidence} confidence</span>
                </div>
              </div>
              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">RELATIONSHIP</p>
                  <p className="mt-1.5 text-sm leading-6 text-slate-700">{constraint.relationship}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">EVIDENCE CHECKED</p>
                  <ul className="mt-1.5 space-y-1.5 text-sm leading-6 text-slate-600">
                    {constraint.evidenceChecked.map((item, index) => (
                      <li key={`constraint-evidence-${constraint.id}-${index}`} className="flex gap-2">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">WHY NOW</p>
                  <p className="mt-1.5 text-sm leading-6 text-slate-700">{constraint.whyNow}</p>
                </div>
                {constraint.confidence !== "Medium" || constraint.status !== "resolved" ? (
                  <div className="rounded-xl border border-amber-100 bg-amber-50/60 px-4 py-3">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-800">DECISION WINDOW</p>
                    <p className="mt-1.5 text-sm leading-6 text-slate-700">{constraint.decisionWindow}</p>
                  </div>
                ) : null}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
