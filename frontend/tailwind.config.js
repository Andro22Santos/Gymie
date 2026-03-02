module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Base backgrounds
        bg: '#0A0A0A',
        surface: '#111111',
        'surface-hl': '#1A1A1A',
        'surface-elevated': '#1F1F1F',
        
        // Gymie brand - Verde vibrante
        gymie: '#00E04B',
        'gymie-dim': '#00B83A',
        'gymie-glow': '#00E04B30',

        // Legacy tactical (mantido por compatibilidade)
        tactical: '#00E04B',
        'tactical-dim': '#00B83A',
        
        // Semantic colors
        success: '#22C55E',
        'success-dim': '#16A34A',
        danger: '#EF4444',
        'danger-dim': '#DC2626',
        warning: '#F59E0B',
        info: '#3B82F6',
        
        // Text hierarchy
        'txt-primary': '#FAFAFA',
        'txt-secondary': '#A3A3A3',
        'txt-muted': '#525252',
        'txt-disabled': '#404040',
        
        // Borders
        'border-default': '#262626',
        'border-subtle': '#1F1F1F',
        'border-hover': '#404040',
      },
      fontFamily: {
        heading: ['Barlow Condensed', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        data: ['JetBrains Mono', 'monospace'],
        ui: ['Chakra Petch', 'sans-serif'],
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom, 16px)',
      },
      borderRadius: {
        'gymie': '12px',
        'gymie-sm': '8px',
        'gymie-lg': '16px',
      },
    },
  },
  plugins: [],
};
