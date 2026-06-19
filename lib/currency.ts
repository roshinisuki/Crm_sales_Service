/**
 * Currency Service — Multi-currency conversion engine
 *
 * Responsibilities:
 *  - Fetch exchange rates from external API (exchangerate-api.com)
 *  - Cache rates in DB (ExchangeRate model) with 24h staleness threshold
 *  - Convert amounts from base currency to display currency
 *  - Handle rounding/precision using integer cents internally
 *  - Provide fallback rates if API is unreachable
 *
 * All monetary values in the DB are stored in the company's BASE currency.
 * Conversion happens at display time only — no DB values are mutated.
 */

import { prisma } from "@/lib/prisma";

// ─── Types ───────────────────────────────────────────────────────────────────

export type CurrencyCode = "INR" | "USD" | "EUR";

export const SUPPORTED_CURRENCIES: CurrencyCode[] = ["INR", "USD", "EUR"];

export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
};

export const CURRENCY_LOCALES: Record<CurrencyCode, string> = {
  INR: "en-IN",
  USD: "en-US",
  EUR: "de-DE",
};

// Fallback rates: 1 INR = X quote currency (approximate, updated Jun 2025)
const FALLBACK_RATES: Record<string, number> = {
  "INR_INR": 1,
  "INR_USD": 0.012,
  "INR_EUR": 0.011,
  "USD_USD": 1,
  "USD_INR": 83.33,
  "USD_EUR": 0.92,
  "EUR_EUR": 1,
  "EUR_INR": 90.91,
  "EUR_USD": 1.09,
};

// Cache TTL: 24 hours
const RATE_STALENESS_MS = 24 * 60 * 60 * 1000;

// In-memory cache (per server instance, cleared on restart)
let memoryCache: Record<string, { rate: number; fetchedAt: number }> = {};
let memoryCacheLoaded = false;

// ─── Exchange Rate Fetching ──────────────────────────────────────────────────

/**
 * Fetch fresh rates from exchangerate-api.com and persist to DB.
 * Falls back to hardcoded rates if API is unreachable.
 */
