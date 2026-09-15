"use client";

import { FormEvent, useState } from "react";

const topics = [
  "General question",
  "Getting started",
  "QuickBooks connection",
  "Billing or pricing",
  "Something isn't working",
  "Other",
];

export default function Contact() {
  const [topic, setTopic] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [website, setWebsite] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setError("");

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, email, message, website }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload?.error || "We couldn't send your message.");

      setStatus("success");
      setTopic("");
      setEmail("");
      setMessage("");
      setWebsite("");
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : "We couldn't send your message.");
    }
  }

  return (
    <section id="contact" className="scroll-mt-24 border-t border-slate-200 bg-white px-5 py-20 sm:px-8 lg:py-24">
      <div className="mx-auto max-w-4xl rounded-3xl border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-white p-8 shadow-sm sm:p-12">
        <div className="text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-blue-600">Contact ClearCFO</p>
          <h2 className="mt-3 text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Have questions about ClearCFO?</h2>
          <p className="mx-auto mt-4 max-w-2xl leading-7 text-slate-600">
            Tell us what you need and we’ll get back to you.
          </p>
        </div>

        {status === "success" ? (
          <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center">
            <p className="font-semibold text-emerald-900">Message sent.</p>
            <p className="mt-1 text-sm text-emerald-800">Thanks for reaching out. We’ll get back to you soon.</p>
            <button
              type="button"
              onClick={() => setStatus("idle")}
              className="mt-4 text-sm font-semibold text-emerald-900 underline underline-offset-4"
            >
              Send another message
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="mx-auto mt-8 max-w-2xl space-y-5 text-left">
            <div>
              <label htmlFor="contact-topic" className="mb-2 block text-sm font-semibold text-slate-800">What can we help with?</label>
              <select
                id="contact-topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
                required
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">Select a topic</option>
                {topics.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>

            <div>
              <label htmlFor="contact-email" className="mb-2 block text-sm font-semibold text-slate-800">Email</label>
              <input
                id="contact-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                maxLength={254}
                placeholder="you@company.com"
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div>
              <label htmlFor="contact-message" className="mb-2 block text-sm font-semibold text-slate-800">Message</label>
              <textarea
                id="contact-message"
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                required
                maxLength={5000}
                rows={6}
                placeholder="Tell us how we can help..."
                className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div aria-hidden="true" className="absolute left-[-9999px] h-px w-px overflow-hidden">
              <label htmlFor="contact-website">Website</label>
              <input id="contact-website" value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" />
            </div>

            {status === "error" && <p className="text-sm font-medium text-red-600" role="alert">{error}</p>}

            <button
              type="submit"
              disabled={status === "sending"}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              {status === "sending" ? "Sending…" : "Send message"}
            </button>
          </form>
        )}
      </div>
    </section>
  );
}
