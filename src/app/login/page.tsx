"use client";

import Image from "next/image";
import { type FormEvent, useState } from "react";

type SignupProfile = {
  companyName: string;
  industry: string;
  companySize: string;
  contactName: string;
  contactPhone: string;
};

const emptyProfile: SignupProfile = {
  companyName: "",
  industry: "",
  companySize: "",
  contactName: "",
  contactPhone: "",
};

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [signupStep, setSignupStep] = useState<1 | 2>(1);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState<SignupProfile>(emptyProfile);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function switchMode(nextMode: "login" | "signup") {
    setMode(nextMode);
    setSignupStep(1);
    setError("");
    setMessage("");
  }

  function updateProfile(field: keyof SignupProfile, value: string) {
    setProfile((current) => ({ ...current, [field]: value }));
  }

  function continueSignup(event: FormEvent) {
    event.preventDefault();
    setError("");
    if (!email.trim() || password.length < 8) {
      setError("Enter a valid email and a password of at least 8 characters.");
      return;
    }
    setSignupStep(2);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    setError("");

    const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";
    const body = mode === "login" ? { email, password } : { email, password, ...profile };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(data.error || "Something went wrong. Please try again.");
        return;
      }

      if (mode === "signup" && data.requiresEmailConfirmation) {
        setMessage("Account created. Check your email to confirm your account, then come back here to sign in.");
        switchMode("login");
        return;
      }

      window.location.href = "/customer";
    } catch {
      setError("We could not reach ClearCFO. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const signup = mode === "signup";

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900 sm:py-16">
      <div className="mx-auto flex max-w-lg flex-col items-center">
        <a href="/" aria-label="ClearCFO home" className="mb-8">
          <Image src="/logo.png" alt="ClearCFO" width={224} height={57} className="h-10 w-auto" priority />
        </a>

        <div className="w-full rounded-3xl border border-slate-200 bg-white p-7 shadow-sm sm:p-9">
          <div className="mb-7">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-600">{signup ? "Create your account" : "Customer Portal"}</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight">
              {signup ? (signupStep === 1 ? "Start your ClearCFO account" : "Tell us about your business") : "Log in to ClearCFO"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              {signup
                ? signupStep === 1
                  ? "Your account gives you a secure workspace for your company's financial intelligence."
                  : "This information helps ClearCFO understand your business and tailor its financial analysis."
                : "Access your financial intelligence workspace."}
            </p>
          </div>

          {signup && (
            <div className="mb-7 flex items-center gap-3" aria-label={`Account setup step ${signupStep} of 2`}>
              {[1, 2].map((step) => (
                <div key={step} className="flex flex-1 items-center gap-3">
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${signupStep >= step ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-400"}`}>{step}</div>
                  <div className="min-w-0 flex-1">
                    <p className={`text-xs font-semibold ${signupStep >= step ? "text-slate-800" : "text-slate-400"}`}>{step === 1 ? "Account" : "Business"}</p>
                    {step === 1 && <div className="mt-1 h-1 rounded-full bg-slate-100"><div className={`h-full rounded-full bg-blue-600 transition-all ${signupStep >= 1 ? "w-full" : "w-0"}`} /></div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          {(!signup || signupStep === 1) ? (
            <form onSubmit={signup ? continueSignup : submit} className="space-y-5">
              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Email address</span>
                <input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="you@company.com" />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Password</span>
                <input type="password" autoComplete={signup ? "new-password" : "current-password"} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="At least 8 characters" />
              </label>

              {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
              {message && <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</p>}

              <button type="submit" disabled={busy} className="w-full rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">
                {signup ? "Continue" : busy ? "Please wait…" : "Log In"}
              </button>
            </form>
          ) : (
            <form onSubmit={submit} className="space-y-5">
              <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3 text-sm text-slate-600">
                <span className="font-semibold text-slate-800">Account:</span> {email}
              </div>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Company name <span className="font-normal text-slate-400">(optional)</span></span>
                <input value={profile.companyName} onChange={(event) => updateProfile("companyName", event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="Your company (optional)" />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Industry <span className="text-red-500">*</span></span>
                <input required value={profile.industry} onChange={(event) => updateProfile("industry", event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="e.g. Professional services" />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Company size <span className="text-red-500">*</span></span>
                <select required value={profile.companySize} onChange={(event) => updateProfile("companySize", event.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100">
                  <option value="">Select company size</option>
                  <option value="1-10">1–10 employees</option>
                  <option value="11-50">11–50 employees</option>
                  <option value="51-200">51–200 employees</option>
                  <option value="201-500">201–500 employees</option>
                  <option value="501+">501+ employees</option>
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Primary contact <span className="text-red-500">*</span></span>
                <input required value={profile.contactName} onChange={(event) => updateProfile("contactName", event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="Name" />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-semibold text-slate-700">Contact phone <span className="font-normal text-slate-400">(optional)</span></span>
                <input type="tel" autoComplete="tel" value={profile.contactPhone} onChange={(event) => updateProfile("contactPhone", event.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-100" placeholder="(555) 555-5555" />
              </label>

              {error && <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

              <div className="flex gap-3">
                <button type="button" onClick={() => { setSignupStep(1); setError(""); }} className="flex-1 rounded-xl border border-slate-300 px-5 py-3.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50">Back</button>
                <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-blue-600 px-5 py-3.5 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{busy ? "Creating…" : "Create Account"}</button>
              </div>
            </form>
          )}

          <div className="mt-7 text-center text-sm text-slate-500">
            {mode === "login" ? "Need an account?" : "Already have an account?"}{" "}
            <button type="button" onClick={() => switchMode(mode === "login" ? "signup" : "login")} className="font-semibold text-blue-600 hover:text-blue-700">
              {mode === "login" ? "Create one" : "Log in"}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-xs leading-5 text-slate-400">Your password is handled by ClearCFO's authentication provider and is never stored by the ClearCFO application itself.</p>
      </div>
    </main>
  );
}
