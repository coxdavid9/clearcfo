export default function Navbar() {
  return (
    <nav className="max-w-7xl mx-auto flex items-center justify-between py-6 px-8">
      <div className="text-3xl font-bold">
        Clear<span className="text-blue-600">CFO</span>
      </div>

      <div className="hidden md:flex gap-8 text-sm font-medium">
        <a href="#">Product</a>
        <a href="#">How It Works</a>
        <a href="#">Pricing</a>
        <a href="#">Resources</a>
        <a href="#">About</a>
      </div>

      <div className="flex gap-4">
        <button>Sign In</button>

        <button className="bg-blue-600 text-white px-6 py-2 rounded-lg font-semibold hover:bg-blue-700">
          Join Early Access
        </button>
      </div>
    </nav>
  );
}