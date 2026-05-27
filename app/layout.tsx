import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { getMeAction } from "@/app/actions/auth";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Suki Marketing CRM",
  description: "Internal CRM portal for Suki Marketing teams",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const userRes = await getMeAction();
  const initialUser = userRes.success ? userRes.data : null;

  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider initialUser={initialUser as any}>{children}</AuthProvider>
      </body>
    </html>
  );
}
