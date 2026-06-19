import { NextRequest, NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";
import { refreshExchangeRates, getAllRates, SUPPORTED_CURRENCIES } from "@/lib/currency";

/**
 * GET /api/exchange-rates?base=INR
 * Returns all exchange rates for the given base currency.
 */
export async function GET(req: NextRequest) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
    }

    const baseParam = req.nextUrl.searchParams.get("base") || "INR";
    const baseCurrency = SUPPORTED_CURRENCIES.includes(baseParam as any) ? baseParam : "INR";

    const rates = await getAllRates(baseCurrency);

    return NextResponse.json({
      success: true,
      data: {
        baseCurrency,
        rates,
        supportedCurrencies: SUPPORTED_CURRENCIES,
      },
    });
  } catch (error: any) {
    console.error("GET /api/exchange-rates error:", error);
    return NextResponse.json({ success: false, message: "Failed to fetch exchange rates" }, { status: 500 });
  }
}

/**
 * POST /api/exchange-rates
 * Force-refresh exchange rates from external API.
 * Body: { baseCurrency?: string }
 * Admin/SuperAdmin only.
 */
export async function POST(req: NextRequest) {
  try {
    const userPayload = await verifyAuth();
    if (!userPayload || !["Admin", "SuperAdmin"].includes(userPayload.role)) {
      return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const baseCurrency = body.baseCurrency || "INR";

    if (!SUPPORTED_CURRENCIES.includes(baseCurrency as any)) {
      return NextResponse.json({ success: false, message: "Unsupported currency" }, { status: 400 });
    }

    await refreshExchangeRates(baseCurrency);
    const rates = await getAllRates(baseCurrency);

    return NextResponse.json({
      success: true,
      message: "Exchange rates refreshed",
      data: rates,
    });
  } catch (error: any) {
    console.error("POST /api/exchange-rates error:", error);
    return NextResponse.json({ success: false, message: "Failed to refresh exchange rates" }, { status: 500 });
  }
}
