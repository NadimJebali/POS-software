/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/index.html', './src/renderer/src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Theme tokens resolve to CSS variables (see src/renderer/src/index.css),
        // so the whole palette is swappable at runtime via data-theme. Channels are
        // space-separated RGB; <alpha-value> lets Tailwind's /opacity modifiers work.
        base: 'rgb(var(--c-base) / <alpha-value>)',
        surface: 'rgb(var(--c-surface) / <alpha-value>)',
        surface2: 'rgb(var(--c-surface2) / <alpha-value>)',
        surface3: 'rgb(var(--c-surface3) / <alpha-value>)',
        line: 'var(--c-line)', // hairline already carries its own low alpha
        cream: 'rgb(var(--c-cream) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        ember: 'rgb(var(--c-ember) / <alpha-value>)',
        emberhi: 'rgb(var(--c-emberhi) / <alpha-value>)',
        mint: 'rgb(var(--c-mint) / <alpha-value>)',
        berry: 'rgb(var(--c-berry) / <alpha-value>)'
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
