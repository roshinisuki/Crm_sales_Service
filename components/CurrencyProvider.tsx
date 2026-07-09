"use client";

import { createContext, useContext, ReactNode, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface CurrencyContextType {
  preferredCurrency: string;
  baseCurrency: string;
  rates: Record<string, number>;
  loading: boolean;
  /** Format an amount to Indian Rupees with Indian number grouping (₹10,000 / ₹1,50,000) */
  formatCurrency: (amount: number) => string;
  /** Convert amount — always returns the same value since currency is fixed to INR */
  convertAmount: (amount: number) => number;
  /** No-op refresh kept for API compatibility */
  refresh: () => void;
}

// ─── INR formatter (en-IN locale → Indian lakh/crore grouping) ───────────────

/** Formats a number as Indian Rupees: ₹10,000 / ₹1,50,000 / ₹18,40,000 */
export function formatINR(amount: number): string {
  if (!isFinite(amount)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(amount);
}

// ─── Context default (always INR, no loading) ─────────────────────────────────

const CurrencyContext = createContext<CurrencyContextType>({
  preferredCurrency: "INR",
  baseCurrency: "INR",
  rates: {},
  loading: false,
  formatCurrency: formatINR,
  convertAmount: (v) => v,
  refresh: () => {},
});

export function useCurrency() {
  return useContext(CurrencyContext);
}

// ─── Provider — always INR, no network calls needed ───────────────────────────

export function CurrencyProvider({ children }: { children: ReactNode }) {
  // Currency is permanently locked to INR — no conversion, no API calls.
  const formatCurrency = useCallback(formatINR, []);
  const convertAmount = useCallback((amount: number) => {
    if (!amount || isNaN(amount)) return 0;
    return amount;
  }, []);
  const refresh = useCallback(() => {}, []);

  return (
    <CurrencyContext.Provider
      value={{
        preferredCurrency: "INR",
        baseCurrency: "INR",
        rates: {},
        loading: false,
        formatCurrency,
        convertAmount,
        refresh,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}
