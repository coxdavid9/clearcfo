import ScrollReveal from "./ScrollReveal";

const steps = [
  {
    title: "CONNECT",
    description: "Connect your financial data.",
    icon: "/icons/step-connect.svg",
  },
  {
    title: "UNDERSTAND",
    description: "Get CFO-level insights.",
    icon: "/icons/step-understand.svg",
  },
  {
    title: "IDENTIFY",
    description: "See what's driving profit and performance.",
    icon: "/icons/step-identify.svg",
  },
  {
    title: "IMPROVE",
    description: "Make better decisions.",
    icon: "/icons/step-improve.svg",
  },
] as const;

export default function HowItWorks() {
  return (
    <section className="mx-auto max-w-[1200px] px-6 py-20 sm:py-24">
      <ScrollReveal className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">
          How It Works
        </p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
          From Financial Data to Clear Decisions.
        </h2>
        <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-600">
          ClearCFO turns your financial data into insights you can actually
          use — without spending hours digging through reports.
        </p>
      </ScrollReveal>

      <div className="mt-14 grid gap-0 md:grid-cols-4">
        {steps.map((step, index) => (
          <ScrollReveal key={step.title} delay={index * 110} y={18}>
            <div
              className={`group px-6 py-6 text-center transition-transform duration-300 hover:-translate-y-1 sm:px-8 ${
                index > 0 ? "border-slate-200 md:border-l" : ""
              }`}
            >
              <div className="mx-auto flex h-24 items-center justify-center transition-transform duration-300 group-hover:scale-105 sm:h-28">
                <img src={step.icon} alt="" aria-hidden="true" className="h-20 w-20 sm:h-24 sm:w-24" />
              </div>
              <h3 className="mt-4 text-xl font-extrabold tracking-wide text-[#0B2F8A]">
                {step.title}
              </h3>
              <p className="mx-auto mt-3 max-w-[220px] text-base leading-6 text-slate-600">
                {step.description}
              </p>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
