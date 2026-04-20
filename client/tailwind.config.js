/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base:    '#0B0F14',
        surface: '#121821',
        card:    '#0F172A',
        // legacy compat
        navy: {
          950: '#0B0F14',
          900: '#121821',
          800: '#0F172A',
          700: '#1a2235',
          600: '#1e2d45',
          500: '#263650',
        },
        bbva: '#004481',
        amex: '#B8972B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        'card':    '0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)',
        'card-md': '0 4px 16px rgba(0,0,0,0.5), 0 1px 4px rgba(0,0,0,0.3)',
        'card-lg': '0 8px 32px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)',
        'glow-green': '0 0 24px rgba(34,197,94,0.12)',
        'glow-red':   '0 0 24px rgba(239,68,68,0.12)',
      },
      animation: {
        'fade-up':   'fadeUp 0.35s ease-out forwards',
        'count-in':  'countIn 0.2s ease-out forwards',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        countIn: {
          '0%':   { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
    },
  },
  plugins: [],
}
