import type { ReactNode } from "react";
import { SubmitButton } from "@/components/action-form";
import { signInWithProvider } from "@/lib/actions/auth";
import { OAUTH_PROVIDERS, getEnabledProviders, type OAuthProvider } from "@/lib/auth-providers";
import { getDictionary } from "@/i18n/server";
import { fmt } from "@/i18n/config";

const ICONS: Record<OAuthProvider, ReactNode> = {
  google: (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.5a5.6 5.6 0 0 1-2.4 3.6v3h3.9c2.2-2.1 3.5-5.1 3.5-8.7Z" />
      <path fill="#34A853" d="M12 24c3.2 0 6-1.1 7.9-2.9l-3.9-3c-1 .7-2.4 1.1-4 1.1-3.1 0-5.7-2.1-6.7-4.9h-4v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.3 14.3a7.2 7.2 0 0 1 0-4.6V6.6h-4a12 12 0 0 0 0 10.8l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.3 6.6l4 3.1C6.3 6.9 8.9 4.8 12 4.8Z" />
    </svg>
  ),
  apple: (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden fill="currentColor">
      <path d="M16.4 12.7c0-2.4 2-3.6 2.1-3.7a4.6 4.6 0 0 0-3.6-1.9c-1.5-.2-3 .9-3.8.9-.8 0-2-.9-3.3-.9a4.9 4.9 0 0 0-4.1 2.5c-1.8 3.1-.5 7.6 1.3 10.1.8 1.2 1.8 2.6 3.1 2.5 1.3-.1 1.7-.8 3.3-.8 1.5 0 2 .8 3.3.8 1.4 0 2.3-1.2 3.1-2.5a11 11 0 0 0 1.4-2.9 4.4 4.4 0 0 1-2.8-4.1ZM14 5.4A4.3 4.3 0 0 0 15 2.2a4.5 4.5 0 0 0-2.9 1.5 4.1 4.1 0 0 0-1 3.1A3.7 3.7 0 0 0 14 5.4Z" />
    </svg>
  ),
  azure: (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden>
      <path fill="#F25022" d="M1 1h10.5v10.5H1z" />
      <path fill="#7FBA00" d="M12.5 1H23v10.5H12.5z" />
      <path fill="#00A4EF" d="M1 12.5h10.5V23H1z" />
      <path fill="#FFB900" d="M12.5 12.5H23V23H12.5z" />
    </svg>
  ),
};

/**
 * Google, Apple and Microsoft buttons. A provider that isn't switched on in Supabase Auth is shown
 * disabled ("not set up yet") instead of failing after the click.
 */
export async function OAuthButtons({ next }: { next?: string }) {
  const [t, enabled] = await Promise.all([getDictionary(), getEnabledProviders()]);
  return (
    <div className="space-y-2">
      {OAUTH_PROVIDERS.map((p) => {
        const name = t.access.provider[p];
        const label = fmt(t.access.continueWith, { provider: name });
        return (
          <form key={p} action={signInWithProvider}>
            <input type="hidden" name="provider" value={p} />
            {next && <input type="hidden" name="next" value={next} />}
            {enabled[p] ? (
              <SubmitButton variant="secondary" className="w-full" pendingLabel="…" aria-label={label}>
                {ICONS[p]}
                {label}
              </SubmitButton>
            ) : (
              <button
                type="button"
                disabled
                title={t.access.notConfigured}
                className="inline-flex h-10 w-full cursor-not-allowed items-center justify-center gap-1.5 rounded-lg border border-line bg-surface px-4 text-sm font-medium text-muted"
              >
                <span className="opacity-60">{ICONS[p]}</span>
                {label}
                <span className="text-xs font-normal">· {t.access.notConfigured}</span>
              </button>
            )}
          </form>
        );
      })}
    </div>
  );
}
