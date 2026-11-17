"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { QUIZ_QUESTIONS, scoreQuiz, type QuizAnswer } from "../lib/quiz";
import TrialLine from "./TrialLine";

const primary = "inline-flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600";
const link = "text-sm font-semibold text-blue-700 underline underline-offset-4";

export default function FinancialHealthQuiz() {
  const [step, setStep] = useState(-1);
  const [answers, setAnswers] = useState<QuizAnswer[]>([]);
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [emailStatus, setEmailStatus] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    heading.current?.focus();
  }, [step]);
  const result = step === QUIZ_QUESTIONS.length ? scoreQuiz(answers) : null;
  const question = step >= 0 && step < QUIZ_QUESTIONS.length ? QUIZ_QUESTIONS[step] : null;

  async function sendBreakdown(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    setSending(true);
    setEmailStatus("");
    try {
      const response = await fetch("/api/quiz/email", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, answers }),
      });
      const payload = await response.json();
      setEmailStatus(response.ok ? "Sent — check your inbox." : payload.error || "We couldn't send your breakdown. Please try again.");
    } catch {
      setEmailStatus("We couldn't send your breakdown. Please try again.");
    } finally { setSending(false); }
  }

  return <section className="mx-auto max-w-2xl px-5 py-12 sm:py-20" aria-label="Financial visibility check">
    <p className="mb-4 text-xs font-bold uppercase tracking-[0.18em] text-blue-700">The 1-minute money check</p>
    {step === -1 && <>
      <h1 ref={heading} tabIndex={-1} className="text-4xl font-extrabold tracking-tight outline-none sm:text-5xl">Can you see your money?</h1>
      <p className="mt-6 leading-7 text-slate-600">Answer 8 questions about how you run your business&apos;s money. No numbers needed — this is about what you can see, not what you earn. You&apos;ll get a score and the two blind spots most likely to bite you.</p>
      <p className="mt-4 leading-7 text-slate-600">ClearCFO connects to QuickBooks (or takes an Excel upload) and turns your actual numbers into a plain-language briefing: what changed, why it matters, and what to do first. This quiz shows you where that briefing would look first.</p>
      <button className={`${primary} mt-8`} onClick={() => setStep(0)}>Start the check</button>
      <p className="mt-3 text-sm text-slate-500">About 1 minute. No sign-up to take it.</p>
    </>}
    {question && <>
      <p className="text-sm font-semibold text-slate-600">Question {step + 1} of 8</p>
      <progress aria-label="Questions answered" value={step} max={8} className="mt-3 h-2 w-full overflow-hidden rounded-full accent-blue-600" />
      <h1 ref={heading} tabIndex={-1} className="mt-8 text-2xl font-bold leading-snug tracking-tight outline-none sm:text-3xl">{question.question}</h1>
      <div className="mt-7 grid gap-3" role="group" aria-label="Choose your answer">
        {question.answers.map((answer) => <button key={`${question.key}-${answer.score}`} type="button"
          aria-pressed={answers[step] === answer.score}
          className="min-h-16 rounded-xl border border-slate-300 bg-white px-5 py-4 text-left font-medium leading-6 hover:border-blue-600 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 aria-pressed:border-blue-600 aria-pressed:bg-blue-50"
          onClick={() => { setAnswers([...answers.slice(0, step), answer.score]); setStep(step + 1); }}>
          {answer.label}
        </button>)}
      </div>
      {step > 0 && <button className={`${link} mt-6 min-h-11`} onClick={() => setStep(step - 1)}>Back</button>}
    </>}
    {result && <>
      <p className="text-lg font-semibold text-blue-700">{result.score} out of 16</p>
      <h1 ref={heading} tabIndex={-1} className="mt-2 text-4xl font-extrabold tracking-tight outline-none" aria-live="polite">{result.band.headline}</h1>
      <p className="mt-5 leading-7 text-slate-600">{result.band.copy}</p>
      <p className="mt-4 text-sm text-slate-500">Based on your self-assessment, not an analysis of your books.</p>
      <h2 className="mt-9 text-xl font-bold">Your two biggest blind spots</h2>
      {result.blindSpots.every((spot) => answers[QUIZ_QUESTIONS.indexOf(spot)] === 2) && <p className="mt-2 text-sm text-slate-600">You reported a clear view across all eight checks. These are two areas to keep monitoring.</p>}
      <div className="mt-4 grid gap-4">{result.blindSpots.map((spot) => <article key={spot.key} className="rounded-2xl border border-blue-100 bg-white p-5">
        <h3 className="font-bold">{spot.title}</h3><p className="mt-2 leading-7 text-slate-600">{spot.blurb}</p>
      </article>)}</div>
      <div className="mt-9">
        <a className={`${primary} w-full sm:w-auto`} href="/demo">See a sample briefing</a>
        <p className="mt-2 text-sm leading-6 text-slate-600">A briefing built from fictional books — see what ClearCFO could tell you about yours.</p>
        <a className="mt-5 inline-flex min-h-12 items-center justify-center rounded-xl border border-blue-600 px-6 py-3 font-semibold text-blue-700 hover:bg-blue-50" href="/signup">Start your free trial</a>
        <p className="mt-2 text-xs text-slate-500"><TrialLine /></p>
      </div>
      <div className="mt-10 border-t border-slate-200 pt-6">
        <h2 className="font-semibold">Want this as a one-page breakdown?</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">We&apos;ll email your score and your blind spots so you can keep them.</p>
        <p className="mt-1 text-xs text-slate-500">Optional. Your results are already here. <a href="/privacy" className="underline">Privacy policy</a></p>
        <form onSubmit={sendBreakdown} className="mt-4">
          <label htmlFor="quiz-email" className="text-sm font-medium">Email address</label>
          <div className="mt-2 flex flex-col gap-3 sm:flex-row">
            <input id="quiz-email" name="email" type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="min-h-12 min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-4" />
            <button disabled={sending} className="min-h-12 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold disabled:opacity-60">{sending ? "Sending…" : "Send my breakdown"}</button>
          </div>
        </form>
        <p role="status" className="mt-3 text-sm text-slate-600">{emailStatus}</p>
      </div>
      <button className={`${link} mt-6 min-h-11`} disabled={sending} onClick={() => { setAnswers([]); setStep(-1); setEmail(""); setEmailStatus(""); }}>Retake the check.</button>
    </>}
  </section>;
}
