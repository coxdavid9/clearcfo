export default function DashboardPreview() {
  return (
    <div className="bg-white rounded-3xl shadow-xl border p-8">

      <h2 className="text-2xl font-bold mb-8">
        Your CFO Dashboard
      </h2>

      <div className="grid grid-cols-2 gap-4">

        <div className="border rounded-xl p-4 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl">
          <p className="text-gray-500 text-sm">Revenue</p>
          <p className="text-3xl font-bold">$2.4M</p>
          <p className="text-green-600 font-semibold">▲ 12%</p>
        </div>

        <div className="border rounded-xl p-4 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl">
          <p className="text-gray-500 text-sm">Gross Margin</p>
          <p className="text-3xl font-bold">31.8%</p>
          <p className="text-green-600 font-semibold">▲ 2.4%</p>
        </div>

        <div className="border rounded-xl p-4 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl">
          <p className="text-gray-500 text-sm">Cash Flow</p>
          <p className="text-3xl font-bold text-green-600">
            +$142K
          </p>
        </div>

        <div className="border rounded-xl p-4 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl">
          <p className="text-gray-500 text-sm">Open AI Alerts</p>
          <p className="text-3xl font-bold text-red-500">
            3
          </p>
        </div>

      </div>

      <div className="mt-8 rounded-2xl bg-blue-50 border border-blue-200 p-6 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl">

        <p className="text-blue-700 font-semibold">
          🤖 AI Recommendation
        </p>

        <h3 className="text-xl font-bold mt-3">
          Reduce inventory purchases by 8%
        </h3>

        <p className="mt-3 text-gray-600">
          Current inventory is increasing faster than sales.
          Estimated cash flow improvement:
        </p>

        <p className="text-3xl font-bold text-green-600 mt-4">
          +$87,000
        </p>

      </div>

    </div>
  );
}