import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { ToastProvider } from "@/components/ToastProvider";
import { GlobalLoadingProvider } from "@/components/GlobalLoadingProvider";
import { getMeAction } from "@/app/actions/auth";

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

  // Resolve theme from user profile (DB), fallback to defaults
  const themeColor = initialUser?.theme || "ember";
  const themeMode = initialUser?.themeMode || "light";
  const dataTheme = `${themeColor}-${themeMode}`;
  const isDark = themeMode === "dark";

  return (
    <html lang="en" data-theme={dataTheme} className={isDark ? "dark" : ""}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__CRM_VARIANT__ = ${process.env.NEXT_PUBLIC_CRM_VARIANT || "1"};`,
          }}
        />
      </head>
      <body className={inter.className}>
        <ToastProvider>
          <AuthProvider initialUser={initialUser as any}>
            <GlobalLoadingProvider>
              {children}
            </GlobalLoadingProvider>
          </AuthProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
