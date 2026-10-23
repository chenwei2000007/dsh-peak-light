# Release checklist · dsh-ds-peak-light

This file is for publishing. It is **not** part of the npm package (`files` excludes
`release/`).

## Identity

| Item | Value |
|---|---|
| npm package | `dsh-ds-peak-light` (unscoped, unused on npm as of 2026-10-23) |
| GitHub repo | `https://github.com/chenwei2000007/dsh-ds-peak-light` (must be created) |
| Author | `chenwei2000007 <chenwei2000007@gmail.com>` |
| License | MIT |
| Market category | `usage` (Usage & Billing) |

The `repository` field in `package.json` already points at the repo above. It must
exist and be public before `npm publish`, otherwise the npm page and the market
cannot link the package back to the repo.

## 1. Create the GitHub repository

- Public repo named `dsh-ds-peak-light` under `chenwei2000007`, no README initialization.
- Add the topic **`dsh-plugin`** (Settings → Topics).
- The [awesome list](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)
  requires the repo to be **at least 1 day old** before a listing PR is accepted.

## 2. Push the source

The local repository is already initialized, committed on `main` as
`chenwei2000007 <chenwei2000007@gmail.com>`, and the worktree is clean. After the
GitHub repository exists, only add the remote and push:

```powershell
git remote add origin https://github.com/chenwei2000007/dsh-ds-peak-light.git
git push -u origin main
```

`.gitignore` already excludes `node_modules/`, `release/*.tgz` and the npm cache.

## 3. Publish to npm

```powershell
npm login          # browser + OTP if 2FA is enabled
npm publish        # prepack rebuilds lib/client.js
npm view dsh-ds-peak-light version
```

- The package is public and unscoped; `publishConfig.access` is `public`.
- `prepack` runs `node scripts/build-client.mjs`, so `lib/client.js` is always fresh.
- Never commit `.npmrc` or a token.

## 4. Submit to the plugin market

The market reads the curated list from
[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin);
there is no upload endpoint.

1. Fork `awesome-dsh-plugin/awesome-dsh-plugin`.
2. Copy `release/awesome-entry.yml` to
   `data/plugins/chenwei2000007__dsh-ds-peak-light.yml` (one file, nothing else).
3. Commit, push, open a PR.

CI checks, in order: at most 3 entries per PR, `dsh.bundle` in the target repo,
repo age ≥ 1 day, then `awesome-lint` and the site build. The YAML is already
written for this plugin; only edit it if the description stops being accurate.

Notes:

- Listing is a best-effort review, not a security audit.
- There is an existing similar plugin, `hojas/dsh-price-tip` (a richer price bar at
  the sidebar footer). This plugin is a minimal brand-row dot, but a maintainer may
  still treat the two as duplicates. That is a review decision, not a publish error.
- npm is optional for listing but recommended: prebuilt installs skip the build
  approval step and the market can show downloads.
- Optional storefront assets: add `screenshots.json` + GitHub-hosted PNGs in the
  repo. Not prepared yet.

## 5. After listing

- The site and market rebuild daily; a merged entry usually appears within a day.
- Release flow: bump `version` in `package.json`, rebuild, commit, tag,
  `npm publish`, then create a GitHub release.
- Do not hand-edit the generated READMEs in the awesome list; edit the YAML entry.

## Local package check

```powershell
npm pack --pack-destination release
tar -tzf release/dsh-ds-peak-light-0.1.0.tgz
```

Expected contents: `package.json`, `cordis.patch.yml`, `icon.svg`, `README*.md`,
`LICENSE`, `lib/index.js`, `lib/client.js`. No `src/`, `test/`, `scripts/` or
`release/`.
