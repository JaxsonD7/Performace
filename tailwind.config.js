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
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: { xl: '0.875rem', '2xl': '1.125rem' },
      boxShadow: {
        card: '0 1px 2px rgba(11,11,11,0.04), 0 1px 1px rgba(11,11,11,0.03)',
      },
    },
  },
  plugins: [],
};
