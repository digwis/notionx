import type { Metadata } from "next";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { ThemeBootstrap } from "@/components/site/theme-bootstrap";
import { getSiteSettings, getStaticSiteSettings } from "@/lib/site/settings";
import { fallbackSiteConfig } from "@/lib/site/config";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await getSiteSettings();
  return {
    title: {
      default: settings.seo.title || settings.name,
      template: `%s · ${settings.seo.title || settings.name}`,
    },
    description: settings.seo.description || settings.description,
    openGraph: {
      title: settings.seo.title || settings.name,
      description: settings.seo.description || settings.description,
      ...(settings.ogImageUrl
        ? { images: [{ url: settings.ogImageUrl }] }
        : settings.socialImageUrl
          ? { images: [{ url: settings.socialImageUrl }] }
          : {}),
      type: "website",
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const settings = (await getSiteSettings()) ?? getStaticSiteSettings();
  return (
    <html
      lang={settings.defaultLocale ?? fallbackSiteConfig.defaultLocale}
      data-theme-primary={settings.theme.primary}
      data-theme-accent={settings.theme.accent}
      data-theme-font={settings.theme.font}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeBootstrap />
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
