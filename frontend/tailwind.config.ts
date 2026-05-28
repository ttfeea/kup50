import type { Config } from 'tailwindcss';

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#f7f8fb',
          dark: '#12151b',
        },
        ink: {
          DEFAULT: '#172033',
          muted: '#64748b',
        },
      },
      boxShadow: {
        soft: '0 12px 28px rgba(15, 23, 42, 0.08)',
      },
    },
  },
  plugins: [],
} satisfies Config;
