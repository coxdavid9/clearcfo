import fs from "node:fs";

const path = "src/components/CFOBriefing.tsx";
let source = fs.readFileSync(path, "utf8");

const oldUpload = `      setData(analyzed);\n      await generateAIAnalysis(analyzed);`;
const newUpload = `      setData(analyzed);\n      // Testing mode: upload updates the deterministic dashboard only.\n      // AI reasoning is intentionally manual until the financial engine is validated.\n      setAiAnalysis(null);\n      setAiError(\"\");`;

if (!source.includes(oldUpload)) {
  throw new Error("Expected upload/AI coupling was not found; refusing to patch blindly.");
}

source = source.replace(oldUpload, newUpload);

const marker = `  async function generateAIAnalysis(inputData: BriefingData = data) {`;
const guarded = `  async function generateAIAnalysis(inputData: BriefingData = data) {`;

if (!source.includes(marker)) {
  throw new Error("generateAIAnalysis function was not found.");
}

fs.writeFileSync(path, source);
console.log("ClearCFO test flow prepared: upload no longer automatically invokes AI analysis.");
