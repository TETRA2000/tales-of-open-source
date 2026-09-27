// Checks a code excerpt against the file it quotes, at the article's pin.
//
// An excerpt is the file's lines [start, end], dedented by the indentation of
// line `start`. Lines may be trimmed: a line consisting of an elision marker
// ("# ..." in Ruby, "// ..." in JS/C, optionally followed by a note) stands for
// zero or more omitted lines. Every other line must match the source exactly
// (trailing whitespace ignored), in order, and without gaps except at markers.

export interface LineRange {
  start: number;
  end: number;
}

export type ExcerptCheck =
  | { ok: true }
  | { ok: false; reason: string };

const ELISION = /^\s*(#|\/\/) \.\.\.(\s.*)?$/;

export function isElision(line: string): boolean {
  return ELISION.test(line);
}

export function parseLineRange(value: string): LineRange {
  const match = /^(\d+)(?:-(\d+))?$/.exec(value.trim());
  if (!match) throw new Error(`Invalid line range "${value}" (expected "12" or "12-40")`);
  const start = Number(match[1]);
  const end = match[2] === undefined ? start : Number(match[2]);
  if (start < 1 || end < start) throw new Error(`Invalid line range "${value}"`);
  return { start, end };
}

function indentOf(line: string): number {
  return line.length - line.trimStart().length;
}

function excerptLines(code: string): string[] {
  const lines = code.replace(/\n+$/, "").split("\n");
  return lines.map((l) => l.trimEnd());
}

export function verifyExcerpt(source: string, code: string, range: LineRange): ExcerptCheck {
  const fileLines = source.split("\n");
  if (range.end > fileLines.length) {
    return { ok: false, reason: `line range ${range.start}-${range.end} is past the end of the file (${fileLines.length} lines)` };
  }

  const base = indentOf(fileLines[range.start - 1]);
  const window: string[] = [];
  for (let n = range.start; n <= range.end; n++) {
    const line = fileLines[n - 1].trimEnd();
    if (line !== "" && indentOf(line) < base) {
      return { ok: false, reason: `line ${n} is indented less than line ${range.start}; the range crosses a block boundary` };
    }
    window.push(line.slice(Math.min(base, line.length)));
  }

  const lines = excerptLines(code);
  if (lines.length === 0 || lines.every(isElision)) return { ok: false, reason: "excerpt is empty" };
  if (isElision(lines[0])) return { ok: false, reason: "excerpt must start with a real line, not an elision marker" };
  if (isElision(lines[lines.length - 1])) return { ok: false, reason: "excerpt must end with a real line, not an elision marker" };

  let cursor = 0; // index into window
  let skipping = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (isElision(line)) {
      skipping = true;
      continue;
    }
    if (skipping) {
      while (cursor < window.length && window[cursor] !== line) cursor++;
      skipping = false;
      if (cursor === window.length) {
        return { ok: false, reason: `excerpt line ${i + 1} not found after the elision: ${JSON.stringify(line)}` };
      }
    } else if (window[cursor] !== line) {
      const at = range.start + cursor;
      return {
        ok: false,
        reason: `excerpt line ${i + 1} does not match source line ${at}:\n  excerpt: ${JSON.stringify(line)}\n  source:  ${JSON.stringify(window[cursor] ?? "<end of range>")}`,
      };
    }
    cursor++;
  }

  if (cursor !== window.length) {
    return { ok: false, reason: `excerpt ends at source line ${range.start + cursor - 1}, but the range ends at ${range.end}` };
  }
  return { ok: true };
}

export function githubBlobUrl(repo: string, commit: string, file: string, range?: LineRange): string {
  const anchor = range ? (range.start === range.end ? `#L${range.start}` : `#L${range.start}-L${range.end}`) : "";
  return `https://github.com/${repo}/blob/${commit}/${file}${anchor}`;
}
