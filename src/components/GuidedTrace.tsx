// Guided Trace stepper (island): progress bar, step rail and the selected step.
// Server-rendered on step 1; the selected step is mirrored in the URL hash (#step-3).

import { useEffect, useRef, useState } from "preact/hooks";
import type { TraceStep } from "../lib/guided-trace.ts";
import { isElision } from "../lib/excerpt.ts";
import "./GuidedTrace.css";

interface Props {
  steps: TraceStep[];
}

function stepFromHash(steps: TraceStep[]): number {
  const id = typeof location === "undefined" ? "" : location.hash.slice(1);
  const index = steps.findIndex((s) => s.id === id);
  return index === -1 ? 0 : index;
}

export default function GuidedTrace({ steps }: Props) {
  const [current, setCurrent] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const moved = useRef(false);

  useEffect(() => {
    setCurrent(stepFromHash(steps));
    const onHash = () => setCurrent(stepFromHash(steps));
    addEventListener("hashchange", onHash);
    return () => removeEventListener("hashchange", onHash);
  }, [steps]);

  const go = (index: number, focusHeading = false) => {
    const next = Math.max(0, Math.min(steps.length - 1, index));
    setCurrent(next);
    history.replaceState(null, "", `#${steps[next].id}`);
    moved.current = focusHeading;
  };

  useEffect(() => {
    if (moved.current) headingRef.current?.focus();
    moved.current = false;
  }, [current]);

  const step = steps[current];
  const total = steps.length;
  const range = step.lines.start === step.lines.end ? `L${step.lines.start}` : `L${step.lines.start}–${step.lines.end}`;

  return (
    <div class="gt">
      <div class="gt-progress" aria-hidden="true">
        <div class="gt-progress-bar" style={{ width: `${((current + 1) / total) * 100}%` }} />
      </div>

      <div class="gt-body">
        <nav class="gt-rail" aria-label="Steps">
          <ol>
            {steps.map((s, i) => (
              <li key={s.id}>
                <button
                  type="button"
                  class={`gt-step ${i === current ? "is-current" : i < current ? "is-done" : ""}`}
                  aria-current={i === current ? "step" : undefined}
                  onClick={() => go(i)}
                >
                  <span class="gt-step-num" aria-hidden="true">
                    {i + 1}
                  </span>
                  <span class="gt-step-text">
                    <span class="gt-step-title">
                      <span class="visually-hidden">Step {i + 1}: </span>
                      {s.title}
                    </span>
                    <span class="gt-step-symbol">{s.symbol}</span>
                  </span>
                </button>
              </li>
            ))}
          </ol>
        </nav>

        <article class="gt-pane" aria-labelledby="gt-step-title">
          <div class="gt-pane-head">
            <div class="gt-counter" aria-live="polite">
              Step {current + 1} of {total} · {step.package}
            </div>
            <div class="gt-nav">
              <button type="button" class="gt-prev" aria-label="Previous step" disabled={current === 0} onClick={() => go(current - 1, true)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </button>
              <button type="button" class="gt-next" aria-label="Next step" disabled={current === total - 1} onClick={() => go(current + 1, true)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M9 18l6-6-6-6" />
                </svg>
              </button>
            </div>
          </div>

          <h2 id="gt-step-title" class="gt-title" tabIndex={-1} ref={headingRef}>
            {step.title}
          </h2>
          <p class="gt-prose">{step.body}</p>

          <figure class="gt-code">
            <figcaption class="gt-code-head">
              <span class="gt-file">
                {step.file}
                <span class="gt-lines">{range}</span>
              </span>
              <a href={step.url} target="_blank" rel="noopener">
                View on GitHub at pin
              </a>
            </figcaption>
            <pre tabIndex={0} aria-label={`${step.file}, lines ${step.lines.start} to ${step.lines.end}`}>
              <code>
                {step.code.split("\n").map((line, i) => (
                  <span key={i} class={isElision(line) ? "gt-elided" : undefined}>
                    {line}
                    {"\n"}
                  </span>
                ))}
              </code>
            </pre>
          </figure>

          <div class="gt-handoff">
            <span class="gt-handoff-label">Hands off to</span>
            <span class="gt-handoff-call">{step.next}</span>
          </div>
        </article>
      </div>
    </div>
  );
}