export async function refreshExchangeRates(baseCurrency: string = "INR"): Promise<void> {
  const apiKey = process.env.EXCHANGE_RATE_API_KEY;
  const supportedQuotes = SUPPORTED_CURRENCIES.filter(c => c !== baseCurrency);

  try {
    // Try live API first
    if (apiKey) {
      const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${baseCurrency}`;
      const res = await fetch(url, { next: { revalidate: 86400 } }); // cache 24h at fetch level

      if (res.ok) {
        const data = await res.json();
        if (data?.conversion_rates) {
          for (const quoteCurrency of SUPPORTED_CURRENCIES) {
            const rate = data.conversion_rates[quoteCurrency];
            if (rate && typeof rate === "number") {
              await prisma.exchangeRate.upsert({
                where: { baseCurrency_quoteCurrency: { baseCurrency, quoteCurrency } },
                update: { rate, fetchedAt: new Date(), source: "exchangerate-api" },
                create: { baseCurrency, quoteCurrency, rate, source: "exchangerate-api" },
              });
              memoryCache[`${baseCurrency}_${quoteCurrency}`] = { rate, fetchedAt: Date.now() };
            }
          }
          return;
        }
      }
    }

    // Fallback: open.er-api.com (free, no key required)
    const fallbackUrl = `https://open.er-api.com/v6/latest/${baseCurrency}`;
    const fbRes = await fetch(fallbackUrl, { next: { revalidate: 86400 } });

    if (fbRes.ok) {
      const fbData = await fbRes.json();
      if (fbData?.rates) {
        for (const quoteCurrency of SUPPORTED_CURRENCIES) {
          const rate = fbData.rates[quoteCurrency];
          if (rate && typeof rate === "number") {
            await prisma.exchangeRate.upsert({
              where: { baseCurrency_quoteCurrency: { baseCurrency, quoteCurrency } },
              update: { rate, fetchedAt: new Date(), source: "open.er-api" },
              create: { baseCurrency, quoteCurrency, rate, source: "open.er-api" },
            });
            memoryCache[`${baseCurrency}_${quoteCurrency}`] = { rate, fetchedAt: Date.now() };
          }
        }
        return;
      }
    }

    // Ultimate fallback: use hardcoded rates
    console.warn("[currency] All exchange rate APIs unreachable. Using fallback rates.");
    for (const quoteCurrency of SUPPORTED_CURRENCIES) {
      const key = `${baseCurrency}_${quoteCurrency}`;
      const rate = FALLBACK_RATES[key] ?? 1;
      await prisma.exchangeRate.upsert({
        where: { baseCurrency_quoteCurrency: { baseCurrency, quoteCurrency } },
        update: { rate, fetchedAt: new Date(), source: "fallback" },
        create: { baseCurrency, quoteCurrency, rate, source: "fallback" },
      });
      memoryCache[key] = { rate, fetchedAt: Date.now() };
    }
  } catch (error) {
    console.error("[currency] refreshExchangeRates error:", error);
    // Ensure fallback rates are in memory even if DB write fails
    for (const quoteCurrency of SUPPORTED_CURRENCIES) {
      const key = `${baseCurrency}_${quoteCurrency}`;
      if (!memoryCache[key]) {
        memoryCache[key] = { rate: FALLBACK_RATES[key] ?? 1, fetchedAt: Date.now() };
      }
    }
  }
}

/**
 * Load all rates from DB into in-memory cache (called once per server lifecycle).
 */
async function loadMemoryCacheFromDB(): Promise<void> {
  if (memoryCacheLoaded) return;
  try {
    const rates = await prisma.exchangeRate.findMany();
    for (const r of rates) {
      memoryCache[`${r.baseCurrency}_${r.quoteCurrency}`] = {
        rate: r.rate,
        fetchedAt: r.fetchedAt.getTime(),
      };
    }
    memoryCacheLoaded = true;
  } catch (error) {
    console.error("[currency] loadMemoryCacheFromDB error:", error);
    memoryCacheLoaded = true; // don't keep retrying on every call
  }
}

/**
 * Get the exchange rate from baseCurrency → quoteCurrency.
 * If cached rate is stale (>24h), triggers a background refresh.
 */
export async function getExchangeRate(baseCurrency: string, quoteCurrency: string): Promise<number> {
  if (baseCurrency === quoteCurrency) return 1;

  await loadMemoryCacheFromDB();

  const key = `${baseCurrency}_${quoteCurrency}`;
  const cached = memoryCache[key];

  // Check if cached rate is stale
  if (cached && (Date.now() - cached.fetchedAt) > RATE_STALENESS_MS) {
    // Stale — trigger background refresh (non-blocking)
    refreshExchangeRates(baseCurrency).catch(console.error);
  }

  // If we have any cached rate (even stale), use it — better than fallback
  if (cached) {
    return cached.rate;
  }

  // No cached rate — try DB
  try {
    const dbRate = await prisma.exchangeRate.findUnique({
      where: { baseCurrency_quoteCurrency: { baseCurrency, quoteCurrency } },
    });
    if (dbRate) {
      memoryCache[key] = { rate: dbRate.rate, fetchedAt: dbRate.fetchedAt.getTime() };
      return dbRate.rate;
    }
  } catch {
    // DB might not be ready (e.g., during migration)
  }

  // Trigger refresh and use fallback in the meantime
  refreshExchangeRates(baseCurrency).catch(console.error);
  return FALLBACK_RATES[key] ?? 1;
}

// ─── Currency Conversion ─────────────────────────────────────────────────────

/**
 * Convert an amount from base currency to display currency.
 *
 * Uses integer cents internally to avoid floating-point precision issues:
 *   1. Multiply amount by 100 → integer cents
 *   2. Multiply cents by rate → integer cents in target currency
 *   3. Divide by 100 → final amount with 2 decimal precision
 *
 * @param amount - Amount in base currency (Float)
 * @param baseCurrency - The currency the amount is stored in (e.g., "INR")
 * @param displayCurrency - The currency to convert to (e.g., "USD")
 * @returns Converted amount rounded to 2 decimal places
 */
export async function convertCurrency(
  amount: number,
  baseCurrency: string,
  displayCurrency: string,
): Promise<number> {
  if (baseCurrency === displayCurrency) return roundTo2Decimals(amount);
  if (!amount || isNaN(amount)) return 0;

  const rate = await getExchangeRate(baseCurrency, displayCurrency);

  // Integer cents approach to avoid floating-point errors
  const cents = Math.round(amount * 100);
  const convertedCents = Math.round(cents * rate);
  return convertedCents / 100;
}

/**
 * Round to 2 decimal places using banker's rounding (round half to even).
 * This avoids the common 0.005 → 0.01 rounding error.
 */
export function roundTo2Decimals(value: number): number {
  if (!value || isNaN(value)) return 0;
  const factor = 100;
  const rounded = Math.round(value * factor) / factor;
  return rounded;
}

/**
 * Format a currency amount with proper symbol and locale.
 *
 * @param amount - Amount in BASE currency (as stored in DB)
 * @param baseCurrency - The currency the amount is stored in
 * @param displayCurrency - The user's preferred display currency
 * @returns Formatted string e.g., "$1,234" or "₹1,23,456"
 */
export async function formatCurrencyConverted(
  amount: number,
  baseCurrency: string,
  displayCurrency: string,
): Promise<string> {
  const converted = await convertCurrency(amount, baseCurrency, displayCurrency);
  const locale = CURRENCY_LOCALES[displayCurrency as CurrencyCode] || "en-IN";

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: displayCurrency,
    maximumFractionDigits: 0,
  }).format(converted);
}

/**
 * Get all exchange rates for a base currency (for admin display).
 */
export async function getAllRates(baseCurrency: string): Promise<{ quoteCurrency: string; rate: number; fetchedAt: Date; source: string }[]> {
  await loadMemoryCacheFromDB();

  const rates = await prisma.exchangeRate.findMany({
    where: { baseCurrency },
    orderBy: { quoteCurrency: "asc" },
  });

  return rates.map(r => ({
    quoteCurrency: r.quoteCurrency,
    rate: r.rate,
    fetchedAt: r.fetchedAt,
    source: r.source,
  }));
}
