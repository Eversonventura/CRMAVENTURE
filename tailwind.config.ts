import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#FFFFFF",
        surface: "#F7F7F9",
        surface2: "#F0EEF3",
        border: "#E6E3EA",
        muted: "#78758A",
        ink: "#18161F",
        brand: "#FF007A",
        "brand-soft": "#FFE3F0",
        brand2: "#FF4D9D",
        accent: "#F9B300",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
      backgroundImage: {
        "growth-gradient": "linear-gradient(135deg, #FF007A 0%, #FF4D9D 55%, #F9B300 100%)",
      },
    },
  },
  plugins: [],
};
export default config;
