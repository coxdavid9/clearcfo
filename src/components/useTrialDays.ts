"use client";
import { useEffect, useState } from "react";
import { currentTrialDays, TRIAL_DAYS } from "../lib/pricing";
export function useTrialDays(): number {
 const [days, setDays] = useState<number>(TRIAL_DAYS);
 useEffect(() => { setDays(currentTrialDays()); }, []);
 return days;
}
