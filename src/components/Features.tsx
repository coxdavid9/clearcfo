export default function Features() {
  return (
    <section className="py-32 bg-gray-50">
      <div className="max-w-6xl mx-auto px-8">

        <h2 className="text-4xl font-bold text-center">
          Everything You Need To Run Your Business Better
        </h2>

        <p className="text-center text-gray-600 mt-4 max-w-2xl mx-auto">
          ClearCFO analyzes your financial data and tells you exactly what matters.
        </p>

        <div className="grid md:grid-cols-3 gap-8 mt-16">

          <div className="rounded-2xl border p-12 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl">
            <h3 className="text-xl font-bold mb-3">📊 Connect Your Data</h3>
            <p className="text-gray-600">
              Securely connect QuickBooks, Excel, and ERP systems in minutes.
            </p>
          </div>

          <div className="rounded-2xl border p-12 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl">
            <h3 className="text-xl font-bold mb-3">📈 AI Financial Insights</h3>
            <p className="text-gray-600">
              Instantly understand profit drivers, cash flow, and spending trends.
            </p>
          </div>

          <div className="rounded-2xl border p-12 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl">
            <h3 className="text-xl font-bold mb-3">🎯 Actionable Recommendations</h3>
            <p className="text-gray-600">
              Receive CFO-level recommendations to improve performance.
            </p>
          </div>
          
        </div>
      </div>
    </section>
  );
}