import { notFound } from "next/navigation";
import { detectCashSqueeze } from "../../../lib/briefing/emerging-constraints";
import EmergingConstraintsCard from "../../../components/EmergingConstraintsCard";
import {
  buildBaseCashSqueezeInput,
  buildMediumCashSqueezeInput,
  buildWorseningCashSqueezeInput,
} from "../../../lib/briefing/emerging-constraints-preview";

export const dynamic = "force-dynamic";

export default function EmergingConstraintsDevPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();

  const emerging = detectCashSqueeze(buildBaseCashSqueezeInput());
  const worsening = emerging
    ? detectCashSqueeze(buildWorseningCashSqueezeInput(emerging))
    : null;
  const medium = detectCashSqueeze(buildMediumCashSqueezeInput());

  const constraints = [emerging, worsening, medium].filter(
    (constraint): constraint is NonNullable<typeof constraint> => Boolean(constraint),
  );

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-8 rounded-2xl border border-dashed border-amber-300 bg-amber-50/60 p-5">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-amber-800">DEV ONLY</p>
          <h1 className="mt-2 text-2xl font-bold">Emerging Constraints preview</h1>
          <p className="mt-2 text-sm leading-6 text-slate-700">
            Synthetic regression view using the real detector and the same card markup used by the CFO Briefing.
          </p>
        </div>

        <EmergingConstraintsCard constraints={constraints} />
      </div>
    </main>
  );
}
