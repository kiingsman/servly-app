/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: { 
        primary: '#0f172a', 
        accent: '#0d9488', 
        bgLight: '#f8fafc' 
      }
    },
  },
  plugins: [],
}