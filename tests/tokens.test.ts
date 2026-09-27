import { describe, expect, it } from "vitest";
import tokens from "../design/tokens.json";
import { tokensToCss } from "../src/lib/tokens";

describe("tokensToCss", () => {
  const css = tokensToCss(tokens);

  it("emits the dark slate background, never pure black", () => {
    expect(css).toContain("--color-bg: #222838;");
    expect(css).not.toMatch(/#000(000)?\b/i);
  });

  it("flattens nested colour groups with the tokens.css naming", () => {
    expect(css).toContain("--color-accent-rails: #F28B6D;");
    expect(css).toContain("--color-status-drifted: #A2481F;");
    expect(css).toContain("--color-code-highlight: rgba(108,200,214,0.16);");
  });

  it("emits the three font stacks but not the Google Fonts URL", () => {
    expect(css).toContain("--font-display: 'Bricolage Grotesque'");
    expect(css).toContain("--font-body: 'IBM Plex Sans'");
    expect(css).toContain("--font-mono: 'IBM Plex Mono'");
    expect(css).not.toContain("googleapis");
  });

  it("adds px to radius and layout numbers", () => {
    expect(css).toContain("--radius-lg: 6px;");
    expect(css).toContain("--layout-pageGutter: 72px;");
  });
});
