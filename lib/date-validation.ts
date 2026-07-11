/**
 * Date validation helpers used by both client components and server routes/actions.
 * All comparisons use the local date boundary (midnight) so that "today" remains valid
 * regardless of the time of day the check runs.
 */

function startOfDayLocal(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function isDateInPast(value: string | Date | null | undefined): boolean {
  if (!value) return false;
  const input = new Date(value);
  if (isNaN(input.getTime())) return false;

  const today = startOfDayLocal(new Date());
  const inputDate = startOfDayLocal(input);

  return inputDate.getTime() < today.getTime();
}

export function validateNotInPast(
  value: string | Date | null | undefined,
  fieldName = "Date"
): string | null {
  if (!value) return null;
  const input = new Date(value);
  if (isNaN(input.getTime())) return `${fieldName} is invalid`;

  if (isDateInPast(value)) {
    return `${fieldName} cannot be in the past`;
  }
  return null;
}

export function getTodayDateInputValue(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function getTodayDatetimeLocalInputValue(d = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00`;
}
