// Ready-made colour sets for the site, each complete for every colour role and checked to pass the contrast rules
// (see lib/site/theme.ts). The first is the site's own original.
import type { Theme } from "@/lib/site/schema.ts";

type Colors = Theme["colors"];

const shared = { input: "#FFFFFF", buttonText: "#FFFFFF", navigationText: "#FFFFFF", footerText: "#FFFFFF", onPrimary: "#FFFFFF", warning: "#B45309", error: "#B91C1C" };

function palette(dark: string, darker: string, light: string, card: string, ink: string, heading: string, muted: string, subtle: string): Colors {
  return {
    ...shared,
    primary: dark,
    secondary: darker,
    accent: dark,
    background: light,
    surface: card,
    text: ink,
    heading,
    muted,
    subtle,
    border: heading,
    link: heading,
    button: dark,
    buttonHover: darker,
    navigation: dark,
    footer: dark,
    success: dark,
  };
}

export const palettes: { id: string; name: string; colors: Colors }[] = [
  { id: "skog", name: "Skog (original)", colors: palette("#1C2817", "#131C10", "#E3E1D8", "#F2F0E9", "#333333", "#222222", "#63625C", "#B6B5AE") },
  { id: "granit", name: "Granit", colors: palette("#1F2933", "#141B22", "#E4E7EA", "#F3F4F6", "#2D333A", "#1A1F24", "#5A6169", "#AEB4BA") },
  { id: "hav", name: "Hav", colors: palette("#123A5A", "#0B2840", "#E2E8EE", "#F1F5F8", "#2B3640", "#16222D", "#56626D", "#AAB6C1") },
  { id: "lera", name: "Lera", colors: palette("#7A3B22", "#5C2B18", "#EDE6DE", "#F7F2EC", "#3A302A", "#2A211C", "#6B5E55", "#BDB2A8") },
  { id: "sand", name: "Sand och svart", colors: palette("#1E1E1E", "#000000", "#EFEBE3", "#F8F6F1", "#333333", "#141414", "#625E57", "#B9B4AA") },
  { id: "mossa", name: "Mossa", colors: palette("#3D4A2A", "#2C361E", "#E8E6DC", "#F5F3EB", "#33362E", "#22251E", "#5F6257", "#B4B6A8") },
];
