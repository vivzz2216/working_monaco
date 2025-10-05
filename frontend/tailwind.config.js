/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'ide-bg': '#1e1e1e',
        'ide-sidebar': '#252526',
        'ide-border': '#3e3e42',
        'ide-text': '#cccccc',
        'ide-accent': '#007acc',
      }
    },
  },
  plugins: [],
}
