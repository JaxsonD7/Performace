/**
 * Tokens live in src/index.css as RGB channels; this helper wires them up so
 * every color supports Tailwind's alpha modifiers (`bg-brand/10`).
 */
const token = (name) => `rgb(var(${name}) / <alpha-value>)`;

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Surfaces and ink are driven by CSS custom properties so light/dark
        // swap in exactly one place (src/index.css).
        plane: token('--plane'),
        surface: token('--surface-1'),
        raised: token('--surface-2'),
        line: token('--border'),
        grid: token('--gridline'),
        ink: {
          DEFAULT: token('--text-primary'),
          secondary: token('--text-secondary'),
          muted: token('--text-muted'),
        },
        brand: token('--series-1'),
        good: token('--good'),
        warning: token('--warning'),
        serious: token('--serious'),
        critical: token('--critical'),
        // Categorical slots, fixed order — never cycled.
        s1: token('--series-1'),
        s2: token('--series-2'),
        s3: token('--series-3'),
        s4: token('--series-4'),
        s5: token('--series-5'),
        s6: token('--series-6'),
        s7: token('--series-7'),
        s8: token('--series-8'),
      },
      fontFamily: {
        sans: ['Rajdhani', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['"Share Tech Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: { xl: '0.75rem', '2xl': '1rem' },
      boxShadow: {
        // Mirrors the raw box-shadow on `.card` in index.css: a hairline cyan
        // ring plus a soft glow that only shows up once --glow-strength turns
        // on in dark mode.
        card:
          '0 0 0 1px rgb(var(--series-1) / calc(0.05 + var(--glow-strength) * 0.05)), ' +
          '0 0 calc(16px * var(--glow-strength)) rgb(var(--series-1) / calc(var(--glow-strength) * 0.12))',
      },
    },
  },
  plugins: [],
};
