"use client";
import { useTrialDays } from "./useTrialDays";
export default function TrialLine({ button = false }: { button?: boolean }) {
 const days = useTrialDays();
 return <>{button ? `Start your ${days}-day free trial` : `${days}-day free trial · Credit card required`}</>;
}
