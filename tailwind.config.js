/** @type {import("tailwindcss").Config} */
module.exports = {
  content: ["src/client/**/*.vue", "src/client/**/*.ts"],
  theme: {
    extend: {},
    colors: {
      "fg": "rgb(var(--color-fg) / <alpha-value>)",
      "fg-mute": "rgb(var(--color-fg-mute) / <alpha-value>)",

      "bg": "rgb(var(--color-bg) / <alpha-value>)",
      "bg-mute": "rgb(var(--color-bg-mute) / <alpha-value>)",

      "primary": "rgb(var(--color-primary) / <alpha-value>)",
      "primary-mute": "rgb(var(--color-primary-mute) / <alpha-value>)",
      "secondary": "rgb(var(--color-secondary) / <alpha-value>)",

      "green": "rgb(var(--color-green) / <alpha-value>)",
      "red": "rgb(var(--color-red) / <alpha-value>)",
      "orange": "rgb(var(--color-orange) / <alpha-value>)",
      "yellow": "rgb(var(--color-yellow) / <alpha-value>)",
      "blue": "rgb(var(--color-blue) / <alpha-value>)"
    }
  },
  plugins: [],
}
