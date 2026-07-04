import { type ThemeName, type ThemeMode, DEFAULT_THEME_NAME, DEFAULT_THEME_MODE, migrateTheme, migrateMode } from "./theme";

const THEME_COOKIE = "suki-theme";
const MODE_COOKIE = "suki-mode";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

/**
 * Parse a cookie string into a Record. Safe for SSR use with request headers.
 */
export function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  if (!cookieHeader) return {};
  return Object.fromEntries(
    cookieHeader.split(";").map((cookie) => {
      const [key, ...value] = cookie.split("=");
      return [key.trim(), value.join("=").trim()];
    })
  );
}

/**
 * Read the theme cookies from a cookie header (SSR) or document.cookie (client).
 */
export function readThemeCookies(source?: string | undefined) {
  const cookieHeader = source ?? (typeof document !== "undefined" ? document.cookie : undefined);
  const cookies = parseCookies(cookieHeader);
  return {
    theme: migrateTheme(cookies[THEME_COOKIE]),
    mode: migrateMode(cookies[MODE_COOKIE]),
  };
}

/**
 * Serialize a cookie with the same defaults used by the client-side setter.
 */
export function serializeThemeCookie(name: string, value: string) {
  return `${name}=${value}; Path=/; Max-Age=${COOKIE_MAX_AGE}; SameSite=Lax`;
}

/**
 * Set the theme cookies on the client.
 * This is the local fallback that lets the server render the same theme on the
 * login page after the user signs out.
 */
export function setThemeCookies(theme: ThemeName, mode: ThemeMode) {
  if (typeof document === "undefined") return;
  document.cookie = serializeThemeCookie(THEME_COOKIE, theme);
  document.cookie = serializeThemeCookie(MODE_COOKIE, mode);
}

/**
 * Clear the theme cookies. Used only when the user explicitly wants to reset
 * the local fallback to the default.
 */
export function clearThemeCookies() {
  if (typeof document === "undefined") return;
  document.cookie = `${THEME_COOKIE}=; Path=/; Max-Age=0`;
  document.cookie = `${MODE_COOKIE}=; Path=/; Max-Age=0`;
}

export { THEME_COOKIE, MODE_COOKIE, DEFAULT_THEME_NAME, DEFAULT_THEME_MODE };
