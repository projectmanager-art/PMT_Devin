/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#1d2021',
        muted: '#777b78',
        line: '#e7e7e2',
        canvas: '#f6f6f3',
        paper: '#ffffff',
        green: '#3b8b67',
        amber: '#b87b2c',
        red: '#c25555',
        blue: '#2b6cb0',
      },
      boxShadow: {
        soft: '0 8px 24px rgba(20,22,24,0.045)',
        lift: '0 12px 30px rgba(20,22,24,0.08)',
      },
      borderRadius: {
        card: '14px',
      },
      fontFamily: {
        sans: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
        heading: ['Inter', 'Segoe UI', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
