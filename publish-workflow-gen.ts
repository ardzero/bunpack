// workflow generator, check out the guide below for more details
// https://github.com/ardzero/bunpack/blob/main/PUBLISH_GUIDE.md#then-setup-publishing-using-github-workflow-cicd

import * as p from "@clack/prompts";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { execa } from "execa";
import packageJson from "./package.json";
import picocolors from "picocolors";

/** Edit this object, then run `bun run publish-workflow-gen.ts` (or `bun run gen:publish-workflow`). */
const workflowConfig = {
  workflowName: `Publish ${packageJson.name} to npm`,
  watchBranches: ["main"],
  //  Paths that trigger the workflow; 
  watchPaths: [
    "cli.ts",
    "package.json",
    "bun.lock",
    "README.md",
    // workflow file path is auto appended
  ],
  nodeVersion: "24",
  environmentName: "npm",
  // Directory only (no trailing slash required).
  workflowDir: ".github/workflows",
  workflowFilename: "publish-package.yml",
} as const;



//* don't edit anything below unless you know what you are doing
type PackageJsonRecord = Record<string, unknown>;

type ParsedRepoMeta = {
  homepage: string | undefined;
  bugsUrl: string | undefined;
  repoUrl: string | undefined;
};

type RemoteRepoLink = {
  remoteName: string;
  remoteUrl: string;
  homepage: string;
  issuesUrl: string;
  repoUrl: string;
};

function normalizeHomepageUrl(input: string): string {
  return input.trim().replace(/\/+$/, "");
}

/** Reads valid homepage / bugs.url / repository (git) fields; missing or invalid → undefined. */
function parseRepoMetaFromPkg(pkg: PackageJsonRecord): ParsedRepoMeta {
  let homepage: string | undefined;
  const h = pkg["homepage"];
  if (typeof h === "string" && h.trim()) {
    homepage = normalizeHomepageUrl(h);
  }

  let bugsUrl: string | undefined;
  const bugs = pkg["bugs"];
  if (bugs != null && typeof bugs === "object" && !Array.isArray(bugs)) {
    const u = (bugs as Record<string, unknown>)["url"];
    if (typeof u === "string" && u.trim()) bugsUrl = u.trim();
  }

  let repoUrl: string | undefined;
  const repo = pkg["repository"];
  if (repo != null && typeof repo === "object" && !Array.isArray(repo)) {
    const r = repo as Record<string, unknown>;
    if (r["type"] === "git" && typeof r["url"] === "string" && r["url"].trim()) {
      repoUrl = r["url"].trim();
    }
  }

  return { homepage, bugsUrl, repoUrl };
}

function isRepoMetaIncomplete(meta: ParsedRepoMeta): boolean {
  return !meta.homepage || !meta.bugsUrl || !meta.repoUrl;
}

