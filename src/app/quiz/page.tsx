import type { Metadata } from "next";
import Navbar from "../../components/Navbar";
import Footer from "../../components/Footer";
import FinancialHealthQuiz from "../../components/FinancialHealthQuiz";

export const metadata: Metadata = {
  title: "Can you see your money? | ClearCFO",
  description: "Take a free, one-minute financial visibility check. Eight questions, instant results, no financial figures or sign-up required.",
};

export default function QuizPage() {
  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <Navbar loginHref="/login" signupHref="/signup" />
    <FinancialHealthQuiz />
    <Footer />
  </main>;
}
