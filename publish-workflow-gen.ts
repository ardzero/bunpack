import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
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
