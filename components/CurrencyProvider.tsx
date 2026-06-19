"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { getCurrencySettingsAction, getExchangeRatesAction } from "@/app/actions/currency";
import { CURRENCY_LOCALES, CurrencyCode } from "@/lib/currency";

// ─── Types ───────────────────────────────────────────────────────────────────

interface CurrencyContextType {
  preferredCurrency: string;
  baseCurrency: string;
  rates: Record<string, number>; // "INR_USD" → 0.012
  loading: boolean;
  /** Format an amount (in base currency) to the user's preferred currency */
  formatCurrency: (amount: number) => string;
  /** Convert an amount from base currency to preferred currency (returns number) */
  convertAmount: (amount: number) => number;
  /** Refresh rates from server */
  refresh: () => void;
}

const CurrencyContext = createContext<CurrencyContextType>({
  preferredCurrency: "INR",
  baseCurrency: "INR",
  rates: {},
  loading: true,
  formatCurrency: (v) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v),
  convertAmount: (v) => v,
  refresh: () => {},
});

export function useCurrency() {
  return useContext(CurrencyContext);
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [preferredCurrency, setPreferredCurrency] = useState("INR");
  const [baseCurrency, setBaseCurrency] = useState("INR");
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [settingsRes, ratesRes] = await Promise.all([
        getCurrencySettingsAction(),
        getExchangeRatesAction(),
      ]);

      if (settingsRes.success && settingsRes.data) {
        setPreferredCurrency(settingsRes.data.preferredCurrency);
        setBaseCurrency(settingsRes.data.baseCurrency);
      }

      if (ratesRes.success && ratesRes.data) {
        const base = settingsRes.success && settingsRes.data ? settingsRes.data.baseCurrency : "INR";
        const rateMap: Record<string, number> = {};
        for (const r of ratesRes.data) {
          rateMap[`${base}_${r.quoteCurrency}`] = r.rate;
        }
        setRates(rateMap);
      }
    } catch (error) {
      console.error("CurrencyProvider load error:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ─── Conversion (client-side, synchronous) ────────────────────────────────

  const convertAmount = useCallback(
    (amount: number): number => {
      if (!amount || isNaN(amount)) return 0;
      if (baseCurrency === preferredCurrency) return amount;

      const key = `${baseCurrency}_${preferredCurrency}`;
      const rate = rates[key];

      if (!rate) {
        // No rate available — return original amount (graceful degradation)
        return amount;
      }

      // Integer cents approach to avoid floating-point errors
      const cents = Math.round(amount * 100);
      const convertedCents = Math.round(cents * rate);
      return convertedCents / 100;
    },
    [baseCurrency, preferredCurrency, rates],
  );

  const formatCurrency = useCallback(
    (amount: number): string => {
      const converted = convertAmount(amount);
      const locale = CURRENCY_LOCALES[preferredCurrency as CurrencyCode] || "en-IN";

      return new Intl.NumberFormat(locale, {
        style: "currency",
        currency: preferredCurrency,
        maximumFractionDigits: 0,
      }).format(converted);
    },
    [convertAmount, preferredCurrency],
  );

  const refresh = useCallback(() => {
    setLoading(true);
    load();
  }, [load]);

  return (
    <CurrencyContext.Provider
      value={{
        preferredCurrency,
        baseCurrency,
        rates,
        loading,
        formatCurrency,
        convertAmount,
        refresh,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}
