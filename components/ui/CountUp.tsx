"use client";

import { useEffect, useRef, useState } from "react";

interface CountUpProps {
  end: number;
  duration?: number;
  decimals?: number;
  prefix?: string;
  suffix?: string;
  separator?: boolean;
  className?: string;
}

function easeOutExpo(t: number): number {
  return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

export function CountUp({
  end,
  duration = 1200,
  decimals = 0,
  prefix = "",
  suffix = "",
  separator = true,
  className,
}: CountUpProps) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<number | null>(null);
  const fromRef = useRef(0);

  useEffect(() => {
    const from = fromRef.current;
    startRef.current = null;
    const animate = (ts: number) => {
      if (startRef.current === null) startRef.current = ts;
      const progress = Math.min((ts - startRef.current) / duration, 1);
      const eased = easeOutExpo(progress);
      const current = from + (end - from) * eased;
      setDisplay(current);
      fromRef.current = current;
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      } else {
        setDisplay(end);
        fromRef.current = end;
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [end, duration]);

  const formatted = display.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    useGrouping: separator,
  });

  return (
    <span className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}

/**
 * Parses a numeric or string value into CountUp props.
 * Handles currency-formatted strings, percentages, and plain numbers.
 */
export function parseCountValue(value: number | string): {
  end: number;
  prefix: string;
  suffix: string;
  decimals: number;
} {
  if (typeof value === "number") {
    return { end: value, prefix: "", suffix: "", decimals: 0 };
  }
  const str = String(value);
  // Currency like ₹1,234.56 or $1,234
  const currencyMatch = str.match(/^([^\d-]*)([\d,]+\.?\d*)$/);
  if (currencyMatch) {
    const prefix = currencyMatch[1] || "";
    const numStr = currencyMatch[2].replace(/,/g, "");
    const num = parseFloat(numStr);
    const decimals = numStr.includes(".") ? numStr.split(".")[1].length : 0;
    return { end: isNaN(num) ? 0 : num, prefix, suffix: "", decimals };
  }
  // Percentage like "12.5%"
  const pctMatch = str.match(/^([\d.]+)%$/);
  if (pctMatch) {
    const num = parseFloat(pctMatch[1]);
    const decimals = pctMatch[1].includes(".") ? pctMatch[1].split(".")[1].length : 0;
    return { end: isNaN(num) ? 0 : num, prefix: "", suffix: "%", decimals };
  }
  // Fallback: try to extract a number
  const fallback = parseFloat(str.replace(/[^0-9.-]/g, ""));
  return { end: isNaN(fallback) ? 0 : fallback, prefix: "", suffix: "", decimals: 0 };
}
