/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'sans-serif'],
        display: ['"Syne"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        surface: { DEFAULT: '#0f0f13', 1: '#16161d', 2: '#1e1e28', 3: '#262633' },
        accent: { DEFAULT: '#6c63ff', warm: '#ff6b6b', green: '#4ade80', amber: '#fbbf24' },
      },
      animation: {
        'fade-up': 'fadeUp 0.4s ease forwards',
        'pulse-dot': 'pulseDot 1.5s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        pulseDot: {
          '0%,100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.4', transform: 'scale(0.8)' },
        },
      },
    },
  },
  plugins: [],
}
