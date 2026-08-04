export default function Pricing() {
  return (
    <section className="py-32 bg-white">
      <div className="max-w-6xl mx-auto px-8">

        <h2 className="text-4xl font-bold text-center">
          Simple Pricing
        </h2>

        <p className="text-center text-gray-600 mt-4">
          Simple pricing for every stage of growth.
        </p>

        <div className="grid md:grid-cols-3 gap-8 mt-16">

          <div className="border rounded-2xl p-12 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl">
            <h3 className="text-2xl font-bold">Starter</h3>

            <p className="text-5xl font-bold mt-6">
              $29
              <span className="text-lg text-gray-500">/mo</span>
            </p>

            <ul className="mt-8 space-y-3 text-gray-600">
              <li>✓ QuickBooks Integration</li>
              <li>✓ Monthly AI Report</li>
              <li>✓ KPI Dashboard</li>
            </ul>

            <button className="mt-8 w-full border rounded-lg py-3">
              Get Started
            </button>
          </div>

          <div className="border-2 border-blue-600 rounded-2xl p-12 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl">

            <p className="text-blue-600 font-semibold">
              MOST POPULAR
            </p>

            <h3 className="text-2xl font-bold mt-2">
              Growth
            </h3>

            <p className="text-5xl font-bold mt-6">
              $99
              <span className="text-lg text-gray-500">/mo</span>
            </p>

            <ul className="mt-8 space-y-3 text-gray-600">
              <li>✓ Unlimited Reports</li>
              <li>✓ AI Recommendations</li>
              <li>✓ Cash Flow Insights</li>
              <li>✓ Budget Tracking</li>
            </ul>

            <button className="mt-8 w-full bg-blue-600 text-white rounded-lg py-3">
              Join Early Access
            </button>

          </div>

          <div className="border rounded-2xl p-12 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl">

            <h3 className="text-2xl font-bold">
              Professional
            </h3>

            <p className="text-5xl font-bold mt-6">
              Custom
            </p>

            <ul className="mt-8 space-y-3 text-gray-600">
              <li>✓ Multi-company</li>
              <li>✓ Forecasting</li>
              <li>✓ AI CFO Assistant</li>
              <li>✓ Priority Support</li>
            </ul>

            <button className="mt-8 w-full border rounded-lg py-3">
              Contact Sales
            </button>

          </div>

        </div>

      </div>
    </section>
  );
}