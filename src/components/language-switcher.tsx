import { LOCALES, LOCALE_NAMES, type Locale } from "@/i18n/config";
import { setLocale } from "@/lib/actions/locale";
import { cn } from "@/components/ui";

/** Plain form buttons so it works without client JavaScript. */
export function LanguageSwitcher({ locale, label, tone = "dark" }: { locale: Locale; label: string; tone?: "dark" | "light" }) {
  return (
    <form action={setLocale} aria-label={label} className="flex items-center gap-1">
      {LOCALES.map((l) => (
        <button
          key={l}
          name="locale"
          value={l}
          aria-pressed={l === locale}
          title={LOCALE_NAMES[l]}
          className={cn(
            "rounded-md px-2 py-1 text-xs font-medium uppercase transition-colors",
            tone === "dark"
              ? l === locale
                ? "bg-white/15 text-white"
                : "text-white/60 hover:text-white"
              : l === locale
                ? "bg-ink text-white"
                : "text-muted hover:text-ink",
          )}
        >
          {l}
        </button>
      ))}
    </form>
  );
}
