# Renovate

Dependency updates come from [Renovate](https://docs.renovatebot.com/) running as the **Sora** GitHub App. The runner, its credentials and the shared update policy all live in [`ardzero/sora-renovate`](https://github.com/ardzero/sora-renovate). This repo only holds its own config.

| File                       | Purpose                                                                     |
| :------------------------- | :-------------------------------------------------------------------------- |
| `renovate.json`            | Extends the shared weekly preset, plus the publish workflow generator rules |
| `.github/workflows/ci.yml` | `Verify` check (install, typecheck, build, smoke test) that gates automerge |

## Behaviour

From the shared `github>ardzero/sora-renovate:weekly` preset (details in that repo's README):

- New PRs only open on Mondays (UTC); the whole day counts. The runner is scheduled hourly, but GitHub currently starts scheduled runs hours late, so automerges and Dependency Dashboard checkboxes can take a while. To act now, run the Renovate workflow in `ardzero/sora-renovate` by hand.
- One PR for non-major npm updates and one for GitHub Actions, both automerged once `Verify` passes. Each major npm update gets its own PR; major GitHub Actions and workflow Node.js updates share one PR. Majors always wait for you.
- Releases must be 3 days old; security fixes from OSV skip the wait. Actions are pinned to commit SHAs with a `# vX.Y.Z` comment.
- Workflow `node-version` only moves between even (LTS) majors. `engines.node` is never changed.

bunpack's own rules: the action pins and `nodeVersion` in `publish-workflow-gen.ts` are updated in the same PR as `.github/workflows`, so regenerating the publish workflow never reverts them.

Automerged PRs touch `package.json` / `bun.lock`, which starts the publish workflow. It skips publishing because `version` is unchanged, so releases still only happen when you bump the version.

To get a PR before Monday, tick its checkbox in the "Dependency Dashboard" issue. To validate config changes locally, run `bunx --package renovate renovate-config-validator --strict`.
