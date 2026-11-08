/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      // Ported verbatim from frontend/src/app/globals.css's `@theme` block — custom
      // in-between shades the web app relies on that have no stock Tailwind equivalent.
      // Keep these in sync if the web token values ever change (see Standing Rule 1).
      colors: {
        zinc: {
          405: '#9f9fa8',
          550: '#62626b',
          605: '#51515a',
          655: '#48484f',
          850: '#202022',
          905: '#171719',
        },
        emerald: {
          250: '#8bedc4',
          350: '#51dda8',
          405: '#32d298',
        },
        amber: {
          405: '#fbbd23',
        },
        red: {
          650: '#cb2121',
        },
      },
    },
  },
  plugins: [],
};
