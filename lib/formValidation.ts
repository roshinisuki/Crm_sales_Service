export function validateEmail(value: string): string {
  if (!value) return "";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return "Please enter a valid email address";
  return "";
}

export function validatePhone(value: string): string {
  if (!value) return "";
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10) return "Please enter a valid 10-digit phone number";
  if (digits.length > 15) return "Phone number is too long (max 15 digits)";
  if (!/^\+?[0-9\s-]+$/.test(value)) return "Please use numbers only (digits, spaces, +, - allowed)";
  return "";
}

export function validateNumeric(value: string, label = "This field"): string {
  if (!value) return "";
  if (!/^-?\d*\.?\d+$/.test(value)) return `Please use numeric values only in ${label}`;
  return "";
}

export function validatePositiveNumeric(value: string, label = "This field"): string {
  if (!value) return "";
  if (!/^-?\d*\.?\d+$/.test(value)) return `Please use numeric values only in ${label}`;
  if (parseFloat(value) <= 0) return `${label} must be greater than 0`;
  return "";
}

export function validateCurrency(value: string, label = "This field"): string {
  if (!value) return "";
  if (!/^\d*\.?\d+$/.test(value)) return `Please enter a valid amount in ${label} (numbers only)`;
  if (parseFloat(value) < 0) return `${label} cannot be negative`;
  return "";
}

export function validateAlphabetic(value: string, label = "This field"): string {
  if (!value) return "";
  if (!/^[a-zA-Z\s.]+$/.test(value)) return `Please use alphabetic characters only in ${label}`;
  return "";
}

export function validateAlphanumeric(value: string, label = "This field"): string {
  if (!value) return "";
  if (!/^[a-zA-Z0-9\s\-]+$/.test(value)) return `Please use alphanumeric characters only in ${label}`;
  return "";
}

export function validatePercentage(value: string, label = "Discount"): string {
  if (!value) return "";
  if (!/^-?\d*\.?\d+$/.test(value)) return `Please use numeric values only in ${label}`;
  const num = parseFloat(value);
  if (num < 0 || num > 100) return `${label} must be between 0 and 100`;
  return "";
}

export function validateUrl(value: string): string {
  if (!value) return "";
  try {
    new URL(value);
  } catch {
    return "Please enter a valid URL (e.g. https://example.com)";
  }
  return "";
}

export function validateMinLength(value: string, min: number, label = "This field"): string {
  if (!value) return "";
  if (value.trim().length < min) return `${label} must be at least ${min} characters`;
  return "";
}

export function validateDateRange(startDate: string, endDate: string, startLabel = "Start date", endLabel = "End date"): string {
  if (!startDate || !endDate) return "";
  if (new Date(endDate) <= new Date(startDate)) return `${endLabel} must be after ${startLabel}`;
  return "";
}

export function validateRequired(value: string, label = "This field"): string {
  if (!value || !value.trim()) return `${label} is required`;
  return "";
}
