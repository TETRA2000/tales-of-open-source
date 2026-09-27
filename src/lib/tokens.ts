// Turns design/tokens.json into CSS custom properties, using the same names as
// design/tokens.css (--color-bg, --color-accent-rails, --font-mono, --radius-sm …).

type TokenTree = { [key: string]: string | number | TokenTree };

export interface DesignTokens {
  font: Record<string, string>;
  color: TokenTree;
  radius: Record<string, number>;
  layout: Record<string, number>;
}

function flatten(prefix: string, tree: TokenTree, unit = ""): string[] {
  return Object.entries(tree).flatMap(([key, value]) =>
    typeof value === "object"
      ? flatten(`${prefix}-${key}`, value, unit)
      : [`--${prefix}-${key}: ${typeof value === "number" ? `${value}${unit}` : value};`],
  );
}

export function tokensToCss(tokens: DesignTokens): string {
  const fonts = Object.entries(tokens.font)
    .filter(([key]) => key !== "googleFontsHref")
    .map(([key, value]) => `--font-${key}: ${value};`);
  const lines = [
    ...flatten("color", tokens.color),
    ...fonts,
    ...flatten("radius", tokens.radius, "px"),
    ...flatten("layout", tokens.layout, "px"),
  ];
  return `:root {\n${lines.map((l) => `  ${l}`).join("\n")}\n}`;
}
