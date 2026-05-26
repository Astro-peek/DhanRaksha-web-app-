/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: "#028090",      // Vibrant Teal
          secondary: "#00A896",    // Seafoam
          dark: "#05668D",         // Deep Accent Teal
          bg: "#F0F4F8",           // Premium Soft Slate Gray/Blue Background
          surface: "#FFFFFF",      // Clean surface card
          error: "#E53E3E",        // Vivid Red
          success: "#38A169",      // Lush Emerald Green
          warning: "#D69E2E",      // Ochre Yellow
          textPrimary: "#1A202C",  // Charcoal Slate
          textMuted: "#718096",    // Slate Gray
        }
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
      borderRadius: {
        card: "12px",
        input: "8px",
        badge: "6px",
      },
      boxShadow: {
        premium: "0 4px 20px -2px rgba(2, 128, 144, 0.08), 0 2px 8px -1px rgba(5, 102, 141, 0.04)",
        soft: "0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)",
        cardHover: "0 12px 24px -4px rgba(2, 128, 144, 0.12), 0 4px 12px -2px rgba(5, 102, 141, 0.06)",
      }
    },
  },
  plugins: [],
}
