"use client";

import { createContext, use, type ReactNode } from "react";
import type { Dictionary } from "./dictionaries/en";

type ClientStrings = Dictionary["client"];

const I18nContext = createContext<ClientStrings | null>(null);

/** Supplies the small set of strings that client components need (the rest render on the server). */
export function I18nProvider({ strings, children }: { strings: ClientStrings; children: ReactNode }) {
  return <I18nContext value={strings}>{children}</I18nContext>;
}

export function useClientStrings(): ClientStrings {
  const strings = use(I18nContext);
  if (!strings) throw new Error("useClientStrings must be used inside I18nProvider");
  return strings;
}
