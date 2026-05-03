# Publishing `create-bunpack` to npm

This package is published as `**create-bunpack**`.

`prepublishOnly` in `package.json` runs `bun run build`, so a publish always rebuilds `dist/` before the tarball is created.

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

## 2. One-time: log in to npm

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

## 9. CI / automation (optional)

For GitHub Actions or other CI, use an **Automation** or **Granular access token** from npm (Account → Access Tokens), store it as a secret (e.g. `NPM_TOKEN`), and publish with:

```bash
npm publish --provenance
```

(`--provenance` is optional; it links the package to the build on supported CI.)

Example pattern:

```yaml
- run: npm publish
  env:
    NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

Ensure `.npmrc` in CI contains the registry line npm documents for token auth (often `//registry.npmjs.org/:_authToken=${NODE_AUTH_TOKEN}`).

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

