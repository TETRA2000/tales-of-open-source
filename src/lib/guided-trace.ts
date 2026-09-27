// Guided Trace (GT) body: the example request and one step per hop across a
// function boundary. Each step's excerpt is checked against its file at the pin.

import { z } from "zod";
import { githubBlobUrl, parseLineRange, verifyExcerpt, type LineRange } from "./excerpt.ts";
import type { ArticleContext } from "./content.ts";

const StepSchema = z.object({
  id: z.string(),
  title: z.string(),
  symbol: z.string(),
  package: z.string(),
  file: z.string(),
  lines: z.coerce.string(),
  body: z.string(),
  code: z.string(),
  next: z.string(),
});

const GuidedTraceSchema = z.object({
  example: z.object({ request: z.string(), target: z.string() }),
  steps: z.array(StepSchema).min(1),
  tracked_symbols: z.array(z.object({ symbol: z.string(), file: z.string(), used_in: z.string() })).default([]),
});

export interface TraceStep {
  id: string;
  title: string;
  symbol: string;
  package: string;
  file: string;
  lines: LineRange;
  url: string;
  body: string;
  code: string;
  next: string;
}

export interface GuidedTraceBody {
  example: { request: string; target: string };
  steps: TraceStep[];
}

export function parseGuidedTrace(raw: unknown, { repo, pin, reader }: ArticleContext): GuidedTraceBody {
  const data = GuidedTraceSchema.parse(raw);
  const problems: string[] = [];

  const ids = new Set(data.steps.map((s) => s.id));
  if (ids.size !== data.steps.length) problems.push("step ids must be unique");

  const steps = data.steps.map((step) => {
    let lines: LineRange = { start: 1, end: 1 };
    try {
      lines = parseLineRange(step.lines);
      const check = verifyExcerpt(reader.readAtCommit(pin, step.file), step.code, lines);
      if (!check.ok) problems.push(`${step.id} (${step.file}:${step.lines}): ${check.reason}`);
    } catch (error) {
      problems.push(`${step.id}: ${error instanceof Error ? error.message : String(error)}`);
    }
    return {
      id: step.id,
      title: step.title,
      symbol: step.symbol,
      package: step.package,
      file: step.file,
      lines,
      url: githubBlobUrl(repo, pin, step.file, lines),
      body: step.body,
      code: step.code.replace(/\n+$/, ""),
      next: step.next,
    };
  });

  for (const tracked of data.tracked_symbols) {
    const step = steps.find((s) => s.id === tracked.used_in);
    if (!step) problems.push(`tracked symbol ${tracked.symbol} is used_in "${tracked.used_in}", which is not a step`);
    else if (step.file !== tracked.file) problems.push(`tracked symbol ${tracked.symbol}: file ${tracked.file} does not match ${step.id}'s file ${step.file}`);
  }

  if (problems.length > 0) throw new Error(`excerpt check failed at ${pin}:\n  ${problems.join("\n  ")}`);
  return { example: data.example, steps };
}
