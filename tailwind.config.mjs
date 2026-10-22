/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        midnight: {
          950: '#090C10',
          900: '#0E131F',
          800: '#151C2C',
          700: '#1E293B',
          600: '#334155',
        },
        pastel: {
          lavender: '#C4B5FD',
          lavenderDark: '#A78BFA',
          mint: '#86EFAC',
          coral: '#FDA4AF',
          amber: '#FDE68A',
          ice: '#93C5FD',
        }
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif'
        ],
        mono: [
          'JetBrains Mono',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace'
        ],
      },
      boxShadow: {
        'glow-lavender': '0 0 20px -5px rgba(196, 181, 253, 0.25)',
        'glow-mint': '0 0 20px -5px rgba(134, 239, 172, 0.25)',
        'glow-ice': '0 0 20px -5px rgba(147, 197, 253, 0.25)',
      }
    },
  },
  plugins: [],
};
