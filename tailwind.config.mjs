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
        display: ['Lora', 'Georgia', 'serif'],
        sans:    ['Archivo', 'sans-serif'],
      },
      boxShadow: {
        'warm-sm': '0 1px 2px rgba(30, 66, 48, 0.06), 0 1px 2px rgba(30, 66, 48, 0.04)',
        'warm':    '0 4px 12px rgba(30, 66, 48, 0.08), 0 2px 4px rgba(30, 66, 48, 0.04)',
        'warm-lg': '0 12px 32px rgba(30, 66, 48, 0.12), 0 4px 8px rgba(30, 66, 48, 0.06)',
      },
    },
  },
  plugins: [],
}
