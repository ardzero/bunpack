# Renovate (self-hosted, free)

Dependency updates run through [Renovate](https://docs.renovatebot.com/) inside this repo's own GitHub Actions. Actions minutes are free and unlimited on public repos, so this costs nothing.

| File                             | Purpose                                                       |
| :------------------------------- | :------------------------------------------------------------ |
| `renovate.json`                  | What gets updated, when, grouping, automerge rules             |
| `.github/workflows/renovate.yml` | Runs Renovate every 4 hours (and on demand)                    |
| `.github/workflows/ci.yml`       | `Verify` check (install, typecheck, build, smoke test) that gates automerge |

## Behaviour

- **Schedule:** new PRs only before 06:00 UTC on Mondays. The runner still wakes every 4 hours to automerge and to act on Dependency Dashboard checkboxes.
- **Grouping:** one PR for non-major npm updates, one for non-major GitHub Actions updates, and one for major Actions/Node.js updates. Each major npm update gets its own PR.
- **Automerge:** non-major updates and the weekly lockfile refresh merge automatically, but only after `Verify` passes. Majors always wait for you.
- **Release age:** a version must be 3 days old before Renovate proposes it. Security fixes from OSV skip the wait.
- **Actions** are pinned to commit SHAs with a `# vX.Y.Z` comment. The pins and the Node.js version in `publish-workflow-gen.ts` are updated in the same PR as `.github/workflows`, so regenerating the publish workflow never reverts them.
- **Dependency Dashboard:** an issue titled "Dependency Dashboard" lists everything pending.

Automerged PRs touch `package.json` / `bun.lock`, which starts the publish workflow. It skips publishing because `version` is unchanged, so releases still only happen when you bump the version.

## One-time setup

1. **Create a GitHub App** (free): GitHub → Settings → Developer settings → GitHub Apps → New GitHub App.
   - Name: anything unique, e.g. `ardzero-renovate`. Homepage URL: this repo.
   - Webhook: uncheck **Active**.
   - Repository permissions:

     | Permission        | Access         |
     | :---------------- | :------------- |
     | Checks            | Read and write |
     | Commit statuses   | Read and write |
     | Contents          | Read and write |
     | Issues            | Read and write |
     | Pull requests     | Read and write |
     | Workflows         | Read and write |
     | Administration    | Read-only      |
     | Dependabot alerts | Read-only      |
     | Metadata          | Read-only      |

   - Where can this app be installed: **Only on this account**.
2. On the app page, copy the **Client ID**, then **Generate a private key** (downloads a `.pem`).
3. **Install the app** (app page → Install App) on this repository only.
4. In this repo → Settings → Secrets and variables → Actions:
   - **Variables** tab: `RENOVATE_APP_CLIENT_ID` = the Client ID
   - **Secrets** tab: `RENOVATE_APP_PRIVATE_KEY` = the full contents of the `.pem` file
5. Actions tab → **Renovate** → **Run workflow** to trigger the first run instead of waiting.

A GitHub App is used instead of a personal access token because it doesn't expire, commits show up as the bot (signed), and PRs it opens trigger CI. PRs opened with the default `GITHUB_TOKEN` would not trigger CI.

## Troubleshooting

- Run the workflow manually with log level `debug`.
- To validate config changes locally, run `npx -p renovate renovate-config-validator --strict`.
