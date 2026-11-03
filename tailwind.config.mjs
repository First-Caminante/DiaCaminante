/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        midnight: {
          950: '#080B11',
          900: '#0E1422',
          800: '#141D30',
          700: '#1F2B45',
          600: '#334155',
        },
        pastel: {
          lavender: '#C4B5FD',
          lavenderDark: '#A78BFA',
          mint: '#86EFAC',
          coral: '#FDA4AF',
          amber: '#FDE68A',
          ice: '#93C5FD',
        },
        retro: {
          peach: '#FDA4AF',
          coral: '#FB7185',
          mint: '#86EFAC',
          lavender: '#C4B5FD',
          amber: '#FDE68A',
          ice: '#93C5FD',
          dark: '#080B11',
          card: '#121826',
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
        display: [
          'Space Grotesk',
          'Inter',
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
        'brutal': '4px 4px 0px 0px #000000',
        'brutal-sm': '2px 2px 0px 0px #000000',
        'brutal-lg': '6px 6px 0px 0px #000000',
        'brutal-mint': '4px 4px 0px 0px #86EFAC',
        'brutal-coral': '4px 4px 0px 0px #FDA4AF',
        'brutal-lavender': '4px 4px 0px 0px #C4B5FD',
        'acrylic': '4px 4px 0px 0px #000000, inset 0 1px 0 rgba(255, 255, 255, 0.15)',
        'glow-lavender': '0 0 20px -5px rgba(196, 181, 253, 0.3)',
        'glow-mint': '0 0 20px -5px rgba(134, 239, 172, 0.3)',
        'glow-ice': '0 0 20px -5px rgba(147, 197, 253, 0.3)',
      }
    },
  },
  plugins: [],
};
