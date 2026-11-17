import { escapeHtml } from "./email";
import { scoreQuiz, type QuizAnswer } from "./quiz";

export function buildQuizEmail(to: string, answers: QuizAnswer[]) {
  const { score, band, blindSpots } = scoreQuiz(answers);
  const base = "https://theclearcfo.com";
  const monitoringNote = answers.every((answer) => answer === 2) ? "You reported a clear view across all eight checks. These are two areas to keep monitoring." : "";
  const text = [
    `Your ClearCFO money check: ${score} out of 16 — ${band.headline}`,
    "Based on your self-assessment, not an analysis of your books.",
    band.copy, "Your two biggest blind spots:", monitoringNote,
    ...blindSpots.map((spot) => `${spot.title}: ${spot.blurb}`),
    `See a sample briefing: ${base}/demo`, `Start your free trial: ${base}/signup`,
  ].join("\n\n");
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:24px 12px;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;color:#0F172A;line-height:1.6"><div style="max-width:600px;margin:auto;background:white;padding:24px"><img src="${base}/logo.png" alt="ClearCFO" height="48" style="display:block;height:48px;width:auto;max-width:100%"><h1 style="font-size:24px">${score} out of 16 — ${escapeHtml(band.headline)}</h1><p>Based on your self-assessment, not an analysis of your books.</p><p>${escapeHtml(band.copy)}</p><h2 style="font-size:20px">Your two biggest blind spots</h2>${monitoringNote ? `<p>${monitoringNote}</p>` : ""}${blindSpots.map((spot) => `<h3 style="font-size:16px">${escapeHtml(spot.title)}</h3><p>${escapeHtml(spot.blurb)}</p>`).join("")}<p><a style="color:#2563EB" href="${base}/demo">See a sample briefing</a></p><p><a style="color:#2563EB" href="${base}/signup">Start your free trial</a></p><hr style="border:0;border-top:1px solid #e2e8f0"><p style="font-size:12px;color:#64748b">ClearCFO · Financial clarity. Smarter decisions.<br>You requested this breakdown from the ClearCFO money check.<br><a href="mailto:support@theclearcfo.com">support@theclearcfo.com</a></p></div></body></html>`;
  return { to, subject: "Your ClearCFO money check breakdown", text, html };
}
