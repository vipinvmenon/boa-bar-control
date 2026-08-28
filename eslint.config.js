import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'src/sw.ts'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }]
    }
  },

  /**
   * BAR-154 / ADR-010 — no fixture data inside a screen file.
   *
   * This project's original failure was screens that rendered hardcoded values.
   * They passed a screenshot comparison while never reading the data layer, and
   * two of them were signed off that way. The two-fixture-state gate
   * (`pnpm test:visual`) catches a screen that ignores its data wholesale; it does
   * NOT catch a single literal identifier, because both fixture variants use the
   * same ids. BAR-133 was exactly that: `bar.id === 'bar-3'` in the bars list,
   * which made the list a dead end under live data where every id is a UUID.
   *
   * So this is a narrow, high-signal rule rather than a general ban on literals —
   * an unusable rule gets disabled, and a disabled rule catches nothing. It bans
   * the two literal shapes that are always domain data:
   *
   *   - a location identifier or name  (`bar-3`, `bar_3`, `BAR 3`, `warehouse-1`)
   *   - a docket number                (`D-0184`)
   *   - a product name from the catalogue
   *
   * Where a screen legitimately needs one of these it must come from the
   * repository. `src/data/fixture/design-data.ts` is the only place these literals
   * belong, and it is deliberately outside this rule's file scope.
   */
  {
    files: ['src/screens/**/*.{ts,tsx}', 'src/components/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'Literal[value=/^(?:bar|warehouse|wh|hospitality|lounge)[-_ ]?[0-9]+$/i]',
          message:
            'BAR-154 / ADR-010: a location id or name in a screen file is fixture data. Under live data these are UUIDs, so the literal silently stops matching (BAR-133). Read it from the repository.',
        },
        {
          selector: 'Literal[value=/^D-[0-9]{3,}$/i]',
          message:
            'BAR-154 / ADR-010: a docket number in a screen file is fixture data. Docket numbers are minted server-side by boa_bar_create_docket. Read it from the repository.',
        },
        {
          selector:
            'Literal[value=/kingfisher|corona|bira|budweiser|old monk|signature rare|smirnoff|coca-cola|tonic water|stok draught/i]',
          message:
            'BAR-154 / ADR-010: an SKU name in a screen file is fixture data. It belongs in src/data/fixture/design-data.ts and must reach the screen through the repository.',
        },
      ],
    },
  }
)
