/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        potrero: {
          50:  '#F0F5F1',
          100: '#D6E4D9',
          200: '#A8C5B0',
          300: '#7BA588',
          400: '#4E7D5A',
          500: '#3D6B48',
          600: '#2A5438',
          700: '#1E4230',
          800: '#162F23',
          900: '#0C1A10',
        },
        earth: {
          50:  '#FAF6EE',
          100: '#F4EFE3',
          200: '#E8DCC4',
          300: '#DFC08A',
          400: '#C8A971',
          500: '#A88A55',
          600: '#866C40',
          700: '#64502E',
          800: '#42351E',
          900: '#211B0F',
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans:    ['DM Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
