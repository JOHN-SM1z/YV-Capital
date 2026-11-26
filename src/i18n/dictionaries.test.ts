import { describe, expect, it } from "vitest";
import { en } from "./dictionaries/en";
import { ru } from "./dictionaries/ru";
import { uz } from "./dictionaries/uz";
import { fmt, negotiateLocale } from "./config";

type Tree = { [key: string]: string | Tree };

function leaves(tree: Tree, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") out.set(path, value);
    else for (const [p, v] of leaves(value, path)) out.set(p, v);
  }
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe("dictionaries", () => {
  const base = leaves(en);

  for (const [name, dict] of [
    ["ru", ru],
    ["uz", uz],
  ] as const) {
    const other = leaves(dict);

    it(`${name} has exactly the same keys as en`, () => {
      expect([...other.keys()].sort()).toEqual([...base.keys()].sort());
    });

    it(`${name} has no empty strings`, () => {
      expect([...other].filter(([, v]) => !v.trim()).map(([k]) => k)).toEqual([]);
    });

    it(`${name} keeps the same {placeholders} as en`, () => {
      const mismatched = [...base].filter(([k, v]) => JSON.stringify(placeholders(v)) !== JSON.stringify(placeholders(other.get(k) ?? "")));
      expect(mismatched.map(([k]) => k)).toEqual([]);
    });
  }
});

describe("fmt", () => {
  it("fills placeholders and leaves unknown ones visible", () => {
    expect(fmt("Hi {name}, {n} new", { name: "Aziz", n: 3 })).toBe("Hi Aziz, 3 new");
    expect(fmt("Hi {name}")).toBe("Hi {name}");
  });
});

describe("negotiateLocale", () => {
  it("picks the highest-ranked supported language", () => {
    expect(negotiateLocale("ru-RU,ru;q=0.9,en;q=0.8")).toBe("ru");
    expect(negotiateLocale("de-DE,uz;q=0.7,en;q=0.5")).toBe("uz");
    expect(negotiateLocale("fr-FR")).toBe("en");
    expect(negotiateLocale(null)).toBe("en");
  });
});
