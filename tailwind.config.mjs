/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: '#070e1e',
        surface: '#0d1733',
        elevated: '#132247',
        midnight: {
          950: '#070e1e',
          900: '#0b1633',
          850: '#0d1a3d',
          800: '#11224d',
          700: '#19336e',
          600: '#254a9c',
          border: 'rgba(91, 155, 213, 0.22)',
          card: 'rgba(13, 26, 61, 0.72)',
        },
        gold: {
          100: '#fcf7eb',
          200: '#f7ebd0',
          300: '#f1dba7',
          400: '#eed59b',
          500: '#e5c179',
          600: '#c89e47',
          700: '#9d762e',
        },
        cerulean: {
          100: '#eff6ff',
          200: '#dbeafe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#3b82f6',
          600: '#2563eb',
          soft: '#5b9bd5',
        },
        aquamarine: {
          400: '#4ecdc4',
          500: '#38b2ac',
        },
        tactical: {
          border: 'rgba(91, 155, 213, 0.3)',
          subtle: 'rgba(91, 155, 213, 0.15)',
          glow: '#5b9bd5',
        },
        forest: {
          base: '#070e1e',
          surface: '#0d1733',
          elevated: '#132247',
          border: 'rgba(91, 155, 213, 0.25)',
          muted: '#94a3b8',
          primary: '#1d4ed8',
          secondary: '#eed59b',
        },
        pastel: {
          lavender: '#94a3b8',
          lavenderDark: '#64748b',
          mint: '#4ecdc4',
          coral: '#f87171',
          amber: '#eed59b',
          ice: '#93c5fd',
        },
        retro: {
          peach: '#eed59b',
          coral: '#f87171',
          mint: '#4ecdc4',
          lavender: '#94a3b8',
          amber: '#eed59b',
          ice: '#93c5fd',
          dark: '#070e1e',
          card: '#0d1733',
        }
      },
      fontFamily: {
        serif: [
          '"Playfair Display"',
          'Cormorant Garamond',
          'Georgia',
          'serif',
        ],
        sans: [
          'Inter',
          '-apple-system',
          'system-ui',
          'sans-serif',
        ],
        display: [
          '"Playfair Display"',
          'Inter',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },
      boxShadow: {
        'midnight': '0 10px 30px -10px rgba(0, 0, 0, 0.6), 0 0 15px -3px rgba(91, 155, 213, 0.15)',
        'midnight-glow': '0 0 25px -4px rgba(91, 155, 213, 0.25), 0 0 10px 0px rgba(229, 193, 121, 0.2)',
        'gold-glow': '0 0 25px -3px rgba(229, 193, 121, 0.35)',
        'tactical': '0 10px 25px -5px rgba(0,0,0,0.7)',
        'tactical-sm': '0 4px 12px rgba(0,0,0,0.5)',
        'tactical-glow': '0 0 20px -3px rgba(91, 155, 213, 0.25)',
      }
    },
  },
  plugins: [],
};
