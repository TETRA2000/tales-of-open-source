// Content loader for content/sets/** (see docs/content-model.md).
//
//   content/sets/<set>/set.yaml                     set, pin, reading paths, parts → chapter outline
//   content/sets/<set>/chapters/<chapter>/chapter.yaml   optional overrides for the outline entry
//   content/sets/<set>/chapters/<chapter>/<format-slug>.yaml   one article per format
//
// Articles are discovered from the chapter folder, so adding a format is adding a file.
// Format-specific bodies are parsed (and their excerpts verified against git) by the
// parser registered for that format code.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { parse as parseYaml } from "yaml";
import { z } from "zod";
import { FORMATS, type FormatInfo, type Level } from "./formats.ts";
import { openRepo as defaultOpenRepo, type RepoReader } from "./git.ts";
import { parseGuidedTrace, type GuidedTraceBody } from "./guided-trace.ts";

const Sha = z.string().regex(/^[0-9a-f]{40}$/, "must be a full 40-character commit SHA (placeholders like [SHA] are not allowed)");
const LevelSchema = z.enum(["newcomer", "practitioner", "contributor", "all"]);
const FormatCode = z.enum(FORMATS.map((f) => f.code) as [string, ...string[]]);

const OutlineChapter = z.object({
  id: z.string(),
  title: z.string(),
  path_hint: z.string(),
  formats: z.array(FormatCode).default([]),
});

const SetSchema = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string(),
  accent: z.string(),
  accent_hover: z.string().optional(),
  repo: z.string().regex(/^[\w.-]+\/[\w.-]+$/),
  pin: z.object({
    commit: Sha,
    release: z.string(),
    synced_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  blurb: z.string(),
  description: z.string(),
  paths: z.array(z.object({ level: LevelSchema, name: z.string(), formats: z.array(FormatCode), what: z.string() })),
  parts: z.array(z.object({ num: z.string(), title: z.string(), chapters: z.array(OutlineChapter) })),
});

const ChapterOverride = OutlineChapter.partial();

export const TrackedSymbol = z.object({ symbol: z.string(), file: z.string(), used_in: z.string() });

export const ArticleBase = z.object({
  format: FormatCode,
  title: z.string(),
  level: LevelSchema,
  minutes: z.number().positive(),
  pin: Sha.optional(),
  tracked_symbols: z.array(TrackedSymbol).default([]),
});

export type Status = "up_to_date" | "drifted" | "planned";

export interface ArticleContext {
  repo: string;
  pin: string;
  reader: RepoReader;
}

export type ArticleBody = { format: "GT"; data: GuidedTraceBody };

type Parser = (raw: unknown, ctx: ArticleContext) => ArticleBody;

const PARSERS: Record<string, Parser> = {
  GT: (raw, ctx) => ({ format: "GT", data: parseGuidedTrace(raw, ctx) }),
};

export interface Article {
  format: FormatInfo;
  title: string;
  level: Level;
  minutes: number;
  pin: string;
  trackedSymbols: z.infer<typeof TrackedSymbol>[];
  status: Status;
  href: string;
  body: ArticleBody;
}

export interface Chapter {
  id: string;
  num: string;
  title: string;
  pathHint: string;
  plannedFormats: string[];
  part: { num: string; title: string };
  articles: Article[];
  status: Status;
  href: string | null;
}

export interface Part {
  num: string;
  title: string;
  chapters: Chapter[];
}

export interface BookSet {
  id: string;
  title: string;
  subtitle: string;
  accent: string;
  accentHover: string | undefined;
  repo: string;
  pin: { commit: string; release: string; syncedAt: string };
  blurb: string;
  description: string;
  paths: z.infer<typeof SetSchema>["paths"];
  parts: Part[];
  chapters: Chapter[];
  trackedSymbolCount: number;
  href: string;
}

export interface Library {
  sets: BookSet[];
}

export interface LoadOptions {
  contentDir: string;
  openRepo?: (repo: string) => RepoReader;
}

function readYaml(file: string): unknown {
  return parseYaml(readFileSync(file, "utf8"));
}

function describe(error: unknown): string {
  if (error instanceof z.ZodError) {
    return error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
  }
  return error instanceof Error ? error.message : String(error);
}

