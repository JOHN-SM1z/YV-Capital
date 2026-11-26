import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Space_Grotesk } from "next/font/google";
import { I18nProvider } from "@/i18n/client";
import { getI18n } from "@/i18n/server";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ variable: "--font-jakarta", subsets: ["latin", "latin-ext", "cyrillic-ext"] });
const grotesk = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin", "latin-ext"] });

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getI18n();
  return {
    title: { default: t.meta.title, template: `%s · ${t.meta.title}` },
    description: t.meta.description,
    robots: { index: false, follow: false },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { t, locale } = await getI18n();
  return (
    <html lang={locale} className={`${jakarta.variable} ${grotesk.variable} h-full`}>
      <body className="min-h-full">
        <I18nProvider strings={t.client}>{children}</I18nProvider>
      </body>
    </html>
  );
}
