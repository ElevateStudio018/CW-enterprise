import type { Config } from "tailwindcss";
import plugin from "tailwindcss/plugin";

const role = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      // Every colour is a theme role from the content document (lib/site/theme.ts writes the variables), so the admin
      // can change them. The channels-only variables keep Tailwind's opacity modifiers (bg-primary/20) working.
      colors: {
        primary: role("primary"),
        secondary: role("secondary"),
        accent: role("accent"),
        page: role("background"),
        card: role("surface"),
        body: role("text"),
        heading: role("heading"),
        muted: role("muted"),
        subtle: role("subtle"),
        line: role("border"),
        field: role("input"),
        link: role("link"),
        button: { DEFAULT: role("button"), hover: role("button-hover"), text: role("button-text") },
        nav: { DEFAULT: role("navigation"), text: role("navigation-text") },
        footer: { DEFAULT: role("footer"), text: role("footer-text") },
        "on-primary": role("on-primary"),
        success: role("success"),
        warning: role("warning"),
        error: role("error"),
        // The admin panel's own colours: its prime colour (chosen on the colour page) and a few warm neutrals.
        admin: {
          DEFAULT: "rgb(var(--admin-primary) / <alpha-value>)",
          contrast: "rgb(var(--admin-primary-contrast) / <alpha-value>)",
          canvas: "#F6F5F2",
          ink: "#1E1E1C",
          muted: "#6A6963",
          subtle: "#9C9A93",
          line: "#E8E6E1",
        },
      },
      fontFamily: {
        sans: ["var(--font-body)"],
        heading: ["var(--font-heading)"],
        button: ["var(--font-button)"],
      },
      // Mobile sizes are width-matched against the reference screenshots (Figtree equivalents):
      // 17px body with tight ~1.12 leading, 29px section headings, 17px uppercase links.
      fontSize: {
        display: ["33px", { lineHeight: "1.15", letterSpacing: "-0.01em", fontWeight: "600" }],
        "display-lg": ["60px", { lineHeight: "1.06", letterSpacing: "-0.015em", fontWeight: "600" }],
        h2: ["29px", { lineHeight: "1.14", letterSpacing: "-0.01em", fontWeight: "600" }],
        "h2-lg": ["46px", { lineHeight: "1.1", letterSpacing: "-0.015em", fontWeight: "600" }],
        h3: ["22px", { lineHeight: "1.18", fontWeight: "600" }],
        lead: ["19px", { lineHeight: "1.3" }],
        copy: ["17px", { lineHeight: "1.12" }],
        label: ["17px", { lineHeight: "1.18", letterSpacing: "0.03em", fontWeight: "700" }],
        tag: ["13px", { lineHeight: "1", letterSpacing: "0.2em", fontWeight: "700" }],
        stat: ["50px", { lineHeight: "1", letterSpacing: "-0.01em", fontWeight: "800" }],
      },
      maxWidth: {
        content: "1280px",
        prose: "720px",
      },
      keyframes: {
        "fade-up": {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "modal-in": {
          "0%": { opacity: "0", transform: "scale(0.96)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
        rise: {
          "0%": { opacity: "0", transform: "translateY(16px)" },
          "100%": { opacity: "1", transform: "none" },
        },
        "pin-drop": {
          "0%": { opacity: "0", transform: "translateY(-18px)" },
          "55%": { opacity: "1", transform: "translateY(0)" },
          "75%": { transform: "translateY(-5px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "error-in": {
          "0%": { opacity: "0", transform: "translateY(-4px)" },
          "100%": { opacity: "1", transform: "none" },
        },
        "toast-timer": {
          "0%": { transform: "scaleX(1)" },
          "100%": { transform: "scaleX(0)" },
        },
      },
      animation: {
        "fade-up": "fade-up 0.5s ease-out forwards",
        "modal-in": "modal-in 0.2s ease-out forwards",
        // Held hidden through its delay ("both"), so staggered lines appear in turn.
        rise: "rise 0.8s cubic-bezier(0.22, 1, 0.36, 1) both",
        "rise-fast": "rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both",
        "pin-drop": "pin-drop 0.8s cubic-bezier(0.33, 1, 0.68, 1) both",
        "error-in": "error-in 0.25s ease-out both",
        // Its duration is set where it is used, to match how long the thank-you stays.
        "toast-timer": "toast-timer linear both",
      },
    },
  },
  plugins: [
    // Devices with a real hover (a mouse): secondary controls can appear when a row is pointed at.
    plugin(({ addVariant }) => addVariant("can-hover", "@media (hover: hover)")),
  ],
};

export default config;
