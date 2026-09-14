# CFO Briefing structure

Phase 1 separates the CFO Briefing's financial data, calculations, analysis helpers, and demo data from the UI component.

- `src/components/CFOBriefing.tsx` — customer-facing UI and React state
- `src/lib/briefing/engine.ts` — briefing types, demo data, workbook parsing, calculations, driver detection, trend analysis, and deterministic briefing logic

The customer-facing behavior is intentionally unchanged. Phase 2 can use this separation to feed QuickBooks and Excel through the same financial-data pipeline.