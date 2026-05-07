import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-space-grotesk)', 'system-ui', 'sans-serif'],
      },
      colors: {
        // Page background (RGB for opacity-modifier support: bg-bg/95)
        bg: 'rgb(var(--bg) / <alpha-value>)',
        // Card / surface
        surface: 'var(--surface)',
        // Bottom-sheet surface
        sheet: 'var(--sheet)',
        // Borders — faint → strong
        bdf: 'var(--bdf)',
        bdr: 'var(--bdr)',
        bdh: 'var(--bdh)',
        bds: 'var(--bds)',
        bda: 'var(--bda)',
        // Text levels
        tx:  'var(--tx)',
        t2:  'var(--t2)',
        t3:  'var(--t3)',
        t4:  'var(--t4)',
        t5:  'var(--t5)',
        t6:  'var(--t6)',
        ph:  'var(--ph)',
        // Accent (RGB for opacity-modifier support: bg-ac/5, border-ac/20)
        ac:  'rgb(var(--ac) / <alpha-value>)',
        acf: 'rgb(var(--acf) / <alpha-value>)',
      },
    },
  },
  plugins: [],
}
export default config
