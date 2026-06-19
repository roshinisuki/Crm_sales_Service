"use server";

import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { logAudit } from "@/lib/audit";
import { revalidatePath } from "next/cache";
import { SUPPORTED_CURRENCIES, CurrencyCode, refreshExchangeRates, getAllRates } from "@/lib/currency";

/**
 * Get the current user's preferred display currency + company base currency.
 */
export async function getCurrencySettingsAction() {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) {
      return { success: false, message: "Unauthorized" };
    }

    const user = await prisma.user.findUnique({
      where: { id: userPayload.id },
      select: { preferredCurrency: true, companyId: true },
    });

    if (!user) {
      return { success: false, message: "User not found" };
    }

    let baseCurrency = "INR";
    if (user.companyId) {
      const company = await prisma.company.findUnique({
        where: { id: user.companyId },
        select: { baseCurrency: true },
      });
      baseCurrency = company?.baseCurrency || "INR";
    }

    return {
      success: true,
      data: {
        preferredCurrency: user.preferredCurrency || "INR",
        baseCurrency,
        supportedCurrencies: SUPPORTED_CURRENCIES,
      },
    };
  } catch (error: any) {
    console.error("getCurrencySettingsAction error:", error);
    return { success: false, message: "Failed to fetch currency settings" };
  }
}

/**
 * Update the current user's preferred display currency.
 * Called from the Settings page dropdown.
 */
export async function updatePreferredCurrencyAction(currency: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) {
      return { success: false, message: "Unauthorized" };
    }

    // Validate currency code
    if (!SUPPORTED_CURRENCIES.includes(currency as CurrencyCode)) {
      return { success: false, message: `Unsupported currency: ${currency}` };
    }

    await prisma.user.update({
      where: { id: userPayload.id },
      data: { preferredCurrency: currency },
    });

    await logAudit(
      userPayload.id,
      "user-settings",
      "update",
      `Preferred display currency changed to ${currency}`
    );

    revalidatePath("/settings");
    revalidatePath("/dashboard");

    return { success: true, message: "Currency preference updated" };
  } catch (error: any) {
    console.error("updatePreferredCurrencyAction error:", error);
    return { success: false, message: "Failed to update currency preference" };
  }
}

/**
 * Update the company's base currency (Admin/SuperAdmin only).
 * Base currency is the currency in which all transactions are stored.
 * Changing this does NOT retroactively convert existing data —
 * it only affects new transactions going forward.
 */
export async function updateBaseCurrencyAction(currency: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    if (!SUPPORTED_CURRENCIES.includes(currency as CurrencyCode)) {
      return { success: false, message: `Unsupported currency: ${currency}` };
    }

    if (!userPayload.companyId) {
      return { success: false, message: "No company associated with user" };
    }

    await prisma.company.update({
      where: { id: userPayload.companyId },
      data: { baseCurrency: currency },
    });

    // Refresh exchange rates for the new base currency
    await refreshExchangeRates(currency);

    await logAudit(
      userPayload.id,
      "company-settings",
      "update",
      `Base currency changed to ${currency}. New transactions will use this currency.`
    );

    revalidatePath("/settings");

    return { success: true, message: "Base currency updated. New transactions will use this currency." };
  } catch (error: any) {
    console.error("updateBaseCurrencyAction error:", error);
    return { success: false, message: "Failed to update base currency" };
  }
}

/**
 * Force-refresh exchange rates from API (Admin only).
 */
export async function refreshRatesAction(baseCurrency?: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SuperAdmin"].includes(userPayload.role)) {
      return { success: false, message: "Unauthorized" };
    }

    const base = baseCurrency || "INR";
    await refreshExchangeRates(base);
    const rates = await getAllRates(base);

    return { success: true, message: "Exchange rates refreshed", data: rates };
  } catch (error: any) {
    console.error("refreshRatesAction error:", error);
    return { success: false, message: "Failed to refresh exchange rates" };
  }
}

/**
 * Get current exchange rates for display (Admin settings page).
 */
export async function getExchangeRatesAction(baseCurrency?: string) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) {
      return { success: false, message: "Unauthorized" };
    }

    const base = baseCurrency || "INR";
    const rates = await getAllRates(base);

    return { success: true, data: rates };
  } catch (error: any) {
    console.error("getExchangeRatesAction error:", error);
    return { success: false, message: "Failed to fetch exchange rates" };
  }
}
