/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        primary: {
          50: '#e8f0fe',
          100: '#d2e3fc',
          200: '#aecbfa',
          300: '#8ab4f8',
          400: '#669df6',
          500: '#4285f4',
          600: '#1a73e8', // Official Google Chrome Blue
          700: '#1557b0',
          800: '#174ea6',
          900: '#0d3a78',
          950: '#062047',
        },
        surface: {
          50: '#f8fafd',  // Clean subtle background
          100: '#f1f3f4', // Soft secondary neutral
          200: '#e8eaed', // Dividers & subtle borders
          300: '#dadce0', // Card/input borders
          400: '#bdc1c6',
          500: '#9aa0a6',
          600: '#80868b', // Muted label text
          700: '#5f6368', // Secondary body text
          800: '#3c4043', // Primary dark body text
          900: '#202124', // Near-black charcoal headings
          950: '#171717',
        },
        google: {
          blue: '#1a73e8',
          'blue-light': '#e8f0fe',
          red: '#d93025',
          'red-light': '#fce8e6',
          yellow: '#f9ab00',
          'yellow-light': '#fef7e0',
          green: '#1e8e3e',
          'green-light': '#e6f4ea',
        },
      },
      boxShadow: {
        'soft-xs': '0 1px 2px 0 rgba(60,64,67,0.08), 0 1px 3px 1px rgba(60,64,67,0.04)',
        'soft-sm': '0 1px 3px 0 rgba(60,64,67,0.12), 0 2px 6px 1px rgba(60,64,67,0.06)',
        'soft-md': '0 2px 6px 2px rgba(60,64,67,0.12), 0 1px 2px 0 rgba(60,64,67,0.06)',
        'soft-lg': '0 4px 14px 2px rgba(60,64,67,0.12), 0 1px 4px 0 rgba(60,64,67,0.08)',
        'soft-xl': '0 8px 24px 4px rgba(60,64,67,0.12), 0 2px 8px 0 rgba(60,64,67,0.06)',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      transitionDuration: {
        DEFAULT: '180ms',
      },
    },
  },
  plugins: [],
};
