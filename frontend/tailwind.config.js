module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: '#050505',
        surface: '#0A0A0A',
        'surface-hl': '#121212',
        tactical: '#D4FF00',
        'tactical-dim': '#A3CC00',
        danger: '#FF3B30',
        info: '#00F0FF',
        'txt-primary': '#F5F5F5',
        'txt-secondary': '#A1A1AA',
        'txt-muted': '#52525B',
        'border-default': '#27272A',
      },
      fontFamily: {
        heading: ['Barlow Condensed', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        data: ['JetBrains Mono', 'monospace'],
        ui: ['Chakra Petch', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
