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
        'google-blue': '#4285F4',
        'google-blue-dark': '#1a73e8',
        'surface': {
          DEFAULT: '#0f0f0f',
          '50': '#1a1a1a',
          '100': '#2d2d2d',
          '200': '#3d3d3d',
        },
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'grow': 'grow 0.3s ease-out',
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
      },
    },
  },
  plugins: [],
};

export default config;
