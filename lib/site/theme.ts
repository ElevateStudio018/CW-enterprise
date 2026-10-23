// The theme as CSS: each colour role becomes a variable holding its RGB channels (so Tailwind's opacity modifiers
// work on it), each font role a variable holding the family with fallbacks for its kind.
import { colorRoles, type ColorRole, type FontChoice, type Theme } from "./schema.ts";

/** "buttonHover" → "button-hover", the name in CSS variables and Tailwind classes. */
export function cssRoleName(role: ColorRole): string {
  return role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);
}

export function hexToChannels(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  return `${(value >> 16) & 255} ${(value >> 8) & 255} ${value & 255}`;
}

const fallbacks: Record<FontChoice["category"], string> = {
  "sans-serif": 'ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji"',
  serif: 'ui-serif, Georgia, Cambria, "Times New Roman", Times, serif',
  display: "ui-sans-serif, system-ui, sans-serif",
  handwriting: "cursive",
  monospace: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
};

export function fontStack(font: FontChoice): string {
  return `"${font.family}", ${fallbacks[font.category]}`;
}

/** The variable declarations for a theme, without a selector. */
export function themeDeclarations(theme: Theme): string {
  const colors = colorRoles.map((role) => `--c-${cssRoleName(role)}:${hexToChannels(theme.colors[role])};`).join("");
  const fonts = (["heading", "body", "button"] as const).map((role) => `--font-${role}:${fontStack(theme.fonts[role])};`).join("");
  return colors + fonts;
}

export function themeCss(theme: Theme, selector = ":root"): string {
  return `${selector}{${themeDeclarations(theme)}}`;
}

// ---------------------------------------------------------------------------------------------------------------------
// Contrast (WCAG 2.1)

function luminance(hex: string): number {
  const [r, g, b] = hexToChannels(hex)
    .split(" ")
    .map((channel) => {
      const c = Number(channel) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/** Text colour on background colour, as the site uses them; large: only shown in big type (3:1 is enough). */
export const contrastPairs: { text: ColorRole; background: ColorRole; large?: boolean }[] = [
  { text: "text", background: "background" },
  { text: "heading", background: "background" },
  { text: "muted", background: "background" },
  { text: "link", background: "background" },
  { text: "text", background: "surface" },
  { text: "heading", background: "surface" },
  { text: "muted", background: "surface" },
  { text: "text", background: "input" },
  { text: "error", background: "surface" },
  { text: "buttonText", background: "button" },
  { text: "buttonText", background: "buttonHover" },
  { text: "navigationText", background: "navigation" },
  { text: "footerText", background: "footer" },
  { text: "onPrimary", background: "primary" },
  { text: "onPrimary", background: "secondary", large: true },
  { text: "onPrimary", background: "success" },
  { text: "onPrimary", background: "accent", large: true },
];

export interface ContrastProblem {
  text: ColorRole;
  background: ColorRole;
  ratio: number;
  required: number;
}

export function contrastProblems(colors: Theme["colors"]): ContrastProblem[] {
  return contrastPairs.flatMap(({ text, background, large }) => {
    const ratio = contrastRatio(colors[text], colors[background]);
    const required = large ? 3 : 4.5;
    return ratio < required ? [{ text, background, ratio, required }] : [];
  });
}
