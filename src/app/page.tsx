import Navbar from "../components/Navbar";
import Image from "next/image";
export default function Home() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      {/* Navigation */}
      <Navbar />

      {/* Hero */}

      <section className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center px-8 py-24">

        <div>

          <h1 className="text-6xl font-extrabold leading-tight">
            Your Business Has the Data.
            <br />
            <span className="text-blue-600">
              ClearCFO Gives You the Answers.
            </span>
          </h1>

          <p className="mt-8 text-xl text-gray-600 leading-9">
            Turn your financial data into clear insights, actionable
            recommendations, and better decisions—without hiring a full-time
            CFO.
          </p>

          <div className="flex gap-5 mt-10">

            <button className="bg-blue-600 text-white px-8 py-4 rounded-xl font-semibold">
              Join Early Access
            </button>

            <button className="border border-gray-300 px-8 py-4 rounded-xl font-semibold">
              Watch Demo
            </button>

          </div>

        </div>

        <div className="rounded-2xl border bg-white shadow-xl p-8">

          <h2 className="text-3xl font-bold mb-2">
            Your CFO Briefing
          </h2>

          <p className="text-gray-500 mb-8">
            Good morning, David. Here are the three things you need to know today.
          </p>

          <div className="space-y-5">

            <div className="border rounded-xl p-5">
              <h3 className="font-semibold">
                Material costs increased 12%
              </h3>

              <p className="text-gray-600 mt-2">
                Impact: $18,000 annual profit risk
              </p>

              <p className="text-red-600 font-semibold mt-3">
                Profit Risk
              </p>
            </div>

            <div className="border rounded-xl p-5">
              <h3 className="font-semibold">
                Inventory growing faster than sales
              </h3>

              <p className="text-gray-600 mt-2">
                Action: Review slow-moving inventory
              </p>

              <p className="text-yellow-600 font-semibold mt-3">
                Cash Flow Opportunity
              </p>
            </div>

            <div className="border rounded-xl p-5">
              <h3 className="font-semibold">
                Revenue trending upward
              </h3>

              <p className="text-gray-600 mt-2">
                Highest-margin products continue improving.
              </p>

              <p className="text-green-600 font-semibold mt-3">
                Positive Trend
              </p>
            </div>

          </div>

        </div>

      </section>
    </main>
  );
}