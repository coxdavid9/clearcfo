import DashboardPreview from "./DashboardPreview";
export default function Hero() {
  return (
    <section className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center px-8 py-20">
      <div>
        <h1 className="text-6xl font-extrabold leading-tight">
          Your Business Has the Data.
          <br />
          <span className="text-blue-600">
            ClearCFO Gives You the Answers.
          </span>
        </h1>

        <p className="mt-8 text-xl text-gray-600 leading-9">
          Turn your financial data into clear insights,
          actionable recommendations, and better decisions—
          without hiring a full-time CFO.
        </p>

        <div className="flex gap-5 mt-10">
          <button className="bg-blue-600 text-white px-8 py-4 rounded-lg font-semibold">
            Join Early Access
          </button>

          <button className="border px-8 py-4 rounded-lg font-semibold">
            Watch Demo
          </button>
        </div>
      </div>

      <DashboardPreview />
    </section>
  );
}