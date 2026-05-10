/** @type {import('tailwindcss').Config} */
module.exports = {
  // NOTE: Update this to include the paths to all of your component files.
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        tar: {
          matter: "#3b82f6",  // Blue
          mass: "#8b5cf6",    // Purple
          relation: "#06b6d4",// Cyan
          motion: "#f43f5e",  // Rose
          memory: "#64748b",  // Slate
          bg: "#09090b",
          fg: "#fafafa",
          card: "#18181b",
          border: "#27272a",
        }
      },
      fontFamily: {
        tar: ["Inter", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      }
    },
  },
  plugins: [],
}
