/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // ── Core surfaces ──────────────────────────────────────────────────
        base:    '#0D1117',   // page background
        surface: '#111827',   // card/panel
        raised:  '#161E2D',   // elevated card
        // ── Legacy compat ──────────────────────────────────────────────────
        card: '#111827',
        navy: {
          950: '#080C10',
          900: '#0D1117',
          800: '#111827',
          700: '#161E2D',
          600: '#1e2d45',
          500: '#263650',
        },
        // ── Brand ──────────────────────────────────────────────────────────
        bbva: '#004481',
        amex: '#B8972B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      boxShadow: {
        // Elevation
        'card':    '0 1px 3px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.4)',
        'card-md': '0 4px 16px rgba(0,0,0,0.6), 0 1px 4px rgba(0,0,0,0.4)',
        'card-lg': '0 8px 32px rgba(0,0,0,0.7), 0 2px 8px rgba(0,0,0,0.5)',
        // Cyber-neo glows
        'glow-green':  '0 0 20px rgba(52,211,153,0.14), 0 0 60px rgba(52,211,153,0.05)',
        'glow-red':    '0 0 20px rgba(248,113,113,0.14), 0 0 60px rgba(248,113,113,0.05)',
        'glow-indigo': '0 0 20px rgba(99,102,241,0.14), 0 0 60px rgba(99,102,241,0.05)',
      },
      animation: {
        'fade-up':  'fadeUp 0.3s ease-out forwards',
        'count-in': 'countIn 0.2s ease-out forwards',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        fadeUp: {
          '0%':   { opacity: '0', transform: 'translateY(10px)' },
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