/** `owner/repo` lowercase for comparable GitHub URLs; unknown formats → undefined. */
function githubRepoSlugFromUrl(url: string): string | undefined {
  const trimmed = url.trim();
  const withoutGitPlus = trimmed.startsWith("git+") ? trimmed.slice(4) : trimmed;

  const patterns = [
    /^https?:\/\/github\.com\/([^/]+)\/([^/?#]+)/i,
    /^git@github\.com:([^/]+)\/([^/]+)$/i,
    /^ssh:\/\/git@github\.com\/([^/]+)\/([^/]+)$/i,
  ];

  for (const re of patterns) {
    const m = withoutGitPlus.match(re);
    if (!m?.[1] || !m[2]) continue;
    const repo = m[2].replace(/\.git$/i, "");
    return `${m[1]}/${repo}`.toLowerCase();
  }

  return undefined;
}

/** Raw npm `repository` URL string (object.url or top-level string shorthand). */
function getRepositoryUrlString(pkg: PackageJsonRecord): string | undefined {
  const repo = pkg["repository"];
  if (typeof repo === "string" && repo.trim()) return repo.trim();
  if (repo != null && typeof repo === "object" && !Array.isArray(repo)) {
    const u = (repo as Record<string, unknown>)["url"];
    if (typeof u === "string" && u.trim()) return u.trim();
  }
  return undefined;
}

/** Resolves GitHub `owner/repo` from repository.url or npm `github:user/repo` shorthand. */
function githubSlugFromRepositoryField(raw: string): string | undefined {
  const s = raw.trim();
  const shorthand = s.match(/^github:([^/]+\/[^/]+)$/i);
  if (shorthand?.[1]) return shorthand[1].toLowerCase();
  return githubRepoSlugFromUrl(s);
}

/** npm `repository.url` form (`git+https://github.com/…`) from user input or shorthand. */
function npmGithubRepositoryUrl(input: string): string | undefined {
  const raw = input.trim();
  const shorthand = raw.match(/^github:([^/]+\/[^/]+)$/i);
  const httpsBase = shorthand?.[1]
    ? `https://github.com/${shorthand[1]}`
    : (() => {
        const stripped = raw.startsWith("git+") ? raw.slice(4) : raw;
        const slug = githubRepoSlugFromUrl(stripped);
        return slug ? `https://github.com/${slug}` : undefined;
      })();
  if (!httpsBase) return undefined;
  return defaultGitUrlFromHomepage(normalizeHomepageUrl(httpsBase));
}

const REMOTE_OPTION_PREFIX = "remote:";

/**
 * GitHub Actions workflow assumes GitHub; offer to align `repository` when it isn’t GitHub.
 * Safe when `.git` is missing or `git` fails — remotes list is empty and flow continues.
 */
async function ensureGithubRepositoryForWorkflow(): Promise<void> {
  const pkgPath = path.join(process.cwd(), "package.json");
  let pkg: PackageJsonRecord;
  try {
    pkg = JSON.parse(await readFile(pkgPath, "utf8")) as PackageJsonRecord;
  } catch {
    return;
  }

  const repoRef = getRepositoryUrlString(pkg);
  if (!repoRef || githubSlugFromRepositoryField(repoRef)) return;

  const remoteLinks = await getGitRemoteRepoLinks();

  if (!process.stdin.isTTY) {
    const hint =
      remoteLinks.length > 0
        ? ` GitHub remotes: ${remoteLinks.map((l) => `${l.remoteName}→${l.repoUrl}`).join("; ")}.`
        : " No GitHub git remote detected.";
    console.warn(
      picocolors.yellow(
        `package.json repository is not GitHub — this script writes a GitHub Actions workflow.${hint} Set repository.url or run interactively.`,
      ),
    );
    return;
  }

  p.intro(picocolors.dim("GitHub Actions workflow — repository field"));

  const keepValue = "__keep__";
  const manualValue = "__manual__";

  const options = [
    ...remoteLinks.map((link, i) => ({
      value: `${REMOTE_OPTION_PREFIX}${i}`,
      label: link.repoUrl,
      hint: link.remoteName,
    })),
    { value: manualValue, label: "Enter GitHub repository URL manually" },
    { value: keepValue, label: "Leave package.json unchanged" },
  ];

  const choice = await p.select({
    message:
      "package.json repository is not GitHub (this workflow targets GitHub). Replace repository.url?",
    options,
    initialValue:
      remoteLinks.length > 0 ? `${REMOTE_OPTION_PREFIX}0` : manualValue,
  });

  if (p.isCancel(choice)) return;

  const pick = choice as string;

  if (pick === keepValue) return;

  let newRepoUrl: string | undefined;

  if (pick.startsWith(REMOTE_OPTION_PREFIX)) {
    const idx = Number(pick.slice(REMOTE_OPTION_PREFIX.length));
    newRepoUrl = remoteLinks[idx]?.repoUrl;
  }

  if (pick === manualValue) {
    const ans = await p.text({
      message: "GitHub repository URL",
      placeholder: "https://github.com/org/repo or github:org/repo",
      validate: (v) => {
        if (!v?.trim()) return "Required";
        if (!npmGithubRepositoryUrl(v)) return "Use a GitHub HTTPS / git URL or github:org/repo";
      },
    });
    if (p.isCancel(ans)) return;
    newRepoUrl = npmGithubRepositoryUrl(ans as string);
  }

  if (!newRepoUrl) return;

  const meta = parseRepoMetaFromPkg(pkg);
  const slug = githubRepoSlugFromUrl(newRepoUrl.replace(/^git\+/, ""));
  const inferredHomepage = slug ? `https://github.com/${slug}` : "";
  const homepage = meta.homepage ?? inferredHomepage;
  if (!homepage) {
    p.log.warn("Cannot infer homepage — skipping package.json repository update.");
    return;
  }
  const bugsPayload = { url: meta.bugsUrl ?? `${homepage}/issues` };

  const nextPkg = mergePkgWithRepoMetaPreservingOrder(pkg, homepage, bugsPayload, {
    type: "git",
    url: newRepoUrl,
  });

  await writeFile(pkgPath, `${JSON.stringify(nextPkg, null, 2)}\n`, "utf8");
  p.outro(picocolors.green("Updated package.json repository.url for GitHub."));
}

/** Only compares `repository.url` to remotes; homepage / bugs may differ intentionally. */
function repositoryMatchesRemote(repoUrl: string | undefined, remoteLinks: RemoteRepoLink[]): boolean {
  if (remoteLinks.length === 0) return true;
  if (!repoUrl?.trim()) return false;

  const pkgSlug = githubRepoSlugFromUrl(repoUrl);
  if (!pkgSlug) return true;

  const comparableSlugs = remoteLinks
    .map((link) => githubRepoSlugFromUrl(link.remoteUrl) ?? githubRepoSlugFromUrl(link.repoUrl))
    .filter((s): s is string => s != null);

  if (comparableSlugs.length === 0) return true;

  return comparableSlugs.some((slug) => slug === pkgSlug);
}

function buildRepositoryMismatchNote(meta: ParsedRepoMeta, remoteLinks: RemoteRepoLink[]): string {
  const pkgRepo = meta.repoUrl ?? "(missing)";
  const remoteLines = remoteLinks.map((link) => `${link.remoteName}: ${link.remoteUrl}`).join("\n\n");

  return `${picocolors.bold("package.json")}\nrepository.url: ${pkgRepo}\n\n${picocolors.bold("git remotes")}\n${remoteLines}`;
}

/** npm-style `repository.url` from a normal https homepage. */
function defaultGitUrlFromHomepage(homepageNorm: string): string {
  if (homepageNorm.startsWith("git+")) {
    return homepageNorm.endsWith(".git") ? homepageNorm : `${homepageNorm}.git`;
  }
  return `git+${homepageNorm}.git`;
}

function uniqueByValue<T extends { value: string }>(options: T[]): T[] {
  const seen = new Set<string>();
  return options.filter((option) => {
    if (seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
}

function repoLinkFromRemote(remoteName: string, remoteUrl: string): RemoteRepoLink | undefined {
  const url = remoteUrl.trim();
  const match =
    url.match(/^git@github\.com:([^/]+)\/(.+?)(?:\.git)?$/) ??
    url.match(/^ssh:\/\/git@github\.com\/([^/]+)\/(.+?)(?:\.git)?$/) ??
    url.match(/^https:\/\/github\.com\/([^/]+)\/(.+?)(?:\.git)?$/);

  if (!match) return;

  const [, owner, repo] = match;
  if (!owner || !repo) return;

  const homepage = `https://github.com/${owner}/${repo}`;
  return {
    remoteName,
    remoteUrl: url,
    homepage,
    issuesUrl: `${homepage}/issues`,
    repoUrl: defaultGitUrlFromHomepage(homepage),
  };
}

async function getGitRemoteRepoLinks(): Promise<RemoteRepoLink[]> {
  try {
    const result = await execa("git", ["remote", "-v"], {
      cwd: process.cwd(),
      reject: false,
    });
    if (result.failed || typeof result.stdout !== "string") return [];
    const { stdout } = result;
    const links = stdout
      .split("\n")
      .map((line) => {
        const match = line.match(/^(\S+)\s+(\S+)\s+\((fetch|push)\)$/);
        const [, remoteName, remoteUrl, direction] = match ?? [];
        if (!remoteName || !remoteUrl || direction !== "fetch") return;
        return repoLinkFromRemote(remoteName, remoteUrl);
      })
      .filter((link): link is RemoteRepoLink => link != null);

    return uniqueByValue(links.map((link) => ({ ...link, value: link.homepage }))).map(
      ({ value, ...link }) => link,
    );
  } catch {
    return [];
  }
}

function cancelPkgUpdate(): never {
  p.cancel("Skipped updating package.json.");
  process.exit(0);
}

async function chooseOrEnterUrl({
  message,
  suggestions,
  manualPlaceholder,
}: {
  message: string;
  suggestions: { value: string; label: string; hint?: string }[];
  manualPlaceholder: string;
}): Promise<string> {
  const manualValue = "__manual__";
  const options = [
    ...uniqueByValue(suggestions),
    { value: manualValue, label: "Enter manually" },
  ];

  const choice =
    options.length === 1
      ? manualValue
      : await p.select({
        message,
        options,
        initialValue: options[0]?.value,
      });

  if (p.isCancel(choice)) cancelPkgUpdate();
  if (choice !== manualValue) return choice as string;

  const answer = await p.text({
    message,
    placeholder: manualPlaceholder,
    validate: (v) => (!v?.trim() ? "Required" : undefined),
  });
  if (p.isCancel(answer)) cancelPkgUpdate();
  return (answer as string).trim();
}

const REPO_META_KEYS = ["homepage", "bugs", "repository"] as const;

/** Keeps original `package.json` key order; inserts links right after `keywords` (template-style). */
function mergePkgWithRepoMetaPreservingOrder(
  original: PackageJsonRecord,
  homepage: string,
  bugs: { url: string },
  repository: { type: "git"; url: string },
): PackageJsonRecord {
  const metaKeySet = new Set<string>(REPO_META_KEYS);
  const orderedKeys: string[] = [];

  for (const key of Object.keys(original)) {
    if (metaKeySet.has(key)) continue;
    orderedKeys.push(key);
    if (key === "keywords") {
      orderedKeys.push(...REPO_META_KEYS);
    }
  }

  if (!orderedKeys.includes("homepage")) {
    const kw = orderedKeys.indexOf("keywords");
    if (kw >= 0) {
      orderedKeys.splice(kw + 1, 0, ...REPO_META_KEYS);
    } else {
      const desc = orderedKeys.indexOf("description");
      if (desc >= 0) {
        orderedKeys.splice(desc + 1, 0, ...REPO_META_KEYS);
      } else {
        orderedKeys.push(...REPO_META_KEYS);
      }
    }
  }

  const next: PackageJsonRecord = {};
  for (const key of orderedKeys) {
    if (key === "homepage") next[key] = homepage;
    else if (key === "bugs") next[key] = bugs;
    else if (key === "repository") next[key] = repository;
    else next[key] = original[key];
  }
  return next;
}

async function ensurePkgRepoMetaFromDisk(): Promise<void> {
  const pkgPath = path.join(process.cwd(), "package.json");
  const raw = await readFile(pkgPath, "utf8");
  const pkg = JSON.parse(raw) as PackageJsonRecord;

  const parsed = parseRepoMetaFromPkg(pkg);
  const remoteLinks = await getGitRemoteRepoLinks();
  const isIncomplete = isRepoMetaIncomplete(parsed);
  const repoMatchesRemote = repositoryMatchesRemote(parsed.repoUrl, remoteLinks);

  if (!isIncomplete && repoMatchesRemote) return;

  if (!process.stdin.isTTY) {
    if (isIncomplete) {
      console.error(
        picocolors.red(
          "package.json must include homepage, bugs.url, and repository ({ type: \"git\", url }). Run this script in an interactive terminal or add those fields manually.",
        ),
      );
      process.exit(1);
    }

    if (!repoMatchesRemote) {
      console.warn(
        picocolors.yellow(
          "package.json repository.url does not match the detected git remote. Keeping package.json in non-interactive mode.",
        ),
      );
    }
    return;
  }

  let rewriteRepoOnly = false;
  if (!isIncomplete && !repoMatchesRemote) {
    p.intro(picocolors.dim("package.json — verify repository URL"));
    p.note(buildRepositoryMismatchNote(parsed, remoteLinks), "repository.url vs git remote");
    const keepExisting = await p.confirm({
      message:
        "package.json repository.url does not match the detected git remote. Keep package.json as-is?",
      initialValue: true,
    });
    if (p.isCancel(keepExisting)) cancelPkgUpdate();
    if (keepExisting) return;
    rewriteRepoOnly = true;
  }

  p.intro(
    picocolors.dim(
      rewriteRepoOnly
        ? "package.json — update repository URL"
        : "package.json — fill missing npm registry links",
    ),
  );

  let homepage = rewriteRepoOnly || isIncomplete ? parsed.homepage : undefined;
  if (!homepage) {
    homepage = normalizeHomepageUrl(
      await chooseOrEnterUrl({
        message: "Homepage URL",
        suggestions: [
          ...remoteLinks.map((link) => ({
            value: link.homepage,
            label: link.homepage,
            hint: link.remoteName,
          })),
          ...(parsed.homepage
            ? [{ value: parsed.homepage, label: parsed.homepage, hint: "from package.json" }]
            : []),
        ],
        manualPlaceholder: "https://github.com/you/your-repo",
      }),
    );
  }

  let bugsUrl = rewriteRepoOnly || isIncomplete ? parsed.bugsUrl : undefined;
  if (!bugsUrl) {
    bugsUrl = await chooseOrEnterUrl({
      message: "Bug tracker URL",
      suggestions: [
        {
          value: `${homepage}/issues`,
          label: `${homepage}/issues`,
          hint: "from homepage",
        },
        ...remoteLinks.map((link) => ({
          value: link.issuesUrl,
          label: link.issuesUrl,
          hint: link.remoteName,
        })),
        ...(parsed.bugsUrl
          ? [{ value: parsed.bugsUrl, label: parsed.bugsUrl, hint: "from package.json" }]
          : []),
      ],
      manualPlaceholder: `${homepage}/issues`,
    });
  }

  let repoUrl = rewriteRepoOnly ? undefined : isIncomplete ? parsed.repoUrl : undefined;
  if (!repoUrl) {
    const defaultRepoUrl = defaultGitUrlFromHomepage(homepage);
    repoUrl = await chooseOrEnterUrl({
      message: "Repository git URL",
      suggestions: [
        { value: defaultRepoUrl, label: defaultRepoUrl, hint: "from homepage" },
        ...remoteLinks.map((link) => ({
          value: link.repoUrl,
          label: link.repoUrl,
          hint: link.remoteName,
        })),
        ...(parsed.repoUrl
          ? [{ value: parsed.repoUrl, label: parsed.repoUrl, hint: "from package.json" }]
          : []),
      ],
      manualPlaceholder: defaultRepoUrl,
    });
  }

  const nextPkg = mergePkgWithRepoMetaPreservingOrder(
    pkg,
    homepage,
    { url: bugsUrl },
    { type: "git", url: repoUrl },
  );

  await writeFile(pkgPath, `${JSON.stringify(nextPkg, null, 2)}\n`, "utf8");
  p.outro(picocolors.green("Updated package.json with npm links."));
}


function posixJoin(...segments: string[]): string {
  return path.posix.join(
    ...segments.map((s) => s.replace(/\\/g, "/").replace(/\/+$/, "")),
  );
}

function yamlFlowScalar(s: string): string {
  return JSON.stringify(s);
}

/** Order: folders → .ts → package.json → bun.lock → .md → anything else (workflow path appended separately). */
function watchPathSortRank(p: string): number {
  const base = path.posix.basename(p);
  if (p.endsWith("/") || p.endsWith("/**")) return 0;
  if (p.endsWith(".ts")) return 1;
  if (base === "package.json") return 2;
  if (base === "bun.lock") return 3;
  if (p.endsWith(".md")) return 4;
  return 5;
}

function compareWatchPaths(a: string, b: string): number {
  const d = watchPathSortRank(a) - watchPathSortRank(b);
  if (d !== 0) return d;
  return a.localeCompare(b);
}

function generateWorkflowYaml(): string {
  const workflowRelativePath = posixJoin(
    workflowConfig.workflowDir,
    workflowConfig.workflowFilename,
  );
  const otherPaths = [
    ...new Set(
      workflowConfig.watchPaths.filter((p) => p !== workflowRelativePath),
    ),
  ].sort(compareWatchPaths);
  const watchPaths = [...otherPaths, workflowRelativePath];

  const branchesYaml = workflowConfig.watchBranches
    .map((b) => `      - ${b}`)
    .join("\n");
  const pathsYaml = watchPaths
    .map((p) => `      - ${yamlFlowScalar(p)}`)
    .join("\n");

  const name = workflowConfig.workflowName;
  const env = workflowConfig.environmentName;
  const node = workflowConfig.nodeVersion;
  const wfFile = workflowConfig.workflowFilename;

  return `name: ${name}

on:
  workflow_dispatch:
  push:
    branches:
${branchesYaml}
    paths:
${pathsYaml}

permissions:
  id-token: write
  contents: read

jobs:
  publish:
    name: Publish package
    runs-on: ubuntu-latest
    environment: ${env}

    steps:
      - name: Checkout repo
        uses: actions/checkout@v4
        with:
          token: \${{ secrets.GITHUB_TOKEN }}

      - name: Setup Bun
        uses: oven-sh/setup-bun@v2

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${yamlFlowScalar(node)}

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
            echo "::notice::Registry already has \${PKG_NAME}@\${PKG_VERSION}. The publish step will be skipped (not an error)."
          else
            echo "already_published=false" >> "$GITHUB_OUTPUT"
          fi

      - name: Publish to npm (Trusted Publisher OIDC)
        id: npm_publish
        if: steps.version_check.outputs.already_published == 'false'
        run: npm publish --provenance

      - name: Publish summary
        if: always() && steps.version_check.outcome == 'success'
        run: |
          NAME="\${{ steps.version_check.outputs.name }}"
          VERSION="\${{ steps.version_check.outputs.version }}"

          if [ "\${{ steps.version_check.outputs.already_published }}" = "true" ]; then
            echo "::notice::Skipped npm publish — $NAME@$VERSION is already published on the registry."
          elif [ "\${{ steps.npm_publish.outcome }}" = "success" ]; then
            echo "::notice::Published $NAME@$VERSION to npm."
          elif [ "\${{ steps.npm_publish.outcome }}" = "failure" ]; then
            echo "::error::npm publish failed for $NAME@$VERSION."
            echo ""
            echo "If this looks like auth / OIDC / Trusted Publisher:"
            echo "  • npm → package → Trusted Publisher: GitHub org/user, repo, workflow filename must match ${wfFile}, environment must match ${env}."
            echo "  • GitHub repo → Settings → Environments: create environment \\"${env}\\" if missing."
            echo "  • This workflow must keep permissions.id-token: write (OIDC)."
            echo ""
            echo "See PUBLISH_GUIDE.md (CI/CD section). Full error output is in the publish step log above."
          elif [ "\${{ steps.npm_publish.outcome }}" = "skipped" ]; then
            echo "::notice::Publish step was skipped (see version check log)."
          fi
`;
}

async function main(): Promise<void> {
  await ensurePkgRepoMetaFromDisk();
  await ensureGithubRepositoryForWorkflow();

  const cwd = process.cwd();
  const outPath = path.join(
    cwd,
    workflowConfig.workflowDir,
    workflowConfig.workflowFilename,
  );
  await mkdir(path.dirname(outPath), { recursive: true });
  const yaml = generateWorkflowYaml();
  await writeFile(outPath, yaml.endsWith("\n") ? yaml : `${yaml}\n`, "utf8");
  console.log(`Created workflow at: ${picocolors.green(path.relative(cwd, outPath))}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
