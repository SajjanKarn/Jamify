/** @type {import('tailwindcss').Config} */
// Spotify-inspired design tokens extracted from /Applications/Spotify.app's
// xpui-snapshot.css. Implementation is original — no copied code or assets.
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Spotify's dark theme palette (backgrounds).
        spotify: {
          bg: "#121212",          // base (--background-base)
          "bg-elevated": "#1a1a1a",
          "bg-highlight": "#1f1f1f",
          "bg-press": "#000000",
          surface: "#181818",      // sidebar, topbar, cards
          "surface-hover": "#282828",
          "surface-2": "#282828",  // list items, secondary surfaces
          "surface-3": "#3a3a3a",
          deco: "#2a2a2a",         // decorative (separators)
        },
        // Spotify's brand green.
        brand: {
          DEFAULT: "#1ed760",
          hover: "#1fdf64",
          press: "#169c46",
          accent: "#1abc54",
        },
        // Text palette.
        ink: {
          DEFAULT: "#ffffff",
          primary: "#ffffff",
          secondary: "#b3b3b3",
          muted: "#6a6a6a",
          tertiary: "#727272",
        },
      },
      fontFamily: {
        sans: ['"Inter"', '"SpotifyMixUI"', '"CircularSp-Arab"', "system-ui", "sans-serif"],
        title: ['"Inter"', '"SpotifyMixUITitle"', "system-ui", "sans-serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "monospace"],
      },
      fontSize: {
        // Spotify's type scale (approx).
        xxs: ["0.6875rem", { lineHeight: "1rem" }],     // 11px
        xs: ["0.75rem", { lineHeight: "1rem" }],        // 12px
        sm: ["0.8125rem", { lineHeight: "1rem" }],      // 13px
        base: ["0.875rem", { lineHeight: "1rem" }],     // 14px
        lg: ["1rem", { lineHeight: "1.25rem" }],        // 16px
        xl: ["1.125rem", { lineHeight: "1.5rem" }],     // 18px
        "2xl": ["1.5rem", { lineHeight: "2rem" }],       // 24px
        "3xl": ["2rem", { lineHeight: "2.5rem" }],       // 32px
        "4xl": ["3rem", { lineHeight: "1.1", fontWeight: "700" }],
      },
      spacing: {
        // Spotify's encore-spacing scale.
        "sp-2": "2px",
        "sp-4": "4px",
        "sp-6": "6px",
        "sp-8": "8px",
        "sp-12": "12px",
        "sp-16": "16px",
        "sp-20": "20px",
        "sp-24": "24px",
        "sp-32": "32px",
        "sp-40": "40px",
        "sp-48": "48px",
        "sp-64": "64px",
      },
      borderRadius: {
        spotify: "4px",
        "spotify-lg": "6px",
        "spotify-xl": "8px",
        pill: "9999px",
      },
    },
  },
  plugins: [],
};