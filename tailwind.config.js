/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class', '[data-theme="dark"]'],
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary)",
        "primary-focus": "var(--color-primary-focus)",
        ink: "var(--color-ink)",
        "ink-muted-80": "var(--color-ink-muted-80)",
        "ink-muted-48": "var(--color-ink-muted-48)",
        canvas: "var(--color-canvas)",
        "canvas-parchment": "var(--color-canvas-parchment)",
        "surface-pearl": "var(--color-surface-pearl)",
        "divider-soft": "var(--color-divider-soft)",
        hairline: "var(--color-hairline)",
        "surface-black": "var(--color-surface-black)",
        "on-primary": "var(--color-on-primary)",
        "chip-translucent": "var(--color-chip-translucent)",
      },
      fontFamily: {
        sans: [
          "-apple-system",
          "BlinkMacSystemFont",
          '"SF Pro Display"',
          '"SF Pro Text"',
          "Inter",
          "system-ui",
          "sans-serif",
        ],
      },
      fontSize: {
        // token: [size, { lineHeight, letterSpacing, fontWeight }]
        "display-lg": ["40px", { lineHeight: "1.10", letterSpacing: "0", fontWeight: "600" }],
        "display-md": ["34px", { lineHeight: "1.20", letterSpacing: "-0.374px", fontWeight: "600" }],
        lead: ["28px", { lineHeight: "1.14", letterSpacing: "0.196px", fontWeight: "400" }],
        "lead-airy": ["24px", { lineHeight: "1.5", letterSpacing: "0", fontWeight: "300" }],
        tagline: ["21px", { lineHeight: "1.19", letterSpacing: "0.231px", fontWeight: "600" }],
        "body-strong": ["17px", { lineHeight: "1.24", letterSpacing: "-0.374px", fontWeight: "600" }],
        body: ["17px", { lineHeight: "1.47", letterSpacing: "-0.374px", fontWeight: "400" }],
        "dense-link": ["17px", { lineHeight: "2.41", letterSpacing: "0", fontWeight: "400" }],
        caption: ["14px", { lineHeight: "1.43", letterSpacing: "-0.224px", fontWeight: "400" }],
        "caption-strong": ["14px", { lineHeight: "1.29", letterSpacing: "-0.224px", fontWeight: "600" }],
        "button-utility": ["14px", { lineHeight: "1.29", letterSpacing: "-0.224px", fontWeight: "400" }],
        "fine-print": ["12px", { lineHeight: "1.0", letterSpacing: "-0.12px", fontWeight: "400" }],
      },
      fontWeight: {
        light: "300",
        normal: "400",
        semibold: "600",
        bold: "700",
      },
      borderRadius: {
        none: "0px",
        xs: "5px",
        sm: "8px",
        md: "11px",
        lg: "18px",
        pill: "9999px",
        full: "9999px",
      },
      spacing: {
        1: "4px",
        2: "8px",
        3: "12px",
        "4.5": "17px",
        6: "24px",
        8: "32px",
        12: "48px",
        20: "80px",
        // semantic
        "label-value": "17px",
      },
      boxShadow: {
        // The single approved shadow in the entire system.
        product: "3px 5px 30px rgba(0,0,0,0.22)",
        none: "none",
      },
    },
  },
  plugins: [],
};
