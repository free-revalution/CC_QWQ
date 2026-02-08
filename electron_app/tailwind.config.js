/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#F5F5F7',
        surface: '#FFFFFF',
        primary: '#1D1D1F',
        secondary: '#86868B',
        muted: 'rgba(0, 0, 0, 0.06)',
        border: 'rgba(0, 0, 0, 0.08)',
      },
      borderRadius: {
        'lg': '1rem',
        'xl': '1.5rem',
        '2xl': '2rem',
      },
      backdropBlur: {
        sm: 'blur(8px)',
        md: 'blur(16px)',
        lg: 'blur(24px)',
      },
    },
  },
  plugins: [],
}
