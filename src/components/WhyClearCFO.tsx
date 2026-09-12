import ScrollReveal from "./ScrollReveal";

const reasons = [
  {
    title: "Built for owners",
    text: "ClearCFO translates financial information into plain-language priorities so you can focus on the business instead of decoding reports.",
  },
  {
    title: "Evidence before explanation",
    text: "ClearCFO starts with observable financial changes and relationships, then explains why they may matter. It separates evidence from assumptions.",
  },
  {
    title: "Action over dashboards",
    text: "The goal is not another report to read. ClearCFO helps identify what deserves attention and where management should focus next.",
  },
];

export default function WhyClearCFO() {
  return (
    <section id="why-clearcfo" className="scroll-mt-24 border-y border-slate-200 bg-white px-5 py-20 sm:px-8 lg:py-24">
      <div className="mx-auto max-w-6xl">
        <ScrollReveal>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Why ClearCFO</p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Financial clarity without another report to decode.</h2>
            <p className="mt-4 leading-7 text-slate-600">
              ClearCFO is designed to help owners understand what changed, why it matters, and what deserves their attention next.
            </p>
          </div>
        </ScrollReveal>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {reasons.map((reason, index) => (
            <ScrollReveal key={reason.title} delay={index * 100}>
              <div className="h-full rounded-2xl border border-slate-200 bg-slate-50/60 p-7 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:bg-white hover:shadow-lg">
                <h3 className="text-lg font-bold text-slate-900">{reason.title}</h3>
                <p className="mt-3 leading-6 text-slate-600">{reason.text}</p>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
