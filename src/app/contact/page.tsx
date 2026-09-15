import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import ContactForm from "../../components/ContactForm";

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <Navbar loginHref="/login" loginLabel="Log In" signupHref="/login?signup=1" signupLabel="Sign Up" sessionAware />

      <section className="border-b border-slate-200 bg-gradient-to-b from-blue-50/70 via-white to-white px-5 pb-20 pt-10 sm:px-8 sm:pb-24 sm:pt-14">
        <div className="mx-auto max-w-3xl">
          <div className="mb-8">
            <a href="/" className="text-sm font-semibold text-blue-600 hover:text-blue-700">← Back to ClearCFO</a>
          </div>

          <div className="rounded-3xl border border-blue-100 bg-white p-7 shadow-sm sm:p-10">
            <div className="text-center">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Contact ClearCFO</p>
              <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">How can we help?</h1>
              <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-600">
                Tell us what you need and we’ll get back to you.
              </p>
            </div>

            <div className="mx-auto mt-8 max-w-2xl">
              <ContactForm />
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
