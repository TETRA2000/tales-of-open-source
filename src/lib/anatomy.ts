// Anatomy (AN) body: a struct card with grouped fields, plus typed sections
// (pointer-tree, twin-trees, reference-grid). Every source excerpt is checked
// against its file at the pin; the struct's field groups and every
// reference-grid row are then checked against the excerpt text itself.

import { z } from "zod";
import { githubBlobUrl, isElision, parseLineRange, verifyExcerpt, type CodeSource, type LineRange } from "./excerpt.ts";
import type { ArticleContext } from "./content.ts";
import type { TreeNode } from "./anatomy-layout.ts";

const SourceSchema = z.object({
  file: z.string(),
  lines: z.coerce.string(),
  code: z.string(),
});

const TreeNodeSchema: z.ZodType<TreeNode> = z.lazy(() =>
  z.object({
    name: z.string().min(1),
    children: z.array(TreeNodeSchema).optional(),
  }),
);

const StructGroupSchema = z.object({
  key: z.string().regex(/^[A-Z]{2}$/),
  name: z.string(),
  fields: z.array(z.string()).min(1),
  what: z.string(),
});

const StructSchema = z.object({
  name: z.string(),
  source: SourceSchema,
  groups: z.array(StructGroupSchema),
});

const RowSchema = z.object({
  name: z.string(),
  value: z.coerce.string(),
  example: z.string(),
});

const PointerTreeSectionSchema = z.object({
  kind: z.literal("pointer-tree"),
  id: z.string(),
  title: z.string(),
  body: z.string(),
  jsx: z.string(),
  tree: TreeNodeSchema,
  source: SourceSchema.nullable().default(null),
});

const TwinTreesSectionSchema = z.object({
  kind: z.literal("twin-trees"),
  id: z.string(),
  title: z.string(),
  body: z.string(),
  nodes: z.array(z.string()).min(1),
  source: SourceSchema.nullable().default(null),
});

const ReferenceGridSectionSchema = z.object({
  kind: z.literal("reference-grid"),
  id: z.string(),
  title: z.string(),
  body: z.string().nullable().default(null),
  source: SourceSchema,
  rows: z.array(RowSchema).min(1),
});

const AnatomySectionSchema = z.discriminatedUnion("kind", [
  PointerTreeSectionSchema,
  TwinTreesSectionSchema,
  ReferenceGridSectionSchema,
]);

const AnatomySchema = z.object({
  deck: z.string(),
  struct: StructSchema,
  sections: z.array(AnatomySectionSchema).min(1),
  tracked_symbols: z.array(z.object({ symbol: z.string(), file: z.string(), used_in: z.string() })).default([]),
});

export interface StructGroup {
  key: string;
  name: string;
  fields: string[];
  what: string;
}

interface SectionBase {
  id: string;
  title: string;
  body: string | null;
}

export type AnatomySection =
  | (SectionBase & { kind: "pointer-tree"; jsx: string; tree: TreeNode; source: CodeSource | null })
  | (SectionBase & { kind: "twin-trees"; nodes: string[]; source: CodeSource | null })
  | (SectionBase & { kind: "reference-grid"; rows: { name: string; value: string; example: string }[]; source: CodeSource });

