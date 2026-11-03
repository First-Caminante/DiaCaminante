/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        base: '#000000',
        surface: '#121c13',
        elevated: '#1a281b',
        tactical: {
          border: '#74a47b',
          subtle: 'rgba(116, 164, 123, 0.25)',
          glow: '#74a47b',
        },
        forest: {
          base: '#000000',
          surface: '#121c13',
          elevated: '#1a281b',
          border: '#74a47b',
          muted: '#92aa95',
          primary: '#215e28',
          secondary: '#d9f2c4',
        },
        midnight: {
          950: '#000000',
          900: '#121c13',
          800: '#1a281b',
          700: '#215e28',
          600: '#74a47b',
        },
        pastel: {
          lavender: '#92aa95',
          lavenderDark: '#74a47b',
          mint: '#d9f2c4',
          coral: '#e28080',
          amber: '#fde68a',
          ice: '#74a47b',
        },
        retro: {
          peach: '#d9f2c4',
          coral: '#e28080',
          mint: '#d9f2c4',
          lavender: '#92aa95',
          amber: '#fde68a',
          ice: '#74a47b',
          dark: '#000000',
          card: '#121c13',
        }
      },
      fontFamily: {
        sans: [
          'Space Grotesk',
          'Inter',
          '-apple-system',
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
          'Menlo',
          'Consolas',
          'monospace'
        ],
      },
      boxShadow: {
        'tactical': '3px 3px 0px 0px #215e28, 0 10px 25px -5px rgba(0,0,0,0.8)',
        'tactical-sm': '2px 2px 0px 0px #215e28',
        'tactical-glow': '0 0 25px -4px rgba(217, 242, 196, 0.25), 0 0 10px 0px rgba(116, 164, 123, 0.3)',
        'brutal': '3px 3px 0px 0px #215e28',
        'brutal-sm': '2px 2px 0px 0px #215e28',
        'brutal-lg': '5px 5px 0px 0px #215e28',
        'brutal-mint': '3px 3px 0px 0px #d9f2c4',
        'brutal-coral': '3px 3px 0px 0px #e28080',
        'brutal-lavender': '3px 3px 0px 0px #74a47b',
        'glow-lavender': '0 0 20px -5px rgba(116, 164, 123, 0.4)',
        'glow-mint': '0 0 20px -5px rgba(217, 242, 196, 0.4)',
        'glow-ice': '0 0 20px -5px rgba(116, 164, 123, 0.4)',
      }
    },
  },
  plugins: [],
};
