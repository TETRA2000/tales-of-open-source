// The code excerpt panel: file/line head with a GitHub link, then the excerpt
// itself with elided lines dimmed. Shared by every format that shows an
// excerpt (Guided Trace today; Anatomy and others later). Renders fine as a
// static Astro component (no `client:` directive) as well as inside an
// island, since it holds no state of its own.

import { isElision } from "../lib/excerpt.ts";
import type { CodeSource } from "../lib/excerpt.ts";
import "./CodePanel.css";

interface Props {
  source: CodeSource;
}

export default function CodePanel({ source }: Props) {
  const { file, lines, url, code } = source;
  const range = lines.start === lines.end ? `L${lines.start}` : `L${lines.start}–${lines.end}`;

  return (
    <figure class="code-panel">
      <figcaption class="code-panel-head">
        <span class="code-panel-file">
          {file}
          <span class="code-panel-lines">{range}</span>
        </span>
        <a href={url} target="_blank" rel="noopener">
          View on GitHub at pin
        </a>
      </figcaption>
      <pre tabIndex={0} aria-label={`${file}, lines ${lines.start} to ${lines.end}`}>
        <code>
          {code.split("\n").map((line, i) => (
            <span key={i} class={isElision(line) ? "code-panel-elided" : undefined}>
              {line}
              {"\n"}
            </span>
          ))}
        </code>
      </pre>
    </figure>
  );
}
