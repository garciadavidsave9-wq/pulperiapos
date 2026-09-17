/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        clay: {
          50: '#FBF4EE',
          100: '#F6E6D8',
          400: '#E08A52',
          500: '#C45C26',
          600: '#A3491C',
          700: '#823A16',
        },
        leaf: {
          500: '#2D6A4F',
          600: '#1B4332',
        },
      },
      fontFamily: {
        sans: ['Segoe UI', 'system-ui', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 10px 30px -12px rgba(60, 30, 10, 0.18)',
      },
    },
  },
  plugins: [],
}
