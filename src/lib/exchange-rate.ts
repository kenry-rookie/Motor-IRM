"use client";

import { useEffect, useState } from "react";

/**
 * The last exchange rate typed at this computer, so the counter doesn't type
 * «36.62» on every dollar payment. Only a starting value: the person can always
 * change it, and the server stores the rate of each payment.
 */
const KEY = "motor-irm.tipo-de-cambio";

export function rememberedRate(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function rememberRate(rate: string) {
  if (!/^\d{1,6}(\.\d{1,4})?$/.test(rate.trim()) || Number(rate) <= 0) return;
  try {
    window.localStorage.setItem(KEY, rate.trim());
  } catch {
    /* without storage it just isn't remembered */
  }
}

/** [rate, setRate]: starts with the remembered rate and remembers what is typed. */
export function useExchangeRate() {
  const [rate, setRate] = useState("");
  useEffect(() => setRate(rememberedRate()), []);
  return [
    rate,
    (v: string) => {
      setRate(v);
      rememberRate(v);
    },
  ] as const;
}
