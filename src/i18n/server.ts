import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { LOCALE_COOKIE, isLocale, negotiateLocale, type Locale } from "./config";
import { en, type Dictionary } from "./dictionaries/en";
import { ru } from "./dictionaries/ru";
import { uz } from "./dictionaries/uz";

const DICTIONARIES: Record<Locale, Dictionary> = { en, ru, uz };

/** The user's chosen language (cookie), else the best match for their browser. */
export const getLocale = cache(async (): Promise<Locale> => {
  const chosen = (await cookies()).get(LOCALE_COOKIE)?.value;
  if (isLocale(chosen)) return chosen;
  return negotiateLocale((await headers()).get("accept-language"));
});

export const getDictionary = cache(async (): Promise<Dictionary> => DICTIONARIES[await getLocale()]);

export async function getI18n(): Promise<{ t: Dictionary; locale: Locale }> {
  const locale = await getLocale();
  return { t: DICTIONARIES[locale], locale };
}
