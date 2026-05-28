/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // "Espresso & Ember" — warm hospitality dark theme
        base: '#15100D',
        surface: '#1F1813',
        surface2: '#2A211B',
        surface3: '#352A22',
        line: 'rgba(245,239,230,0.09)',
        cream: '#F5EFE6',
        muted: '#A89789',
        ember: '#EC9A45',
        emberhi: '#F7B96B',
        mint: '#54D6A0',
        berry: '#E26A52'
      },
      fontFamily: {
        display: ['"Bricolage Grotesque Variable"', 'Bricolage Grotesque', 'system-ui', 'sans-serif'],
        sans: ['"Hanken Grotesk Variable"', 'Hanken Grotesk', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        soft: '0 20px 50px -20px rgba(0,0,0,0.65)',
        glow: '0 0 0 1px rgba(236,154,69,0.35), 0 12px 40px -12px rgba(236,154,69,0.45)'
      },
      borderRadius: {
        '2xl': '1.1rem',
        '3xl': '1.5rem'
      },
      keyframes: {
        rise: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' }
        },
        pop: {
          '0%': { transform: 'scale(0.96)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' }
        }
      },
      animation: {
        rise: 'rise .4s cubic-bezier(.2,.7,.2,1) both',
        pop: 'pop .25s ease-out both'
      }
    }
  },
  plugins: []
}
