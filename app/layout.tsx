import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { ToastProvider } from "@/components/ToastProvider";
import { GlobalLoadingProvider } from "@/components/GlobalLoadingProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
import { getMeAction } from "@/app/actions/auth";
import { migrateTheme, migrateMode, DEFAULT_THEME_NAME, DEFAULT_THEME_MODE } from "@/lib/theme";
import { cookies } from "next/headers";
import { readThemeCookies } from "@/lib/theme-cookies";

const inter = { className: "font-sans" };

// Mark as dynamic since getMeAction() uses cookies() which requires server-side rendering
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: " SUKI  Marketing CRM",
  description: "Internal CRM portal for  SUKI  Marketing teams",
  icons: {
    icon: "/tick-mark.svg",
    shortcut: "/tick-mark.svg",
    apple: "/tick-mark.svg",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userRes = await getMeAction();
  const initialUser = userRes.success ? userRes.data : null;

  // If a user is logged in, the DB is the source of truth.
  // If logged out, fall back to the theme cookie so the login page keeps the last theme.
  const cookieStore = await cookies();
  const cookieTheme = readThemeCookies(cookieStore.toString());

  const themeColor = initialUser?.id
    ? migrateTheme(initialUser.theme)
    : cookieTheme.theme;
  const themeMode = initialUser?.id
    ? migrateMode(initialUser.themeMode)
    : cookieTheme.mode;
  const isDark = themeMode === "dark";

  // DEBUG: log the resolved theme on the server so we can trace mismatches
  if (process.env.NODE_ENV !== "production") {
    console.log("[layout] resolved theme", { userId: initialUser?.id, dbTheme: initialUser?.theme, dbMode: initialUser?.themeMode, cookieTheme: cookieTheme.theme, cookieMode: cookieTheme.mode, resolvedTheme: themeColor, resolvedMode: themeMode });
  }

  const antiFoucScript = `
    (function() {
      var html = document.documentElement;
      html.setAttribute("data-theme", "${themeColor}");
      html.setAttribute("data-mode", "${themeMode}");
      ${isDark ? "html.classList.add(\"dark\");" : "html.classList.remove(\"dark\");"}
    })();
  `;

  return (
    <html lang="en" data-theme={themeColor} data-mode={themeMode} className={isDark ? "dark" : ""} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: antiFoucScript }} />
      </head>
      <body className={inter.className}>
        <ThemeProvider
          initialTheme={themeColor}
          initialMode={themeMode}
          userId={initialUser?.id || null}
        >
          <ToastProvider>
            <AuthProvider initialUser={initialUser as any}>
              <GlobalLoadingProvider>
                {children}
              </GlobalLoadingProvider>
            </AuthProvider>
          </ToastProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
