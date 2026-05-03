# Publishing `create-bunpack` to npm

This package is published as `create-bunpack`.

> when a package is published with `create-` prefix user can use it like `bun create [suffix]`

`prepublishOnly` in `package.json` runs `bun run build`, so a publish always rebuilds `dist/` before the tarball is created.

# Publishing Locally (recommended for first deployment)

---

## 1. Prerequisites

- **npm account**: [https://www.npmjs.com/signup](https://www.npmjs.com/signup)
- **Bun** (for the build script): [https://bun.sh](https://bun.sh) — install and ensure `bun` is on your `PATH`
- **npm CLI** (ships with Node.js): used for `npm login`, `npm publish`, `npm pack`

Check:

```bash
node -v #should look like v25.x.x
npm -v #should look like 11.x.x
bun -v #should look like 1.x.x
```

---

## 2. Log in to npm

```bash
npm login
```

Follow the prompts (username, password, email, and OTP if 2FA is enabled). Confirm:

```bash
npm whoami
```

---

## 3. Check that the package name is free

The published name is the `"name"` field in `package.json` (`create-bunpack`). See if it is already taken:

```bash
npm view create-bunpack 2>&1
```

- If it prints metadata, the name is taken — change `"name"` in `package.json` (and update this guide / README references), or use a [scoped name](https://docs.npmjs.com/cli/v10/using-npm/scope) like `@yourscope/create-bunpack`.

---

## 4. Build and inspect the tarball (recommended)

From the repo root:

```bash
bun run build
npm pack --dry-run
```

`npm pack --dry-run` lists exactly what would be published (controlled by the `"files"` field: `dist`, `README.md`, plus always-included `package.json`).

To create a local `.tgz` for manual inspection:

```bash
npm pack
```

---

## 5. Version bump

Do not reuse a published version. Bump before each release:

```bash
# patch: 0.0.1 -> 0.0.2
npm version patch

# minor: 0.0.2 -> 0.1.0
npm version minor

# major: 0.1.0 -> 1.0.0
npm version major
```

That updates `package.json`, creates a git commit, and a tag (if the repo is a git worktree with a clean state). To bump **without** git commit/tag:

```bash
npm version patch --no-git-tag-version
```

Then commit and tag yourself if you want that in history.

---

## 6. Publish

From the repo root (with a clean `dist/` or rely on `prepublishOnly`):

```bash
npm publish
```

### 2FA (OTP)

If your npm account uses 2FA for **writes**:

```bash
npm publish --otp=123456
```

Replace `123456` with the current code from your authenticator app.

### Scoped packages (`@scope/name`)

If you ever rename to a scope, the first publish is usually:

```bash
npm publish --access public
```

Unscoped packages like `create-bunpack` do **not** need `--access public`.

---

## 7. Verify after publish

Wait a few seconds, then:

```bash
npm view create-bunpack version
npx create-bunpack@latest --help
```

---

## 8. Useful npm commands

| Goal                                                 | Command                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| See what would ship                                  | `npm pack --dry-run`                                               |
| Deprecate a bad version (keeps installs possible)    | `npm deprecate create-bunpack@0.0.1 "reason"`                      |
| Yank latest tag only (discouraged; prefer deprecate) | Read [unpublish policy](https://docs.npmjs.com/policies/unpublish) |

Avoid `npm unpublish` except in narrow cases; npm’s policy restricts removing versions others may depend on.

---

## 10. Troubleshooting

| Issue                                 | What to try                                                                  |
| ------------------------------------- | ---------------------------------------------------------------------------- |
| `E403` / “You do not have permission” | Wrong user (`npm whoami`), or name owned by someone else.                    |
| `E409` / version exists               | Bump `version` in `package.json` (`npm version patch`).                      |
| `prepublishOnly` fails                | Run `bun run build` locally and read the error; fix TypeScript/build issues. |
| `ENOENT` on `dist/cli.js`             | Run `bun run build`; confirm `dist/cli.js` exists before publish.            |
| OTP errors                            | `npm publish --otp=...` with a fresh code.                                   |

---

## Quick checklist

1. `npm whoami` → correct account
2. `npm view create-bunpack` → name strategy OK
3. `bun run build` → succeeds
4. `npm pack --dry-run` → expected files only
5. `npm version patch` (or manual version bump)
6. `npm publish` (+ `--otp` if required)
7. `npx create-bunpack@latest --help` → smoke test

---

# Publishing using github workflow CI/CD

Use CI/CD when you want npm releases from `main` without sharing personal npm credentials.
This setup uses **npm Trusted Publisher (OIDC)**, not `NPM_TOKEN`.

---

## 1) Create the GitHub workflow

Create `/.github/workflows/publish-npm.yml` with:

```yaml
name: Publish create-bunpack to npm

on:
  workflow_dispatch:
  push:
    branches:
      - main
    paths:
      - "cli.ts"
      - "package.json"
      - "bun.lock"
      - "README.md"
      - ".github/workflows/publish-npm.yml"

permissions:
  id-token: write
  contents: read

jobs:
  publish:
    name: Publish package
    runs-on: ubuntu-latest
    environment: npm

    steps:
      - name: Checkout repo
        uses: actions/checkout@v4
        with:
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "20"

      - name: Upgrade npm to latest
        run: npm install -g npm@latest

      - name: Install dependencies
        run: bun install

      - name: Check package/version publish status
        id: version_check
        run: |
          PKG_NAME=$(node -p "require('./package.json').name")
          PKG_VERSION=$(node -p "require('./package.json').version")
          echo "name=$PKG_NAME" >> "$GITHUB_OUTPUT"
          echo "version=$PKG_VERSION" >> "$GITHUB_OUTPUT"

          PUBLISHED=$(npm view "$PKG_NAME@$PKG_VERSION" version 2>/dev/null || echo "")
          if [ "$PUBLISHED" = "$PKG_VERSION" ]; then
            echo "already_published=true" >> "$GITHUB_OUTPUT"
          else
            echo "already_published=false" >> "$GITHUB_OUTPUT"
          fi

      - name: Publish to npm (Trusted Publisher OIDC)
        if: steps.version_check.outputs.already_published == 'false'
        run: npm publish --provenance

      - name: Publish summary
        run: |
          if [ "${{ steps.version_check.outputs.already_published }}" = "true" ]; then
            echo "Skipping publish: ${{ steps.version_check.outputs.name }}@${{ steps.version_check.outputs.version }} already exists on npm."
          else
            echo "Published: ${{ steps.version_check.outputs.name }}@${{ steps.version_check.outputs.version }}"
          fi
```

---

## 2) Configure npm Trusted Publisher (UI fields from your screenshot)

In npm package settings, open **Trusted Publisher** and use:

- **Publisher**: `GitHub Actions`
- **Organization or user**: `ardzero` (or your actual repo owner if changed)
- **Repository**: `bunpack` (or your actual repo name if changed)
- **Workflow filename**: `publish-npm.yml` (filename only, not full path)
- **Environment name**: `npm` (must match `environment: npm` on the job)

Then click **Set up connection**.

Create a GitHub **Environment** named `npm` under repo **Settings → Environments** if it does not exist yet (required reviewers / branch rules are optional).

---

## 3) First CI publish flow

1. Ensure `package.json` version is new (not published already).
2. Push commit to `main` (or manually trigger `workflow_dispatch` in Actions tab).
3. Workflow checks npm registry and runs `npm publish` only if that version is not already on the registry. The tarball is built during publish via `prepublishOnly` (`bun run build`) — same pattern as a reference workflow that goes straight to `npm publish` after `bun install`.
4. Verify with:

```bash
npm view create-bunpack version
npx create-bunpack@latest --help
```

---

## 4) Versioning policy for CI

- CI publish is **version-driven**. If `package.json` version already exists on npm, publish is skipped.
- Always bump version before merge to `main`:

```bash
npm version patch --no-git-tag-version
git add package.json bun.lock
git commit -m "release: bump create-bunpack to x.y.z"
git push
```

---

## 5) Common pitfalls / caveats / warnings (important)

- `id-token: write` is mandatory. Without it, Trusted Publisher auth fails.
- Trusted Publisher metadata must match exactly (owner/repo/workflow filename and environment if used).
- `workflow filename` in npm is only the file name (`publish-npm.yml`), not `.github/workflows/publish-npm.yml`.
- If repo ownership changes (transfer/fork/rename), you must update Trusted Publisher config in npm.
- Keep `prepublishOnly` intact (`bun run build`), otherwise CI may publish stale or missing `dist/`.
- `npm publish --provenance` needs GitHub-hosted runners + OIDC; avoid replacing with self-hosted until you validate provenance flow.
- Avoid path filters that are too narrow; if `package.json` changes are excluded, release won’t trigger.
- `contents: write` is not needed here (reference used it because a later step `git push`’d wrapper changes). This repo workflow only needs `contents: read` unless you add commit/push steps.
- CI skips already-published versions by design; that is a safety feature, not a failure.

---

## CI/CD Troubleshooting

| Issue                                               | What to try                                                                                                              |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `403 Forbidden` during CI publish                   | Check Trusted Publisher mapping in npm package settings (owner/repo/workflow/env must match exactly).                    |
| `No OIDC token` / auth failures                     | Ensure workflow `permissions` has `id-token: write`.                                                                     |
| Workflow runs but publish step skipped              | Version already exists on npm (`npm view create-bunpack@<version> version`). Bump version and rerun.                     |
| Workflow never triggered on push                    | Validate `push.branches` and `push.paths` filters include changed files.                                                 |
| `npm ERR! code E404` for package/version check      | For unpublished versions this is expected; script handles it and continues.                                              |
| `bun install` fails in CI                           | Fix lockfile / `package.json` mismatch locally, run `bun install`, commit `bun.lock` if it changed, push.                 |
| Trusted Publisher rejects the run                   | GitHub environment name, workflow file name, repo owner/name must match npm Trusted Publisher fields exactly (`npm` env here). |
| Package publishes but command fails right away      | Registry propagation delay; retry smoke test after 30-120 seconds.                                                       |

---

## CI/CD Quick checklist

1. `.github/workflows/publish-npm.yml` exists and is committed.
2. npm Trusted Publisher is configured for `ardzero` / `bunpack` / `publish-npm.yml` with environment `npm`, and GitHub has an environment named `npm`.
3. Workflow has `permissions.id-token: write`.
4. `package.json` version is bumped to an unpublished version.
5. Commit pushed to `main` (or manual dispatch run triggered).
6. Actions run shows publish step executed (not skipped).
7. `npm view create-bunpack version` + `npx create-bunpack@latest --help` pass.
