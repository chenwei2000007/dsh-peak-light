# dsh-peak-light

A tiny peak/off-peak pricing indicator for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness):
a 6px dot to the right of the sidebar brand (`deepseek HARNESS`).

| Period | Color | Meaning |
|---|---|---|
| Peak | 🔴 red, slow pulse | Standard price |
| Off-peak | 🟢 green, steady | 50% of peak price |

Hover the dot to see the current period, the countdown to the next switch, and the
billing rule. Clicking the dot does not bubble to the brand button, so it never
opens a new session by accident.

## Pricing rule (effective 2026-09-10 12:00 Beijing time)

| Period | Beijing time |
|---|---|
| Peak | Monday–Friday `09:00–12:00` and `14:00–18:00`, excluding Chinese public holidays |
| Off-peak | Everything else, including weekends and public holidays in full |

Source: [DeepSeek API pricing](https://api-docs.deepseek.com/quick_start/pricing) (checked 2026-10-23).
The older "00:30–08:30 nightly discount" rule is retired.

## Install

```sh
dsh plugin --profile <profile> add dsh-peak-light
```

Or install it from the **Plugins** page / DSH Market. This is a Web-client plugin:
the host half is empty, and the browser half occupies the `sidebar.brand.name` slot
with `priority: -1` (single slots render the lowest priority), re-renders the official
`BrandWordmark`, and appends the dot after the `HARNESS` badge.

If the official wordmark component is missing or the slot registration fails, the
plugin steps aside and leaves the official brand untouched.

## Development

```sh
npm run build     # inline src/policy.js + src/ui.js into lib/client.js
npm test          # policy unit tests + bundle smoke tests
npm run dev:install   # copy into the local DSH desktop profile (not for end users)
```

- `src/policy.js` — peak windows, 2026 holiday calendar, countdown (pure functions).
- `src/ui.js` — React component and slot registration.
- `scripts/build-client.mjs` — builds the self-contained CJS bundle.

Dynamic DSH bundles must register through `window.__ModuleLoader__` (double
underscore). The `_ModuleLoader__` identifier used by built-in bundles is a local
alias in the bootstrap scope; using it in a third-party bundle throws
`ReferenceError` and makes DSH fall back to safe mode.

## Known limits

- The holiday calendar currently ships **2026** only (weekday public holidays).
  Other years fall back to Monday–Friday and say so in the tooltip.
- Slot names are those of DSH `0.2.1-rc.2`; a future slot rename needs a matching
  update in `src/ui.js`.
- Status indicator only: no notifications, no network calls, no credentials.

## License

MIT © 2026 chenwei2000007