function loadArticle(file: string, format: FormatInfo, ctx: Omit<ArticleContext, "pin"> & { setPin: string; href: string }): Article {
  const raw = readYaml(file);
  const base = ArticleBase.parse(raw);
  if (base.format !== format.code) {
    throw new Error(`format is "${base.format}" but the file name says ${format.code}`);
  }
  const parser = PARSERS[format.code];
  if (!parser) throw new Error(`no renderer is registered for format ${format.code} yet`);
  const pin = base.pin ?? ctx.setPin;
  return {
    format,
    title: base.title,
    level: base.level,
    minutes: base.minutes,
    pin,
    trackedSymbols: base.tracked_symbols,
    // Verified against its pin at build time. Drift against upstream main is a later milestone.
    status: "up_to_date",
    href: ctx.href,
    body: parser(raw, { repo: ctx.repo, pin, reader: ctx.reader }),
  };
}

function loadSet(setDir: string, openRepo: (repo: string) => RepoReader, errors: string[]): BookSet | null {
  let data: z.infer<typeof SetSchema>;
  try {
    data = SetSchema.parse(readYaml(join(setDir, "set.yaml")));
  } catch (error) {
    errors.push(`${join(setDir, "set.yaml")}: ${describe(error)}`);
    return null;
  }

  let reader: RepoReader | null = null;
  const getReader = () => (reader ??= openRepo(data.repo));
  const setHref = `/${data.id}/`;

  const parts: Part[] = data.parts.map((part) => ({
    num: part.num,
    title: part.title,
    chapters: part.chapters.map((outline) => {
      const chapterDir = join(setDir, "chapters", outline.id);
      const overridePath = join(chapterDir, "chapter.yaml");
      let merged = outline;
      if (existsSync(overridePath)) {
        try {
          merged = { ...outline, ...ChapterOverride.parse(readYaml(overridePath)), id: outline.id } as typeof outline;
        } catch (error) {
          errors.push(`${overridePath}: ${describe(error)}`);
        }
      }

      const files = existsSync(chapterDir) ? readdirSync(chapterDir) : [];
      const articles: Article[] = [];
      for (const format of FORMATS) {
        const name = files.find((f) => f === `${format.slug}.yaml` || f === `${format.slug}.yml`);
        if (!name) continue;
        const file = join(chapterDir, name);
        try {
          articles.push(
            loadArticle(file, format, {
              repo: data.repo,
              setPin: data.pin.commit,
              reader: getReader(),
              href: `${setHref}${outline.id}/${format.slug}/`,
            }),
          );
        } catch (error) {
          errors.push(`${file}: ${describe(error)}`);
        }
      }

      const status: Status = articles.length === 0 ? "planned" : articles.some((a) => a.status === "drifted") ? "drifted" : "up_to_date";
      return {
        id: outline.id,
        num: /^(\d+)/.exec(outline.id)?.[1] ?? "",
        title: merged.title,
        pathHint: merged.path_hint,
        plannedFormats: merged.formats,
        part: { num: part.num, title: part.title },
        articles,
        status,
        href: articles[0]?.href ?? null,
      };
    }),
  }));

  const chapters = parts.flatMap((p) => p.chapters);
  const symbols = new Set(
    chapters.flatMap((c) => c.articles.flatMap((a) => a.trackedSymbols.map((s) => `${s.file}#${s.symbol}`))),
  );

  return {
    id: data.id,
    title: data.title,
    subtitle: data.subtitle,
    accent: data.accent,
    accentHover: data.accent_hover,
    repo: data.repo,
    pin: { commit: data.pin.commit, release: data.pin.release, syncedAt: data.pin.synced_at },
    blurb: data.blurb,
    description: data.description,
    paths: data.paths,
    parts,
    chapters,
    trackedSymbolCount: symbols.size,
    href: setHref,
  };
}

export function loadLibrary({ contentDir, openRepo = (repo) => defaultOpenRepo(repo) }: LoadOptions): Library {
  const setsDir = join(contentDir, "sets");
  const errors: string[] = [];
  const sets = readdirSync(setsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(join(setsDir, d.name, "set.yaml")))
    .map((d) => d.name)
    .sort()
    .map((name) => loadSet(join(setsDir, name), openRepo, errors))
    .filter((s): s is BookSet => s !== null);

  if (errors.length > 0) {
    throw new Error(`Content errors:\n${errors.map((e) => `- ${e}`).join("\n")}`);
  }
  return { sets };
}

export function shortSha(commit: string): string {
  return commit.slice(0, 7);
}
