/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // B&W palette — all grays + pure black/white accents
        ink: {
          50:  '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
        dash: {
          bg: '#F8F9FA',
          bgDark: '#0F0F1A',
          sidebar: '#FFFFFF',
          sidebarDark: '#1A1A2E',
          card: '#FFFFFF',
          cardDark: '#1C1C2E',
          border: '#E5E7EB',
          borderDark: '#2D2D4E',
          text: '#111827',
          textDark: '#F9FAFB',
          muted: '#6B7280',
          mutedDark: '#9CA3AF',
          primary: '#1A1A2E',
          accent: '#E67E22',
          success: '#27AE60',
          danger: '#C0392B',
          warning: '#F39C12'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.12)',
        'modal': '0 20px 60px rgba(0,0,0,0.3)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.25s ease-out',
      },
      keyframes: {
        fadeIn:  { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp: { from: { opacity: 0, transform: 'translateY(8px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
      },
    },
  },
  plugins: [],
}
