/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/**/*.{ts,tsx}',
    // Klassen, die erst zur Laufzeit vom Client-JS gesetzt werden (Toast, Spinner, Tab-Toggle)
    './public/assets/app.js',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
