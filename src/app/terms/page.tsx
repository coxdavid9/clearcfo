import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import { LEGAL_VERSION, TERMS_SECTIONS } from "../../lib/legal";
export const metadata = { title: "Terms of Service | ClearCFO" };
export default function LegalPage() { return <><Navbar loginHref="/login" signupHref="/signup" sessionAware /><main className="mx-auto max-w-3xl px-5 py-14 sm:px-8"><h1 className="text-3xl font-bold text-slate-900">Terms of Service</h1><p className="mt-3 text-sm text-slate-500">Effective date: {LEGAL_VERSION} · ClearCFO LLC</p><div className="mt-6 flex gap-5 text-sm text-blue-600"><a href="/terms">Terms of Service</a><a href="/privacy">Privacy Policy</a></div>{TERMS_SECTIONS.map(([heading, text], i) => <section key={heading} className="mt-8"><h2 className="text-xl font-semibold text-slate-900">{i + 1}. {heading}</h2><p className="mt-3 leading-7 text-slate-600">{text}</p></section>)}</main><Footer /></>; }
