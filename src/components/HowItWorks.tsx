export default function HowItWorks() {
  return (
    <section className="max-w-[1200px] mx-auto px-6 py-20">
      <div className="text-center max-w-2xl mx-auto">
        <p className="text-blue-600 text-sm font-semibold uppercase tracking-wider">
          How It Works
        </p>

        <h2 className="text-3xl md:text-4xl font-bold tracking-tight mt-3">
          From Financial Data to Clear Decisions.
        </h2>

        <p className="text-gray-600 mt-4 leading-7">
          ClearCFO turns your financial data into insights you can actually
          use — without spending hours digging through reports.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6 mt-12">
        {/* Step 1 */}
        <div className="border border-slate-200 rounded-2xl p-7 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:bg-slate-50/50 hover:shadow-lg">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            1
          </div>

          <h3 className="text-xl font-bold mt-5">
            Connect Your Data
          </h3>

          <p className="text-gray-600 mt-3 leading-6">
            Connect your accounting and financial data so ClearCFO can see
            the complete picture of your business.
          </p>
        </div>

        {/* Step 2 */}
        <div className="border border-slate-200 rounded-2xl p-7 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:bg-slate-50/50 hover:shadow-lg">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            2
          </div>

          <h3 className="text-xl font-bold mt-5">
            Find What Matters
          </h3>

          <p className="text-gray-600 mt-3 leading-6">
            ClearCFO analyzes revenue, margins, cash flow, expenses, and
            trends to identify what is changing and why.
          </p>
        </div>

        {/* Step 3 */}
        <div className="border border-slate-200 rounded-2xl p-7 bg-white transition-all duration-300 hover:-translate-y-1 hover:border-blue-200 hover:bg-slate-50/50 hover:shadow-lg">
          <div className="w-10 h-10 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
            3
          </div>

          <h3 className="text-xl font-bold mt-5">
            Take Action
          </h3>

          <p className="text-gray-600 mt-3 leading-6">
            Get clear, prioritized recommendations that show you where to
            focus and what could have the biggest financial impact.
          </p>
        </div>
      </div>
    </section>
  );
}