export interface AnatomyBody {
  deck: string;
  struct: { name: string; source: CodeSource; groups: StructGroup[] };
  sections: AnatomySection[];
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// Unique `this.X =` names, in order. Skips whole-line elisions and lines that
// are `//` comments, so a removed or commented-out assignment isn't counted.
export function assignedFields(code: string): string[] {
  const seen = new Set<string>();
  const fields: string[] = [];
  for (const line of code.split("\n")) {
    if (isElision(line) || line.trim().startsWith("//")) continue;
    for (const match of line.matchAll(/\bthis\.(\w+)\s*=(?!=)/g)) {
      const name = match[1];
      if (!seen.has(name)) {
        seen.add(name);
        fields.push(name);
      }
    }
  }
  return fields;
}

function rowIsInExcerpt(code: string, name: string, value: string): boolean {
  const pattern = new RegExp(`\\b${escapeRegExp(name)}\\s*=\\s*${escapeRegExp(value)}\\b`);
  return code.split("\n").some((line) => pattern.test(line));
}

export function parseAnatomy(raw: unknown, { repo, pin, reader }: ArticleContext): AnatomyBody {
  const data = AnatomySchema.parse(raw);
  const problems: string[] = [];

  function verifySource(label: string, source: z.infer<typeof SourceSchema>): CodeSource {
    let lines: LineRange = { start: 1, end: 1 };
    try {
      lines = parseLineRange(source.lines);
      const check = verifyExcerpt(reader.readAtCommit(pin, source.file), source.code, lines);
      if (!check.ok) problems.push(`${label} (${source.file}:${source.lines}): ${check.reason}`);
    } catch (error) {
      problems.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
    return {
      file: source.file,
      lines,
      url: githubBlobUrl(repo, pin, source.file, lines),
      code: source.code.replace(/\n+$/, ""),
    };
  }

  const groupKeys = data.struct.groups.map((g) => g.key);
  if (new Set(groupKeys).size !== groupKeys.length) problems.push("group keys must be unique");

  const structSource = verifySource("struct", data.struct.source);
  const assigned = assignedFields(data.struct.source.code);

  const fieldGroupCount = new Map<string, number>();
  for (const group of data.struct.groups) {
    for (const field of group.fields) {
      fieldGroupCount.set(field, (fieldGroupCount.get(field) ?? 0) + 1);
    }
  }
  for (const [field, count] of fieldGroupCount) {
    if (count > 1) problems.push(`struct: field "${field}" is in more than one group`);
  }
  for (const field of fieldGroupCount.keys()) {
    if (!assigned.includes(field)) problems.push(`struct: field "${field}" is not assigned in the excerpt`);
  }
  for (const field of assigned) {
    if (!fieldGroupCount.has(field)) problems.push(`struct: "this.${field}" is assigned in the excerpt but is in no group`);
  }

  const sectionIds = data.sections.map((s) => s.id);
  if (new Set(sectionIds).size !== sectionIds.length) problems.push("section ids must be unique");
  if (sectionIds.includes("struct")) problems.push('"struct" cannot be a section id');

  const sections: AnatomySection[] = data.sections.map((section): AnatomySection => {
    const body = section.body;
    if (section.kind === "reference-grid") {
      const source = verifySource(section.id, section.source);
      for (const row of section.rows) {
        if (!rowIsInExcerpt(source.code, row.name, row.value)) {
          problems.push(`${section.id}: row ${row.name} = ${row.value} is not in the excerpt`);
        }
      }
      return { id: section.id, title: section.title, body, kind: "reference-grid", rows: section.rows, source };
    }
    const source = section.source ? verifySource(section.id, section.source) : null;
    if (section.kind === "pointer-tree") {
      return { id: section.id, title: section.title, body, kind: "pointer-tree", jsx: section.jsx, tree: section.tree, source };
    }
    return { id: section.id, title: section.title, body, kind: "twin-trees", nodes: section.nodes, source };
  });

  const sourceFileFor = (usedIn: string): string | undefined =>
    usedIn === "struct" ? structSource.file : sections.find((s) => s.id === usedIn)?.source?.file;

  for (const tracked of data.tracked_symbols) {
    const file = sourceFileFor(tracked.used_in);
    if (file === undefined) {
      problems.push(`tracked symbol ${tracked.symbol} is used_in "${tracked.used_in}", which is not struct or a section with a source`);
    } else if (file !== tracked.file) {
      problems.push(`tracked symbol ${tracked.symbol}: file ${tracked.file} does not match ${tracked.used_in}'s file ${file}`);
    }
  }

  if (problems.length > 0) throw new Error(`excerpt check failed at ${pin}:\n  ${problems.join("\n  ")}`);
  return {
    deck: data.deck,
    struct: { name: data.struct.name, source: structSource, groups: data.struct.groups },
    sections,
  };
}
