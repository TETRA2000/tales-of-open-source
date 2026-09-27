// Format registry. A new format is one entry here plus a renderer page;
// the chapter folder file name (`<slug>.yaml`) is how a chapter declares it.

export type Level = "newcomer" | "practitioner" | "contributor" | "all";

export interface FormatInfo {
  code: string;
  slug: string;
  name: string;
  level: Level;
  length: string;
}

export const FORMATS: readonly FormatInfo[] = [
  { code: "QT", slug: "quick-tale", name: "Quick Tale", level: "newcomer", length: "3–5 min" },
  { code: "GT", slug: "guided-trace", name: "Guided Trace", level: "practitioner", length: "10–15 min" },
  { code: "SR", slug: "source-reading", name: "Source Reading", level: "contributor", length: "25–40 min" },
  { code: "AN", slug: "anatomy", name: "Anatomy", level: "practitioner", length: "8–12 min" },
  { code: "FG", slug: "field-guide", name: "Field Guide", level: "all", length: "reference" },
  { code: "RN", slug: "revision-note", name: "Revision Note", level: "practitioner", length: "2–4 min" },
];

export function formatByCode(code: string): FormatInfo | undefined {
  return FORMATS.find((f) => f.code === code);
}

export function formatBySlug(slug: string): FormatInfo | undefined {
  return FORMATS.find((f) => f.slug === slug);
}

export const LEVELS: Record<Level, { name: string; pips: string }> = {
  newcomer: { name: "Newcomer", pips: "●○○" },
  practitioner: { name: "Practitioner", pips: "●●○" },
  contributor: { name: "Contributor", pips: "●●●" },
  all: { name: "All levels", pips: "●●●" },
};
