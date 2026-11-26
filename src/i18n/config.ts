export const LOCALES = ["uz", "ru", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "yv_locale";

export const LOCALE_NAMES: Record<Locale, string> = { uz: "O‘zbekcha", ru: "Русский", en: "English" };

/** BCP-47 tags used for number and date formatting. */
export const INTL_LOCALE: Record<Locale, string> = { uz: "uz-Latn-UZ", ru: "ru-RU", en: "en-GB" };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Picks the best supported locale from an Accept-Language header. */
export function negotiateLocale(acceptLanguage: string | null): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part) => {
      const [tag = "", q] = part.trim().split(";q=");
      return { lang: tag.toLowerCase().split("-")[0] ?? "", q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  for (const { lang } of ranked) if (isLocale(lang)) return lang;
  return DEFAULT_LOCALE;
}

/** Replaces {name} placeholders. Missing params are left visible so gaps are noticed, not hidden. */
export function fmt(template: string, params: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match));
}
