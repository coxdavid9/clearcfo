# ClearCFO

AI-powered financial intelligence for small and growing businesses.

## Local development

```powershell
npm install
npm run dev
```

On Windows, you can also double-click **START_CLEARCFO.bat**. It will install dependencies if needed and start the local site.

Open http://localhost:3000.

## Demo workflow

The homepage is the public ClearCFO site. The demo login switches into the customer briefing experience so the product can be demonstrated without real authentication. The local workbook analyzer uses deterministic financial rules first, then can pass a compact financial snapshot to the server-side AI reasoning layer for CFO narrative, driver analysis, and prioritized actions.

Click **Upload Excel** and select `demo-data/ClearCFO_Demo_Financials.xlsx` to test the local workbook analysis flow. The dashboard will switch to **Live data** and recalculate KPIs, trend data, alerts, and the recommendation from the workbook.


## Roadmap

- Authentication and customer/company accounts
- Persistent financial datasets per company
- QuickBooks connection
- More robust financial statement mapping
- AI narrative generation, driver analysis, and prioritized actions
- Saved briefings and alerts

## AI CFO Analysis

ClearCFO now has an AI reasoning layer behind the dashboard. The browser sends a compact financial snapshot to `/api/cfo-analysis`; the server calls the OpenAI Responses API and returns a structured CFO analysis containing an executive summary, primary driver, why it matters, a management question, a recommended action, and prioritized actions.

The API key is server-side only. Copy `.env.example` to `.env.local` and set `OPENAI_API_KEY`. The route uses `store: false` for the Responses API request.

Without an API key, the workbook analysis and deterministic recommendations still work; the AI button will show a configuration message instead of failing silently.
## ClearCFO intelligence foundation

The dashboard now separates financial analysis into three layers:

1. **Financial facts** — workbook-derived KPIs and period changes.
2. **Financial drivers** — ranked observable drivers plus relationships between metrics.
3. **AI reasoning** — server-side CFO reasoning using only the supplied snapshot, drivers, and evidence.

The AI endpoint is `/api/cfo-analysis`. Configure `OPENAI_API_KEY` in the server environment (see `.env.example`). The browser never receives the API key.

The AI layer is intentionally conservative: it must distinguish observed facts from interpretation, avoid inventing causes or savings, and treat potential impact as an opportunity rather than a guaranteed result.

## Current ClearCFO Intelligence Architecture

The dashboard now follows this reasoning flow:

**Financial data → KPI analysis → account-level drivers → cross-metric relationships → multi-period signals → prioritized action → AI CFO explanation**

### Reasoning tests

- `npm run test:reasoning` — 8 financial driver scenarios
- `npm run test:trends` — 3 multi-period trend scenarios

A synthetic multi-period workbook is included at:

`demo-data/ClearCFO_Multi_Period_Test_Financials.xlsx`

It is designed to exercise persistent revenue decline, margin compression, rising operating expenses, rising MRO, unusual spend, cash decline, and inventory growth.

## Current intelligence architecture

ClearCFO now follows this reasoning path:

Financial data → KPI analysis → financial drivers → account-level evidence → driver relationships → multi-period patterns → evidence gaps → prioritized management actions → optional AI CFO reasoning.

The deterministic layer remains useful when no AI API key is configured. The AI layer is instructed to use supplied evidence, distinguish facts from inference, and surface evidence gaps rather than inventing causes.

### Current test coverage

- `npm run test:reasoning` — 8 financial reasoning scenarios
- `npm run test:trends` — 3 multi-period trend scenarios

The latest test baseline is **11/11 passing**.


## Before the AI is live

The product UI, workbook analysis, deterministic financial reasoning, dashboard visuals, and AI analysis endpoint are wired together. The remaining setup step for local AI reasoning is the server-side OpenAI key:

1. Copy `.env.example` to `.env.local`
2. Add your `OPENAI_API_KEY`
3. Restart `npm run dev`
4. Open the demo, upload a workbook, and ClearCFO will automatically send the analyzed financial snapshot to the AI reasoning endpoint.

The API key must stay in `.env.local` and must never be placed in a `NEXT_PUBLIC_*` variable.
