import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        'laplace': {
          green: '#1B3A2D',
          'green-hover': '#2A5040',
          sage: '#4A7C59',
          parchment: '#F5F0E8',
          border: '#DDD5C4',
          muted: '#7A6E5F',
          card: '#FDFAF5',
          footer: '#EDE8DE',
        },
        'google-blue': '#4285F4',
        'google-blue-dark': '#1a73e8',
      },
      fontFamily: {
        serif: ['var(--font-serif)', 'Georgia', 'serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'grow': 'grow 0.3s ease-out',
        'bounce-slow': 'bounceSlow 1.6s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        grow: {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        bounceSlow: {
          '0%, 100%': { transform: 'rotate(45deg) translateY(-2px)', opacity: '0.4' },
          '50%': { transform: 'rotate(45deg) translateY(4px)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};

export default config;
