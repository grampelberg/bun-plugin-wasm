import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{html,ts}'],
  theme: {
    extend: {
      colors: {
        brand: '#15b8a6',
      },
    },
  },
  plugins: [],
}

export default config
