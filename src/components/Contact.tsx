export default function Contact() {
  return (
    <section id="contact" className="scroll-mt-24 border-t border-slate-200 bg-white px-5 py-20 sm:px-8 lg:py-24">
      <div className="mx-auto max-w-4xl rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white p-8 text-center shadow-sm sm:p-12">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Contact ClearCFO</p>
        <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Have questions about ClearCFO?</h2>
        <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-600">
          Whether you’re exploring ClearCFO for your business or already a customer, we’re here to help.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href="mailto:contact@theclearcfo.com"
            className="inline-flex min-h-11 items-center justify-center rounded-full bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Email ClearCFO
          </a>
          <a
            href="mailto:contact@theclearcfo.com"
            className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-200 hover:text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            contact@theclearcfo.com
          </a>
        </div>
      </div>
    </section>
  );
}
