// Shared public quiz copy and deterministic scoring; no financial data is used.
export type QuizAnswer = 0 | 1 | 2;
export const QUIZ_QUESTIONS = [
  {
    "key": "q1",
    "question": "If sales stopped tomorrow, how long could your business keep paying its bills?",
    "answers": [
      {
        "label": "I know almost exactly",
        "score": 2
      },
      {
        "label": "I have a rough idea",
        "score": 1
      },
      {
        "label": "I'd be guessing",
        "score": 0
      }
    ],
    "title": "Cash runway",
    "blurb": "You don't know how long your cash lasts if sales dip. This is the number that turns a slow month into an emergency — or just a slow month."
  },
  {
    "key": "q2",
    "question": "When did you last know your real cash position — cash on hand, plus what's owed to you, minus what you owe?",
    "answers": [
      {
        "label": "This week",
        "score": 2
      },
      {
        "label": "Sometime this month",
        "score": 1
      },
      {
        "label": "I mostly go by the bank balance",
        "score": 0
      }
    ],
    "title": "Real cash position",
    "blurb": "The bank balance lies by omission: it doesn't show the checks you've written, the invoices you're owed, or the bills coming due."
  },
  {
    "key": "q3",
    "question": "Do you know which product, service, or job makes you the most money — and which one quietly loses it?",
    "answers": [
      {
        "label": "Yes, I can name both",
        "score": 2
      },
      {
        "label": "I have a feeling, but no numbers",
        "score": 1
      },
      {
        "label": "No idea",
        "score": 0
      }
    ],
    "title": "Margin by product or job",
    "blurb": "Overall profit can hide a product or job that loses money on every sale. Busy and profitable are not the same thing."
  },
  {
    "key": "q4",
    "question": "If your biggest customer left tomorrow, do you know how big the hole would be?",
    "answers": [
      {
        "label": "Yes, I've seen the number",
        "score": 2
      },
      {
        "label": "It would hurt — not sure how much",
        "score": 1
      },
      {
        "label": "I've never thought about it",
        "score": 0
      }
    ],
    "title": "Customer concentration",
    "blurb": "If one customer is a big share of your revenue, their bad month becomes your bad quarter."
  },
  {
    "key": "q5",
    "question": "Right now, how much are you owed that's already past due?",
    "answers": [
      {
        "label": "I know, and we follow up on it",
        "score": 2
      },
      {
        "label": "I could look it up if I had to",
        "score": 1
      },
      {
        "label": "No idea",
        "score": 0
      }
    ],
    "title": "Past-due receivables",
    "blurb": "Money you've already earned but haven't collected is a loan you're giving your customers for free."
  },
  {
    "key": "q6",
    "question": "If a regular cost had crept up 20% over the last few months, would you catch it?",
    "answers": [
      {
        "label": "Yes, quickly",
        "score": 2
      },
      {
        "label": "Probably at tax time",
        "score": 1
      },
      {
        "label": "Probably never",
        "score": 0
      }
    ],
    "title": "Expense creep",
    "blurb": "Small increases in regular costs compound quietly. A 20% creep across a few lines can erase a thin margin without a single dramatic bill."
  },
  {
    "key": "q7",
    "question": "Do you know what's going out in the next 30 days — payroll, rent, loan payments, big bills — and that the cash covers it?",
    "answers": [
      {
        "label": "Yes, I can see it coming",
        "score": 2
      },
      {
        "label": "The big ones, yes; the rest is fuzzy",
        "score": 1
      },
      {
        "label": "I find out when it hits the account",
        "score": 0
      }
    ],
    "title": "The next 30 days",
    "blurb": "Payroll and rent don't care whether a big invoice got paid late. Seeing outflows before they land is the whole game."
  },
  {
    "key": "q8",
    "question": "How long after the month ends do you know whether you actually made money?",
    "answers": [
      {
        "label": "Within a few days",
        "score": 2
      },
      {
        "label": "A few weeks",
        "score": 1
      },
      {
        "label": "When my accountant tells me — or at tax time",
        "score": 0
      }
    ],
    "title": "Slow month-end",
    "blurb": "If you learn you lost money six weeks after it happened, you're steering by the rearview mirror."
  }
] as const;
export const QUIZ_BANDS = [
  {
    "min": 13,
    "max": 16,
    "headline": "Clear view",
    "copy": "You can see your money. Most owners can't say that. The risk at your level isn't blindness — it's drift: a margin slipping a point at a time, one customer quietly becoming half your revenue. ClearCFO re-checks these numbers every time your books sync, so the drift gets flagged while it's still small."
  },
  {
    "min": 8,
    "max": 12,
    "headline": "Partial view",
    "copy": "You can see some of your money — and the gaps are specific, not general. That's good news: you don't need a finance department, you need the missing checks running automatically. ClearCFO connects to QuickBooks or an Excel upload and checks cash, margin, receivables, and customer concentration every sync, then tells you in plain language what changed and what to do first."
  },
  {
    "min": 0,
    "max": 7,
    "headline": "Flying blind",
    "copy": "You're running the business on the bank balance and gut feel. That's how most owners run — right up until a cash crunch, a deadbeat customer, or a money-losing product blindsides them. None of your blind spots need an accountant to fix. They need the checks running: ClearCFO reads your QuickBooks or Excel numbers and turns them into a briefing that flags exactly these things, in plain language, every sync."
  }
] as const;

export function isQuizAnswers(value: unknown): value is QuizAnswer[] {
  return Array.isArray(value) && value.length === QUIZ_QUESTIONS.length &&
    value.every((answer) => Number.isInteger(answer) && answer >= 0 && answer <= 2);
}

export function scoreQuiz(answers: readonly QuizAnswer[]) {
  if (!isQuizAnswers(answers)) throw new Error("Please answer all eight questions.");
  const score = answers.reduce<number>((sum, answer) => sum + answer, 0);
  const band = QUIZ_BANDS.find((band) => score >= band.min && score <= band.max)!;
  const blindSpots = QUIZ_QUESTIONS.map((question, index) => ({ question, index, score: answers[index] }))
    .sort((a, b) => a.score - b.score || a.index - b.index)
    .slice(0, 2).map(({ question }) => question);
  return { score, band, blindSpots };
}
