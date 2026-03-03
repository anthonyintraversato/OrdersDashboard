/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        earth: {
          950: '#1a1917',
          900: '#2a2825',
          800: '#3d3a36',
          700: '#524e49',
          600: '#6b665f',
          500: '#a9a4a0',
          400: '#c4a77d',
          300: '#d4c4a8',
          200: '#e8e2d8',
          100: '#f5f3ef',
          50: '#faf9f7',
        },
      },
      fontFamily: {
        sans: ['"Source Sans 3"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
    },
  },
  plugins: [],
};
