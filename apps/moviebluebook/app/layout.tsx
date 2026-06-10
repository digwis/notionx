import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { defaultLocale, isAppLocale } from "@/lib/i18n/config";

// 仅用 Geist Sans。Mono 字体在 UI 里用不到，去掉 6 个 woff2 文件 ~77KB。
// display: "swap" 保证 FOUT 而不是 FOIT（首次显示用系统字体，避免空白）。
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "vinext",
    template: "%s · vinext",
  },
  description:
    "A Notion-powered content foundation running on vinext and Cloudflare Workers",
  openGraph: {
    title: "vinext",
    description:
      "A Notion-powered content foundation running on vinext and Cloudflare Workers",
    type: "website",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headerStore = await headers();
  const requestedLocale = headerStore.get("x-app-locale") ?? defaultLocale;
  const htmlLang = isAppLocale(requestedLocale) ? requestedLocale : defaultLocale;

  return (
    <html
      lang={htmlLang}
      suppressHydrationWarning
      className={`${geistSans.variable}`}
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
